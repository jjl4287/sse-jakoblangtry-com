import type { Attachment } from '~/types';
import { attachmentRepository } from '~/lib/repositories/attachment-repository';
import { activityRepository } from '~/lib/repositories/activity-repository';
import { NotFoundError, ValidationError } from '~/lib/errors/domain-errors';

export interface AttachmentService {
  getAttachmentById(attachmentId: string): Promise<Attachment | null>;
  getAttachmentsByCardId(cardId: string): Promise<Attachment[]>;
  createAttachment(cardId: string, data: {
    name: string;
    url: string;
    type: string;
  }, userId?: string): Promise<Attachment>;
  deleteAttachment(attachmentId: string, userId?: string): Promise<void>;
}

export class AttachmentServiceImpl implements AttachmentService {
  private static readonly ALLOWED_FILE_TYPES = [
    // Images
    'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
    // Documents
    'application/pdf', 'text/plain', 'text/markdown',
    'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    // Links
    'link'
  ];

  private static readonly MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

  constructor(
    private attachmentRepo = attachmentRepository,
    private activityRepo = activityRepository
  ) {}

  async getAttachmentById(attachmentId: string): Promise<Attachment | null> {
    return this.attachmentRepo.findById(attachmentId);
  }

  async getAttachmentsByCardId(cardId: string): Promise<Attachment[]> {
    return this.attachmentRepo.findByCardId(cardId);
  }

  async createAttachment(cardId: string, data: {
    name: string;
    url: string;
    type: string;
  }, userId?: string): Promise<Attachment> {
    // Business validation
    this.validateAttachmentData(data);

    const attachment = await this.attachmentRepo.createForCard(cardId, data);

    // Log activity
    if (userId) {
      await this.activityRepo.createActivityLog({
        actionType: 'ADD_ATTACHMENT',
        details: { 
          attachmentId: attachment.id,
          name: attachment.name,
          type: attachment.type
        },
        cardId,
        userId
      });
    }

    return attachment;
  }

  async deleteAttachment(attachmentId: string, userId?: string): Promise<void> {
    const existingAttachment = await this.attachmentRepo.findById(attachmentId);
    if (!existingAttachment) {
      throw new NotFoundError('Attachment', attachmentId);
    }

    // Log activity before deletion
    if (userId) {
      await this.activityRepo.createActivityLog({
        actionType: 'DELETE_ATTACHMENT',
        details: { 
          attachmentId,
          name: existingAttachment.name,
          type: existingAttachment.type
        },
        cardId: this.extractCardIdFromAttachment(existingAttachment),
        userId
      });
    }

    await this.attachmentRepo.delete(attachmentId);
  }

  private validateAttachmentData(data: { name: string; url: string; type: string }): void {
    // Validate name
    if (!data.name || !data.name.trim()) {
      throw new ValidationError('Attachment name cannot be empty');
    }

    if (data.name.length > 255) {
      throw new ValidationError('Attachment name cannot exceed 255 characters');
    }

    // Validate URL
    if (!data.url || !data.url.trim()) {
      throw new ValidationError('Attachment URL cannot be empty');
    }

    try {
      new URL(data.url);
    } catch {
      throw new ValidationError('Invalid URL format');
    }

    // Validate type
    if (!data.type || !data.type.trim()) {
      throw new ValidationError('Attachment type cannot be empty');
    }

    if (!AttachmentServiceImpl.ALLOWED_FILE_TYPES.includes(data.type)) {
      throw new ValidationError(`File type '${data.type}' is not allowed`);
    }

    // Additional validation for links
    if (data.type === 'link') {
      this.validateLinkUrl(data.url);
    }
  }

  private validateLinkUrl(url: string): void {
    const urlObj = new URL(url);
    
    // Basic security: only allow HTTP(S) protocols for external links
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      throw new ValidationError('Links must use HTTP or HTTPS protocol');
    }

    // Prevent localhost/internal network access for security
    const hostname = urlObj.hostname.toLowerCase();
    if (hostname === 'localhost' || 
        hostname.startsWith('127.') || 
        hostname.startsWith('192.168.') ||
        hostname.startsWith('10.') ||
        hostname.includes('internal')) {
      throw new ValidationError('Links to internal/localhost addresses are not allowed');
    }
  }

  private extractCardIdFromAttachment(attachment: Attachment): string {
    // This is a workaround since the Attachment type doesn't include cardId
    // In a real system, you might want to modify the type or repository to include this
    // For now, we'll need to find the card that contains this attachment
    // This could be improved by modifying the repository to return cardId with attachments
    throw new Error('Card ID extraction not implemented - modify repository to include cardId');
  }
}

// Export singleton instance
export const attachmentService: AttachmentService = new AttachmentServiceImpl(); 