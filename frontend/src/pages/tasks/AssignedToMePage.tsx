import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { useAppSelector } from '../../store';
import api from '../../services/api';
import { useSocket } from '../../hooks/useSocket';
import { Loading } from '../../components/ui/Loading';
import { useOrgRole } from '../../hooks/useOrgRole';
import { cn } from '../../utils/cn';
import type { Task, TaskStatus, TaskPriority } from '../../types';

/* ─── Status config ──────────────────────────────────────────── */

const STATUS_GROUPS: { key: TaskStatus; label: string; color: string; bg: string; dot: string }[] = [
  { key: 'OPEN', label: 'OPEN', color: 'text-gray-900 dark:text-gray-100', bg: 'bg-gray-100 dark:bg-gray-800', dot: 'bg-gray-400' },
  { key: 'IN_PROGRESS', label: 'IN PROGRESS', color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-950/30', dot: 'bg-red-500' },
  { key: 'PENDING', label: 'PENDING', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/30', dot: 'bg-amber-500' },
  { key: 'IN_REVIEW', label: 'IN REVIEW', color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-950/30', dot: 'bg-purple-500' },
  { key: 'COMPLETED', label: 'COMPLETED', color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-950/30', dot: 'bg-green-500' },
  { key: 'ACCEPTED', label: 'ACCEPTED', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-950/30', dot: 'bg-blue-500' },
  { key: 'REJECTED', label: 'REJECTED', color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-50 dark:bg-rose-950/30', dot: 'bg-rose-500' },
  { key: 'CLOSED', label: 'CLOSED', color: 'text-gray-500 dark:text-gray-400', bg: 'bg-gray-50 dark:bg-gray-900/40', dot: 'bg-gray-300' },
];

/* ─── Priority config ────────────────────────────────────────── */
type PriorityKey = TaskPriority;
const PRIORITY_META: Record<PriorityKey, { label: string; color: string }> = {
  URGENT: { label: 'Urgent', color: '#ef4444' },
  HIGH: { label: 'High', color: '#f97316' },
  MEDIUM: { label: 'Normal', color: '#3b82f6' },
  LOW: { label: 'Low', color: '#6b7280' },
};

/* ─── Relative date ──────────────────────────────────────────── */
function relativeDate(dateStr: string | null): { text: string; overdue: boolean } {
  if (!dateStr) return { text: '', overdue: false };
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const due = new Date(dateStr); due.setHours(0, 0, 0, 0);
  const diff = Math.round((now.getTime() - due.getTime()) / 86400000);
  if (diff < 0) return { text: `${Math.abs(diff)}d`, overdue: false };
  if (diff === 0) return { text: 'Today', overdue: false };
  if (diff === 1) return { text: 'Yesterday', overdue: true };
  return { text: `${diff}d`, overdue: true };
}

/* ─── Icon helpers ───────────────────────────────────────────── */
function FlagIcon({ color }: { color: string }) {
  return (
    <svg width="12" height="12" viewBox="0 0 20 20" fill={color}>
      <path d="M4 3a1 1 0 00-1 1v13a1 1 0 102 0v-5h4.586l.707.707A1 1 0 0011 13h5a1 1 0 001-1V5a1 1 0 00-1-1h-4.586l-.707-.707A1 1 0 0010 3H4z" />
    </svg>
  );
}

function AvatarPill({ firstName, lastName, avatarUrl }: { firstName: string; lastName: string; avatarUrl?: string | null }) {
  const letters = `${firstName ? firstName.charAt(0) : '?'}${lastName ? lastName.charAt(0) : ''}`.toUpperCase();
  const colors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899'];
  const color = colors[(firstName ? firstName.charCodeAt(0) : 0 + (lastName ? lastName.charCodeAt(0) : 0)) % colors.length];

  if (avatarUrl) return (
    <img
      src={avatarUrl}
      alt=""
      className="w-full h-full object-cover rounded-md"
      onError={(e) => {
        const img = e.target as HTMLImageElement;
        img.style.display = 'none';
        const parent = img.parentElement;
        if (parent && !parent.querySelector('.avatar-placeholder')) {
          const div = document.createElement('div');
          div.className = 'w-full h-full text-white text-[8px] font-black flex items-center justify-center shrink-0 rounded-md';
          div.style.backgroundColor = color;
          div.innerText = letters;
          parent.appendChild(div);
        }
      }}
    />
  );

  return <AvatarFallback letters={letters} color={color} />;
}

function AvatarFallback({ letters, color }: { letters: string; color: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.style.backgroundColor = color;
  }, [color]);
  return (
    <div ref={ref} className="w-full h-full text-white text-[8px] font-black flex items-center justify-center shrink-0 rounded-md">
      {letters}
    </div>
  );
}

function TagBadge({ color, name }: { color: string; name: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.style.backgroundColor = color || '#3b82f6';
  }, [color]);
  return (
    <span
      ref={ref}
      className="px-1.5 py-0.5 rounded-[4px] text-[9px] font-black text-white shadow-sm shrink-0 whitespace-nowrap uppercase tracking-tighter"
    >
      {name}
    </span>
  );
}

/* ─── Main component ─────────────────────────────────────────── */
export function AssignedToMePage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'STATUS' | 'FAVORITES'>('STATUS');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const navigate = useNavigate();
  const location = useLocation();
  const { canDeleteTask } = useOrgRole();

  /* Search / filter */
  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);


  /* Load tasks */
  const currentOrg = useAppSelector(state => state.organization.currentOrg);
  const loadTasks = useCallback(() => {
    const params = currentOrg?.id ? `?orgId=${currentOrg.id}` : '';
    api.get<{ success: boolean; data: Task[] }>(`/tasks/my${params}`)
      .then(r => setTasks(r.data.data))
      .catch(() => { })
      .finally(() => setLoading(false));
  }, [currentOrg?.id]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const socket = useSocket();
  useEffect(() => {
    if (!socket) return;
    let timeout: any;
    const handleRefresh = () => {
      clearTimeout(timeout);
      timeout = setTimeout(loadTasks, 500);
    };
    socket.on('task:updated', handleRefresh);
    socket.on('task:refresh', handleRefresh);
    return () => {
      clearTimeout(timeout);
      socket.off('task:updated', handleRefresh);
      socket.off('task:refresh', handleRefresh);
    };
  }, [socket, loadTasks]);

  useEffect(() => { if (showSearch && searchRef.current) searchRef.current.focus(); }, [showSearch]);

  const toggleGroup = (key: string) => setCollapsed(p => ({ ...p, [key]: !p[key] }));

  const filtered = useMemo(() => {
    let base = tasks;
    const filterParam = new URLSearchParams(location.search).get('filter');

    if (filterParam === 'today') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      base = base.filter(t => {
        if (!t.dueDate) return false;
        const due = new Date(t.dueDate);
        due.setHours(0, 0, 0, 0);
        return due.getTime() <= today.getTime() && t.status !== 'CLOSED' && t.status !== 'COMPLETED';
      });
    }

    if (view === 'FAVORITES') {
      base = base.filter(t => t.isFavorite);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      base = base.filter(t => t.title.toLowerCase().includes(q));
    }
    return base;
  }, [tasks, search, view, location.search]);

  const toggleFavorite = async (e: React.MouseEvent, taskId: string, current: boolean) => {
    e.stopPropagation();
    try {
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, isFavorite: !current } : t));
      await api.patch(`/tasks/${taskId}`, { isFavorite: !current });
    } catch {
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, isFavorite: current } : t));
    }
  };

  const deleteTask = async (taskId: string) => {
    if (!confirm('Are you sure you want to delete this task?')) return;
    try {
      await api.delete(`/tasks/${taskId}`);
      setTasks(p => p.filter(t => t.id !== taskId));
    } catch {
      alert('Failed to delete task');
    }
  };


  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  useEffect(() => {
    const closeMenu = () => setActiveMenu(null);
    window.addEventListener('click', closeMenu);
    return () => window.removeEventListener('click', closeMenu);
  }, []);

  if (loading) return <Loading size="lg" />;

  return (
    <div className="w-full h-full bg-white dark:bg-gray-900 flex flex-col font-sans antialiased text-gray-800">

      {/* ── Top toolbar ── */}
      <div className="h-[52px] flex items-center justify-between px-6 bg-white dark:bg-[#0f172a] border-b border-gray-100 dark:border-gray-800 sticky top-0 z-20 shrink-0">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setView('STATUS')}
            className={`flex items-center gap-1.5 h-8 px-3 rounded-lg transition-all ${view === 'STATUS'
              ? 'bg-[#f0f0ff] dark:bg-indigo-900/20 shadow-sm'
              : 'hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            title="View by Status"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={view === 'STATUS' ? "#7c3aed" : "currentColor"} strokeWidth="2.5">
              <rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 3v18M15 3v18M3 9h18M3 15h18" />
            </svg>
            <span className={`text-[11px] font-black uppercase tracking-wide ${view === 'STATUS' ? 'text-[#7c3aed]' : 'text-gray-500'}`}>Status</span>
          </button>

          <button
            onClick={() => setView('FAVORITES')}
            className={`flex items-center gap-1.5 h-8 px-3 rounded-lg transition-all ${view === 'FAVORITES'
              ? 'bg-[#f0f0ff] dark:bg-indigo-900/20 shadow-sm'
              : 'hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            title="View Favorites"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill={view === 'FAVORITES' ? "#7c3aed" : "none"} stroke={view === 'FAVORITES' ? "#7c3aed" : "currentColor"} strokeWidth="2.5">
              <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
            <span className={`text-[11px] font-black uppercase tracking-wide ${view === 'FAVORITES' ? 'text-[#7c3aed]' : 'text-gray-500'}`}>Favorites</span>
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button title="Filter" className="w-9 h-9 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg"><svg width="16" height="16" viewBox="0 0 24 24" stroke="currentColor" fill="none" strokeWidth="2"><path d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg></button>
          <button title="Refresh" onClick={loadTasks} className="w-9 h-9 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg"><svg width="16" height="16" viewBox="0 0 24 24" stroke="currentColor" fill="none" strokeWidth="2.5"><path d="M23 4v6h-6" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" /></svg></button>
          <button title="Search" onClick={() => setShowSearch(!showSearch)} className="w-9 h-9 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg"><svg width="16" height="16" viewBox="0 0 24 24" stroke="currentColor" fill="none" strokeWidth="2.5"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg></button>
          <div className="w-[1px] h-4 bg-gray-100 mx-2"></div>
          <button title="Settings" className="w-9 h-9 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg"><svg width="16" height="16" viewBox="0 0 24 24" stroke="currentColor" fill="none" strokeWidth="2.5"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg></button>
        </div>
      </div>

      {showSearch && (
        <div className="px-6 py-2 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800 flex items-center gap-3">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2.5"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
          <input
            ref={searchRef}
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Filter tasks by name..."
            className="flex-1 bg-transparent outline-none text-sm font-medium text-gray-700 dark:text-gray-200"
            autoFocus
            title="Filter tasks"
          />
          <button onClick={() => { setShowSearch(false); setSearch(''); }} className="text-gray-400 hover:text-gray-600" title="Close Search"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6L6 18M6 6l12 12" /></svg></button>
        </div>
      )}

      {/* ── Task groups ── */}
      <div className="flex-1 overflow-y-auto">
        {STATUS_GROUPS.map(group => {
          const groupTasks = filtered.filter(t => t.status === group.key);
          const isCollapsed = collapsed[group.key] ?? false;
          if (groupTasks.length === 0) return null;

          return (
            <div key={group.key} className="mt-4">
              <div
                className="flex items-center px-6 py-1 cursor-pointer group/hdr"
                onClick={() => toggleGroup(group.key)}
              >
                <div className="w-5 flex items-center justify-center mr-1">
                  <svg
                    width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="4"
                    className={`shrink-0 transition-transform ${isCollapsed ? '-rotate-90' : ''}`}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>

                <div className={cn("px-2 py-0.5 rounded flex items-center gap-1.5 mr-2 border border-gray-100 dark:border-gray-800", group.bg)}>
                  <div className={cn("w-2.5 h-2.5 rounded-full border-2 border-dashed border-gray-400 dark:border-gray-500", group.dot)} />
                  <span className={cn("text-[10px] font-bold uppercase tracking-wide leading-none", group.color)}>{group.label}</span>
                </div>

                <span className="text-[11px] font-bold text-gray-400 mr-1.5 tabular-nums">
                  {groupTasks.length}
                </span>

                <div className="flex items-center gap-1 opacity-10 opacity-0 group-hover/hdr:opacity-100 transition-opacity">
                  <span className="text-[10px] text-gray-300 font-bold tracking-widest px-1 mr-1">...</span>
                  <button title="Group Options" onClick={e => e.stopPropagation()} className="p-1 text-gray-400 hover:text-gray-600 rounded">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="opacity-80"><circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" /></svg>
                  </button>
                </div>
              </div>

              {!isCollapsed && (
                <div className="mt-2">
                  {/* Column Headers */}
                  <div className="flex items-center px-6 py-1.5 border-b border-gray-50 text-[11px] font-medium text-gray-400 select-none">
                    <div className="w-[60%] pl-7">Name</div>
                    <div className="w-[15%] text-left">Assignee</div>
                    <div className="w-[12%] flex items-center gap-1">Due date</div>
                    <div className="w-[10%]">Priority</div>
                    <div className="flex-1 flex justify-end">
                      <div className="w-5 h-5 flex items-center justify-center rounded-full border border-gray-200 text-gray-400 hover:text-indigo-600 transition-colors cursor-pointer">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M12 5v14M5 12h14" /></svg>
                      </div>
                    </div>
                  </div>

                  {/* Rows */}
                  {groupTasks.map(task => {
                    const due = relativeDate(task.dueDate);
                    const pr = PRIORITY_META[task.priority];
                    return (
                      <div
                        key={task.id}
                        onClick={() => navigate(`/tasks/${task.id}`, { state: { backgroundLocation: location } })}
                        className="flex items-center px-6 h-[44px] hover:bg-gray-50/80 dark:hover:bg-gray-800/50 group border-b border-gray-100 dark:border-gray-800 transition-all cursor-pointer"
                      >
                        <div className="w-[60%] flex items-center gap-3 min-w-0 pr-4">
                          <div className="shrink-0 w-8 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => toggleFavorite(e, task.id, task.isFavorite)}
                              title={task.isFavorite ? "Unfavorite" : "Favorite"}
                              className={`transition-all ${task.isFavorite ? 'text-amber-400 scale-110 opacity-100' : 'text-gray-300 hover:text-amber-400'}`}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill={task.isFavorite ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2"><path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>
                            </button>
                          </div>

                          <div className="shrink-0 w-5 h-5 rounded-md border border-gray-200 dark:border-gray-700 flex items-center justify-center">
                            <div className="w-2 h-2 rounded-sm bg-gray-300 dark:bg-gray-600" />
                          </div>

                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <span className="text-[13px] font-medium text-gray-700 dark:text-gray-200 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 block transition-colors">
                              {task.title}
                            </span>
                            {task.tags && task.tags.length > 0 && (
                              <div className="flex items-center gap-1 shrink-0 overflow-hidden">
                                {task.tags.map(tag => (
                                  <TagBadge key={tag.id} color={tag.color || '#3b82f6'} name={tag.name} />
                                ))}
                              </div>
                            )}
                            {task.project && (
                              <div className="px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-900/20 text-blue-500 dark:text-blue-400 text-[9px] font-bold uppercase tracking-tight border border-blue-100/50 dark:border-blue-800/50 shrink-0">
                                {task.project.name.charAt(0).toUpperCase()}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="w-[15%] flex items-center pl-1">
                          <div className="flex -space-x-1">
                            {task.assignees?.slice(0, 3).map(a => (
                              <div key={a.id} className="w-[22px] h-[22px] rounded-md border-2 border-white dark:border-gray-800 overflow-hidden bg-white dark:bg-gray-800 shadow-sm">
                                <AvatarPill firstName={a.firstName} lastName={a.lastName} avatarUrl={a.avatarUrl} />
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="w-[12%] flex items-center gap-1.5 text-gray-400 pr-2">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                          <span className={`text-[11px] font-medium ${due.overdue ? 'text-red-500' : ''}`}>{due.text || ''}</span>
                        </div>

                        <div className="w-[10%] flex items-center gap-2">
                          <FlagIcon color={pr.color} />
                          <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400">{pr.label}</span>
                        </div>

                        <div className="flex-1 flex items-center justify-end pr-4 pl-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className={`flex items-center gap-1 transition-opacity ${activeMenu === task.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                            <div className="relative">
                              <button
                                title="More actions"
                                onClick={e => { e.stopPropagation(); setActiveMenu(activeMenu === task.id ? null : task.id); }}
                                className={`p-1 rounded transition-colors ${activeMenu === task.id ? 'bg-indigo-100 text-indigo-600' : 'text-gray-300 hover:text-gray-500'}`}
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" /></svg>
                              </button>

                              {activeMenu === task.id && (
                                <div className="absolute right-0 top-full mt-1.5 w-48 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-100 dark:border-gray-700 z-[100] py-1.5 overflow-hidden animate-scale-in origin-top-right">
                                  <button
                                    onClick={(e) => toggleFavorite(e, task.id, task.isFavorite)}
                                    className="w-full text-left px-4 py-2 text-[13px] hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-gray-700 dark:text-gray-200 flex items-center gap-3 group transition-colors"
                                  >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill={task.isFavorite ? "#f59e0b" : "none"} stroke={task.isFavorite ? "#f59e0b" : "currentColor"} strokeWidth="2.5" className="group-hover:scale-110 transition-transform">
                                      <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                                    </svg>
                                    {task.isFavorite ? 'Remove from Favorites' : 'Add to Favorites'}
                                  </button>
                                  {canDeleteTask && (
                                    <>
                                      <div className="my-1 border-t border-gray-100 dark:border-gray-700/50" />
                                      <button
                                        onClick={(e) => { e.stopPropagation(); deleteTask(task.id); }}
                                        className="w-full text-left px-4 py-2 text-[12px] text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors font-medium"
                                      >
                                        Delete Task
                                      </button>
                                    </>
                                  )}
                                </div>
                              )}
                            </div>

                            {canDeleteTask && !activeMenu && (
                              <button
                                title="Delete task"
                                onClick={e => { e.stopPropagation(); deleteTask(task.id); }}
                                className="p-1.5 text-gray-300 hover:text-red-500 rounded-md transition-colors"
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6L6 18M6 6l12 12" /></svg>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                </div>
              )}
            </div>
          );
        })}

      </div>
    </div>
  );
}
