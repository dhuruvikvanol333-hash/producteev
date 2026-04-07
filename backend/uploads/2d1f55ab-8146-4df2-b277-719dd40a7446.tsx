import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSearchParams } from 'react-router';
import { ChatPanel } from '../../components/chat/ChatPanel';
import { useAppSelector } from '../../store';
import type { User } from '../../types';
import api from '../../services/api';
import { Loading } from '../../components/ui/Loading';
import { getSocket } from '../../services/socket';
import { useOrgRole } from '../../hooks/useOrgRole';
import { InviteModal } from '../../components/workspace/InviteModal';
import { useToast } from '../../components/ui/Toast';
import SpaceAccessModal from '../../components/modals/SpaceAccessModal';
import type { RootState } from '../../store';

interface Person {
  id: string;
  user: User;
  role: string;
  createdAt: string;
}

interface Invitation {
  id: string;
  email: string;
  role: string;
  token: string;
  createdAt: string;
  expiresAt: string;
  invitedBy: {
    firstName: string;
    lastName: string;
  };
}

const AVATAR_COLORS = [
  '#7c3aed', '#2563eb', '#059669', '#d97706',
  '#e11d48', '#0891b2', '#4f46e5', '#db2777',
];

export function PeoplePage() {
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'members' | 'pending'>('members');
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [members, setMembers] = useState<Person[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isSpaceModalOpen, setIsSpaceModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const userIdParam = searchParams.get('userId');

  const currentOrg = useAppSelector(state => state.organization.currentOrg);
  const { isOwner, isAdmin } = useOrgRole();
  const { success: showSuccess, error: showError } = useToast();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Get all organizations first
      const orgRes = await api.get<{ success: boolean; data: any[] }>('/organizations');
      if (!orgRes?.data?.success) return;
      const orgs = orgRes.data.data || [];

      // 2. Fetch members for all orgs concurrently
      const membersMap = new Map<string, Person>();
      await Promise.all(orgs.map(async (org) => {
        try {
          const res = await api.get<{ success: boolean; data: Person[] }>(`/organizations/${org.id}/members`);
          if (res?.data?.success && Array.isArray(res.data.data)) {
            res.data.data.forEach(m => {
              if (m?.user?.id && !membersMap.has(m.user.id)) {
                membersMap.set(m.user.id, m);
              }
            });
          }
        } catch (err) {
          console.warn(`Failed to fetch members for org ${org.id}:`, err);
        }
      }));

      // 3. Fetch invitations for CURRENT organization only (if admin)
      let invites: Invitation[] = [];
      if (currentOrg && (isAdmin || isOwner)) {
        try {
          const res = await api.get<{ success: boolean; data: Invitation[] }>(`/organizations/${currentOrg.id}/invitations`);
          if (res?.data?.success) invites = res.data.data;
        } catch (err) {
          console.warn('Failed to fetch invitations:', err);
        }
      }

      setInvitations(invites);

      const rolePriority: Record<string, number> = {
        'OWNER': 0, 'ADMIN': 1, 'MEMBER': 2, 'LIMITED_MEMBER': 3, 'GUEST': 4
      };
      const sortedMembers = Array.from(membersMap.values()).sort((a, b) => {
        const priorityA = rolePriority[a.role] ?? 99;
        const priorityB = rolePriority[b.role] ?? 99;
        return priorityA - priorityB;
      });
      setMembers(sortedMembers);

    } catch (err) {
      console.error('Failed to load global people data:', err);
    } finally {
      setLoading(false);
    }
  }, [currentOrg, isAdmin, isOwner]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleOnlineList = (ids: string[]) => setOnlineUsers(new Set(ids));
    const handleOnline = (d: { userId: string }) => setOnlineUsers((p) => new Set(p).add(d.userId));
    const handleOffline = (d: { userId: string }) => {
      setOnlineUsers((p) => { const n = new Set(p); n.delete(d.userId); return n; });
    };

    const handleMemberUpdate = (data: { organizationId: string }) => {
      if (currentOrg && data.organizationId === currentOrg.id) {
        loadData();
      }
    };

    socket.on('users:online-list', handleOnlineList);
    socket.on('user:online', handleOnline);
    socket.on('user:offline', handleOffline);
    socket.on('org:member_added', handleMemberUpdate);
    socket.on('org:member_removed', handleMemberUpdate);
    socket.on('people:updated', handleMemberUpdate);

    return () => {
      socket.off('users:online-list', handleOnlineList);
      socket.off('user:online', handleOnline);
      socket.off('user:offline', handleOffline);
      socket.off('org:member_added', handleMemberUpdate);
      socket.off('org:member_removed', handleMemberUpdate);
      socket.off('people:updated', handleMemberUpdate);
    };
  }, [currentOrg, loadData]);

  const copyInviteLink = (invite: Invitation) => {
    const url = `${window.location.origin}/register?token=${invite.token}`;
    navigator.clipboard.writeText(url);
    setCopiedId(invite.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleRevokeInvite = async (id: string) => {
    if (!window.confirm('Are you sure you want to revoke this invitation?')) return;
    try {
      await api.delete(`/invitations/${id}`);
      setInvitations(prev => prev.filter(inv => inv.id !== id));
      showSuccess('Invitation revoked successfully');
    } catch (err) {
      showError('Failed to revoke invitation');
    }
  };

  const handleUpdateRole = async (userId: string, role: string) => {
    if (!currentOrg) return;
    try {
      await api.patch(`/organizations/${currentOrg.id}/members/${userId}`, { role });
      setMembers(prev => prev.map(m => m.user.id === userId ? { ...m, role } : m));
      showSuccess(`Role updated to ${role}`);
    } catch (err) {
      showError('Failed to update member role');
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!currentOrg) return;
    if (!window.confirm('Are you sure you want to remove this member from the workspace?')) return;
    try {
      await api.delete(`/organizations/${currentOrg.id}/members/${userId}`);
      setMembers(prev => prev.filter(m => m.user.id !== userId));
      showSuccess('Member removed from workspace');
    } catch (err) {
      showError('Failed to remove member');
    }
  };

  const currentUserId = useAppSelector((state: RootState) => state.user.currentUser?.id);
  const activeChatMember = userIdParam ? members.find(m => m.user.id === userIdParam) : null;
  const activeChatIdx = userIdParam ? members.findIndex(m => m.user.id === userIdParam) : -1;

  const filteredMembers = members.filter((m) => {
    if (!m.user) return false;
    const q = search.toLowerCase();
    const fullName = `${m.user.firstName || ''} ${m.user.lastName || ''}`.toLowerCase();
    return fullName.includes(q) || (m.user.email || '').toLowerCase().includes(q);
  });

  const filteredInvites = invitations.filter((inv) => {
    const q = search.toLowerCase();
    return (inv.email || '').toLowerCase().includes(q);
  });

  const onlineCount = members.filter((m) => m.user && onlineUsers.has(m.user.id)).length;

  if (loading && members.length === 0) return <Loading size="lg" />;

  return (
    <div className="-m-4 sm:-m-6 min-h-full bg-white dark:bg-[#0F1116] overflow-hidden" {...{ style: { height: 'calc(100vh - 64px)' } }}>
      {userIdParam && activeChatMember && currentUserId ? (
        <ChatPanel
          currentUserId={currentUserId}
          targetUser={{
            id: activeChatMember.user?.id || '',
            name: activeChatMember.user ? `${activeChatMember.user.firstName || ''} ${activeChatMember.user.lastName || ''}` : 'Unknown User',
            email: activeChatMember.user?.email || '',
            colorIdx: activeChatIdx,
          }}
          onlineUsers={onlineUsers}
          onMessagesRead={() => { }}
          onBack={() => setSearchParams({})}
        />
      ) : (
        <div className="flex flex-col h-full">
          <div className="px-8 pt-8 pb-4 border-b border-gray-100 dark:border-gray-800/50 shrink-0">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">People</h1>
                  {(isOwner || isAdmin) && (
                    <button
                      onClick={() => setIsInviteModalOpen(true)}
                      className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors flex items-center justify-center font-bold"
                      title="Invite Member"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                    </button>
                  )}
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Manage your workspace members and invitations. {onlineCount > 0 && (
                    <span className="ml-2 text-emerald-500 font-medium inline-flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      {onlineCount} online
                    </span>
                  )}
                </p>
              </div>
              <div className="relative w-full md:w-80">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                 <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Filter by name or email..."
                  title="Search members"
                  className="w-full pl-10 pr-4 py-2.5 text-sm bg-gray-50 dark:bg-gray-800/40 border border-transparent focus:border-indigo-500 focus:bg-white dark:focus:bg-gray-800 rounded-xl focus:outline-none transition-all dark:text-white"
                />
              </div>
            </div>
            <div className="flex items-center gap-8 mt-8">
              <button
                onClick={() => setActiveTab('members')}
                className={`relative pb-3 text-sm font-bold transition-colors ${activeTab === 'members' ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400 hover:text-gray-600'}`}
              >
                Active Members ({members.length})
                {activeTab === 'members' && <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 dark:bg-indigo-400 rounded-full" />}
              </button>
              {(isAdmin || isOwner) && (
                <button
                  onClick={() => setActiveTab('pending')}
                  className={`relative pb-3 text-sm font-bold transition-colors ${activeTab === 'pending' ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400 hover:text-gray-600'}`}
                >
                  Pending Invitations ({invitations.length})
                  {activeTab === 'pending' && <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 dark:bg-indigo-400 rounded-full" />}
                </button>
              )}
            </div>
          </div>

          <div className="px-8 py-8 flex-1 overflow-y-auto custom-scrollbar">
            <AnimatePresence mode="wait">
              {activeTab === 'members' ? (
                <motion.div key="members" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {filteredMembers.length === 0 ? (
                    <div className="col-span-full py-20 text-center text-gray-500">No members match your search</div>
                  ) : (
                    filteredMembers.map((member, idx) => {
                      const isOnline = onlineUsers.has(member.user.id);
                      const color = AVATAR_COLORS[idx % AVATAR_COLORS.length];
                      return (
                        <div
                          key={member.id}
                          className="group bg-white dark:bg-gray-800/20 p-5 rounded-2xl border border-gray-100 dark:border-gray-800/50 hover:border-indigo-200 dark:hover:border-indigo-500/30 hover:shadow-xl transition-all"
                        >
                          <div 
                            className="flex items-start gap-4 cursor-pointer outline-none rounded-lg focus-within:ring-2 focus-within:ring-indigo-500/50"
                            onClick={() => setSearchParams({ userId: member.user.id })}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSearchParams({ userId: member.user.id }); }}
                            title={`View profile of ${member.user?.firstName} ${member.user?.lastName}`}
                          >
                            <div className="relative shrink-0">
                              {member.user?.avatarUrl ? <img src={member.user.avatarUrl} alt="" className="w-14 h-14 rounded-2xl object-cover" /> : <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold text-white shadow-inner" {...{ style: { backgroundColor: color } }}>{(member.user?.firstName?.[0] || 'U').toUpperCase()}</div>}
                              {isOnline && <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-white dark:border-[#1E1E1E] rounded-full" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <h3 className="font-bold text-gray-900 dark:text-white truncate">{member.user?.firstName} {member.user?.lastName}</h3>
                                <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold tracking-wider uppercase border ${member.role === 'OWNER' ? 'bg-amber-50 text-amber-600 border-amber-200' : member.role === 'ADMIN' ? 'bg-indigo-50 text-indigo-600 border-indigo-200' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>{member.role}</span>
                              </div>
                              <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">{member.user.email}</p>
                            </div>
                          </div>
                          {(isAdmin || isOwner) && member.role !== 'OWNER' && (
                            <div className="mt-4 pt-4 border-t border-gray-50 dark:border-gray-800/50 flex items-center justify-between">
                              <span className="text-[10px] text-gray-400">Joined {new Date(member.createdAt).toLocaleDateString()}</span>
                              <div className="relative">
                                <button onClick={(e) => { e.stopPropagation(); setActiveMenuId(activeMenuId === member.id ? null : member.id); }} className="text-[10px] font-bold text-gray-400 hover:text-indigo-500 uppercase tracking-widest flex items-center gap-1">Manage <svg className={`w-2.5 h-2.5 transition-transform ${activeMenuId === member.id ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" /></svg></button>
                                {activeMenuId === member.id && (
                                  <div className="absolute top-full right-0 mt-2 w-52 bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 py-2 z-[100]">
                                    {isOwner && (
                                      <button onClick={(e) => { e.stopPropagation(); setSelectedUser(member.user); setIsSpaceModalOpen(true); setActiveMenuId(null); }} className="w-full text-left px-4 py-2 text-[13px] hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 transition-colors"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>Manage Sync Access</button>
                                    )}
                                    <button onClick={(e) => { e.stopPropagation(); handleUpdateRole(member.user.id, 'ADMIN'); setActiveMenuId(null); }} className="w-full text-left px-4 py-2 text-[13px] hover:bg-gray-50">Make Admin</button>
                                    <button onClick={(e) => { e.stopPropagation(); handleUpdateRole(member.user.id, 'MEMBER'); setActiveMenuId(null); }} className="w-full text-left px-4 py-2 text-[13px] hover:bg-gray-50">Make Member</button>
                                    <button onClick={(e) => { e.stopPropagation(); handleRemoveMember(member.user.id); setActiveMenuId(null); }} className="w-full text-left px-4 py-2 text-[13px] text-red-600 hover:bg-red-50 font-bold">Remove</button>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </motion.div>
              ) : (
                <motion.div key="pending" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-4">
                  {filteredInvites.length === 0 ? <div className="text-center py-20 text-gray-500">No pending invitations</div> : filteredInvites.map((inv) => (
                    <div key={inv.id} className="flex items-center justify-between p-5 bg-white dark:bg-gray-800/20 rounded-2xl border border-gray-100 dark:border-gray-800/50">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl flex items-center justify-center text-indigo-600"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg></div>
                        <div>
                          <p className="text-sm font-bold">{inv.email}</p>
                          <p className="text-xs text-gray-500">Invited as {inv.role}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => copyInviteLink(inv)} className="px-4 py-2 text-xs font-bold bg-gray-100 dark:bg-gray-800 rounded-xl">{copiedId === inv.id ? 'Copied!' : 'Copy Link'}</button>
                        <button onClick={() => handleRevokeInvite(inv.id)} className="p-2 text-gray-400 hover:text-red-500 uppercase font-black text-[10px]">Revoke</button>
                      </div>
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}
      {isInviteModalOpen && <InviteModal onClose={() => setIsInviteModalOpen(false)} />}
      {currentOrg && <SpaceAccessModal open={isSpaceModalOpen} onClose={() => setIsSpaceModalOpen(false)} user={selectedUser} organizationId={currentOrg.id} />}
    </div>
  );
}
