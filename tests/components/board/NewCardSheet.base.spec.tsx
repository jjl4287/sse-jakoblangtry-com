import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { NewCardSheet } from '~/app/components/board/ui/NewCardSheet';
import type { Label as LabelType, Milestone, BoardMemberWithUser } from '~/types';

// --- Copied Mocks and Props ---
const mockOnCreateCard = vi.fn();
const mockOnOpenChange = vi.fn();

const mockBoardMembers: BoardMemberWithUser[] = [
  { id: 'bm1', boardId: 'b1', userId: 'u1', user: { id: 'u1', name: 'Alice', email: 'alice@example.com' } },
  { id: 'bm2', boardId: 'b1', userId: 'u2', user: { id: 'u2', name: 'Bob', email: 'bob@example.com' } },
];

const mockMilestones: Milestone[] = [
  { id: 'm1', title: 'Sprint 1', name: 'Sprint 1' },
  { id: 'm2', title: 'Sprint 2', name: 'Sprint 2' },
];

const mockLabels: LabelType[] = [
  { id: 'l1', name: 'Bug', color: '#d73a4a' },
  { id: 'l2', name: 'Feature', color: '#0e8a16' },
];

const defaultProps = {
  open: true,
  onOpenChange: mockOnOpenChange,
  columnId: 'col1',
  boardMembers: mockBoardMembers,
  milestones: mockMilestones,
  labels: mockLabels,
  onCreateCard: mockOnCreateCard,
};
// --- End Copied Mocks ---

describe('NewCardSheet (Base)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders correctly when open', () => {
    render(<NewCardSheet {...defaultProps} />);
    expect(screen.getByRole('heading', { name: /Create New Card/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter a title for this card...')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter a description for this card...')).toBeInTheDocument();

    // Check for metadata section headers using more specific selectors
    expect(screen.getByText((content, element) => element?.tagName.toLowerCase() === 'label' && /Assignees/i.test(content))).toBeInTheDocument();
    expect(screen.getByText((content, element) => element?.tagName.toLowerCase() === 'label' && /Labels/i.test(content))).toBeInTheDocument();
    expect(screen.getByText((content, element) => element?.tagName.toLowerCase() === 'label' && /Milestone/i.test(content))).toBeInTheDocument();
    expect(screen.getByText((content, element) => element?.tagName.toLowerCase() === 'label' && /Priority/i.test(content))).toBeInTheDocument();
    expect(screen.getByText((content, element) => element?.tagName.toLowerCase() === 'label' && /Due Date/i.test(content))).toBeInTheDocument();
  });

  it('allows entering title and description', () => {
    render(<NewCardSheet {...defaultProps} />);
    const titleInput = screen.getByPlaceholderText('Enter a title for this card...');
    const descTextarea = screen.getByPlaceholderText('Enter a description for this card...');

    act(() => {
      fireEvent.change(titleInput, { target: { value: 'New Card Title' } });
    });
    
    act(() => {
      fireEvent.change(descTextarea, { target: { value: 'Card Description.' } });
    });

    expect(titleInput).toHaveValue('New Card Title');
    expect(descTextarea).toHaveValue('Card Description.');
  });

  it('handles form submission with basic data', async () => {
    render(<NewCardSheet {...defaultProps} />);
    
    // Fill in basic required fields
    const titleInput = screen.getByPlaceholderText('Enter a title for this card...');
    const descTextarea = screen.getByPlaceholderText('Enter a description for this card...');
    
    await act(async () => {
      fireEvent.change(titleInput, { target: { value: 'Test Card' } });
    });
    
    await act(async () => {
      fireEvent.change(descTextarea, { target: { value: 'Test Description' } });
    });
    
    // Submit the form - find the Create button by its text
    const createButton = screen.getByRole('button', { name: /Create/i });
    
    await act(async () => {
      fireEvent.click(createButton);
    });
    
    // Verify onCreateCard was called with at least the title and description
    expect(mockOnCreateCard).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Test Card',
        description: 'Test Description',
        columnId: 'col1',
      })
    );
  });

  it('closes when cancelled', async () => {
    render(<NewCardSheet {...defaultProps} />);
    
    // Find and click the Cancel button
    const cancelButton = screen.getByRole('button', { name: /Cancel/i });
    
    await act(async () => {
      fireEvent.click(cancelButton);
    });
    
    // Verify onOpenChange was called with false
    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });
}); 