import { useEffect, useState, useCallback } from 'react';
import api from '../../services/api';
import { ActivityItem } from './ActivityItem';
import { useSocket } from '../../hooks/useSocket';

interface ActivityUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
}

export interface Activity {
  id: string;
  orgId: string | null;
  userId: string;
  entityType: string;
  entityId: string;
  action: string;
  changes: Record<string, unknown>;
  createdAt: string;
  user: ActivityUser;
}

interface Props {
  taskId: string;
  refreshKey?: number;
}

function groupByDate(activities: Activity[]): Record<string, Activity[]> {
  const groups: Record<string, Activity[]> = {};
  for (const a of activities) {
    const date = new Date(a.createdAt);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    let key: string;
    if (date.toDateString() === today.toDateString()) {
      key = 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      key = 'Yesterday';
    } else {
      key = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    if (!groups[key]) groups[key] = [];
    groups[key].push(a);
  }
  return groups;
}

export function ActivityTimeline({ taskId, refreshKey }: Props) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const socket = useSocket();

  const loadActivities = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setIsRefreshing(true);
    
    try {
      const res = await api.get<{ success: boolean; data: Activity[] }>(`/tasks/${taskId}/activities`);
      setActivities(res.data.data);
    } catch (err) {
      console.error('Failed to load activities:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [taskId]);

  useEffect(() => {
    loadActivities();
  }, [loadActivities, refreshKey]);

  // Real-time socket logic
  useEffect(() => {
    if (!socket || !taskId) return;

    const handleRealtimeUpdate = (data: any) => {
      // If the notification refers to this task, refresh the timeline
      if (data.link === `/tasks/${taskId}` || (data.message && data.message.includes(taskId))) {
        loadActivities(true);
      }
    };

    socket.on('notification:new', handleRealtimeUpdate);
    return () => {
      socket.off('notification:new', handleRealtimeUpdate);
    };
  }, [socket, taskId, loadActivities]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <svg className="animate-spin w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
          <path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" fill="currentColor" className="opacity-75" />
        </svg>
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="text-center py-6 text-xs text-gray-400 dark:text-gray-500">
        No activity yet
      </div>
    );
  }

  const grouped = groupByDate(activities);

  return (
    <div className={`space-y-4 transition-opacity duration-300 ${isRefreshing ? 'opacity-70' : 'opacity-100'}`}>
      {Object.entries(grouped).map(([date, items]) => (
        <div key={date}>
          <div className="flex items-center gap-2 mb-2">
            <div className="h-px flex-1 bg-gray-100 dark:bg-gray-700" />
            <span className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">{date}</span>
            <div className="h-px flex-1 bg-gray-100 dark:bg-gray-700" />
          </div>
          <div className="space-y-1">
            {items.map((activity) => (
              <ActivityItem key={activity.id} activity={activity} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
