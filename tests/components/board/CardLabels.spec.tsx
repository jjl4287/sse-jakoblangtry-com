/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { Label } from '~/types';
import { CardLabels } from '~/app/components/board/ui/CardLabels';
import { useBoard } from '~/services/board-context';
import { userEvent } from '@testing-library/user-event';
import { Card } from '@prisma/client';

// Mock the board context hooks
const mockAddLabel = vi.fn();
const mockRemoveLabel = vi.fn();

vi.mock('~/services/board-context', () => ({
  useBoard: () => ({
    addLabel: mockAddLabel,
    removeLabel: mockRemoveLabel,
  }),
}));

// Mocks
vi.mock('@/services/board');
vi.mock('sonner');

describe('CardLabels', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const labels: Label[] = [
    { id: '1', name: 'Bug', color: '#ff0000' },
    { id: '2', name: 'Feature', color: '#00ff00' },
  ];

  it('renders existing labels', async () => {
    render(<CardLabels cardId="card1" labels={labels} />);
    // Open the popover to reveal labels
    fireEvent.click(screen.getByRole('button'));
    // Wait for popover content (label input) to appear
    await screen.findByPlaceholderText('Label name');
    // Now the existing labels should be visible
    expect(screen.getByText('Bug')).toBeTruthy();
    expect(screen.getByText('Feature')).toBeTruthy();
  });

  it('calls removeLabel when a label badge is clicked', async () => {
    render(<CardLabels cardId="card1" labels={labels} />);
    // Open the popover to reveal labels
    fireEvent.click(screen.getByRole('button'));
    // Wait for the 'Bug' label to appear and then click it
    const bugLabel = await screen.findByText('Bug');
    fireEvent.click(bugLabel);
    expect(mockRemoveLabel).toHaveBeenCalledWith('card1', '1');
  });

  it('opens the popover and adds a new label', async () => {
    const { addLabel } = useBoard();
    render(<CardLabels cardId="c1" labels={[]} />);

    // Open popover using data-testid
    await act(async () => {
      fireEvent.click(screen.getByTestId('add-label-button'));
    });
    
    // Wait for the popover content to appear and find the input
    await waitFor(() => expect(screen.getByPlaceholderText('Label name')).toBeInTheDocument());

    // Add new label
    fireEvent.change(screen.getByPlaceholderText('Label name'), { target: { value: 'New Label' } });
    // Click color picker or set color if needed
    // fireEvent.click(screen.getBy...);

    await act(async () => {
      // Find the "Add" button within the popover content to be more specific
      const popoverContent = screen.getByRole('dialog'); // Popover content often has dialog role
      fireEvent.click(within(popoverContent).getByRole('button', { name: /Add/i }));
    });

    expect(addLabel).toHaveBeenCalledWith('c1', expect.objectContaining({ name: 'New Label' }));
  });
}); 