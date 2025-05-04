/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { Comment } from '~/types';
import { CardComments } from '~/app/components/board/ui/CardComments';
import { useBoard } from '~/services/board-context';

// Mock the board context hooks
const mockAddComment = vi.fn();
const mockDeleteComment = vi.fn();

vi.mock('~/services/board-context', () => ({
  useBoard: () => ({
    addComment: mockAddComment,
    deleteComment: mockDeleteComment,
  }),
}));

describe('CardComments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const comments: Comment[] = [
    { id: '1', author: 'Alice', content: 'First comment', createdAt: new Date() },
    { id: '2', author: 'Bob', content: 'Second comment', createdAt: new Date() },
  ];

  it('renders existing comments', () => {
    render(<CardComments cardId="card1" comments={comments} />);
    // Authors and content should be rendered
    expect(screen.getByText('Alice')).toBeTruthy();
    expect(screen.getByText('First comment')).toBeTruthy();
    expect(screen.getByText('Bob')).toBeTruthy();
    expect(screen.getByText('Second comment')).toBeTruthy();
  });

  it('calls deleteComment when delete button is clicked', () => {
    render(<CardComments cardId="card1" comments={comments} />);
    const deleteButtons = screen.getAllByLabelText('Delete comment');
    expect(deleteButtons.length).toBe(2);
    fireEvent.click(deleteButtons[0]);
    expect(mockDeleteComment).toHaveBeenCalledWith('card1', '1');
  });

  it('adds a new comment when Add Comment button is clicked', () => {
    render(<CardComments cardId="card1" comments={[]} />);
    // Fill author and content
    fireEvent.change(screen.getByPlaceholderText('Your name'), { target: { value: 'Charlie' } });
    fireEvent.change(screen.getByPlaceholderText('Write a comment...'), { target: { value: 'Nice work!' } });
    // Click add comment
    fireEvent.click(screen.getByText('Add Comment'));
    expect(mockAddComment).toHaveBeenCalledWith('card1', 'Charlie', 'Nice work!');
  });
}); 