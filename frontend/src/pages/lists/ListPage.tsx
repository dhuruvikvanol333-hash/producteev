import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, Link, useLocation } from 'react-router';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../services/api';
import { useSocket } from '../../hooks/useSocket';
import { useAppSelector } from '../../store';
import { useAuth } from '../../hooks/useAuth';
import { useOrgRole } from '../../hooks/useOrgRole';
import { Loading } from '../../components/ui/Loading';
import { useToast } from '../../components/ui/Toast';
import { BulkActionBar } from '../../components/ui/BulkActionBar';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { AvatarStack } from '../../components/ui/AvatarStack';
import { Dropdown, DropdownItem } from '../../components/ui/Dropdown';
import type { Task, TaskStatus, TaskPriority, List, User } from '../../types';

// ─── Config ────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<TaskStatus, {
  label: string; color: string; dot: string; bg: string; ring: string; glow: string;
}> = {
  OPEN: { label: 'Open', color: 'text-[#3E4C59] dark:text-[#CBD5E0]', dot: 'bg-[#52606D]', bg: 'bg-[#F1F5F8] dark:bg-[#2D3748]', ring: 'ring-[#E4E7EB] dark:ring-[#4A5568]', glow: '' },
  PENDING: { label: 'Pending', color: 'text-[#243B53]', dot: 'bg-[#243B53]', bg: 'bg-[#FADB5E]', ring: 'ring-[#F9D03D]', glow: 'shadow-[#FADB5E]/20' },
  IN_PROGRESS: { label: 'In Progress', color: 'text-white', dot: 'bg-white', bg: 'bg-[#E11D48]', ring: 'ring-[#BE123C]', glow: 'shadow-[#E11D48]/30' },
  IN_REVIEW: { label: 'In Review', color: 'text-white', dot: 'bg-white', bg: 'bg-[#EA580C]', ring: 'ring-[#C2410C]', glow: 'shadow-[#EA580C]/30' },
  ACCEPTED: { label: 'Accepted', color: 'text-white', dot: 'bg-white', bg: 'bg-[#C5221F]', ring: 'ring-[#A50E0E]', glow: 'shadow-[#C5221F]/30' },
  COMPLETED: { label: 'Completed', color: 'text-white', dot: 'bg-[#38BDF8]', bg: 'bg-[#000000]', ring: 'ring-[#1E293B]', glow: 'shadow-black/20' },
  REJECTED: { label: 'Rejected', color: 'text-white', dot: 'bg-white', bg: 'bg-[#9C27B0]', ring: 'ring-[#7B1FA2]', glow: 'shadow-[#9C27B0]/30' },
  CLOSED: { label: 'Closed', color: 'text-white', dot: 'bg-white', bg: 'bg-[#2E7D32]', ring: 'ring-[#1B5E20]', glow: 'shadow-[#2E7D32]/30' },
};

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
  URGENT: {
    label: 'Urgent',
    icon: <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" /></svg>,
    color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-950/40',
  },
  HIGH: {
    label: 'High',
    icon: <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M7 14l5-5 5 5H7z" /></svg>,
    color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-950/40',
  },
  MEDIUM: {
    label: 'Medium',
    icon: <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M5 11h14v2H5z" /></svg>,
    color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-950/40',
  },
  LOW: {
    label: 'Low',
    icon: <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M7 10l5 5 5-5H7z" /></svg>,
    color: 'text-slate-400', bg: 'bg-slate-50 dark:bg-slate-800/40',
  },
};

const STATUS_ORDER: TaskStatus[] = ['OPEN', 'PENDING', 'IN_PROGRESS', 'IN_REVIEW', 'ACCEPTED', 'COMPLETED', 'REJECTED', 'CLOSED'];

// ─── Sub-components ─────────────────────────────────────────────────────────

function PriorityBadge({ priority }: { priority: TaskPriority }) {
  const cfg = PRIORITY_CONFIG[priority];
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${cfg.color} ${cfg.bg}`}>
      {cfg.icon}
      <span className="hidden sm:inline">{cfg.label}</span>
    </span>
  );
}


function formatDate(d: string | null) {
  if (!d) return null;
  const date = new Date(d);
  const now = new Date();
  const diff = (date.getTime() - now.getTime()) / 86400000;
  const str = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  if (diff < 0) return { str, overdue: true };
  if (diff < 2) return { str, soon: true };
  return { str, overdue: false, soon: false };
}

// ─── Assignee Picker Component ───────────────────────────────────────────────

interface AssigneePickerProps {
  task: Task;
  members: User[];
  canUpdate: boolean;
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  onAssign: (taskId: string, ids: string[]) => void;
}

function AssigneePicker({ task, members, canUpdate, isOpen, onOpen, onClose, onAssign }: AssigneePickerProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [search, setSearch] = React.useState('');

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen, onClose]);

  const filtered = members.filter(m => {
    const name = `${m.firstName} ${m.lastName} ${m.email}`.toLowerCase();
    return name.includes(search.toLowerCase());
  });

  return (
    <div ref={wrapperRef} className="relative inline-flex">
      {/* Avatar trigger */}
      <div
        onClick={e => {
          if (!canUpdate) return;
          e.stopPropagation();
          isOpen ? onClose() : onOpen();
        }}
        className={`p-1 rounded-lg transition-all ${canUpdate ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700' : 'cursor-default'
          }`}
        title="Manage assignees"
      >
        <AvatarStack
          users={task.assignees}
          size="sm"
          showPlaceholder
          max={3}
          onRemove={canUpdate ? (uid) => {
            const cur = task.assigneeIds || task.assignees?.map(a => a.id) || [];
            onAssign(task.id, cur.filter(i => i !== uid));
          } : undefined}
        />
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div
          className="absolute top-full mt-1.5 left-1/2 -translate-x-1/2 w-64 min-w-[240px] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl z-[200] overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {/* Search */}
          <div className="p-2 border-b border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 rounded-xl px-2.5 py-2">
              <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search members..."
                autoFocus
                className="flex-1 text-xs bg-transparent outline-none text-gray-900 dark:text-white placeholder-gray-400 font-medium"
              />
              {search && (
                <button onClick={() => setSearch('')} className="text-gray-300 hover:text-gray-500" title="Clear search">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              )}
            </div>
          </div>

          {/* Assigned section */}
          {task.assignees && task.assignees.length > 0 && (
            <>
              <div className="px-3 pt-2 pb-1 text-[10px] font-black uppercase tracking-widest text-violet-500 dark:text-violet-400">
                Assigned
              </div>
              {task.assignees.map(a => (
                <button
                  key={a.id}
                  onClick={e => {
                    e.preventDefault(); e.stopPropagation();
                    const cur = (task.assignees || []).map(x => x.id);
                    onAssign(task.id, cur.filter(i => i !== a.id));
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors group"
                >
                  <AvatarStack users={[a]} size="sm" />
                  <div className="flex-1 text-left min-w-0">
                    <div className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">{a.firstName} {a.lastName}</div>
                  </div>
                  <svg className="w-3.5 h-3.5 text-violet-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </button>
              ))}
              <div className="mx-3 my-1 border-t border-gray-100 dark:border-gray-800" />
            </>
          )}

          {/* Available members */}
          <div className="max-h-52 overflow-y-auto">
            {filtered.filter(m => !(task.assignees || []).some(a => a.id === m.id)).length > 0 ? (
              <>
                <div className="px-3 pt-1.5 pb-1 text-[10px] font-black uppercase tracking-widest text-gray-400">
                  Add member
                </div>
                {filtered
                  .filter(m => !(task.assignees || []).some(a => a.id === m.id))
                  .map(u => (
                    <button
                      key={u.id}
                      onClick={e => {
                        e.preventDefault(); e.stopPropagation();
                        const cur = (task.assignees || []).map(a => a.id);
                        onAssign(task.id, [...cur, u.id]);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                      <AvatarStack users={[u]} size="sm" />
                      <div className="flex-1 text-left min-w-0">
                        <div className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">{u.firstName} {u.lastName}</div>
                        <div className="text-[10px] text-gray-400 truncate">{u.email}</div>
                      </div>
                    </button>
                  ))}
              </>
            ) : (
              task.assignees && task.assignees.length === 0 && (
                <div className="py-6 text-center text-xs text-gray-400">No members found</div>
              )
            )}
          </div>

          {/* Footer */}
          {task.assignees && task.assignees.length > 0 && (
            <div className="p-2 border-t border-gray-100 dark:border-gray-800">
              <button
                onClick={() => onAssign(task.id, [])}
                className="w-full py-1.5 text-xs font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                title="Remove all assignees"
              >
                Remove all
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ListIconBox({ color }: { color: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) {
      ref.current.style.background = `linear-gradient(135deg, ${color}, ${color}cc)`;
    }
  }, [color]);
  return (
    <div
      ref={ref}
      className="w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-lg shrink-0"
    >
      <svg className="w-4.5 h-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
        <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" />
        <line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" />
        <line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
      </svg>
    </div>
  );
}

function ProgressBarFill({ color, progress }: { color: string; progress: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) {
      ref.current.style.background = `linear-gradient(90deg, ${color}, ${color}aa)`;
    }
  }, [color]);
  return (
    <motion.div
      ref={ref}
      className="h-full rounded-full"
      initial={{ width: 0 }}
      animate={{ width: `${progress}%` }}
      transition={{ duration: 0.8, ease: 'easeOut' }}
    />
  );
}

function ActionBtn({ color, children, onClick, title, className, shadowAlpha = '50' }: any) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (ref.current) {
      ref.current.style.background = `linear-gradient(135deg, ${color}, ${color}cc)`;
      ref.current.style.boxShadow = `0 4px 14px ${color}${shadowAlpha}`;
    }
  }, [color, shadowAlpha]);
  return (
    <button ref={ref} onClick={onClick} className={className} title={title}>
      {children}
    </button>
  );
}

function TagPill({ color, name }: { color: string; name: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (ref.current) {
      ref.current.style.backgroundColor = `${color}25`;
      ref.current.style.color = color;
    }
  }, [color]);
  return (
    <span ref={ref} className="shrink-0 px-1.5 py-0.5 rounded-md text-[10px] font-bold" title={name}>
      {name}
    </span>
  );
}

function EmptyStateIcon({ color }: { color: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) {
      ref.current.style.background = `linear-gradient(135deg, ${color}20, ${color}10)`;
    }
  }, [color]);
  return (
    <div ref={ref} className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 shadow-lg">
      <svg className="w-8 h-8" fill="none" stroke={color} viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export function ListPage() {
  const { id } = useParams();
  const toast = useToast();
  const socket = useSocket();
  const currentOrg = useAppSelector(state => state.organization.currentOrg);

  const [list, setList] = useState<List | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<User[]>([]);
  const [error, setError] = useState<string | null>(null);

  // UI states
  const [viewMode, setViewMode] = useState<'list' | 'board' | 'box'>('list');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [addingInStatus, setAddingInStatus] = useState<TaskStatus | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<TaskStatus>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const location = useLocation();

  // Assignee picker
  useAuth();
  const [activeAssigneeTaskId, setActiveAssigneeTaskId] = useState<string | null>(null);

  // Rename
  const [renamingTaskId, setRenamingTaskId] = useState<string | null>(null);
  const [renamingTitle, setRenamingTitle] = useState('');

  const { canCreateTask, canDeleteTask, canUpdateTaskDetails, canUpdateTaskStatus, isReadOnly } = useOrgRole();

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [listRes, tasksRes] = await Promise.all([
        api.get<{ success: boolean; data: List }>(`/lists/${id}`).catch(err => ({
          data: { success: false, data: null, message: err.response?.status === 404 ? 'List not found' : 'Server error' }
        } as any)),
        api.get<{ success: boolean; data: Task[] }>(`/tasks/list/${id}`).catch(() => ({
          data: { success: false, data: [] }
        })),
      ]);
      if (listRes.data.success && listRes.data.data) {
        setList(listRes.data.data);
      } else {
        setError(listRes.data.message || 'List not found');
      }
      if (tasksRes.data.success) setTasks(tasksRes.data.data);
    } catch {
      setError('An unexpected error occurred');
      toast.error('Failed to load list');
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  const loadAllMembers = useCallback(async () => {
    if (!currentOrg?.id) return;
    try {
      const res = await api.get<{ success: boolean; data: any[] }>(`/organizations/${currentOrg.id}/members`);
      if (res.data.success) {
        // API returns membership records: { id, role, user: { id, firstName, lastName, email, avatarUrl, ... } }
        // Map out the nested .user so components get flat User objects
        const users: User[] = res.data.data
          .map((m: any) => m.user ?? m)
          .filter((u: any) => u && u.id);
        setMembers(users);
      }
    } catch { /* silent */ }
  }, [currentOrg?.id]);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { loadAllMembers(); }, [loadAllMembers]);

  useEffect(() => {
    if (!socket) return;
    let t: any;
    const refresh = () => { clearTimeout(t); t = setTimeout(loadData, 500); };
    socket.on('task:updated', refresh);
    socket.on('task:refresh', refresh);
    socket.on('space:updated', refresh);
    return () => { clearTimeout(t); socket.off('task:updated', refresh); socket.off('task:refresh', refresh); socket.off('space:updated', refresh); };
  }, [socket, loadData]);

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const handleUpdateTaskAssignees = async (taskId: string, assigneeIds: string[]) => {
    const safe = assigneeIds || [];
    setTasks(prev => prev.map(t => t.id === taskId ? {
      ...t, assigneeIds: safe,
      assignees: (members || []).filter(m => m && safe.includes(m.id)).map(m => ({
        id: m.id, email: m.email || '', firstName: m.firstName || '', lastName: m.lastName || '', avatarUrl: m.avatarUrl || null
      }))
    } : t));
    try {
      await api.patch(`/tasks/${taskId}`, { assigneeIds: safe });
      toast.success('Assignees updated');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update assignees');
      loadData();
    }
  };

  const handleCreateTask = async (status: TaskStatus) => {
    if (!newTaskTitle.trim() || !list || isCreatingTask) return;
    try {
      setIsCreatingTask(true);
      const payload: any = { title: newTaskTitle.trim(), status, listId: list.id, assigneeIds: [] };
      if ((list as any).projectId) payload.projectId = (list as any).projectId;
      await api.post('/tasks', payload);
      setNewTaskTitle('');
      setAddingInStatus(null);
      loadData();
      toast.success('Task created');
    } catch {
      toast.error('Failed to create task');
    } finally {
      setIsCreatingTask(false);
    }
  };

  const handleRenameTask = async (taskId: string) => {
    if (!renamingTitle.trim()) return;
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, title: renamingTitle.trim() } : t));
    try {
      await api.patch(`/tasks/${taskId}`, { title: renamingTitle.trim() });
      setRenamingTaskId(null);
      toast.success('Task renamed');
    } catch { toast.error('Failed to rename task'); loadData(); }
  };

  const handleDeleteSingleTask = async (taskId: string) => {
    setTasks(prev => prev.filter(t => t.id !== taskId));
    try {
      await api.delete(`/tasks/${taskId}`);
      toast.success('Task deleted');
    } catch { toast.error('Failed to delete task'); loadData(); }
  };

  const handleToggleFavorite = async (task: Task) => {
    const next = !task.isFavorite;
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, isFavorite: next } : t));
    try {
      await api.patch(`/tasks/${task.id}`, { isFavorite: next });
      toast.success(next ? 'Added to favorites' : 'Removed from favorites');
    } catch { toast.error('Failed to update favorite'); loadData(); }
  };

  const toggleSelect = (taskId: string) => {
    setSelectedIds(prev => { const n = new Set(prev); n.has(taskId) ? n.delete(taskId) : n.add(taskId); return n; });
  };
  const selectAll = () => setSelectedIds(new Set(filteredTasks.map(t => t.id)));
  const deselectAll = () => setSelectedIds(new Set());
  const toggleGroup = (s: TaskStatus) => {
    setCollapsedGroups(prev => { const n = new Set(prev); n.has(s) ? n.delete(s) : n.add(s); return n; });
  };

  // ─── Derived data ──────────────────────────────────────────────────────────

  const filteredTasks = searchQuery
    ? tasks.filter(t => t.title.toLowerCase().includes(searchQuery.toLowerCase()))
    : tasks;

  const grouped: Record<TaskStatus, Task[]> = STATUS_ORDER.reduce((acc, s) => {
    acc[s] = filteredTasks.filter(t => t.status === s);
    return acc;
  }, {} as Record<TaskStatus, Task[]>);

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.status === 'COMPLETED' || t.status === 'ACCEPTED' || t.status === 'CLOSED').length;
  const progress = totalTasks ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // ─── Loading / Error ───────────────────────────────────────────────────────

  if (loading) return <Loading size="lg" text="Building your workspace..." />;

  if (error || !list) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-gradient-to-br from-slate-50 to-white dark:from-[#0B1120] dark:to-[#0F172A] p-12">
        <div className="w-20 h-20 rounded-2xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center text-red-400 mb-6 shadow-xl shadow-red-100/50 dark:shadow-red-900/20">
          <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
        </div>
        <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-2">{error || 'List not found'}</h2>
        <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-sm text-center text-sm">
          {error === 'List not found' ? "This list doesn't exist or may have been deleted." : "A connection issue occurred. Please retry."}
        </p>
        <button onClick={loadData} className="px-6 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-bold text-sm shadow-lg shadow-violet-600/30 transition-all hover:scale-105 active:scale-95">
          Retry
        </button>
      </div>
    );
  }

  const listColor = list.color || '#7C3AED';

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#0F172A] overflow-hidden">

      {/* ── Header ── */}
      <div className="shrink-0 border-b border-gray-100 dark:border-gray-800/80">
        {/* Title bar */}
        <div className="px-6 pt-5 pb-0">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3 min-w-0">
              <ListIconBox color={listColor} />
              <div className="min-w-0">
                <h1 className="text-xl font-black text-gray-900 dark:text-white tracking-tight truncate">{list.name}</h1>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-gray-400 dark:text-gray-500 font-medium">{totalTasks} tasks</span>
                  {totalTasks > 0 && (
                    <>
                      <span className="text-gray-200 dark:text-gray-700">·</span>
                      <span className="text-xs text-gray-400 dark:text-gray-500 font-medium">{progress}% done</span>
                      <div className="w-16 h-1 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                        <ProgressBarFill color={listColor} progress={progress} />
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {/* Search toggle */}
              <button
                onClick={() => setShowSearch(v => !v)}
                className={`p-2 rounded-lg transition-all ${showSearch ? 'bg-violet-50 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                title="Search tasks"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
              </button>
              {canCreateTask && (
                <ActionBtn
                  color={listColor}
                  onClick={() => setAddingInStatus('OPEN')}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-bold text-xs text-white shadow-md transition-all hover:scale-105 active:scale-95"
                  title="New task"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                  New Task
                </ActionBtn>
              )}
            </div>
          </div>

          {/* Search bar */}
          <AnimatePresence>
            {showSearch && (
              <motion.div
                initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                animate={{ opacity: 1, height: 'auto', marginBottom: 12 }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                className="overflow-hidden"
              >
                <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5">
                  <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search tasks..."
                    autoFocus
                    className="flex-1 text-sm bg-transparent outline-none text-gray-900 dark:text-white placeholder-gray-400 font-medium"
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery('')} className="text-gray-400 hover:text-gray-600" title="Clear search">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* View tabs */}
          <div className="flex items-center gap-0.5">
            {([
              { id: 'list', label: 'List', icon: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></svg> },
              { id: 'board', label: 'Board', icon: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><rect x="3" y="3" width="7" height="18" rx="1" /><rect x="14" y="3" width="7" height="11" rx="1" /></svg> },
              { id: 'box', label: 'Box', icon: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><rect x="3" y="3" width="8" height="8" rx="1" /><rect x="13" y="3" width="8" height="8" rx="1" /><rect x="3" y="13" width="8" height="8" rx="1" /><rect x="13" y="13" width="8" height="8" rx="1" /></svg> },
            ] as const).map(tab => (
              <button
                key={tab.id}
                onClick={() => setViewMode(tab.id as any)}
                className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-bold border-b-2 transition-all ${viewMode === tab.id
                  ? 'border-violet-600 text-violet-600 dark:text-violet-400 dark:border-violet-500'
                  : 'border-transparent text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                  }`}
              >
                {tab.icon}{tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Toolbar ── */}
      <div className="shrink-0 flex items-center justify-between px-6 py-2.5 border-b border-gray-50 dark:border-gray-800/50 bg-gray-50/40 dark:bg-gray-900/20">
        <div className="flex items-center gap-2 text-xs text-gray-400 font-semibold">
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm">
            <svg className="w-3 h-3 text-violet-500" fill="currentColor" viewBox="0 0 24 24"><path d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
            Group by Status
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span className="font-medium">{filteredTasks.length} task{filteredTasks.length !== 1 ? 's' : ''}</span>
          {selectedIds.size > 0 && (
            <span className="px-2 py-0.5 bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400 rounded-full font-bold">
              {selectedIds.size} selected
            </span>
          )}
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="flex-1 overflow-y-auto">
        {/* Column headers */}
        <div className="sticky top-0 z-10 grid grid-cols-12 gap-2 px-6 py-2.5 bg-white/90 dark:bg-[#0F172A]/90 backdrop-blur-sm border-b border-gray-100 dark:border-gray-800 text-[10px] font-black text-gray-400 uppercase tracking-widest">
          <div className="col-span-6 flex items-center gap-2">
            <input
              type="checkbox"
              checked={filteredTasks.length > 0 && selectedIds.size === filteredTasks.length}
              onChange={e => e.target.checked ? selectAll() : deselectAll()}
              className="w-3.5 h-3.5 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
              title="Select all"
            />
            Task Name
          </div>
          <div className="col-span-2 text-center">Assignee</div>
          <div className="col-span-2 text-center">Due Date</div>
          <div className="col-span-1 text-center">Priority</div>
          <div className="col-span-1"></div>
        </div>

        <div className="px-2 py-3 space-y-1">
          {STATUS_ORDER.map(status => {
            const stTasks = grouped[status];
            const cfg = STATUS_CONFIG[status];
            const isCollapsed = collapsedGroups.has(status);


            return (
              <div key={status} className="rounded-xl">
                {/* Group header */}
                <button
                  onClick={() => toggleGroup(status)}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors group"
                  title={isCollapsed ? 'Expand group' : 'Collapse group'}
                >
                  <motion.div
                    animate={{ rotate: isCollapsed ? -90 : 0 }}
                    transition={{ duration: 0.15 }}
                    className="text-gray-300 dark:text-gray-600 group-hover:text-gray-500"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                  </motion.div>
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-[11px] font-bold ring-1 ${cfg.bg} ${cfg.color} ${cfg.ring}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                    {cfg.label}
                  </span>
                  <span className="text-xs font-bold text-gray-300 dark:text-gray-600">{stTasks.length}</span>
                  <div className="flex-1 h-px bg-gray-100 dark:bg-gray-800" />
                  {canCreateTask && (
                    <span
                      role="button"
                      onClick={e => { e.stopPropagation(); setAddingInStatus(status); if (isCollapsed) toggleGroup(status); }}
                      className="text-gray-300 hover:text-violet-500 opacity-0 group-hover:opacity-100 transition-all"
                      title={`Add task to ${cfg.label}`}
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                    </span>
                  )}
                </button>

                {/* Tasks */}
                <AnimatePresence initial={false}>
                  {!isCollapsed && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2, ease: 'easeInOut' }}
                      className=""
                    >
                      <div>
                        {stTasks.map((task, idx) => {
                          const dueParsed = formatDate(task.dueDate);
                          return (
                            <motion.div
                              key={task.id}
                              initial={{ opacity: 0, x: -8 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: idx * 0.03, duration: 0.2 }}
                              className="group grid grid-cols-12 gap-2 px-4 py-2.5 items-center border-b border-gray-50 dark:border-gray-800/60 hover:bg-gray-50/80 dark:hover:bg-gray-800/30 transition-colors"
                            >
                              {/* Name col */}
                              <div className="col-span-6 flex items-center gap-2.5 min-w-0 pr-2">
                                <input
                                  type="checkbox"
                                  checked={selectedIds.has(task.id)}
                                  onChange={() => toggleSelect(task.id)}
                                  onClick={e => e.stopPropagation()}
                                  className="w-3.5 h-3.5 shrink-0 rounded border-gray-300 text-violet-600 focus:ring-violet-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                  title={`Select ${task.title}`}
                                />
                                {renamingTaskId === task.id ? (
                                  <input
                                    type="text"
                                    value={renamingTitle}
                                    onChange={e => setRenamingTitle(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') handleRenameTask(task.id); if (e.key === 'Escape') setRenamingTaskId(null); }}
                                    onBlur={() => handleRenameTask(task.id)}
                                    autoFocus
                                    onClick={e => e.stopPropagation()}
                                    className="flex-1 text-sm font-semibold text-gray-900 dark:text-white bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 rounded-lg px-2 py-0.5 outline-none"
                                    placeholder="Task title"
                                  />
                                ) : (
                                  <Link
                                    to={`/tasks/${task.id}`}
                                    state={{ backgroundLocation: location }}
                                    className="text-sm font-semibold text-gray-700 dark:text-gray-200 truncate hover:text-violet-600 dark:hover:text-violet-400 transition-colors shrink"
                                  >
                                    {task.title}
                                  </Link>
                                )}
                                {(task.tags || []).slice(0, 2).map(tag => (
                                  <TagPill key={tag.id} color={tag.color} name={tag.name} />
                                ))}
                                {task.isFavorite && (
                                  <svg className="w-3 h-3 text-amber-400 shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>
                                )}
                              </div>

                              {/* Assignee col */}
                              <div className="col-span-2 flex justify-center">
                                <AssigneePicker
                                  task={task}
                                  members={members}
                                  canUpdate={canUpdateTaskDetails}
                                  isOpen={activeAssigneeTaskId === task.id}
                                  onOpen={() => setActiveAssigneeTaskId(task.id)}
                                  onClose={() => setActiveAssigneeTaskId(null)}
                                  onAssign={handleUpdateTaskAssignees}
                                />
                              </div>

                              {/* Due Date col */}
                              <div className="col-span-2 flex justify-center">
                                {dueParsed ? (
                                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-lg ${dueParsed.overdue
                                    ? 'text-red-600 bg-red-50 dark:bg-red-950/30 dark:text-red-400'
                                    : dueParsed.soon
                                      ? 'text-amber-600 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-400'
                                      : 'text-gray-500 dark:text-gray-400'
                                    }`}>
                                    {dueParsed.overdue && '!'} {dueParsed.str}
                                  </span>
                                ) : (
                                  <span className="text-gray-200 dark:text-gray-700 text-xs">—</span>
                                )}
                              </div>

                              {/* Priority col */}
                              <div className="col-span-1 flex justify-center">
                                <PriorityBadge priority={task.priority} />
                              </div>


                              {/* Actions col */}
                              <div className="col-span-1 flex items-center justify-end gap-0.5">
                                <button
                                  onClick={e => { e.stopPropagation(); handleToggleFavorite(task); }}
                                  className={`p-1.5 rounded-lg transition-all ${task.isFavorite ? 'text-amber-400' : 'text-gray-200 hover:text-gray-400 opacity-0 group-hover:opacity-100'}`}
                                  title={task.isFavorite ? 'Unfavorite' : 'Favorite'}
                                >
                                  <svg className="w-3.5 h-3.5" fill={task.isFavorite ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>
                                </button>
                                <Dropdown
                                  align="right"
                                  trigger={
                                    <button
                                      className="p-1.5 text-gray-200 hover:text-gray-600 dark:hover:text-gray-300 opacity-0 group-hover:opacity-100 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all"
                                      title="Task options"
                                    >
                                      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" /></svg>
                                    </button>
                                  }
                                >
                                  {canUpdateTaskDetails && (
                                    <DropdownItem
                                      icon={<svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>}
                                      onClick={() => { setRenamingTaskId(task.id); setRenamingTitle(task.title); }}
                                    >
                                      Rename
                                    </DropdownItem>
                                  )}
                                  <DropdownItem
                                    icon={<svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>}
                                    onClick={() => handleToggleFavorite(task)}
                                  >
                                    {task.isFavorite ? 'Unfavorite' : 'Favorite'}
                                  </DropdownItem>
                                  {canDeleteTask && (
                                    <>
                                      <hr className="my-1 border-gray-50 dark:border-gray-800" />
                                      <DropdownItem
                                        danger
                                        icon={<svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>}
                                        onClick={() => handleDeleteSingleTask(task.id)}
                                      >
                                        Delete
                                      </DropdownItem>
                                    </>
                                  )}
                                </Dropdown>
                              </div>
                            </motion.div>
                          );
                        })}

                        {/* Inline add task */}
                        {canCreateTask && (
                          <div className="px-4 py-2">
                            {addingInStatus === status ? (
                              <motion.div
                                initial={{ opacity: 0, y: -4 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="flex items-center gap-2.5 bg-violet-50 dark:bg-violet-900/15 border border-violet-200 dark:border-violet-800/50 rounded-xl px-3 py-2.5"
                              >
                                <input
                                  type="text"
                                  value={newTaskTitle}
                                  onChange={e => setNewTaskTitle(e.target.value)}
                                  onBlur={() => !newTaskTitle.trim() && setAddingInStatus(null)}
                                  onKeyDown={e => { if (e.key === 'Enter') handleCreateTask(status); if (e.key === 'Escape') setAddingInStatus(null); }}
                                  placeholder="What needs to be done?"
                                  autoFocus
                                  className="flex-1 text-sm font-medium bg-transparent outline-none text-gray-900 dark:text-white placeholder-gray-400"
                                />
                                <button
                                  onClick={() => handleCreateTask(status)}
                                  className="px-3 py-1 bg-violet-600 text-white text-xs font-bold rounded-lg hover:bg-violet-700 transition-colors"
                                >
                                  Add
                                </button>
                                <button
                                  onClick={() => setAddingInStatus(null)}
                                  className="p-1 text-gray-400 hover:text-gray-600 rounded-lg transition-colors"
                                  title="Cancel"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                              </motion.div>
                            ) : (
                              <button
                                onClick={() => setAddingInStatus(status)}
                                className="w-full flex items-center gap-2 py-1.5 px-2 text-gray-300 dark:text-gray-600 hover:text-violet-500 dark:hover:text-violet-400 text-xs font-semibold rounded-lg hover:bg-violet-50 dark:hover:bg-violet-900/15 transition-all group"
                              >
                                <svg className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                                Add task
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}

          {/* Empty state */}
          {filteredTasks.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center py-24 px-6 text-center"
            >
              <EmptyStateIcon color={listColor} />
              <h3 className="text-base font-bold text-gray-700 dark:text-gray-200 mb-1">
                {searchQuery ? 'No matching tasks' : 'No tasks yet'}
              </h3>
              <p className="text-sm text-gray-400 dark:text-gray-500 mb-6 max-w-xs">
                {searchQuery ? `No tasks match "${searchQuery}". Try a different search.` : 'Get started by creating your first task in this list.'}
              </p>
              {!searchQuery && canCreateTask && (
                <ActionBtn
                  color={listColor}
                  onClick={() => setAddingInStatus('OPEN')}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs text-white shadow-md transition-all hover:scale-105"
                  title="Create first task"
                  shadowAlpha="40"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                  Create first task
                </ActionBtn>
              )}
            </motion.div>
          )}
        </div>
      </div>

      {/* ── Bulk action bar ── */}
      <AnimatePresence>
        {selectedIds.size > 0 && !isReadOnly && (
          <BulkActionBar
            selectedCount={selectedIds.size}
            totalCount={tasks.length}
            onSelectAll={selectAll}
            onDeselectAll={deselectAll}
            onBulkStatusChange={canUpdateTaskStatus ? async (status: TaskStatus) => {
              try {
                await api.patch('/tasks/bulk', { taskIds: Array.from(selectedIds), data: { status } });
                loadData(); deselectAll(); toast.success('Tasks updated');
              } catch { toast.error('Failed to update tasks'); }
            } : undefined}
            onBulkPriorityChange={canUpdateTaskDetails ? async (priority: TaskPriority) => {
              try {
                await api.patch('/tasks/bulk', { taskIds: Array.from(selectedIds), data: { priority } });
                loadData(); deselectAll(); toast.success('Tasks updated');
              } catch { toast.error('Failed to update tasks'); }
            } : undefined}
            onBulkAssign={canUpdateTaskDetails ? async (assigneeIds: string[]) => {
              try {
                await api.patch('/tasks/bulk', { taskIds: Array.from(selectedIds), data: { assigneeIds } });
                loadData(); deselectAll(); toast.success('Tasks updated');
              } catch { toast.error('Failed to update tasks'); }
            } : undefined}
            onBulkDueDate={canUpdateTaskDetails ? async (dueDate: string | null) => {
              try {
                await api.patch('/tasks/bulk', { taskIds: Array.from(selectedIds), data: { dueDate } });
                loadData(); deselectAll(); toast.success('Tasks updated');
              } catch { toast.error('Failed to update tasks'); }
            } : undefined}
            onBulkDelete={canDeleteTask ? () => setShowDeleteConfirm(true) : undefined}
            members={members as any}
          />
        )}
      </AnimatePresence>

      <ConfirmModal
        open={showDeleteConfirm}
        onCancel={() => setShowDeleteConfirm(false)}
        onConfirm={async () => {
          setIsBulkDeleting(true);
          try {
            await api.post('/tasks/bulk-delete', { taskIds: Array.from(selectedIds) });
            deselectAll(); loadData(); toast.success('Tasks deleted');
          } catch { toast.error('Failed to delete tasks'); } finally {
            setIsBulkDeleting(false); setShowDeleteConfirm(false);
          }
        }}
        title="Delete Tasks"
        message={`Are you sure you want to delete ${selectedIds.size} task${selectedIds.size !== 1 ? 's' : ''}? This cannot be undone.`}
        confirmLabel="Delete"
        loading={isBulkDeleting}
      />
    </div>
  );
}
