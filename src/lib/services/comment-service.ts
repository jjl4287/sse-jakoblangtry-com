import type { Comment } from '~/types';
import { commentRepository } from '~/lib/repositories/comment-repository';
import { activityRepository } from '~/lib/repositories/activity-repository';
import { NotFoundError, ValidationError } from '~/lib/errors/domain-errors';

export interface CommentService {
  getCommentById(commentId: string): Promise<Comment | null>;
  getCommentsByCardId(cardId: string): Promise<Comment[]>;
  createComment(cardId: string, userId: string, content: string): Promise<Comment>;
  updateComment(commentId: string, content: string, userId: string): Promise<Comment>;
  deleteComment(commentId: string, userId: string): Promise<void>;
}

export class CommentServiceImpl implements CommentService {
  constructor(
    private commentRepo = commentRepository,
    private activityRepo = activityRepository
  ) {}

  async getCommentById(commentId: string): Promise<Comment | null> {
    return this.commentRepo.findById(commentId);
  }

  async getCommentsByCardId(cardId: string): Promise<Comment[]> {
    return this.commentRepo.findByCardId(cardId);
  }

  async createComment(cardId: string, userId: string, content: string): Promise<Comment> {
    // Business validation
    this.validateCommentContent(content);

    const comment = await this.commentRepo.createForCard(cardId, userId, content);

    // Log activity
    await this.activityRepo.createActivityLog({
      actionType: 'ADD_COMMENT',
      details: { 
        commentId: comment.id,
        preview: this.getCommentPreview(content)
      },
      cardId,
      userId
    });

    return comment;
  }

  async updateComment(commentId: string, content: string, userId: string): Promise<Comment> {
    const existingComment = await this.commentRepo.findById(commentId);
    if (!existingComment) {
      throw new NotFoundError('Comment', commentId);
    }

    // Business validation
    this.validateCommentContent(content);

    // Authorization: Only the comment author can edit their comment
    if (existingComment.userId !== userId) {
      throw new ValidationError('You can only edit your own comments');
    }

    const updatedComment = await this.commentRepo.updateContent(commentId, content);

    // Log activity
    await this.activityRepo.createActivityLog({
      actionType: 'UPDATE_COMMENT',
      details: { 
        commentId,
        oldPreview: this.getCommentPreview(existingComment.content),
        newPreview: this.getCommentPreview(content)
      },
      cardId: updatedComment.cardId,
      userId
    });

    return updatedComment;
  }

  async deleteComment(commentId: string, userId: string): Promise<void> {
    const existingComment = await this.commentRepo.findById(commentId);
    if (!existingComment) {
      throw new NotFoundError('Comment', commentId);
    }

    // Authorization: Only the comment author can delete their comment
    if (existingComment.userId !== userId) {
      throw new ValidationError('You can only delete your own comments');
    }

    // Log activity before deletion
    await this.activityRepo.createActivityLog({
      actionType: 'DELETE_COMMENT',
      details: { 
        commentId,
        preview: this.getCommentPreview(existingComment.content)
      },
      cardId: existingComment.cardId,
      userId
    });

    await this.commentRepo.delete(commentId);
  }

  private validateCommentContent(content: string): void {
    if (!content || !content.trim()) {
      throw new ValidationError('Comment content cannot be empty');
    }

    if (content.length > 10000) {
      throw new ValidationError('Comment content cannot exceed 10,000 characters');
    }
  }

  private getCommentPreview(content: string, maxLength = 100): string {
    if (content.length <= maxLength) {
      return content;
    }
    return content.substring(0, maxLength) + '...';
  }
}

// Export singleton instance
export const commentService: CommentService = new CommentServiceImpl(); 