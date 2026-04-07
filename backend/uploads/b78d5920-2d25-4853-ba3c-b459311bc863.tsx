import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, Link, useLocation } from 'react-router';

import { motion, AnimatePresence } from 'framer-motion';
import api from '../../services/api';
import { useSocket } from '../../hooks/useSocket';
import { useAuth } from '../../hooks/useAuth';
import { useOrgRole } from '../../hooks/useOrgRole';
import { Loading } from '../../components/ui/Loading';
import { useToast } from '../../components/ui/Toast';
import { BulkActionBar } from '../../components/ui/BulkActionBar';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { AvatarStack } from '../../components/ui/AvatarStack';
import { Dropdown, DropdownItem } from '../../components/ui/Dropdown';
import type { Task, TaskStatus, TaskPriority, List, User } from '../../types';

const STATUS_CONFIG: Record<TaskStatus, { label: string; color: string; dot: string; bg: string }> = {
  OPEN: {
    label: 'OPEN',
    color: 'text-gray-500',
    dot: 'bg-gray-400',
    bg: 'bg-gray-50'
  },
  PENDING: {
    label: 'PENDING',
    color: 'text-amber-500',
    dot: 'bg-amber-500',
    bg: 'bg-amber-50'
  },
  IN_PROGRESS: {
    label: 'IN PROGRESS',
    color: 'text-[#FF4B91]',
    dot: 'bg-[#FF4B91]',
    bg: 'bg-[#FFF0F5]'
  },
  COMPLETED: {
    label: 'COMPLETED',
    color: 'text-[#00DFA2]',
    dot: 'bg-[#00DFA2]',
    bg: 'bg-[#E8FBF4]'
  },
  IN_REVIEW: {
    label: 'REVIEW',
    color: 'text-indigo-500',
    dot: 'bg-indigo-500',
    bg: 'bg-indigo-50'
  },
  ACCEPTED: {
    label: 'ACCEPTED',
    color: 'text-blue-500',
    dot: 'bg-blue-500',
    bg: 'bg-blue-50'
  },
  REJECTED: {
    label: 'REJECTED',
    color: 'text-red-500',
    dot: 'bg-red-500',
    bg: 'bg-red-50'
  },
  CLOSED: {
    label: 'CLOSED',
    color: 'text-gray-400',
    dot: 'bg-gray-300',
    bg: 'bg-gray-100'
  },
};

const PRIORITY_ICONS: Record<TaskPriority, { icon: React.ReactNode; color: string }> = {
  URGENT: {
    icon: <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M6 3v18M6 3l12 4.5L6 12" /></svg>,
    color: 'text-red-500'
  },
  HIGH: {
    icon: <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M6 3v18M6 3l12 4.5L6 12" /></svg>,
    color: 'text-orange-500'
  },
  MEDIUM: {
    icon: <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M6 3v18M6 3l12 4.5L6 12" /></svg>,
    color: 'text-blue-500'
  },
  LOW: {
    icon: <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M6 3v18M6 3l12 4.5L6 12" /></svg>,
    color: 'text-gray-400'
  },
};

export function ListPage() {
  const { id } = useParams();
  const toast = useToast();
  const socket = useSocket();

  const [list, setList] = useState<List | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<User[]>([]);

  // UI State
  const [viewMode, setViewMode] = useState<'list' | 'board' | 'box'>('list');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [addingInStatus, setAddingInStatus] = useState<TaskStatus | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const location = useLocation();
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Assignee Picker State
  const { currentUser } = useAuth();
  const [activeAssigneeTaskId, setActiveAssigneeTaskId] = useState<string | null>(null);
  const [assigneeSearch, setAssigneeSearch] = useState('');
  const assigneeRef = useRef<HTMLDivElement>(null);

  const { 
    canCreateTask, 
    canDeleteTask, 
    canUpdateTaskDetails,
    canUpdateTaskStatus,
    isReadOnly 
  } = useOrgRole();

  // Rename State
  const [renamingTaskId, setRenamingTaskId] = useState<string | null>(null);
  const [renamingTitle, setRenamingTitle] = useState('');

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (assigneeRef.current && !assigneeRef.current.contains(e.target as Node)) {
        setActiveAssigneeTaskId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [listRes, tasksRes] = await Promise.all([
        api.get<{ success: boolean; data: List }>(`/lists/${id}`).catch(err => {
          console.error('List load error:', err);
          return { data: { success: false, data: null, message: err.response?.status === 404 ? 'List not found' : 'Server error: Failed to reach the database.' } } as any;
        }),
        api.get<{ success: boolean; data: Task[] }>(`/tasks/list/${id}`).catch(err => {
          console.error('Tasks load error:', err);
          return { data: { success: false, data: [] } };
        }),
      ]);

      if (listRes.data.success && listRes.data.data) {
        setList(listRes.data.data);
      } else {
        setError(listRes.data.message || 'List not found');
      }

      if (tasksRes.data.success) {
        setTasks(tasksRes.data.data);
      }
    } catch (err) {
      console.error('Failed to load list details:', err);
      setError('An unexpected error occurred');
      toast.error('Failed to load list');
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  const loadAllMembers = useCallback(async () => {
    try {
      const res = await api.get<{ success: boolean; data: User[] }>('/users/all');
      if (res.data.success) {
        setMembers(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load members for picker:', err);
    }
  }, []);

  useEffect(() => {
    loadAllMembers();
  }, [loadAllMembers]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!socket) return;
    const handleRefresh = () => loadData();
    socket.on('task:updated', handleRefresh);
    return () => { socket.off('task:updated', handleRefresh); };
  }, [socket, loadData]);

  const handleUpdateTaskAssignees = async (taskId: string, assigneeIds: string[]) => {
    try {
      const safeIds = assigneeIds || [];
      // Optimistic update
      setTasks(prev => prev.map(t =>
        t.id === taskId ? {
          ...t,
          assigneeIds: safeIds,
          assignees: (members || [])
            .filter(m => m && safeIds.includes(m.id))
            .map(m => ({
              id: m.id,
              email: m.email || '',
              firstName: m.firstName || '',
              lastName: m.lastName || '',
              avatarUrl: m.avatarUrl || null
            }))
        } : t
      ));

      await api.patch(`/tasks/${taskId}`, { assigneeIds: safeIds });
      toast.success('Assignees updated');
    } catch (err: any) {
      console.error('Failed to update assignees:', err);
      const msg = err.response?.data?.message || 'Failed to update assignees';
      toast.error(msg);
      loadData(); // Revert on failure
    }
  };

  const handleCreateTask = async (status: TaskStatus) => {
    if (!newTaskTitle.trim() || !list) return;
    try {
      const payload: any = {
        title: newTaskTitle.trim(),
        status,
        listId: list.id,
        assigneeIds: []
      };

      if ((list as any).projectId) {
        payload.projectId = (list as any).projectId;
      }

      await api.post('/tasks', payload);
      setNewTaskTitle('');
      setAddingInStatus(null);
      loadData();
      toast.success('Task created');
    } catch {
      toast.error('Failed to create task');
    }
  };

  const toggleSelect = (taskId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  const selectAll = () => setSelectedIds(new Set(tasks.map(t => t.id)));
  const deselectAll = () => setSelectedIds(new Set());

  const groupedTasks: Record<TaskStatus, Task[]> = {
    OPEN: tasks.filter(t => t.status === 'OPEN'),
    PENDING: tasks.filter(t => t.status === 'PENDING'),
    IN_PROGRESS: tasks.filter(t => t.status === 'IN_PROGRESS'),
    IN_REVIEW: tasks.filter(t => t.status === 'IN_REVIEW'),
    ACCEPTED: tasks.filter(t => t.status === 'ACCEPTED'),
    COMPLETED: tasks.filter(t => t.status === 'COMPLETED'),
    REJECTED: tasks.filter(t => t.status === 'REJECTED'),
    CLOSED: tasks.filter(t => t.status === 'CLOSED'),
  };

  // Action Handlers
  const handleToggleFavorite = async (task: Task) => {
    try {
      const nextFav = !task.isFavorite;
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, isFavorite: nextFav } : t));
      await api.patch(`/tasks/${task.id}`, { isFavorite: nextFav });
      toast.success(nextFav ? 'Added to favorites' : 'Removed from favorites');
    } catch {
      toast.error('Failed to update favorite');
      loadData();
    }
  };

  const handleRenameTask = async (taskId: string) => {
    if (!renamingTitle.trim()) return;
    try {
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, title: renamingTitle.trim() } : t));
      await api.patch(`/tasks/${taskId}`, { title: renamingTitle.trim() });
      setRenamingTaskId(null);
      toast.success('Task renamed');
    } catch {
      toast.error('Failed to rename task');
      loadData();
    }
  };

  const handleDeleteSingleTask = async (taskId: string) => {
    try {
      setTasks(prev => prev.filter(t => t.id !== taskId));
      await api.delete(`/tasks/${taskId}`);
      toast.success('Task deleted');
    } catch {
      toast.error('Failed to delete task');
      loadData();
    }
  };

  if (loading) return <Loading size="lg" text="Building your workspace..." />;

  if (error || !list) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-12 text-center bg-white dark:bg-[#0F172A]">
        <div className="w-16 h-16 bg-red-50 dark:bg-red-900/10 rounded-full flex items-center justify-center text-red-500 mb-4">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
        </div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">{error || 'List not found'}</h2>
        <p className="text-gray-500 dark:text-gray-400 max-w-sm mx-auto mb-6">
          {error === 'List not found'
            ? "We couldn't load the list or it might have been moved."
            : "There was a temporary problem connecting to the server. Please try again."}
        </p>
        <button
          onClick={() => loadData()}
          className="px-6 py-2 bg-indigo-600 text-white rounded-xl text-sm font-black shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 transition-all"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#0F172A]">
      {/* Header Section */}
      <div className="px-6 pt-6 pb-2 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white shadow-lg" {...{ style: { backgroundColor: list.color || '#6366F1' } }}>
              <svg className="w-5 h-5 font-bold" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 6h16M4 12h16M4 18h7" /></svg>
            </div>
            <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">{list.name}</h1>
          </div>
          <div className="flex items-center gap-2">
            <button className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200" title="List options">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" /></svg>
            </button>
          </div>
        </div>

        {/* View Tabs */}
        <div className="flex items-center gap-6">
          {[
            { id: 'list', label: 'List', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg> },
            { id: 'board', label: 'Board', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2" /></svg> },
            { id: 'box', label: 'Box', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5z" /></svg> },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setViewMode(tab.id as any)}
              className={`flex items-center gap-2 py-3 px-1 border-b-2 transition-all font-bold text-sm ${viewMode === tab.id ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              title={`${tab.label} view`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
          <button className="flex items-center gap-2 py-3 px-1 border-b-2 border-transparent text-gray-400 hover:text-gray-600 font-bold text-sm" title="Add view">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
            Add view
          </button>
        </div>
      </div>

      {/* Toolbar Section */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-50 dark:border-gray-800 bg-gray-50/30">
        <div className="flex items-center gap-4">
          <button className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-bold text-gray-600 dark:text-gray-300 shadow-sm" title="Group by status">
            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
            Group: Status
          </button>
          <div className="h-4 border-r border-gray-200 dark:border-gray-700" />
          <div className="flex items-center gap-3">
            <button className="text-[11px] font-black text-gray-400 hover:text-gray-600 uppercase tracking-widest" title="Toggle subtasks">Subtasks</button>
            <button className="text-[11px] font-black text-gray-400 hover:text-gray-600 uppercase tracking-widest" title="Customize columns">Columns</button>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <button className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100" title="Filter list"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg></button>
            <button className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100" title="Search list"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg></button>
          </div>
          {canCreateTask && (
            <button className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-black shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 transition-all" title="Create new task">NEW TASK</button>
          )}
        </div>
      </div>

      {/* Main List Section */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-8">
        {(['OPEN', 'PENDING', 'IN_PROGRESS', 'IN_REVIEW', 'ACCEPTED', 'COMPLETED', 'REJECTED', 'CLOSED'] as TaskStatus[]).map(status => {
          const statusTasks = groupedTasks[status];
          const config = STATUS_CONFIG[status];

          return (
            <div key={status} className="space-y-2">
              {/* Group Header */}
              <div className="flex items-center gap-3 py-1">
                <div className={`px-2 py-0.5 rounded-md ${config.bg} ${config.color} text-[10px] font-black tracking-widest uppercase`}>
                  {config.label}
                </div>
                <span className="text-[11px] font-bold text-gray-300">{statusTasks.length}</span>
                <div className="flex-1 h-px bg-gray-100 dark:bg-gray-800" />
              </div>

              {/* Table Header (only if tasks exist) */}
              {statusTasks.length > 0 && (
                <div className="grid grid-cols-12 gap-4 px-4 py-2 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-50 dark:border-gray-800">
                  <div className="col-span-6">Name</div>
                  <div className="col-span-2 text-center">Assignee</div>
                  <div className="col-span-2 text-center">Due Date</div>
                  <div className="col-span-1 text-center">Priority</div>
                  <div className="col-span-1 text-right pr-4">...</div>
                </div>
              )}

              {/* Task Rows */}
              <div className="space-y-px">
                {statusTasks.map(task => (
                  <motion.div
                    key={task.id}
                    layoutId={task.id}
                    className="group grid grid-cols-12 gap-4 px-4 py-3 items-center bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50/80 dark:hover:bg-gray-800/50 transition-colors cursor-pointer"
                  >
                    <div className="col-span-6 flex items-center gap-3 min-w-0">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(task.id)}
                        onChange={() => toggleSelect(task.id)}
                        className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        onClick={(e) => e.stopPropagation()}
                        title={`Select task ${task.title}`}
                        placeholder="Select task"
                      />
                      <div className={`w-2 h-2 rounded-full ${config.dot} shrink-0`} />

                      {renamingTaskId === task.id ? (
                        <input
                          type="text"
                          value={renamingTitle}
                          onChange={(e) => setRenamingTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleRenameTask(task.id);
                            if (e.key === 'Escape') setRenamingTaskId(null);
                          }}
                          onBlur={() => handleRenameTask(task.id)}
                          autoFocus
                          className="flex-1 bg-transparent border-none outline-none text-sm font-bold text-gray-700 dark:text-gray-200"
                          onClick={(e) => e.stopPropagation()}
                          title="Rename task"
                          placeholder="Task title"
                        />
                      ) : (
                        <Link
                          to={`/tasks/${task.id}`}
                          state={{ backgroundLocation: location }}
                          className="text-sm font-bold text-gray-700 dark:text-gray-200 truncate hover:text-indigo-600 min-w-0"
                        >
                          {task.title}
                        </Link>
                      )}

                      {/* Tags */}
                      <div className="flex items-center gap-1 shrink-0">
                        {task.tags?.map((tag) => (
                          <span
                            key={tag.id}
                            className="px-2 py-0.5 rounded text-[11px] font-medium"
                            {...{
                              style: {
                                backgroundColor: `${tag.color}25`,
                                color: '#374151',
                              }
                            }}
                          >
                            {tag.name}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="col-span-2 flex justify-center relative">
                      <div
                        onClick={(e) => {
                          if (!canUpdateTaskDetails) return;
                          e.stopPropagation();
                          setActiveAssigneeTaskId(task.id);
                          setAssigneeSearch('');
                        }}
                        className={`transition-transform p-1 rounded-lg ${canUpdateTaskDetails ? 'cursor-pointer hover:scale-110 hover:bg-gray-100 dark:hover:bg-gray-800' : 'cursor-default'}`}
                      >
                        <AvatarStack
                          users={task.assignees}
                          size="md"
                          showPlaceholder
                          max={5}
                          onRemove={(userId) => {
                            const currentIds = task.assigneeIds || task.assignees?.map(a => a.id) || [];
                            handleUpdateTaskAssignees(task.id, currentIds.filter(id => id !== userId));
                          }}
                        />
                      </div>

                      {activeAssigneeTaskId === task.id && (
                        <div
                          ref={assigneeRef}
                          className="absolute top-full mt-2 left-1/2 -translate-x-1/2 w-[260px] bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-2xl z-[100] overflow-hidden text-left animate-in fade-in zoom-in duration-200"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {/* Search */}
                          <div className="px-3 py-2 border-b border-gray-50 dark:border-gray-700">
                            <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-900 rounded-lg px-2 py-1.5 border border-transparent focus-within:border-indigo-500/30 transition-all">
                              <svg className="w-3.5 h-3.5 text-gray-400 font-bold" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                              <input
                                type="text"
                                value={assigneeSearch}
                                onChange={e => setAssigneeSearch(e.target.value)}
                                placeholder="Search or enter email..."
                                autoFocus
                                className="flex-1 text-[11px] bg-transparent outline-none text-gray-900 dark:text-white placeholder-gray-400 font-bold"
                                title="Search assignees"
                              />
                            </div>
                          </div>

                          {/* Member list */}
                          <div className="py-1 max-h-[280px] overflow-y-auto">
                            <div className="px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-gray-400">Assignees</div>

                            {/* Me Option */}
                            {currentUser && (
                              <button
                                onClick={() => {
                                  const currentIds = task.assigneeIds || task.assignees?.map(a => a.id) || [];
                                  const isAssigned = currentIds.includes(currentUser.id);
                                  const nextIds = isAssigned
                                    ? currentIds.filter(id => id !== currentUser.id)
                                    : [...currentIds, currentUser.id];
                                  handleUpdateTaskAssignees(task.id, nextIds);
                                }}
                                className={`w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${(task.assigneeIds || task.assignees?.map(a => a.id) || []).includes(currentUser.id) ? 'bg-indigo-50/50 dark:bg-indigo-900/10' : ''}`}
                              >
                                {currentUser.avatarUrl ? (
                                  <img
                                    src={currentUser.avatarUrl}
                                    alt=""
                                    className="w-7 h-7 rounded-full object-cover border border-gray-100"
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).style.display = 'none';
                                      const p = (e.target as HTMLImageElement).parentElement;
                                      if (p && !p.querySelector('.avatar-placeholder')) {
                                        const d = document.createElement('div');
                                        d.className = 'avatar-placeholder w-7 h-7 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center shrink-0 border border-gray-100 shadow-sm';
                                        d.innerText = currentUser.firstName.charAt(0);
                                        p.appendChild(d);
                                      }
                                    }}
                                  />
                                ) : (
                                  <div className="w-7 h-7 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center shrink-0 border border-gray-100 shadow-sm">
                                    {currentUser.firstName.charAt(0)}
                                  </div>
                                )}
                                <span className="text-[12px] font-bold text-gray-700 dark:text-gray-200 flex-1 text-left">Me</span>
                                {(task.assigneeIds || task.assignees?.map(a => a.id) || []).includes(currentUser.id) && (
                                  <div className="w-4 h-4 rounded-full bg-indigo-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4"><path d="M5 13l4 4L19 7" /></svg>
                                  </div>
                                )}
                              </button>
                            )}

                            {/* Other Members */}
                            {(members || [])
                              .filter(m => m && m.id !== currentUser?.id)
                              .filter(u => {
                                const q = (assigneeSearch || '').toLowerCase();
                                const fullName = `${u.firstName || ''} ${u.lastName || ''} ${u.email || ''}`.toLowerCase();
                                return fullName.includes(q);
                              }).length === 0 ? (
                              <div className="px-3 py-4 text-center text-[10px] text-gray-400 italic">
                                No other signup members found
                              </div>
                            ) : (
                              (members || [])
                                .filter(m => m && m.id !== currentUser?.id)
                                .filter(u => {
                                  const q = (assigneeSearch || '').toLowerCase();
                                  const fullName = `${u.firstName || ''} ${u.lastName || ''} ${u.email || ''}`.toLowerCase();
                                  return fullName.includes(q);
                                })
                                .map(u => {
                                  const currentIds = task.assigneeIds || task.assignees?.map(a => a.id) || [];
                                  const isAssigned = currentIds.includes(u.id);
                                  return (
                                    <button
                                      key={u.id}
                                      onClick={() => {
                                        const nextIds = isAssigned
                                          ? currentIds.filter(id => id !== u.id)
                                          : [...currentIds, u.id];
                                        handleUpdateTaskAssignees(task.id, nextIds);
                                      }}
                                      className={`w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${isAssigned ? 'bg-indigo-50/50 dark:bg-indigo-900/10' : ''}`}
                                    >
                                      {u.avatarUrl ? (
                                        <img
                                          src={u.avatarUrl}
                                          alt=""
                                          className="w-7 h-7 rounded-full object-cover border border-gray-100"
                                          onError={(e) => {
                                            (e.target as HTMLImageElement).style.display = 'none';
                                            const p = (e.target as HTMLImageElement).parentElement;
                                            if (p && !p.querySelector('.avatar-placeholder')) {
                                              const d = document.createElement('div');
                                              d.className = 'avatar-placeholder w-7 h-7 rounded-full bg-indigo-500 text-white text-[10px] font-black flex items-center justify-center shrink-0 border border-gray-100 shadow-sm';
                                              d.innerText = `${u.firstName.charAt(0)}${u.lastName.charAt(0)}`;
                                              p.appendChild(d);
                                            }
                                          }}
                                        />
                                      ) : (
                                        <div className="w-7 h-7 rounded-full bg-indigo-500 text-white text-[10px] font-black flex items-center justify-center shrink-0 border border-gray-100 shadow-sm">
                                          {u.firstName.charAt(0)}{u.lastName.charAt(0)}
                                        </div>
                                      )}
                                      <div className="flex-1 text-left">
                                        <div className="text-[12px] font-bold text-gray-700 dark:text-gray-200">{u.firstName} {u.lastName}</div>
                                        <div className="text-[10px] text-gray-400 font-medium truncate">{u.email}</div>
                                      </div>
                                      {isAssigned && (
                                        <div className="w-4 h-4 rounded-full bg-indigo-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4"><path d="M5 13l4 4L19 7" /></svg>
                                        </div>
                                      )}
                                    </button>
                                  );
                                })
                            )
                            }
                          </div>

                          {/* AI Footer */}
                          <div className="p-2 border-t border-gray-50 dark:border-gray-700 bg-gray-50/30 space-y-1.5">
                            <div className="flex gap-1.5">
                              <button
                                onClick={() => handleUpdateTaskAssignees(task.id, [])}
                                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[10px] font-black text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all border border-transparent hover:border-red-100"
                                title="Remove all assignees"
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                                REMOVE ALL
                              </button>
                              <button
                                onClick={() => loadAllMembers()}
                                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[10px] font-black text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-all border border-transparent hover:border-emerald-100"
                                title="Refresh list"
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                REFRESH
                              </button>
                            </div>
                            <button className="w-full flex items-center justify-center gap-2 py-2 text-[10px] font-black text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-all border border-transparent hover:border-indigo-100" title="Set up AI">
                              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0M12 8l0 4l3 0" opacity="0.3" />
                              </svg>
                              SET UP FILL WITH AI
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="col-span-2 text-center text-[12px] font-bold text-gray-500">
                      {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : <span className="text-gray-200">—</span>}
                    </div>


                    <div className="col-span-1 flex justify-center">
                      <div className={PRIORITY_ICONS[task.priority].color}>
                        {PRIORITY_ICONS[task.priority].icon}
                      </div>
                    </div>

                    {/* Actions Column */}
                    <div className="col-span-1 flex items-center justify-end gap-1 pr-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleToggleFavorite(task); }}
                        className={`p-1 transition-colors ${task.isFavorite ? 'text-amber-400' : 'text-gray-300 hover:text-gray-400 opacity-0 group-hover:opacity-100'}`}
                        title={task.isFavorite ? "Unfavorite" : "Favorite"}
                      >
                        <svg className="w-4 h-4" fill={task.isFavorite ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                        </svg>
                      </button>

                      <Dropdown
                        align="right"
                        trigger={
                          <button className="p-1 text-gray-300 hover:text-gray-600 dark:hover:text-gray-200 opacity-0 group-hover:opacity-100 transition-all" title="Task actions">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" /></svg>
                          </button>
                        }
                      >
                        {canUpdateTaskDetails && (
                          <DropdownItem
                            icon={<svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>}
                            onClick={() => { setRenamingTaskId(task.id); setRenamingTitle(task.title); }}
                          >
                            Rename
                          </DropdownItem>
                        )}
                        <DropdownItem
                          icon={<svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>}
                          onClick={() => handleToggleFavorite(task)}
                        >
                          {task.isFavorite ? 'Unfavorite' : 'Favorite'}
                        </DropdownItem>
                        {canDeleteTask && (
                          <>
                            <hr className="my-1 border-gray-100 dark:border-gray-700" />
                            <DropdownItem
                              danger
                              icon={<svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>}
                              onClick={() => handleDeleteSingleTask(task.id)}
                            >
                              Delete
                            </DropdownItem>
                          </>
                        )}
                      </Dropdown>
                    </div>
                  </motion.div>
                ))}

                {/* Inline Task Creation */}
                <div className="pt-2">
                  {canCreateTask && (
                    addingInStatus === status ? (
                      <div className="grid grid-cols-12 gap-4 px-4 py-2 bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-200 dark:border-indigo-900/50 rounded-xl">
                        <div className="col-span-12 flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full ${config.dot}`} />
                          <input
                            type="text"
                            value={newTaskTitle}
                            onChange={(e) => setNewTaskTitle(e.target.value)}
                            onBlur={() => !newTaskTitle.trim() && setAddingInStatus(null)}
                            onKeyDown={(e) => e.key === 'Enter' && handleCreateTask(status)}
                            placeholder="What needs to be done?"
                            className="flex-1 bg-transparent border-none outline-none text-sm font-bold text-gray-900 dark:text-white placeholder-gray-400"
                            autoFocus
                            title="New task title"
                          />
                          <button
                            onClick={() => handleCreateTask(status)}
                            className="px-4 py-1.5 bg-indigo-600 text-white text-[10px] font-black rounded-lg"
                            title="Save new task"
                          >
                            CREATE
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setAddingInStatus(status)}
                        className="group w-full flex items-center gap-3 px-4 py-2 border border-dashed border-gray-100 dark:border-gray-800 rounded-xl text-gray-400 hover:border-gray-300 dark:hover:border-gray-700 hover:text-gray-600 dark:hover:text-gray-200 transition-all"
                        title={`Add task to ${config.label}`}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                        <span className="text-xs font-bold uppercase tracking-wider">Add Task</span>
                      </button>
                    )
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Select All Bar */}
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
                loadData();
                deselectAll();
                toast.success('Tasks updated');
              } catch {
                toast.error('Failed to update tasks');
              }
            } : undefined}
            onBulkPriorityChange={canUpdateTaskDetails ? async (priority: TaskPriority) => {
              try {
                await api.patch('/tasks/bulk', { taskIds: Array.from(selectedIds), data: { priority } });
                loadData();
                deselectAll();
                toast.success('Tasks updated');
              } catch {
                toast.error('Failed to update tasks');
              }
            } : undefined}
            onBulkAssign={canUpdateTaskDetails ? async (assigneeIds: string[]) => {
              try {
                await api.patch('/tasks/bulk', { taskIds: Array.from(selectedIds), data: { assigneeIds } });
                loadData();
                deselectAll();
                toast.success('Tasks updated');
              } catch {
                toast.error('Failed to update tasks');
              }
            } : undefined}
            onBulkDueDate={canUpdateTaskDetails ? async (dueDate: string | null) => {
              try {
                await api.patch('/tasks/bulk', { taskIds: Array.from(selectedIds), data: { dueDate } });
                loadData();
                deselectAll();
                toast.success('Tasks updated');
              } catch {
                toast.error('Failed to update tasks');
              }
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
            deselectAll();
            loadData();
            toast.success('Tasks deleted');
          } catch {
            toast.error('Failed to delete tasks');
          } finally {
            setIsBulkDeleting(false);
            setShowDeleteConfirm(false);
          }
        }}
        title="Delete Tasks"
        message={`Are you sure you want to delete ${selectedIds.size} tasks? This action cannot be undone.`}
        confirmLabel="Delete"
        loading={isBulkDeleting}
      />
    </div>
  );
}
