import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router';
import { useSelector } from 'react-redux';
import api from '../../services/api';
import { getSocket } from '../../services/socket';
import { Loading } from '../../components/ui/Loading';
import { ChatPanel } from '../../components/chat/ChatPanel';
import type { Task } from '../../types';
import type { RootState } from '../../store';

const AVATAR_COLORS = [
  '#7c3aed', '#2563eb', '#059669', '#d97706',
  '#e11d48', '#0891b2', '#4f46e5', '#db2777',
];

function getAvatarColor(idx: number) {
  return AVATAR_COLORS[idx % AVATAR_COLORS.length];
}

function getInitials(name: string) {
  if (!name) return 'U';
  return name.split(' ').filter(Boolean).map((n) => n[0]).join('').toUpperCase() || 'U';
}

interface MemberTasks {
  userId: string;
  name: string;
  email: string;
  tasks: Task[];
}

export function TeamAssignedPage() {
  const { currentUser } = useSelector((state: RootState) => state.user);
  const [memberTasks, setMemberTasks] = useState<MemberTasks[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMember, setSelectedMember] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const userIdParam = searchParams.get('userId');
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    async function loadUnread() {
      try {
        const res = await api.get<{ success: boolean; data: Record<string, number> }>('/messages/unread-counts');
        if (res.data.success) setUnreadCounts(res.data.data);
      } catch { }
    }
    loadUnread();
    const interval = setInterval(loadUnread, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const handleOnlineList = (userIds: string[]) => setOnlineUsers(new Set(userIds));
    const handleUserOnline = (data: { userId: string }) => setOnlineUsers((prev) => new Set(prev).add(data.userId));
    const handleUserOffline = (data: { userId: string }) => {
      setOnlineUsers((prev) => { const next = new Set(prev); next.delete(data.userId); return next; });
    };
    const handleNewMessage = (msg: any) => {
      setUnreadCounts((prev) => ({ ...prev, [msg.senderId]: (prev[msg.senderId] || 0) + 1 }));
    };
    socket.on('users:online-list', handleOnlineList);
    socket.on('user:online', handleUserOnline);
    socket.on('user:offline', handleUserOffline);
    socket.on('message:new', handleNewMessage);
    return () => {
      socket.off('users:online-list', handleOnlineList);
      socket.off('user:online', handleUserOnline);
      socket.off('user:offline', handleUserOffline);
      socket.off('message:new', handleNewMessage);
    };
  }, []);

  const handleMessagesRead = useCallback((senderId: string) => {
    setUnreadCounts((prev) => { const next = { ...prev }; delete next[senderId]; return next; });
  }, []);

  useEffect(() => {
    async function loadTeamTasks() {
      try {
        setLoading(true);
        // Step 1: Get current user orgs to know who is in the team
        const orgRes = await api.get<{ success: boolean; data: any[] }>('/organizations');
        const orgs = orgRes.data.data;
        
        // Step 2: Get all tasks in one go
        const tasksRes = await api.get<{ success: boolean; data: Task[] }>('/tasks/all');
        const allTasks = tasksRes.data.data;

        // Step 3: Map all members from all orgs
        const allUsersMap: Record<string, any> = {};
        for (const org of orgs) {
          try {
            const membersRes = await api.get<{ success: boolean; data: { user: any }[] }>(`/organizations/${org.id}/members`);
            membersRes.data.data.forEach(m => { if (m.user) allUsersMap[m.user.id] = m.user; });
          } catch { }
        }

        // Step 4: Group tasks by member
        const grouped: Record<string, MemberTasks> = {};
        Object.values(allUsersMap).forEach(user => {
          grouped[user.id] = { userId: user.id, name: `${user.firstName} ${user.lastName}`, email: user.email, tasks: [] };
        });

        for (const task of allTasks) {
          task.assignees?.forEach(assignee => { if (grouped[assignee.id]) grouped[assignee.id].tasks.push(task); });
        }

        const members = Object.values(grouped).sort((a, b) => {
          if (a.userId === currentUser?.id) return -1;
          if (b.userId === currentUser?.id) return 1;
          return 0;
        });

        setMemberTasks(members);
        if (members.length > 0) {
          if (userIdParam) setSelectedMember(userIdParam);
          else if (!selectedMember) {
            const firstOther = members.find((m) => m.userId !== currentUser?.id);
            setSelectedMember(firstOther ? firstOther.userId : members[0].userId);
          }
        }
      } catch (err) { 
        console.error('Failed to load team tasks:', err);
      } finally { 
        setLoading(false); 
      }
    }
    loadTeamTasks();
    const socket = getSocket();
    if (socket) {
      socket.on('task:updated', loadTeamTasks);
      return () => { socket.off('task:updated', loadTeamTasks); };
    }
  }, [currentUser?.id, userIdParam]);

  useEffect(() => { if (userIdParam) setSelectedMember(userIdParam); }, [userIdParam]);

  if (loading) return <Loading size="lg" />;

  const totalAllTasks = memberTasks.reduce((sum, m) => sum + m.tasks.length, 0);
  const totalDoneTasks = memberTasks.reduce((sum, m) => sum + m.tasks.filter((t) => t.status === 'COMPLETED').length, 0);
  const totalUnread = Object.values(unreadCounts).reduce((s, c) => s + c, 0);

  const selectedMemberData = selectedMember ? memberTasks.find((m) => m.userId === selectedMember) : null;
  const selectedIdx = selectedMember ? memberTasks.findIndex((m) => m.userId === selectedMember) : -1;

  return (
    <div className="-m-4 sm:-m-6 min-h-full bg-white dark:bg-gray-900 flex" {...{ style: { height: 'calc(100vh - 64px)' } }}>
      {!selectedMember && (
        <div className="flex-1 border-r border-gray-100 dark:border-gray-700 flex flex-col overflow-hidden transition-all">
          <div className="px-5 pt-4 pb-3 border-b border-gray-100 dark:border-gray-700 shrink-0">
            <div className="flex items-center justify-between mb-2"><div className="flex items-center gap-2"><h2 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider">Team Activity</h2>{totalUnread > 0 && <span className="px-1.5 py-0.5 rounded-full bg-indigo-500 text-white text-[10px] font-bold">{totalUnread} new</span>}</div></div>
            <div className="flex items-center gap-4 text-[11px] font-bold text-gray-400"><span>{memberTasks.length} Members</span><span>{totalAllTasks} Tasks</span><span>{totalDoneTasks} Completed</span></div>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 custom-scrollbar">
            {memberTasks.map((member, idx) => (
              <div key={member.userId} className={`group rounded-xl border transition-all ${selectedMember === member.userId ? 'bg-indigo-50/50 dark:bg-indigo-900/10 border-indigo-200 dark:border-indigo-800' : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 hover:border-indigo-100'}`}>
                <div className="p-3 flex items-center gap-3 cursor-pointer" onClick={() => { setSelectedMember(member.userId); setSearchParams({ userId: member.userId }); }}>
                  <div className="relative"><div className="w-9 h-9 rounded-full text-white text-xs font-bold flex items-center justify-center shrink-0 shadow-sm" {...{ style: { backgroundColor: getAvatarColor(idx) } }}>{getInitials(member.name)}</div>{onlineUsers.has(member.userId) && <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-gray-800 bg-green-500" />}</div>
                  <div className="flex-1 min-w-0"><div className="flex items-center justify-between gap-2"><p className="text-sm font-bold text-gray-900 dark:text-white truncate">{member.userId === currentUser?.id ? 'Me (Personal)' : member.name}</p>{unreadCounts[member.userId] > 0 && <span className="w-2 h-2 rounded-full bg-indigo-500" />}</div><p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">{member.tasks.length} tasks</p></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {selectedMember && selectedMemberData && (
        <div className="flex-1 flex flex-col min-w-0 relative bg-white dark:bg-gray-900">
          <ChatPanel
            currentUserId={currentUser?.id || ''}
            targetUser={{
              id: selectedMemberData.userId,
              name: selectedMemberData.name,
              email: selectedMemberData.email,
              colorIdx: selectedIdx
            }}
            onlineUsers={onlineUsers}
            onMessagesRead={handleMessagesRead}
            onBack={() => { setSelectedMember(null); setSearchParams({}); }}
          />
        </div>
      )}
    </div>
  );
}
