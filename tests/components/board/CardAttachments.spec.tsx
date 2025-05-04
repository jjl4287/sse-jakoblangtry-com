// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { act } from 'react-dom/test-utils';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { Attachment } from '~/types';
import { CardAttachments } from '~/app/components/board/ui/CardAttachments';
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
      result = '';
      onload: ((this: FileReader, ev: ProgressEvent<FileReader>) => any) | null = null;
      readAsDataURL() {
        this.result = 'data:application/octet-stream;base64,TEST';
        if (this.onload) this.onload({ target: this } as any);
      }
    }
    // @ts-ignore
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

  it('calls addAttachment for URL', () => {
    render(<CardAttachments cardId="card1" attachments={[]} />);
    const urlInput = screen.getByPlaceholderText('Attachment URL');
    act(() => {
      fireEvent.change(urlInput, { target: { value: 'https://example.com' } });
      fireEvent.click(screen.getByText('Add Link'));
    });
    expect(mockAddAttachment).toHaveBeenCalledWith(
      'card1',
      'example.com',
      'https://example.com',
      'link'
    );
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