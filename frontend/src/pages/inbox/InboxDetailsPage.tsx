import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import {
  ChevronRight,
  ChevronLeft,
  Star,
  BellOff,
  Archive,
  Clock,
  Check,
  Maximize2,
  MoreHorizontal,
  ThumbsUp,
  Smile,
  Reply,
  Square
} from 'lucide-react';
import api from '../../services/api';
import { Loading } from '../../components/ui/Loading';
import { useNotifications } from '../../hooks/useNotifications';
import { ActivityTimeline } from '../../components/activity/ActivityTimeline';
import type { Task } from '../../types';

export function InboxDetailsPage() {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const { notifications, markTaskAsRead } = useNotifications();
  const [task, setTask] = useState<Task | null>(null);

  const extractTaskId = (link: string | null | undefined) => {
    if (!link) return null;
    const match = link.match(/\/tasks\/([^/]+)/);
    return match ? match[1] : link;
  };
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (taskId) {
      loadTask(taskId);
    }
  }, [taskId]);

  const loadTask = async (id: string) => {
    setLoading(true);
    try {
      const res = await api.get<{ success: boolean; data: Task }>(`/tasks/${id}`);
      setTask(res.data.data);
    } catch (err) {
      console.error('Failed to load task:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="flex-1 flex items-center justify-center"><Loading size="lg" /></div>;
  if (!task) return <div className="flex-1 flex items-center justify-center text-gray-500">Task not found</div>;

  return (
    <div className="flex-1 flex flex-col h-full bg-[#f8f9fb] dark:bg-[#1E2530] overflow-hidden font-sans">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 bg-white dark:bg-[#1E2530] border-b border-gray-100 dark:border-gray-800 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={() => navigate('/inbox')}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors rounded-md"
            title="Back to Inbox"
          >
            <ChevronLeft size={20} />
          </button>

          <div className="flex flex-col gap-0.5 min-w-0">
            <div className="flex items-center gap-1.5 text-[11px] text-gray-400 dark:text-gray-500 font-medium">
              <span
                onClick={() => navigate('/inbox')}
                className="hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer transition-colors"
              >
                Inbox
              </span>
              <ChevronRight size={10} className="shrink-0" />
              <span className="hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer" onClick={() => navigate('/inbox')}>Notifications</span>
            </div>

            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded border-2 border-dashed border-gray-300 dark:border-gray-600 shrink-0 flex items-center justify-center">
                <Square size={8} className="text-gray-400" />
              </div>
              <h1 className="text-[15px] font-bold text-gray-900 dark:text-gray-100 truncate">
                {task.title}
              </h1>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors" title="Maximize">
            <Maximize2 size={16} />
          </button>
          <button className="p-2 text-gray-400 hover:text-amber-400 transition-colors" title={task.isFavorite ? "Unfavorite" : "Favorite"}>
            <Star size={16} fill={task.isFavorite ? "currentColor" : "none"} />
          </button>
          <button className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors" title="Notifications Off">
            <BellOff size={16} />
          </button>
          <button className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors" title="Archive">
            <Archive size={16} />
          </button>
          <button className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors" title="Snooze">
            <Clock size={16} />
          </button>

          <div className="w-px h-6 bg-gray-100 dark:bg-gray-800 mx-2" />

          <button className="flex items-center gap-2 px-3 py-1.5 text-[13px] font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 transition-all">
            <MoreHorizontal size={14} />
            Details
          </button>

          <button
            onClick={() => {
              if (taskId) markTaskAsRead(taskId);
              navigate('/inbox');
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-all"
          >
            <Check size={16} strokeWidth={3} />
            Clear
          </button>
        </div>
      </header>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-8 flex flex-col items-center">
        <div className="w-full max-w-4xl space-y-6">

          {/* Main Message Card */}
          <div className="bg-white dark:bg-[#252D3A] rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-gray-50 dark:border-gray-800/50 overflow-hidden">
            <div className="p-6">
              <div className="flex items-start gap-3">
                {/* Avatar */}
                <div className="shrink-0">
                  {task.createdBy?.avatarUrl ? (
                    <img src={task.createdBy.avatarUrl} alt="" className="w-9 h-9 rounded-full object-cover ring-2 ring-white dark:ring-gray-800 shadow-sm" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-indigo-500 flex items-center justify-center text-white text-sm font-bold shadow-sm">
                      {task.createdBy?.firstName?.[0] || '?'}{task.createdBy?.lastName?.[0] || ''}
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-4">
                    <div className="flex items-center gap-2">
                      <span className="text-[14px] font-bold text-gray-900 dark:text-gray-100">
                        {task.createdBy?.firstName} {task.createdBy?.lastName}
                      </span>
                      <span className="text-[12px] text-gray-400 dark:text-gray-500">
                        Yesterday at 1:51 pm
                      </span>
                    </div>
                  </div>

                  <div 
                    className="text-[15px] text-gray-800 dark:text-gray-200 leading-relaxed mb-6 editor-content prose prose-sm dark:prose-invert max-w-none"
                    dangerouslySetInnerHTML={{ __html: task.description || "Hi" }}
                  />
                </div>
              </div>
            </div>

            {/* Footer of Card */}
            <div className="px-6 py-3 bg-gray-50/50 dark:bg-gray-800/30 border-t border-gray-50 dark:border-gray-800/50 flex items-center justify-between">
              <div className="flex items-center gap-1">
                <button className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors" title="Like">
                  <ThumbsUp size={16} />
                </button>
                <button className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors" title="React with Emoji">
                  <Smile size={16} />
                </button>
              </div>
              <button className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg border border-transparent hover:border-indigo-100 dark:hover:border-indigo-900/30 transition-all">
                <Reply size={14} />
                Reply
              </button>
            </div>
          </div>

          {/* Timeline & Notifications */}
          <div className="px-4 space-y-8">
            {/* Task Notifications / Notices */}
            {notifications.filter(n => extractTaskId(n.link) === taskId).length > 0 && (
              <div className="space-y-3">
                <h3 className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest px-2">Task Updates</h3>
                <div className="space-y-2">
                  {notifications
                    .filter(n => extractTaskId(n.link) === taskId)
                    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                    .map(notif => (
                      <div key={notif.id} className="flex items-start gap-3 p-3 bg-white dark:bg-[#252D3A] rounded-xl border border-gray-100 dark:border-gray-800/50 shadow-sm transition-all hover:border-indigo-100 dark:hover:border-indigo-900/30">
                        <div className="w-8 h-8 rounded-full bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center shrink-0">
                          {notif.senderAvatarUrl ? (
                            <img src={notif.senderAvatarUrl} alt="" className="w-full h-full rounded-full object-cover" />
                          ) : (
                            <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
                              {notif.message.split(' ')[0].substring(0, 2).toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div 
                            className="text-[13px] text-gray-800 dark:text-gray-200 prose prose-sm dark:prose-invert max-w-none prose-p:my-0"
                            dangerouslySetInnerHTML={{ __html: notif.message }}
                          />
                          <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1 uppercase font-bold tracking-tighter">
                            {new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(notif.createdAt))}
                          </p>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            <div className="space-y-3">
              <h3 className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest px-2">Activity Log</h3>
              <ActivityTimeline taskId={taskId!} />
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
