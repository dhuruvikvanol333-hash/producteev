import { User, UserMinus, Share2, MessageSquare, Plus, Trash2, CheckCircle2, Clock, Play, Square } from 'lucide-react';
import type { Activity } from './ActivityTimeline';

interface Props {
  activity: Activity;
}

function formatTime(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  const timeStr = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  if (isToday) return `Today at ${timeStr}`;
  if (isYesterday) return `Yesterday at ${timeStr}`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  }) + ` at ${timeStr}`;
}

const ACTION_CONFIG: Record<string, { icon: any; color: string; iconColor: string }> = {
  'task.created': { icon: Plus, color: 'text-gray-500', iconColor: 'text-green-500' },
  'task.deleted': { icon: Trash2, color: 'text-gray-400', iconColor: 'text-red-500' },
  'task.status_changed': { icon: CheckCircle2, color: 'text-gray-500', iconColor: 'text-amber-500' },
  'task.assigned': { icon: User, color: 'text-indigo-600', iconColor: 'text-indigo-500' },
  'task.unassigned': { icon: UserMinus, color: 'text-gray-400', iconColor: 'text-gray-400' },
  'task.shared': { icon: Share2, color: 'text-indigo-600', iconColor: 'text-indigo-400' },
  'comment.created': { icon: MessageSquare, color: 'text-gray-600', iconColor: 'text-blue-400' },
  'time_entry.created': { icon: Play, color: 'text-gray-500', iconColor: 'text-pink-500' },
  'time_entry.stopped': { icon: Square, color: 'text-gray-500', iconColor: 'text-orange-500' },
};

export function ActivityItem({ activity }: Props) {
  const name = `${activity.user.firstName} ${activity.user.lastName}`;
  const changes = activity.changes as Record<string, any>;
  let actionText = '';
  let actionKey = activity.action;

  // Refine action text based on changes
  switch (activity.action) {
    case 'task.created':
      actionText = 'created this task';
      break;
    case 'task.deleted':
      actionText = 'deleted this task';
      break;
    case 'task.status_changed':
      if (changes.status) {
        actionText = `changed status to ${changes.status.to}`;
      } else {
        actionText = 'changed the status';
      }
      break;
    case 'task.assigned': {
      const assignee = changes.assignee;
      if (assignee) {
        if (!assignee.from && assignee.to) {
          actionText = `assigned this task to ${assignee.to === 'you' || assignee.to === name ? 'you' : assignee.to}`;
        } else if (assignee.from && !assignee.to) {
          actionKey = 'task.unassigned';
          actionText = `unassigned ${assignee.from} from this task`;
        } else {
          actionText = `reassigned from ${assignee.from} to ${assignee.to}`;
        }
      } else {
        actionText = 'assigned this task to you';
      }
      break;
    }
    case 'task.shared':
      actionText = 'shared this task with you';
      break;
    case 'comment.created':
      actionText = 'added a comment';
      break;
    default:
      actionText = 'updated this task';
  }

  const config = ACTION_CONFIG[actionKey] || { icon: Clock, color: 'text-gray-500', iconColor: 'text-gray-400' };
  const Icon = config.icon;

  return (
    <div className="group flex items-center justify-between py-2.5 px-3 hover:bg-gray-50/50 dark:hover:bg-gray-800/20 rounded-xl transition-all border border-transparent hover:border-gray-50 dark:hover:border-gray-800/50">
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${config.iconColor} bg-opacity-10 shrink-0`}>
          <Icon size={14} />
        </div>
        <div className="flex items-center gap-1.5 text-[13px]">
          <span className="font-bold text-gray-700 dark:text-gray-200">{name}</span>
          <span className={`${config.color} font-medium`}>{actionText}</span>
        </div>
      </div>
      <span className="text-[11px] text-gray-400 dark:text-gray-500 font-medium whitespace-nowrap">
        {formatTime(activity.createdAt)}
      </span>
    </div>
  );
}
