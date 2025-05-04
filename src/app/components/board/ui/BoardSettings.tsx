import React, { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { X, UserPlus, Users, PlusCircle } from 'lucide-react';
import { BoardService } from '~/services/board-service';
import { Avatar, AvatarFallback } from '~/components/ui/avatar';
import { Input } from '~/components/ui/input';
import { Button } from '~/components/ui/button';

interface BoardSettingsProps {
  boardId: string;
  open: boolean;
  onClose: () => void;
}

interface Member { id: string; name: string; email?: string; joinedAt: string }
interface SharedGroup { id: string; name: string; createdAt: string; updatedAt: string }

export const BoardSettings: React.FC<BoardSettingsProps> = ({ boardId, open, onClose }) => {
  const { data: session } = useSession();
  const [members, setMembers] = useState<Member[]>([]);
  const [groups, setGroups] = useState<SharedGroup[]>([]);
  const [userGroups, setUserGroups] = useState<SharedGroup[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');

  // load data when open
  useEffect(() => {
    if (!open) return;
    void BoardService.listBoardMembers(boardId).then(setMembers).catch(console.error);
    void BoardService.listBoardGroups(boardId).then(setGroups).catch(console.error);
    void BoardService.listGroups().then(setUserGroups).catch(console.error);
  }, [open, boardId]);

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    try {
      await BoardService.inviteUserToBoard(boardId, inviteEmail.trim());
      setInviteEmail('');
      const updated = await BoardService.listBoardMembers(boardId);
      setMembers(updated);
    } catch (e) {
      console.error(e);
    }
  };

  const handleJoin = async () => {
    try {
      await BoardService.joinBoard(boardId);
      const updated = await BoardService.listBoardMembers(boardId);
      setMembers(updated);
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return;
    try {
      const g = await BoardService.createGroup(newGroupName.trim());
      setNewGroupName('');
      const updated = await BoardService.listGroups();
      setUserGroups(updated);
    } catch (e) {
      console.error(e);
    }
  };

  const handleShareGroup = async () => {
    if (!selectedGroupId) return;
    try {
      await BoardService.shareBoardWithGroup(boardId, selectedGroupId);
      const updated = await BoardService.listBoardGroups(boardId);
      setGroups(updated);
    } catch (e) {
      console.error(e);
    }
  };

  if (!open) return null;
  const isMember = session?.user?.id && members.some(m => m.id === session.user.id);

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative ml-auto w-80 h-full bg-white dark:bg-gray-800 p-4 overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Board Settings</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X />
          </Button>
        </div>

        {/* Members */}
        <section className="mb-6">
          <h3 className="flex items-center text-sm font-medium mb-2"><Users className="mr-1 h-4 w-4"/> Members</h3>
          {members.map(m => (
            <div key={m.id} className="flex items-center mb-1">
              <Avatar className="mr-2">
                <AvatarFallback>{m.name.charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="text-sm flex-1 truncate">
                {m.name}{m.email && <span className="text-xs text-gray-500 ml-1 truncate">({m.email})</span>}
              </div>
            </div>
          ))}
          {!isMember && session?.user?.id && (
            <Button size="sm" className="mt-2" onClick={handleJoin}>
              <UserPlus className="h-4 w-4 mr-1"/> Join Board
            </Button>
          )}
          <div className="flex mt-2">
            <Input
              placeholder="Invite by email"
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              className="flex-1 mr-2"
            />
            <Button size="sm" onClick={handleInvite}><UserPlus className="h-4 w-4 mr-1"/> Invite</Button>
          </div>
        </section>

        {/* Shared Groups */}
        <section className="mb-6">
          <h3 className="text-sm font-medium mb-2">Shared with Groups</h3>
          {groups.map(g => (
            <div key={g.id} className="text-sm mb-1 truncate">{g.name}</div>
          ))}
          <div className="flex mt-2">
            <select
              value={selectedGroupId}
              onChange={e => setSelectedGroupId(e.target.value)}
              className="flex-1 mr-2 border rounded px-2 py-1"
            >
              <option value="">Select group</option>
              {userGroups.map(g => (<option key={g.id} value={g.id}>{g.name}</option>))}
            </select>
            <Button size="sm" onClick={handleShareGroup}><PlusCircle className="h-4 w-4 mr-1"/> Share</Button>
          </div>
          <div className="flex mt-2">
            <Input
              placeholder="New group name"
              value={newGroupName}
              onChange={e => setNewGroupName(e.target.value)}
              className="flex-1 mr-2"
            />
            <Button size="sm" onClick={handleCreateGroup}><PlusCircle className="h-4 w-4 mr-1"/> Create</Button>
          </div>
        </section>
      </div>
    </div>
  );
}; 