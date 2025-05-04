// @vitest-environment jsdom
// jest-dom not available; use toBeDefined
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { BoardSettings } from '~/app/components/board/ui/BoardSettings';
import { BoardService } from '~/services/board-service';
// import { useBoardStore } from '~/stores/board'; // Removed unused import

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
    // useBoardStore.setState({ board: mockBoard, members: [], groups: [], isMember: false }); // Removed store mock
    // Temporarily mock listBoardMembers to return empty for this specific case if needed
    (BoardService.listBoardMembers as any).mockResolvedValueOnce([]); 
    render(<BoardSettings boardId="b1" open={true} onClose={() => {}} />); // Use props as originally intended
    const joinButton = await screen.findByRole('button', { name: /Join Board/i }); // Wait for button
    expect(joinButton).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(joinButton);
    });

    expect(BoardService.joinBoard).toHaveBeenCalledWith('b1'); // Use mocked BoardService
  });

  it('creates a new group on Create click', async () => {
    render(<BoardSettings boardId="b1" open={true} onClose={() => {}} />); 

    await screen.findByText('Alice'); 

    // Correct placeholder text
    fireEvent.change(screen.getByPlaceholderText('New group name'), { target: { value: 'New Test Group' } }); 

    await act(async () => {
      // Use the correct button text "Create"
      fireEvent.click(screen.getByRole('button', { name: /Create/i })); 
    });

    expect(BoardService.createGroup).toHaveBeenCalledWith('New Test Group');
  });

  it('shares board with selected group on Share click', async () => {
    (BoardService.listGroups as any).mockResolvedValueOnce([{ id: 'g1', name: 'Existing Group'}]);

    render(<BoardSettings boardId="b1" open={true} onClose={() => {}} />); 

    await screen.findByText('Alice'); 
    await screen.findByText('Team'); 

    // Target the select element (adjust selector if needed, e.g., add label/testid)
    // Assuming there's only one select element in this part of the form
    const groupSelect = screen.getByRole('combobox'); // Assuming this resolves to the <select> based on context/libraries used, might need refinement
    
    // Change the select value
    await act(async () => {
      // fireEvent.change might need the underlying <select> target, not just the combobox role wrapper
      // Let's try changing the value directly on the element found by role first
      fireEvent.change(groupSelect, { target: { value: 'g1' } }); 
    });

    // Find and click the Share button
    const shareButton = screen.getByRole('button', { name: /Share/i });
    await act(async () => {
      fireEvent.click(shareButton);
    });

    expect(BoardService.shareBoardWithGroup).toHaveBeenCalledWith('b1', 'g1');
  });

  it('does not render when open=false', () => {
    const { container } = render(<BoardSettings boardId="b1" open={false} onClose={() => {}} />);
    expect(container.firstChild).toBeNull();
  });
}); 