import React, { useState, useEffect, useRef, useCallback } from 'react';
import { NavLink, useLocation, useNavigate, Outlet } from 'react-router';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../hooks/useTheme';
import { useAppSelector, useAppDispatch } from '../../store';
import api from '../../services/api';
import { getSocket } from '../../services/socket';
import { useOrgRole } from '../../hooks/useOrgRole';
import { setCurrentOrg } from '../../store/slices/organizationSlice';
import { SearchTrigger, SearchModal } from './SearchBar';
import { GlobalTimer } from '../time-tracking/GlobalTimer';
import { NotificationBell } from './NotificationBell';
import { CreateFolderModal } from '../modals/CreateFolderModal';
import { CreateListModal } from '../modals/CreateListModal';
import { DeleteConfirmModal } from '../modals/DeleteConfirmModal';
import { RenameModal } from '../modals/RenameModal';
import { Space, Task } from '../../types';
import { useNotifications } from '../../hooks/useNotifications';
import { VideoCallModal } from '../chat/VideoCallModal';

const getWorkspaceLogo = (org: any) => {
  if (org?.settings?.logoUrl) return org.settings.logoUrl;
  const name = org?.name || 'Workspace';
  const initial = name.charAt(0).toUpperCase();
  return `https://ui-avatars.com/api/?name=${initial}&background=6366f1&color=fff&bold=true&rounded=true`;
};

function WorkspaceDropdown({ coords, onClose }: { coords: { top: number; left: number }; onClose: () => void }) {
  const navigate = useNavigate();
  const currentOrg = useAppSelector(state => state.organization.currentOrg);
  const organizations = useAppSelector(state => state.organization.organizations);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { isAdmin, isOwner } = useOrgRole();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);



  return (
    <div
      ref={dropdownRef}
      {...{ style: { top: coords.top, left: coords.left } }}
      className="fixed w-[300px] bg-white dark:bg-[#1E2530] rounded-xl shadow-2xl dark:shadow-[0_10px_40px_rgba(0,0,0,0.5)] border border-gray-200 dark:border-[#2D3748] z-[9999] text-sans overflow-hidden animate-scale-in origin-top-left"
    >
      <div className="p-4 pb-2">
        <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3">Workspaces</p>
        <div className="space-y-1 mb-4 max-h-[200px] overflow-y-auto custom-scrollbar pr-1">
          {organizations
            .filter((org, index, self) =>
              index === self.findIndex((o) => o.name === org.name) &&
              !org.name.includes(' IND') && !org.name.includes(' USA')
            )
            .map((org) => (
              <div
                key={org.id}
                className={`w-full flex items-center gap-3 p-2 rounded-lg ${currentOrg?.id === org.id
                  ? 'bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800'
                  : 'border border-transparent'
                  }`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold shadow-sm ${currentOrg?.id === org.id ? 'bg-indigo-600' : 'bg-gray-400 dark:bg-gray-600'
                  }`}>
                  {org.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <h3 className={`text-sm font-semibold truncate ${currentOrg?.id === org.id ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-700 dark:text-gray-300'}`}>
                    {org.name}
                  </h3>
                </div>
                {currentOrg?.id === org.id && (
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                )}
              </div>
            ))}
        </div>

        <div className="pt-2 border-t border-gray-100 dark:border-gray-800 space-y-1">
          <button
            onClick={() => { navigate('/settings'); onClose(); }}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all group"
          >
            <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center group-hover:bg-indigo-50 dark:group-hover:bg-indigo-900/20">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            </div>
            Settings
          </button>
          {(isAdmin || isOwner) && (
            <button
              onClick={() => { navigate('/people'); onClose(); }}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all group"
            >
              <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center group-hover:bg-indigo-50 dark:group-hover:bg-indigo-900/20">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
              </div>
              Manage People
            </button>
          )}
        </div>
      </div>
      {(isOwner || isAdmin) && (
        <div className="pt-2 border-t border-gray-100 dark:border-gray-800 space-y-1">
          <button
            onClick={() => { navigate('/onboarding/workspace'); onClose(); }}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-[13px] font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all font-sans"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
            Create Workspace
          </button>
        </div>
      )}
    </div>
  );
}

export function MainLayout() {
  const { currentUser, logout } = useAuth();
  const { isDark, toggle: toggleThemeMode } = useTheme();
  const { isOwner, isAdmin, isMember, isLimitedMember, isGuest } = useOrgRole();
  const showFullSidebar = isOwner || isAdmin || isMember || isLimitedMember || isGuest;
  const dispatch = useAppDispatch();
  const canManageSpaces = isOwner || isAdmin;
  const currentOrg = useAppSelector(state => state.organization.currentOrg);
  const { unreadCount } = useNotifications();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [workspaceDropdownCoords, setWorkspaceDropdownCoords] = useState({ top: 0, left: 0 });
  const workspaceBtnRef = useRef<HTMLButtonElement>(null);

  const handleWorkspaceToggle = () => {
    if (workspaceBtnRef.current) {
      const rect = workspaceBtnRef.current.getBoundingClientRect();
      setWorkspaceDropdownCoords({ top: rect.bottom + 8, left: rect.left });
    }
    setWorkspaceDropdownOpen(prev => !prev);
  };

  const userDropdownRef = useRef<HTMLDivElement>(null);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [isSidebarMini, setIsSidebarMini] = useState(false);
  const [incomingCall, setIncomingCall] = useState<{ fromUserId: string; callerName: string } | null>(null);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    socket.on('video:call:incoming', (data: { fromUserId: string; callerName: string }) => {
      setIncomingCall(data);
    });

    socket.on('video:call:accepted', () => {
      // Logic for caller when receiver accepts (could show "Connected")
    });

    socket.on('video:call:rejected', () => {
      // Logic for caller when receiver rejects (could show "Call Ended")
    });

    return () => {
      socket.off('video:call:incoming');
      socket.off('video:call:accepted');
      socket.off('video:call:rejected');
    };
  }, []);

  const handleAcceptCall = () => {
    const socket = getSocket();
    if (socket && incomingCall) {
      socket.emit('video:call:accept', { targetUserId: incomingCall.fromUserId });
    }
  };

  const handleDeclineCall = () => {
    const socket = getSocket();
    if (socket && incomingCall) {
      socket.emit('video:call:reject', { targetUserId: incomingCall.fromUserId });
    }
    setIncomingCall(null);
  };

  const [spaces, setSpaces] = useState<Space[]>([]);

  // Persistent Sidebar Expansion States
  const [expandedSpaces, setExpandedSpaces] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem('expandedSpaces');
    return saved ? JSON.parse(saved) : {};
  });

  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem('expandedFolders');
    return saved ? JSON.parse(saved) : {};
  });

  // Persistent Workspace Dropdown State (as requested for "img 2")
  const [workspaceDropdownOpen, setWorkspaceDropdownOpen] = useState(() => {
    return localStorage.getItem('isWorkspaceMenuOpen') === 'true';
  });

  // Save expansion states whenever they change
  useEffect(() => {
    localStorage.setItem('expandedSpaces', JSON.stringify(expandedSpaces));
  }, [expandedSpaces]);

  useEffect(() => {
    localStorage.setItem('expandedFolders', JSON.stringify(expandedFolders));
  }, [expandedFolders]);

  // Save dropdown state whenever it changes
  useEffect(() => {
    localStorage.setItem('isWorkspaceMenuOpen', workspaceDropdownOpen.toString());
  }, [workspaceDropdownOpen]);

  const [favoriteTasks, setFavoriteTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [showAllMembers, setShowAllMembers] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [unreadMessageCounts, setUnreadMessageCounts] = useState<Record<string, number>>({});

  const [activeSpaceId, setActiveSpaceId] = useState<string | null>(null);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [isCreateListOpen, setIsCreateListOpen] = useState(false);
  const [isPlusMenuOpen, setIsPlusMenuOpen] = useState<string | null>(null);
  const [deleteData, setDeleteData] = useState<{ type: 'Space' | 'Folder' | 'List'; id: string; title: string } | null>(null);
  const [renameData, setRenameData] = useState<{ type: 'Space' | 'Folder' | 'List'; id: string; title: string } | null>(null);

  const sidebarRef = useRef<HTMLElement>(null);
  const [sidebarWidth, setSidebarWidth] = useState(260);
  const [isResizing, setIsResizing] = useState(false);

  // Real-time RBAC synchronization
  useEffect(() => {
    const socket = getSocket();
    if (!socket || !currentUser || !currentOrg) return;

    // Join the organization room to receive updates
    socket.emit('join-organization', currentOrg.id);

    const handleOrgUpdate = async (data: { organizationId: string; userId?: string }) => {
      // Refresh member list if necessary
      if (data.organizationId === currentOrg?.id) {
        fetchMembers();
      }

      if (data.userId && data.userId !== currentUser?.id) return;

      try {
        const res = await api.get<{ success: boolean; data: any[] }>('/organizations');
        if (res?.data?.success && Array.isArray(res.data.data)) {
          const orgs = res.data.data;
          const updatedOrg = orgs.find(o => o?.id === currentOrg?.id);

          if (!updatedOrg) {
            navigate('/');
            window.location.reload();
            return;
          }

          if (updatedOrg.role) {
            dispatch(setCurrentOrg({ org: updatedOrg, role: updatedOrg.role }));
          }
        }
      } catch (err) {
        console.error('Failed to sync RBAC update:', err);
      }
    };

    socket.on('org:role_updated', handleOrgUpdate);
    socket.on('org:role_changed', handleOrgUpdate);
    socket.on('org:membership_updated', handleOrgUpdate);
    socket.on('org:member_added', handleOrgUpdate);
    socket.on('org:member_removed', (data) => {
      if (data.organizationId === currentOrg.id) {
        fetchMembers();
        if (data.userId === currentUser.id) {
          navigate('/');
          window.location.reload();
        }
      }
    });
    socket.on('people:updated', () => fetchMembers());

    // Real-time online signaling
    const handleOnlineList = (userIds: string[]) => setOnlineUsers(new Set(userIds));
    const handleUserOnline = (data: { userId: string }) => setOnlineUsers(prev => new Set(prev).add(data.userId));
    const handleUserOffline = (data: { userId: string }) => setOnlineUsers(prev => {
      const next = new Set(prev);
      next.delete(data.userId);
      return next;
    });

    socket.on('users:online-list', handleOnlineList);
    socket.on('user:online', handleUserOnline);
    socket.on('user:offline', handleUserOffline);

    const handleNewMessage = (msg: any) => {
      // If we are recipient, increment count for sender
      if (msg.receiverId === currentUser.id) {
        setUnreadMessageCounts(prev => ({
          ...prev,
          [msg.senderId]: (prev[msg.senderId] || 0) + 1
        }));
      }
    };

    const handleMessagesRead = (data: { readBy: string; senderId?: string }) => {
      // If WE are the one who read the messages (on another tab/device), sync the UI
      if (data.readBy === currentUser.id && data.senderId) {
        setUnreadMessageCounts(prev => ({
          ...prev,
          [data.senderId!]: 0
        }));
      }
    };

    socket.on('message:new', handleNewMessage);
    socket.on('messages:read-receipt', handleMessagesRead);

    // Global Data Sync
    const handleSpaceUpdate = () => fetchSpaces();
    const handleTaskUpdate = () => fetchFavorites();

    socket.on('space:updated', handleSpaceUpdate);
    socket.on('task:updated', handleTaskUpdate);

    return () => {
      socket.off('org:role_changed', handleOrgUpdate);
      socket.off('org:membership_updated', handleOrgUpdate);
      socket.off('org:member_added', handleOrgUpdate);
      socket.off('org:member_removed');
      socket.off('users:online-list', handleOnlineList);
      socket.off('user:online', handleUserOnline);
      socket.off('user:offline', handleUserOffline);
      socket.off('message:new', handleNewMessage);
      socket.off('messages:read-receipt', handleMessagesRead);
      socket.off('space:updated', handleSpaceUpdate);
      socket.off('task:updated', handleTaskUpdate);
    };
  }, [currentUser, currentOrg, navigate, dispatch]);

  const startResizing = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    if (!isResizing) return;
    const handleMouseMove = (e: MouseEvent) => {
      let newWidth = e.clientX;
      if (newWidth < 68) newWidth = 68;
      if (newWidth > 600) newWidth = 600;
      if (sidebarRef.current) sidebarRef.current.style.width = `${newWidth}px`;
    };
    const handleMouseUp = (e: MouseEvent) => {
      setIsResizing(false);
      let finalWidth = e.clientX;
      if (finalWidth < 68) finalWidth = 68;
      if (finalWidth > 600) finalWidth = 600;
      if (finalWidth < 120) setIsSidebarMini(true);
      else {
        setIsSidebarMini(false);
        setSidebarWidth(finalWidth);
      }
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  const fetchSpaces = useCallback(async () => {
    try {
      const res = await api.get<{ success: boolean; data: Space[] }>('/spaces/my');
      if (res.data.success) setSpaces(res.data.data);
    } catch { }
  }, []);

  const fetchFavorites = useCallback(async () => {
    try {
      const res = await api.get<{ success: boolean; data: Task[] }>('/tasks/favorites');
      if (res.data.success) setFavoriteTasks(res.data.data);
    } catch { }
  }, []);

  const fetchMembers = useCallback(async () => {
    try {
      const orgRes = await api.get<{ success: boolean; data: any[] }>('/organizations');
      if (!orgRes?.data?.success) return;
      const orgs = orgRes.data.data || [];

      // Map to store unique members across all organizations
      const allMembersMap = new Map<string, any>();

      // Use Promise.all for faster, concurrent fetching
      await Promise.all(orgs.map(async (org) => {
        if (!org?.id) return;
        try {
          const res = await api.get<{ success: boolean; data: any[] }>(`/organizations/${org.id}/members`);
          if (res?.data?.success && Array.isArray(res.data.data)) {
            res.data.data.forEach(m => {
              if (m?.user?.id && !allMembersMap.has(m.user.id)) {
                allMembersMap.set(m.user.id, m);
              }
            });
          }
        } catch (err) {
          console.warn(`Failed to fetch members for org ${org.id}:`, err);
        }
      }));

      const finalMembers = Array.from(allMembersMap.values());

      // If no members found (which shouldn't happen), add current user as fallback
      if (finalMembers.length === 0 && currentUser) {
        finalMembers.push({ user: currentUser, role: 'OWNER' });
      }

      setMembers(finalMembers);
    } catch (err) {
      console.error('Failed to global fetch members:', err);
    }
  }, [currentUser]);

  const fetchUnreadMessageCounts = useCallback(async () => {
    try {
      const res = await api.get<{ success: boolean; data: Record<string, number> }>('/messages/unread-counts');
      if (res.data.success) {
        setUnreadMessageCounts(res.data.data);
      }
    } catch { }
  }, []);

  useEffect(() => {
    if (currentUser) {
      fetchSpaces();
      fetchFavorites();
      fetchMembers();
      fetchUnreadMessageCounts();
    }
  }, [currentUser, fetchSpaces, fetchFavorites, fetchMembers, fetchUnreadMessageCounts, currentOrg]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const handleRefresh = () => fetchFavorites();
    socket.on('task:updated', handleRefresh);
    return () => { socket.off('task:updated', handleRefresh); };
  }, [fetchFavorites]);

  const toggleSpace = (spaceId: string) => {
    setExpandedSpaces(prev => ({ ...prev, [spaceId]: !prev[spaceId] }));
  };

  const toggleFolder = (folderId: string) => {
    setExpandedFolders(prev => ({ ...prev, [folderId]: !prev[folderId] }));
  };

  const pageTitle = () => {
    if (location.pathname === '/') return 'Home';
    if (location.pathname === '/inbox') return 'Inbox';
    if (location.pathname.startsWith('/tasks/assigned')) return 'Assigned to me';
    if (location.pathname.startsWith('/tasks/team')) return 'Team Message';
    if (location.pathname.startsWith('/tasks/favorites')) return 'Favorites';
    if (location.pathname.startsWith('/people')) return 'People';
    if (location.pathname.startsWith('/settings')) return 'Settings';
    if (location.pathname.startsWith('/lists/')) return 'List';
    return 'ClickUp';
  };

  const openCreateFolder = (spaceId: string) => {
    setActiveSpaceId(spaceId);
    setIsCreateFolderOpen(true);
  };

  const openCreateList = (spaceId: string, folderId?: string) => {
    setActiveSpaceId(spaceId);
    setActiveFolderId(folderId || null);
    setIsCreateListOpen(true);
  };

  const openDeleteModal = (type: 'Space' | 'Folder' | 'List', id: string, title: string) => {
    setDeleteData({ type, id, title });
  };

  const openRenameModal = (type: 'Space' | 'Folder' | 'List', id: string, title: string) => {
    setRenameData({ type, id, title });
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-[#0F172A] text-gray-900 dark:text-gray-100 font-sans overflow-hidden">
      {workspaceDropdownOpen && <WorkspaceDropdown coords={workspaceDropdownCoords} onClose={() => setWorkspaceDropdownOpen(false)} />}

      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside
        ref={sidebarRef}
        {...{ style: { width: isSidebarMini ? 68 : sidebarWidth, flexShrink: 0 } }}
        className={`fixed inset-y-0 left-0 z-50 overflow-y-auto overflow-x-hidden sidebar-scroll gradient-sidebar border-r border-gray-200/70 dark:border-gray-800 flex flex-col transform lg:relative lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          } ${isResizing ? 'transition-none select-none' : 'transition-[width,transform] duration-300 ease-in-out'}`}
      >
        <div className="relative px-3 py-3.5 border-b border-gray-100/80 dark:border-gray-800">
          <button ref={workspaceBtnRef} onClick={handleWorkspaceToggle} className={`flex items-center ${isSidebarMini ? 'justify-center' : 'gap-2'} w-full hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg ${isSidebarMini ? 'px-1' : 'px-2'} py-1.5`} title="Workspace Menu">
            <img src={getWorkspaceLogo(currentOrg)} alt="" className="w-6 h-6 rounded object-cover shrink-0" />
            {!isSidebarMini && <span className="text-sm font-semibold text-gray-900 dark:text-white truncate">{currentOrg?.name || 'Workspace'}</span>}
            {!isSidebarMini && (
              <div className="ml-auto flex items-center gap-1">
                {(isAdmin || isOwner) && (
                  <button onClick={(e) => { e.stopPropagation(); navigate('/onboarding/workspace'); }} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors shadow-sm" title="Create Workspace">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                  </button>
                )}
                <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </div>
            )}
          </button>
        </div>

        <div className="px-2 py-2">
          <NavLink to="/" end className={({ isActive }) => `flex items-center ${isSidebarMini ? 'justify-center' : 'gap-2.5 px-2'} py-1.5 rounded-lg text-[13px] transition-colors ${isActive ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 font-medium' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50'}`}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
            {!isSidebarMini && "Home"}
          </NavLink>
          <NavLink to="/inbox" className={({ isActive }) => `flex items-center ${isSidebarMini ? 'justify-center' : 'justify-between px-2'} py-1.5 rounded-lg text-[13px] transition-colors ${isActive ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 font-medium' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50'}`}>
            <div className={`flex items-center ${isSidebarMini ? 'justify-center' : 'gap-2.5'}`}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
              {!isSidebarMini && "Inbox"}
            </div>
            {!isSidebarMini && (unreadCount + Object.values(unreadMessageCounts).reduce((a, b) => a + b, 0)) > 0 && (
              <span className="px-1.5 py-0.5 bg-indigo-500 text-white text-[10px] font-black rounded-lg shadow-sm">
                {unreadCount + Object.values(unreadMessageCounts).reduce((a, b) => a + b, 0)}
              </span>
            )}
            {isSidebarMini && (unreadCount + Object.values(unreadMessageCounts).reduce((a, b) => a + b, 0)) > 0 && (
              <div className="absolute top-1.5 right-1.5 w-2 h-2 bg-indigo-500 rounded-full border border-white dark:border-gray-900" />
            )}
          </NavLink>
          <NavLink to="/tasks/assigned" className={({ isActive }) => `flex items-center ${isSidebarMini ? 'justify-center' : 'gap-2.5 px-2'} py-1.5 rounded-lg text-[13px] transition-colors ${isActive ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 font-medium' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50'}`}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
            {!isSidebarMini && "Assigne to me"}
          </NavLink>

        </div>

        {showFullSidebar && (
          <div className="flex flex-col flex-1 min-h-0 overflow-y-auto sidebar-scroll">
            {(isOwner || isAdmin) && !isGuest && (
              <div className="px-2 py-3 border-t border-gray-100 dark:border-gray-700">
                <div className="flex items-center justify-between px-2 mb-2 group/spaces">
                  {!isSidebarMini && <span className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Spaces</span>}
                  {canManageSpaces && (
                    <button
                      onClick={() => navigate('/onboarding/workspace')}
                      className="p-2 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                      title="Create Workspace"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                    </button>
                  )}
                </div>
                <div className="space-y-0.5">
                  {spaces.map(space => (
                    <div key={space.id} className="space-item group/space">
                      <div className="flex items-center group/space mb-0.5">
                        <button
                          onClick={() => toggleSpace(space.id)}
                          className="flex-1 flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-[13px] text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800/50 transition-all font-bold"
                        >
                          <div
                            className="w-6 h-6 rounded-lg flex items-center justify-center text-[11px] text-white shrink-0 shadow-sm font-black"
                            {...{ style: { backgroundColor: space.color || '#6366f1' } }}
                          >
                            {space.icon || space.name.charAt(0).toUpperCase()}
                          </div>
                          {!isSidebarMini && (
                            <div className="flex items-center gap-1.5 min-w-0 flex-1">
                              <span className="truncate">{space.name}</span>
                              <svg className="w-3 h-3 text-gray-400 shrink-0" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M12 1.5a5.25 5.25 0 00-5.25 5.25v3a3 3 0 00-3 3v6.75a3 3 0 003 3h10.5a3 3 0 003-3v-6.75a3 3 0 00-3-3v-3c0-2.9-2.35-5.25-5.25-5.25zm3.75 8.25v-3a3.75 3.75 0 10-7.5 0v3h7.5z" clipRule="evenodd" /></svg>
                            </div>
                          )}
                        </button>
                        {!isSidebarMini && canManageSpaces && (
                          <div className="flex items-center pr-1 gap-0.5">
                            <div className="relative">
                              <button
                                onClick={() => setIsPlusMenuOpen(isPlusMenuOpen === space.id ? null : space.id)}
                                className={`p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${isPlusMenuOpen === space.id ? 'text-indigo-600' : 'text-gray-400'}`}
                                title="More"
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" /></svg>
                              </button>
                              {isPlusMenuOpen === space.id && (
                                <div className="absolute right-0 top-full mt-1 w-44 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 z-[100] py-1.5 overflow-hidden animate-scale-in origin-top-right">
                                  <button onClick={(e) => { e.stopPropagation(); openCreateFolder(space.id); setIsPlusMenuOpen(null); }} className="w-full text-left px-4 py-2 text-[13px] hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-gray-700 dark:text-gray-200 flex items-center gap-2 group transition-colors"><div className="w-1 h-1 rounded-full bg-indigo-400 group-hover:scale-150 transition-transform" />Create Folder</button>
                                  <button onClick={(e) => { e.stopPropagation(); openCreateList(space.id); setIsPlusMenuOpen(null); }} className="w-full text-left px-4 py-2 text-[13px] hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-gray-700 dark:text-gray-200 flex items-center gap-2 group transition-colors"><div className="w-1 h-1 rounded-full bg-emerald-400 group-hover:scale-150 transition-transform" />Create List</button>
                                  <div className="my-1.5 border-t border-gray-100 dark:border-gray-700/50" />
                                  <button onClick={(e) => { e.stopPropagation(); openRenameModal('Space', space.id, space.name); setIsPlusMenuOpen(null); }} className="w-full text-left px-4 py-2 text-[12px] text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700">Rename Workspace</button>
                                  <button onClick={(e) => { e.stopPropagation(); openDeleteModal('Space', space.id, space.name); setIsPlusMenuOpen(null); }} className="w-full text-left px-4 py-2 text-[12px] text-red-500 font-medium hover:bg-red-50 dark:hover:bg-red-900/10">Delete Workspace</button>
                                </div>
                              )}
                            </div>
                            <button
                              onClick={() => openCreateList(space.id)}
                              className="p-1 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-all"
                              title="Add List"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                            </button>
                          </div>
                        )}
                      </div>
                      {!isSidebarMini && expandedSpaces[space.id] && (
                        <div className="ml-6 pl-2 border-l border-gray-100 dark:border-gray-800 mt-0.5 space-y-0.5">
                          {space.folders.map(folder => (
                            <div key={folder.id} className="group/folder px-2">
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => toggleFolder(folder.id)}
                                  className="flex-1 flex items-center gap-2 py-1 px-1 rounded-md text-[12px] text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                                >
                                  <svg className={`w-3.5 h-3.5 text-gray-400 shrink-0 transition-transform ${expandedFolders[folder.id] ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                  <span className="truncate flex-1 text-left font-medium">{folder.name}</span>
                                </button>
                                {canManageSpaces && (
                                  <div className="relative shrink-0">
                                    <button
                                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsPlusMenuOpen(isPlusMenuOpen === folder.id ? null : folder.id); }}
                                      className={`opacity-0 group-hover/folder:opacity-100 p-0.5 rounded transition-all ${isPlusMenuOpen === folder.id ? 'bg-indigo-100 text-indigo-600 opacity-100' : 'text-gray-400 hover:text-indigo-500'}`}
                                      title="Folder Options"
                                    >
                                      <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                                    </button>
                                    {isPlusMenuOpen === folder.id && (
                                      <div className="absolute right-0 top-full mt-1 w-36 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-100 dark:border-gray-700 z-[100] py-1 overflow-hidden animate-scale-in origin-top-right">
                                        <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); openCreateList(space.id, folder.id); setIsPlusMenuOpen(null); }} className="w-full text-left px-3 py-1.5 text-[12px] text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">Create List</button>
                                        <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); openRenameModal('Folder', folder.id, folder.name); setIsPlusMenuOpen(null); }} className="w-full text-left px-3 py-1.5 text-[12px] text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">Rename Folder</button>
                                        <div className="my-1.5 border-t border-gray-100 dark:border-gray-700" />
                                        <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); openDeleteModal('Folder', folder.id, folder.name); setIsPlusMenuOpen(null); }} className="w-full text-left px-3 py-1.5 text-[11px] text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors font-medium">Delete Folder</button>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                              {expandedFolders[folder.id] && (
                                <div className="ml-4 mt-0.5 space-y-0.5 border-l border-gray-100 dark:border-gray-800">
                                  {folder.lists.map(list => (
                                    <div key={list.id} className="group/list-item flex items-center relative gap-0.5 pr-2">
                                      <NavLink
                                        to={`/lists/${list.id}`}
                                        className={({ isActive }) => `flex-1 flex items-center gap-2 pl-4 py-1.5 rounded-lg text-[13px] transition-all ${isActive ? 'bg-gray-100 dark:bg-gray-800/80 text-gray-900 dark:text-white font-bold' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
                                      >
                                        <svg className="w-3.5 h-3.5 mr-1 text-gray-400 group-hover/list-item:text-indigo-500 transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><circle cx="3" cy="6" r="1.5" fill="currentColor" stroke="none"></circle><circle cx="3" cy="12" r="1.5" fill="currentColor" stroke="none"></circle><circle cx="3" cy="18" r="1.5" fill="currentColor" stroke="none"></circle></svg>
                                        <span className="truncate flex-1">{list.name}</span>
                                        {list._count && list._count.tasks > 0 && (
                                          <span className="text-[11px] font-medium text-gray-400 tabular-nums">{list._count.tasks}</span>
                                        )}
                                      </NavLink>

                                      <button
                                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsPlusMenuOpen(isPlusMenuOpen === list.id ? null : list.id); }}
                                        className={`opacity-0 group-hover/list-item:opacity-100 p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-all ${isPlusMenuOpen === list.id ? 'text-indigo-600 opacity-100 bg-gray-100' : 'text-gray-400'}`}
                                        title="List Options"
                                      >
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" /></svg>
                                      </button>

                                      {isPlusMenuOpen === list.id && (
                                        <div className="absolute right-2 top-full mt-1 w-32 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-100 dark:border-gray-700 z-[100] py-1 animate-scale-in origin-top-right">
                                          <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); openRenameModal('List', list.id, list.name); setIsPlusMenuOpen(null); }} className="w-full text-left px-3 py-1.5 text-[11px] text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium">Rename List</button>
                                          <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); openDeleteModal('List', list.id, list.name); setIsPlusMenuOpen(null); }} className="w-full text-left px-3 py-1.5 text-[11px] text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors font-medium">Delete List</button>
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                          {space.lists.map(list => (
                            <div key={list.id} className="group/list-item flex items-center relative gap-0.5 pr-2">
                              <NavLink
                                to={`/lists/${list.id}`}
                                className={({ isActive }) => `flex-1 flex items-center gap-2 pl-4 py-1.5 rounded-lg text-[13px] transition-all ${isActive ? 'bg-gray-100 dark:bg-gray-800/80 text-gray-900 dark:text-white font-bold' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
                              >
                                <svg className="w-3.5 h-3.5 mr-1 text-gray-400 group-hover/list-item:text-indigo-500 transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><circle cx="3" cy="6" r="1.5" fill="currentColor" stroke="none"></circle><circle cx="3" cy="12" r="1.5" fill="currentColor" stroke="none"></circle><circle cx="3" cy="18" r="1.5" fill="currentColor" stroke="none"></circle></svg>
                                <span className="truncate flex-1">{list.name}</span>
                                {list._count && list._count.tasks > 0 && (
                                  <span className="text-[11px] font-medium text-gray-400 tabular-nums">{list._count.tasks}</span>
                                )}
                              </NavLink>

                              <button
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsPlusMenuOpen(isPlusMenuOpen === list.id ? null : list.id); }}
                                className={`opacity-0 group-hover/list-item:opacity-100 p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-all ${isPlusMenuOpen === list.id ? 'text-indigo-600 opacity-100 bg-gray-100' : 'text-gray-400'}`}
                                title="List Options"
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" /></svg>
                              </button>

                              {isPlusMenuOpen === list.id && (
                                <div className="absolute right-2 top-full mt-1 w-32 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-100 dark:border-gray-700 z-[100] py-1 animate-scale-in origin-top-right">
                                  <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); openRenameModal('List', list.id, list.name); setIsPlusMenuOpen(null); }} className="w-full text-left px-3 py-1.5 text-[11px] text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium">Rename List</button>
                                  <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); openDeleteModal('List', list.id, list.name); setIsPlusMenuOpen(null); }} className="w-full text-left px-3 py-1.5 text-[11px] text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors font-medium">Delete List</button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="px-2 py-3 border-t border-gray-100 dark:border-gray-700">
              <div className="flex items-center justify-between px-2 mb-1">
                <div className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Favorites</div>
                <NavLink to="/tasks/favorites" className="text-[10px] text-indigo-500 hover:underline">View All</NavLink>
              </div>
              <div className="space-y-0.5">
                {favoriteTasks.slice(0, 5).map(task => (
                  <NavLink key={task.id} to={`/tasks/${task.id}`} state={{ backgroundLocation: location }} className={({ isActive }) => `flex items-start ${isSidebarMini ? 'justify-center' : 'gap-2.5 px-2'} py-2 rounded-lg text-[13px] transition-colors ${isActive ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-gray-700 hover:bg-gray-100'}`}>
                    <svg className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>
                    {!isSidebarMini && <span className="truncate text-gray-900 font-medium">{task.title}</span>}
                  </NavLink>
                ))}
              </div>
            </div>

            <div className="px-2 py-3 border-t border-gray-100 dark:border-gray-700">
              {!isSidebarMini && (
                <div className="flex items-center justify-between px-2 py-1 text-[13px] text-gray-600 dark:text-gray-400 uppercase tracking-widest font-bold opacity-80 mb-1">
                  <span>Direct Messages</span>
                  {members.length > 10 && (
                    <button
                      onClick={() => setShowAllMembers(!showAllMembers)}
                      className="text-[10px] text-indigo-500 hover:underline lowercase font-normal"
                    >
                      {showAllMembers ? 'Show Less' : `View All (${members.length})`}
                    </button>
                  )}
                </div>
              )}
              <div className={`${isSidebarMini ? '' : 'pl-1 ml-1'} mt-1 space-y-0.5 relative font-sans`}>
                {(showAllMembers ? members : members.slice(0, 10))
                  .sort((a, b) => {
                    if (a.user?.id === currentUser?.id) return -1;
                    if (b.user?.id === currentUser?.id) return 1;
                    return 0;
                  })
                  .map((m: any) => {
                    const user = m.user;
                    if (!user) return null;
                    const isOnline = onlineUsers.has(user.id);
                    const isMe = user.id === currentUser?.id;
                    const unreadMsgCount = unreadMessageCounts[user.id] || 0;

                    return (
                      <NavLink
                        key={user.id}
                        to={`/tasks/team?userId=${user.id}`}
                        onClick={() => {
                          setUnreadMessageCounts(prev => ({ ...prev, [user.id]: 0 }));
                        }}
                        className={({ isActive }) => `flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-[13px] transition-colors ${isActive ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 font-medium' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50'}`}
                      >
                        <div className="relative shrink-0">
                          {user.avatarUrl ? (
                            <img
                              src={user.avatarUrl}
                              alt=""
                              className="w-7 h-7 rounded-lg object-cover shadow-sm border border-gray-100 dark:border-gray-800"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                                const p = (e.target as HTMLImageElement).parentElement;
                                if (p && !p.querySelector('.avatar-placeholder')) {
                                  const d = document.createElement('div');
                                  d.className = `avatar-placeholder w-7 h-7 rounded-lg ${isMe ? 'bg-indigo-500' : 'bg-gray-400'} text-white flex items-center justify-center text-[11px] font-bold shadow-sm`;
                                  d.innerText = user.firstName?.charAt(0).toUpperCase() || 'U';
                                  p.appendChild(d);
                                }
                              }}
                            />
                          ) : (
                            <span className={`w-7 h-7 rounded-lg ${isMe ? 'bg-indigo-500' : 'bg-gray-400'} text-white flex items-center justify-center text-[11px] font-bold shadow-sm`}>
                              {user.firstName?.charAt(0).toUpperCase() || 'U'}
                            </span>
                          )}
                          {isOnline && (
                            <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white dark:border-[#0F172A]" />
                          )}
                        </div>
                        {!isSidebarMini && (
                          <div className="flex-1 min-w-0 flex items-center justify-between group/dm-item">
                            <span className="truncate">
                              {user.firstName} {user.lastName} {isMe && "(You)"}
                            </span>
                            {unreadMsgCount > 0 && (
                              <div className="flex items-center justify-center w-5 h-5 bg-indigo-500 text-white text-[10px] font-black rounded-full shadow-lg ring-2 ring-white dark:ring-gray-950 animate-bounce shrink-0 ml-2">
                                {unreadMsgCount}
                              </div>
                            )}
                            {isMe && (
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  // Trigger the existing avatar upload logic or a simple alert for now
                                  document.getElementById('user-avatar-upload')?.click();
                                }}
                                className="hidden group-hover/dm-item:flex p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                                title="Upload Profile Image"
                              >
                                <svg className="w-3 h-3 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                              </button>
                            )}
                          </div>
                        )}
                      </NavLink>
                    );
                  })}
              </div>
            </div>
          </div>
        )}

        <div className="px-3 py-2 border-t border-gray-100 dark:border-gray-700 mt-auto sticky bottom-0 bg-gray-50/90 dark:bg-gray-950/90 backdrop-blur">
          <button onClick={() => setIsSidebarMini(!isSidebarMini)} className="flex items-center justify-center w-full py-1.5 rounded-lg text-gray-400 hover:text-gray-600 transition-colors" title={isSidebarMini ? "Expand Sidebar" : "Collapse Sidebar"}>
            {isSidebarMini ? <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg> : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" /></svg>}
          </button>
        </div>

        <div onMouseDown={startResizing} className="absolute top-0 right-0 w-1 h-full cursor-col-resize z-50 hover:bg-indigo-500 transition-colors" />

      </aside>

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <header className="px-4 py-2.5 flex items-center gap-4 border-b border-gray-100 dark:border-gray-800 bg-white/80 dark:bg-gray-950/80 backdrop-blur z-30">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-gray-600 hover:text-gray-900" title="Open Menu"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16" /></svg></button>
          <div className="flex items-center gap-3 shrink-0">
            <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-300" title="Go back"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg></button>
            <h2 className="text-sm font-bold text-gray-800 dark:text-gray-200 tracking-tight">{pageTitle()}</h2>
          </div>
          <div className="flex-1 flex justify-center"><SearchTrigger onClick={() => setSearchOpen(true)} /></div>
          <div className="flex items-center gap-2 shrink-0">
            <GlobalTimer />
            <NotificationBell />
            <button onClick={toggleThemeMode} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors" title={isDark ? "Light Mode" : "Dark Mode"}>
              {isDark ? <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg> : <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>}
            </button>
            <div className="relative" ref={userDropdownRef}>
              <button onClick={() => setUserDropdownOpen(!userDropdownOpen)} className="w-7 h-7 rounded-full bg-purple-600 text-white flex items-center justify-center text-xs font-semibold hover:ring-2 hover:ring-purple-300 transition-all overflow-hidden shrink-0" title="User Menu">
                {currentUser?.avatarUrl ? <img src={currentUser.avatarUrl} alt="" className="w-full h-full object-cover" /> : currentUser?.firstName?.charAt(0).toUpperCase()}
              </button>
              {userDropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-[#1E2530] rounded-xl shadow-xl border border-gray-100 dark:border-gray-800 py-1 z-50 overflow-hidden animate-scale-in origin-top-right">
                  <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-800">
                    <div className="text-sm font-bold text-gray-900 dark:text-white truncate">{currentUser?.firstName} {currentUser?.lastName}</div>
                    <div className="text-[11px] text-gray-500 truncate">{currentUser?.email}</div>
                  </div>
                  <button onClick={() => { navigate('/settings'); setUserDropdownOpen(false); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50">Settings</button>
                  {(isOwner || isAdmin) && (
                    <button onClick={() => { navigate('/people'); setUserDropdownOpen(false); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50">Manage People</button>
                  )}
                  <div className="border-t border-gray-100 dark:border-gray-800 my-1" />
                  <button onClick={logout} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 hover:text-red-700 font-medium">Log out</button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto relative animate-fade-in custom-scrollbar">
          <Outlet />
        </main>
      </div>
      {incomingCall && (
        <VideoCallModal
          onClose={handleDeclineCall}
          onAccept={handleAcceptCall}
          isReceiving={true}
          targetUser={{
            name: incomingCall.callerName,
            initials: (incomingCall.callerName || '').split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase() || '?',
            color: '#6366f1' // Default color for incoming
          }}
        />
      )}
      <SearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
      {isCreateFolderOpen && activeSpaceId && <CreateFolderModal spaceId={activeSpaceId} onClose={() => setIsCreateFolderOpen(false)} onSuccess={fetchSpaces} />}
      {isCreateListOpen && activeSpaceId && <CreateListModal spaceId={activeSpaceId} folderId={activeFolderId || undefined} onClose={() => setIsCreateListOpen(false)} onSuccess={fetchSpaces} />}
      {deleteData && <DeleteConfirmModal type={deleteData.type} title={deleteData.title} id={deleteData.id} onClose={() => setDeleteData(null)} onSuccess={fetchSpaces} />}
      {renameData && <RenameModal type={renameData.type} initialTitle={renameData.title} id={renameData.id} onClose={() => setRenameData(null)} onSuccess={fetchSpaces} />}
    </div>
  );
}
