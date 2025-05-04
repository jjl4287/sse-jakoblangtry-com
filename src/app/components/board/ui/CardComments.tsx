import React, { useState } from 'react';
import { useBoard } from '~/services/board-context';
import type { Comment as CommentType } from '~/types';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Textarea } from '~/components/ui/textarea';
import { Trash2 } from 'lucide-react';

export interface CardCommentsProps {
  cardId: string;
  comments: CommentType[];
}

export function CardComments({ cardId, comments }: CardCommentsProps) {
  const { addComment, deleteComment } = useBoard();
  const [author, setAuthor] = useState('');
  const [content, setContent] = useState('');

  const handleAdd = () => {
    if (!content.trim()) return;
    addComment(cardId, author.trim(), content.trim());
    setContent('');
  };

  const handleDelete = (commentId: string) => {
    deleteComment(cardId, commentId);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {comments.map((comment) => (
          <div key={comment.id} className="border border-white/20 rounded-md p-2 bg-white/5">
            <div className="flex justify-between items-center">
              <span className="text-xs font-medium">{comment.author}</span>
              <Button variant="ghost" size="icon" aria-label="Delete comment" className="h-5 w-5 text-gray-400 hover:text-red-400" onClick={() => handleDelete(comment.id)}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
            <p className="text-sm mt-1">{comment.content}</p>
          </div>
        ))}
      </div>
      <div className="space-y-2">
        <Input
          type="text"
          placeholder="Your name"
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          className="rounded-md"
        />
        <Textarea
          placeholder="Write a comment..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="rounded-md"
        />
        <Button onClick={handleAdd} disabled={!content.trim()} size="sm">
          Add Comment
        </Button>
      </div>
    </div>
  );
} 