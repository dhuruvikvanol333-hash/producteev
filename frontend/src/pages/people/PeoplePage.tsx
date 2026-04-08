import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSearchParams } from 'react-router';
import { ChatPanel } from '../../components/chat/ChatPanel';
import { useAppSelector } from '../../store';
import type { User } from '../../types';
import api from '../../services/api';
import { Loading } from '../../components/ui/Loading';
import { useSocket } from '../../hooks/useSocket';
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

export function PeoplePage() {
  const socket = useSocket();
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
  const { isAdmin } = useOrgRole();
  const { success: showSuccess, error: showError } = useToast();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      if (currentOrg) {
        const res = await api.get<{ success: boolean; data: Person[] }>(`/organizations/${currentOrg.id}/members`);
        if (res?.data?.success && Array.isArray(res.data.data)) {
          setMembers(res.data.data);
        }

        if (isAdmin) {
          const invRes = await api.get<{ success: boolean; data: Invitation[] }>(`/organizations/${currentOrg.id}/invitations`);
          if (invRes?.data?.success) setInvitations(invRes.data.data);
        }
      }
    } catch (err) {
      console.error('Failed to load people data:', err);
    } finally {
      setLoading(false);
    }
  }, [currentOrg, isAdmin]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (!socket) return;
    const handleOnlineList = (ids: string[]) => setOnlineUsers(new Set(ids));
    const handleOnline = (d: { userId: string }) => setOnlineUsers((p) => new Set(p).add(d.userId));
    const handleOffline = (d: { userId: string }) => setOnlineUsers((p) => { const n = new Set(p); n.delete(d.userId); return n; });
    const handleMemberUpdate = () => loadData();

    socket.on('users:online-list', handleOnlineList);
    socket.on('user:online', handleOnline);
    socket.on('user:offline', handleOffline);
    socket.on('people:updated', handleMemberUpdate);
    socket.on('org:member_added', handleMemberUpdate);
    socket.on('org:member_removed', handleMemberUpdate);

    return () => {
      socket.off('users:online-list', handleOnlineList);
      socket.off('user:online', handleOnline);
      socket.off('user:offline', handleOffline);
      socket.off('people:updated', handleMemberUpdate);
      socket.off('org:member_added', handleMemberUpdate);
      socket.off('org:member_removed', handleMemberUpdate);
    };
  }, [socket, loadData]);

  const copyInviteLink = (invite: Invitation) => {
    navigator.clipboard.writeText(`${window.location.origin}/register?token=${invite.token}`);
    setCopiedId(invite.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleRevokeInvite = async (id: string) => {
    if (!window.confirm('Are you sure you want to revoke this invitation?')) return;
    try {
      await api.delete(`/invitations/${id}`);
      setInvitations(prev => prev.filter(inv => inv.id !== id));
      showSuccess('Invitation revoked');
    } catch (err) { showError('Failed to revoke'); }
  };

  const handleUpdateRole = async (userId: string, role: string) => {
    if (!currentOrg) return;
    try {
      await api.patch(`/organizations/${currentOrg.id}/members/${userId}`, { role });
      setMembers(prev => prev.map(m => m.user.id === userId ? { ...m, role } : m));
      showSuccess(`Role updated to ${role}`);
    } catch (err) { showError('Failed to update role'); }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!currentOrg) return;
    if (!window.confirm('Remove this member?')) return;
    try {
      await api.delete(`/organizations/${currentOrg.id}/members/${userId}`);
      setMembers(prev => prev.filter(m => m.user.id !== userId));
      showSuccess('Member removed');
    } catch (err) { showError('Failed to remove member'); }
  };

  const currentUserId = useAppSelector((state: RootState) => state.user.currentUser?.id);

  const roleOrder: Record<string, number> = {
    'OWNER': 1,
    'ADMIN': 2,
    'MEMBER': 3,
    'LIMITED_MEMBER': 4,
    'GUEST': 5
  };

  const filteredMembers = members.filter(m => {
    const q = search.toLowerCase();
    const fullName = `${m.user?.firstName || ''} ${m.user?.lastName || ''}`.toLowerCase();
    return fullName.includes(q) || (m.user?.email || '').toLowerCase().includes(q);
  }).sort((a, b) => {
    const orderA = roleOrder[a.role] || 99;
    const orderB = roleOrder[b.role] || 99;
    return orderA - orderB;
  });

  const filteredInvites = invitations.filter(inv => (inv.email || '').toLowerCase().includes(search.toLowerCase()));

  if (loading && members.length === 0) return <Loading size="lg" />;

  const activeChatMember = userIdParam ? members.find(m => m.user.id === userIdParam) : null;
  if (userIdParam && activeChatMember && currentUserId) {
    return (
      <ChatPanel
        currentUserId={currentUserId}
        targetUser={{
          id: activeChatMember.user.id,
          name: `${activeChatMember.user.firstName} ${activeChatMember.user.lastName}`,
          email: activeChatMember.user.email,
          colorIdx: members.indexOf(activeChatMember)
        }}
        onlineUsers={onlineUsers}
        onMessagesRead={() => { }}
        onBack={() => setSearchParams({})}
      />
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#f8f9fa] dark:bg-[#0F1116] overflow-hidden">
      <div className="bg-white dark:bg-gray-800/20 px-8 pt-8 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">People</h1>
          <div className="relative w-80">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input
              type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search members..."
              className="w-full pl-10 pr-4 py-2 text-sm bg-gray-50 dark:bg-gray-800/40 rounded-lg border border-transparent focus:border-indigo-500 outline-none"
            />
          </div>
        </div>
        <div className="flex gap-8">
          <button onClick={() => setActiveTab('members')} className={`pb-3 text-sm font-bold transition-colors relative ${activeTab === 'members' ? 'text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}>
            Active Members ({members.length})
            {activeTab === 'members' && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-full" />}
          </button>
          {isAdmin && (
            <button onClick={() => setActiveTab('pending')} className={`pb-3 text-sm font-bold transition-colors relative ${activeTab === 'pending' ? 'text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}>
              Pending Invitations ({invitations.length})
              {activeTab === 'pending' && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-full" />}
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 pb-48 custom-scrollbar">
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800">
          <div className="w-full">
            <table className="w-full text-left border-collapse min-w-[1200px]">
              <thead>
                <tr className="border-t-2 border-[#ff4136] bg-gray-50/50 dark:bg-gray-800/50">
                  <th className="px-5 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider w-[25%]">Name</th>
                  <th className="px-5 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider w-[15%]">Email</th>
                  <th className="px-5 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider w-[10%]">Role</th>
                  <th className="px-5 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider w-[10%]">Last active</th>
                  <th className="px-5 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider w-[10%]">Invited by</th>
                  <th className="px-5 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider w-[10%]">Invited on</th>
                  <th className="px-5 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider w-[10%]">Access</th>
                  <th className="px-5 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider w-[5%] text-center">Permissions</th>
                  <th className="px-5 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider w-[5%]"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {activeTab === 'members' && isAdmin && (
                  <tr onClick={() => setIsInviteModalOpen(true)} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer group transition-colors">
                    <td colSpan={9} className="px-5 py-4">
                      <div className="flex items-center gap-3 text-indigo-600 font-bold text-sm">
                        <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center group-hover:bg-indigo-100 transition-colors">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                        </div>
                        Invite people
                      </div>
                    </td>
                  </tr>
                )}

                <AnimatePresence mode="wait">
                  {activeTab === 'members' ? filteredMembers.map(member => {
                    const isOnline = onlineUsers.has(member.user.id);
                    const counts = member.user._count;
                    return (
                      <motion.tr key={member.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="hover:bg-gray-50/80 dark:hover:bg-gray-800/30 transition-colors group">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="relative">
                              {member.user.avatarUrl ? (
                                <img src={member.user.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 font-bold text-[10px] uppercase">
                                  {member.user.firstName[0]}{member.user.lastName[0]}
                                </div>
                              )}
                              <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-gray-900 ${isOnline ? 'bg-green-500' : 'bg-gray-300'}`} />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-gray-900 dark:text-white truncate hover:text-indigo-600 transition-colors cursor-pointer" onClick={() => setSearchParams({ userId: member.user.id })}>{member.user.firstName} {member.user.lastName}</p>
                              {member.user.technology && <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider leading-none mt-0.5">{member.user.technology}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">{member.user.email}</td>
                        <td className="px-5 py-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-tight ${(member.role === 'ADMIN' || member.role === 'OWNER') ? 'bg-[#E0E0E0] text-[#424242]' : 'bg-gray-100 text-gray-500'}`}>{member.role === 'OWNER' ? 'Owner' : member.role === 'ADMIN' ? 'Admin' : member.role}</span>
                        </td>
                        <td className="px-5 py-4 text-xs text-gray-500 dark:text-gray-400">Apr 3</td>
                        <td className="px-5 py-4 text-xs text-gray-500 dark:text-gray-400">-</td>
                        <td className="px-5 py-4 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">{new Date(member.createdAt).toLocaleDateString()}</td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-4 text-[10px] text-gray-400 font-bold uppercase whitespace-nowrap">
                            <span>{counts?.folderMemberships || 0} Folders</span>
                            <span>{counts?.listMemberships || 0} Lists</span>
                            <span>{counts?.assignedTasks || 0} Tasks</span>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2.5 text-gray-400">
                            <button title="Permissions" className="hover:text-indigo-500 transition-colors"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg></button>
                            <button title="Time Tracking" className="hover:text-indigo-500 transition-colors"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></button>
                            <button title="Settings" className="hover:text-indigo-500 transition-colors"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg></button>
                            <button title="Documents" className="hover:text-indigo-500 transition-colors"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg></button>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <div className="relative">
                            {member.role !== 'OWNER' && (
                              <>
                                <button title="Member options" onClick={() => setActiveMenuId(activeMenuId === member.id ? null : member.id)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors text-gray-400"><svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 10c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0-6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 12c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" /></svg></button>
                                {activeMenuId === member.id && (
                                  <div className="absolute right-0 top-full mt-2 w-52 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.2)] z-[100] py-1.5 overflow-hidden">
                                    {isAdmin && (
                                      <>
                                        {/* Show Manage Access AND separator for all non-owners */}
                                        <button onClick={() => { setSelectedUser(member.user); setIsSpaceModalOpen(true); setActiveMenuId(null); }} className="w-full px-4 py-2 text-left text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 font-medium"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>Manage Access</button>
                                        <div className="border-t border-gray-100 dark:border-gray-700 my-1" />

                                        {/* ALL non-owners get role changing options */}
                                        <button onClick={() => { handleUpdateRole(member.user.id, 'MEMBER'); setActiveMenuId(null); }} className={`w-full px-4 py-2 text-left text-xs font-bold hover:bg-gray-50 dark:hover:bg-gray-700 ${member.role === 'MEMBER' ? 'text-indigo-600' : 'text-gray-700 dark:text-gray-300'}`}>Make Member</button>
                                        <button onClick={() => { handleUpdateRole(member.user.id, 'LIMITED_MEMBER'); setActiveMenuId(null); }} className={`w-full px-4 py-2 text-left text-xs font-bold hover:bg-gray-50 dark:hover:bg-gray-700 ${member.role === 'LIMITED_MEMBER' ? 'text-indigo-600' : 'text-gray-700 dark:text-gray-300'}`}>Make Limited Member</button>
                                        <button onClick={() => { handleUpdateRole(member.user.id, 'GUEST'); setActiveMenuId(null); }} className={`w-full px-4 py-2 text-left text-xs font-bold hover:bg-gray-50 dark:hover:bg-gray-700 ${member.role === 'GUEST' ? 'text-indigo-600' : 'text-gray-700 dark:text-gray-300'}`}>Make Guest</button>
                                        <div className="border-t border-gray-100 dark:border-gray-700 my-1" />
                                        <button onClick={() => { handleRemoveMember(member.user.id); setActiveMenuId(null); }} className="w-full px-4 py-2 text-left text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 font-black">Remove from Workspace</button>
                                      </>
                                    )}
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </motion.tr>
                    );
                  }) : filteredInvites.map(inv => (
                    <tr key={inv.id} className="hover:bg-gray-50/80 dark:hover:bg-gray-800/30 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg></div>
                          <p className="text-sm font-bold text-gray-900 dark:text-white">{inv.email}</p>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-xs text-gray-400">{inv.email}</td>
                      <td className="px-5 py-4"><span className="px-2 py-1 bg-yellow-50 text-yellow-600 rounded text-[10px] font-black uppercase tracking-widest">{inv.role}</span></td>
                      <td className="px-5 py-4 text-xs text-gray-300">Pending</td>
                      <td className="px-5 py-4 text-xs text-gray-400">{inv.invitedBy?.firstName}</td>
                      <td className="px-5 py-4 text-xs text-gray-400">{new Date(inv.createdAt).toLocaleDateString()}</td>
                      <td className="px-5 py-4"></td>
                      <td className="px-5 py-4"></td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => copyInviteLink(inv)} className="text-[10px] font-black text-indigo-600 hover:underline uppercase tracking-wider">{copiedId === inv.id ? 'Copied!' : 'Copy Link'}</button>
                          <button onClick={() => handleRevokeInvite(inv.id)} className="text-[10px] font-black text-red-400 hover:text-red-500 uppercase tracking-wider">Revoke</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {isInviteModalOpen && <InviteModal onClose={() => setIsInviteModalOpen(false)} />}
      {currentOrg && <SpaceAccessModal open={isSpaceModalOpen} onClose={() => setIsSpaceModalOpen(false)} user={selectedUser} organizationId={currentOrg.id} />}
    </div>
  );
}
