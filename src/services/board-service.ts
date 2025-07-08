export const BoardService = {
  async listBoards() {
    const res = await fetch('/api/boards');
    if (!res.ok) {
      throw new Error(`Failed to list boards: ${res.status}`);
    }
    return res.json();
  },

  async createBoard(title: string) {
    const res = await fetch('/api/boards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error ?? `Failed to create board: ${res.status}`);
    }
    return res.json();
  },

  async deleteBoard(boardId: string) {
    const res = await fetch(`/api/boards/${boardId}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error ?? `Failed to delete board: ${res.status}`);
    }
  },

  async getBoard(boardId?: string) {
    if (!boardId) {
      let list;
      try {
        list = await this.listBoards();
      } catch (err: any) {
        throw new Error(`Failed to fetch boards list: ${err.message.split(': ').pop()}`);
      }
      if (!list.length) throw new Error('No boards available');
      boardId = list[0].id;
    }
    const res = await fetch(`/api/boards?boardId=${boardId}`);
    if (!res.ok) {
      throw new Error(`Failed to fetch boards list: ${res.status}`);
    }
    return res.json();
  },
};
