/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { Label } from '~/types';
import { CardLabels } from '~/app/components/board/ui/CardLabels';
import { useBoard } from '~/services/board-context';
import { act } from 'react-dom/test-utils';

// Mock the board context hooks
const mockAddLabel = vi.fn();
const mockRemoveLabel = vi.fn();

vi.mock('~/services/board-context', () => ({
  useBoard: () => ({
    addLabel: mockAddLabel,
    removeLabel: mockRemoveLabel,
  }),
}));

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
    render(<CardLabels cardId="card1" labels={[]} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button'));
    });
    await act(async () => {
      await screen.findByPlaceholderText('Label name');
      fireEvent.change(screen.getByPlaceholderText('Label name'), { target: { value: 'Test' } });
      fireEvent.change(screen.getByDisplayValue('#000000'), { target: { value: '#123456' } });
      fireEvent.click(screen.getByText('Add'));
    });
    expect(mockAddLabel).toHaveBeenCalledWith('card1', 'Test', '#123456');
  });
}); 