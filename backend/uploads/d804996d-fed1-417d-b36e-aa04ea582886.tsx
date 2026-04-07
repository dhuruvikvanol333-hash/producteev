import { useEffect, useState, useCallback } from 'react';
import { Link, useLocation } from 'react-router';
import api from '../../services/api';
import { Loading } from '../../components/ui/Loading';
import type { Task, TaskPriority } from '../../types';


const PRIORITY_META: Record<TaskPriority, { label: string; color: string }> = {
  URGENT: { label: 'Urgent', color: '#ef4444' },
  HIGH: { label: 'High', color: '#f97316' },
  MEDIUM: { label: 'Normal', color: '#3b82f6' },
  LOW: { label: 'Low', color: '#6b7280' },
};

function relativeDate(dateStr: string | null): { text: string; overdue: boolean } {
  if (!dateStr) return { text: '', overdue: false };
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const due = new Date(dateStr); due.setHours(0, 0, 0, 0);
  const diff = Math.round((now.getTime() - due.getTime()) / 86400000);
  if (diff < 0) return { text: `In ${Math.abs(diff)}d`, overdue: false };
  if (diff === 0) return { text: 'Today', overdue: false };
  if (diff === 1) return { text: 'Yesterday', overdue: true };
  return { text: `${diff}d ago`, overdue: true };
}

export function FavoritesPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const location = useLocation();

  const loadTasks = useCallback(async () => {
    try {
      const res = await api.get<{ success: boolean; data: Task[] }>('/tasks/favorites');
      if (res.data.success) {
        setTasks(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load favorites', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const handleToggleFavorite = async (task: Task) => {
    try {
      // Optimistic UI
      setTasks(prev => prev.filter(t => t.id !== task.id));
      await api.patch(`/tasks/${task.id}`, { isFavorite: false });
    } catch (err) {
      loadTasks(); // Rollback
    }
  };

  if (loading) return <Loading size="lg" />;

  return (
    <div className="min-h-full bg-white dark:bg-gray-900 -m-4 sm:-m-6 flex flex-col">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-500">
            <svg width="24" height="24" fill="currentColor" viewBox="0 0 24 24">
              <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Favorites</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Your most important tasks across all lists</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {tasks.length === 0 ? (
          <div className="py-24 flex flex-col items-center gap-3 text-gray-400 dark:text-gray-500">
            <div className="p-4 rounded-full bg-gray-50 dark:bg-gray-800">
              <svg width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
            </div>
            <p className="text-sm font-medium">No favorite tasks yet</p>
            <p className="text-xs">Click the star icon on any task to add it here</p>
          </div>
        ) : (
          <div className="px-4 py-6">
            <div className="grid grid-cols-12 gap-1 px-4 py-2 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
              <div className="col-span-6">Task</div>
              <div className="col-span-3">Context</div>
              <div className="col-span-2 text-center">Due Date</div>
              <div className="col-span-1 text-right">Action</div>
            </div>

            <div className="mt-2 space-y-1">
              {tasks.map(task => {
                const due = relativeDate(task.dueDate);
                return (
                  <Link
                    key={task.id}
                    to={`/tasks/${task.id}`}
                    state={{ backgroundLocation: location }}
                    className="grid grid-cols-12 items-center px-4 py-3 bg-white dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700/50 rounded-xl hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-900/50 transition-all cursor-pointer group"
                  >
                    <div className="col-span-6 flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full shrink-0" {...{ style: { backgroundColor: PRIORITY_META[task.priority].color } }} />
                      <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                        {task.title}
                      </span>
                    </div>

                    <div className="col-span-3">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 font-bold uppercase truncate max-w-[120px]">
                          {task.list?.folder?.name || 'No Folder'}
                        </span>
                        <svg className="w-2 h-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" /></svg>
                        <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium truncate max-w-[120px]">
                          {task.list?.name || 'Inbox'}
                        </span>
                      </div>
                    </div>

                    <div className="col-span-2 flex justify-center">
                      {due.text ? (
                        <div className={`flex items-center gap-1 text-[11px] font-bold ${due.overdue ? 'text-red-500' : 'text-gray-400'}`}>
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
                          {due.text}
                        </div>
                      ) : (
                        <span className="text-[11px] text-gray-300">—</span>
                      )}
                    </div>

                    <div className="col-span-1 flex justify-end">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleToggleFavorite(task); }}
                        className="p-1.5 text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors"
                        title="Remove from Favorites"
                      >
                        <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                        </svg>
                      </button>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
