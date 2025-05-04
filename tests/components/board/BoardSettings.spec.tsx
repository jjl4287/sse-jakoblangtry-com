// @vitest-environment jsdom
// jest-dom not available; use toBeDefined
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BoardSettings } from '~/app/components/board/ui/BoardSettings';
import { BoardService } from '~/services/board-service';

// Mock next-auth session
vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { id: 'u1' } }, status: 'authenticated' }),
}));

// Mock BoardService methods
vi.mock('~/services/board-service', () => ({
  BoardService: {
    listBoardMembers: vi.fn(),
    listBoardGroups: vi.fn(),
    listGroups: vi.fn(),
    inviteUserToBoard: vi.fn(),
    joinBoard: vi.fn(),
    createGroup: vi.fn(),
    shareBoardWithGroup: vi.fn(),
  },
}));

describe('BoardSettings component', () => {
  const members = [{ id: 'u1', name: 'Alice', email: 'alice@example.com', joinedAt: '2023-01-01' }];
  const groups = [{ id: 'g1', name: 'Team', createdAt: '2023-01-02', updatedAt: '2023-01-03' }];
  const userGroups = [{ id: 'g2', name: 'Org', createdAt: '2023-01-04', updatedAt: '2023-01-05' }];

  beforeEach(() => {
    vi.clearAllMocks();
    (BoardService.listBoardMembers as any).mockResolvedValue(members);
    (BoardService.listBoardGroups as any).mockResolvedValue(groups);
    (BoardService.listGroups as any).mockResolvedValue(userGroups);
    (BoardService.inviteUserToBoard as any).mockResolvedValue({});
    (BoardService.joinBoard as any).mockResolvedValue({});
    (BoardService.createGroup as any).mockResolvedValue({ id: 'g3', name: 'NewGroup' });
    (BoardService.shareBoardWithGroup as any).mockResolvedValue({});
  });

  it('renders members and shared groups when open', async () => {
    render(<BoardSettings boardId="b1" open={true} onClose={() => {}} />);
    await waitFor(() => expect(BoardService.listBoardMembers).toHaveBeenCalledWith('b1'));
    expect(screen.getByText('Alice')).toBeDefined();
    expect(screen.getByText('Team')).toBeDefined();
  });

  it('invites a user on Invite click', async () => {
    render(<BoardSettings boardId="b1" open={true} onClose={() => {}} />);
    await waitFor(() => {});
    fireEvent.change(screen.getByPlaceholderText('Invite by email'), { target: { value: 'bob@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /Invite/ }));
    await waitFor(() => expect(BoardService.inviteUserToBoard).toHaveBeenCalledWith('b1', 'bob@example.com'));
  });

  it('shows Join button if user not a member and calls joinBoard', async () => {
    (BoardService.listBoardMembers as any).mockResolvedValue([]);
    render(<BoardSettings boardId="b1" open={true} onClose={() => {}} />);
    await waitFor(() => {});
    const joinBtn = screen.getByRole('button', { name: /Join Board/ });
    fireEvent.click(joinBtn);
    expect(BoardService.joinBoard).toHaveBeenCalledWith('b1');
  });

  it('creates a new group on Create click', async () => {
    render(<BoardSettings boardId="b1" open={true} onClose={() => {}} />);
    await waitFor(() => {});
    fireEvent.change(screen.getByPlaceholderText('New group name'), { target: { value: 'MyGroup' } });
    fireEvent.click(screen.getByRole('button', { name: /Create/ }));
    expect(BoardService.createGroup).toHaveBeenCalledWith('MyGroup');
  });

  it('shares board with selected group on Share click', async () => {
    render(<BoardSettings boardId="b1" open={true} onClose={() => {}} />);
    await waitFor(() => {});
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'g2' } });
    fireEvent.click(screen.getByRole('button', { name: /Share/ }));
    expect(BoardService.shareBoardWithGroup).toHaveBeenCalledWith('b1', 'g2');
  });

  it('does not render when open=false', () => {
    const { container } = render(<BoardSettings boardId="b1" open={false} onClose={() => {}} />);
    expect(container.firstChild).toBeNull();
  });
}); 