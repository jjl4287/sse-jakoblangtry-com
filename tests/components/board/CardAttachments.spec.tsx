// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { Attachment } from '~/types';
import { CardAttachments, AttachmentPreview } from '~/app/components/board/ui/CardAttachments';
import { useBoard } from '~/services/board-context';

// Mock the board context hooks
const mockAddAttachment = vi.fn();
const mockDeleteAttachment = vi.fn();
vi.mock('~/services/board-context', () => ({
  useBoard: () => ({
    addAttachment: mockAddAttachment,
    deleteAttachment: mockDeleteAttachment,
  }),
}));

describe('CardAttachments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock FileReader for file attachments
    class MockFileReader {
      result: string | ArrayBuffer | null = '';
      onload: ((this: FileReader, ev: ProgressEvent<FileReader>) => void) | null = null;
      readAsDataURL() {
        this.result = 'data:application/octet-stream;base64,TEST';
        if (this.onload) {
          // @ts-expect-error - Mocking the event target is sufficient for this test
          this.onload({ target: this } as ProgressEvent<FileReader>);
        }
      }
    }
    // @ts-expect-error - Replacing global FileReader with a simplified mock for testing
    global.FileReader = MockFileReader;
  });

  const attachments: Attachment[] = [
    { id: '1', name: 'test', url: 'https://example.com/test.png', type: 'image/png', createdAt: new Date() },
  ];

  it('renders existing attachments', () => {
    render(<CardAttachments cardId="card1" attachments={attachments} />);
    // Name should be visible
    expect(screen.getByText('test')).toBeTruthy();
  });

  it('calls addAttachment for URL', async () => {
    render(<CardAttachments cardId="c1" attachments={[]} />);

    fireEvent.change(screen.getByPlaceholderText('Attachment URL'), { target: { value: 'http://example.com' } });

    // Use act to wrap the asynchronous operation and state update
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Add Link/i }));
    });

    expect(mockAddAttachment).toHaveBeenCalledWith('c1', expect.stringMatching(/example\.com/i), 'http://example.com', 'link');
  });

  it('calls addAttachment for file', async () => {
    render(<CardAttachments cardId="card1" attachments={[]} />);
    const fileInput = screen.getByLabelText('Attachment File');
    const file = new File(['dummy'], 'dummy.txt', { type: 'text/plain' });
    act(() => {
      fireEvent.change(fileInput, { target: { files: [file] } });
      fireEvent.click(screen.getByText('Add File'));
    });
    await waitFor(() => {
      expect(mockAddAttachment).toHaveBeenCalledWith(
        'card1',
        'dummy.txt',
        expect.stringContaining('data:'),
        'text/plain'
      );
    });
  });

  it('calls deleteAttachment when delete button is clicked', () => {
    render(<CardAttachments cardId="card1" attachments={attachments} />);
    const deleteButton = screen.getByLabelText('Delete attachment');
    act(() => {
      fireEvent.click(deleteButton);
    });
    expect(mockDeleteAttachment).toHaveBeenCalledWith('card1', '1');
  });
}); 