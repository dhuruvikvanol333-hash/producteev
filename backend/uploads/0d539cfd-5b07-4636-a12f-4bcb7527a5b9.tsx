import type { Activity } from './ActivityTimeline';

interface Props {
  activity: Activity;
}

function getInitials(first: string, last: string) {
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

const ACTION_COLORS: Record<string, string> = {
  'task.created': '#22c55e',
  'task.updated': '#3b82f6',
  'task.deleted': '#ef4444',
  'task.assigned': '#8b5cf6',
  'task.status_changed': '#f59e0b',
  'comment.created': '#06b6d4',
  'time_entry.created': '#ec4899',
  'time_entry.stopped': '#f97316',
};

const AVATAR_COLORS = ['#f59e0b', '#3b82f6', '#22c55e', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

function getAvatarColor(userId: string) {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function ActionIcon({ action }: { action: string }) {
  const color = ACTION_COLORS[action] || '#9ca3af';

  switch (action) {
    case 'task.created':
      return (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5">
          <path d="M12 5v14M5 12h14" />
        </svg>
      );
    case 'task.deleted':
      return (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5">
          <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
        </svg>
      );
    case 'task.status_changed':
      return (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5">
          <path d="M5 13l4 4L19 7" />
        </svg>
      );
    case 'task.assigned':
      return (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5">
          <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
          <circle cx="8.5" cy="7" r="4" />
        </svg>
      );
    case 'comment.created':
      return (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5">
          <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
        </svg>
      );
    case 'time_entry.created':
      return (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 6v6l4 2" />
        </svg>
      );
    case 'time_entry.stopped':
      return (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5">
          <circle cx="12" cy="12" r="10" />
          <rect x="9" y="9" width="6" height="6" />
        </svg>
      );
    default:
      return (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5">
          <circle cx="12" cy="12" r="3" />
        </svg>
      );
  }
}

const STATUS_LABELS: Record<string, string> = {
  TODO: 'To Do',
  IN_PROGRESS: 'In Progress',
  IN_REVIEW: 'In Review',
  DONE: 'Done',
};

function formatStatusLabel(status: string) {
  return STATUS_LABELS[status] || status;
}

function buildMessage(activity: Activity): string {
  const name = `${activity.user.firstName} ${activity.user.lastName}`;
  const changes = activity.changes as Record<string, unknown>;

  switch (activity.action) {
    case 'task.created':
      return `${name} created this task`;

    case 'task.deleted':
      return `${name} deleted this task`;

    case 'task.status_changed': {
      const status = changes.status as { from: string; to: string } | undefined;
      if (status) {
        return `${name} changed status from ${formatStatusLabel(status.from)} to ${formatStatusLabel(status.to)}`;
      }
      return `${name} changed the status`;
    }

    case 'task.assigned': {
      const assignee = changes.assignee as { from: string | null; to: string | null } | undefined;
      if (assignee) {
        if (!assignee.from && assignee.to) return `${name} assigned to ${assignee.to}`;
        if (assignee.from && !assignee.to) return `${name} unassigned ${assignee.from}`;
        return `${name} reassigned from ${assignee.from} to ${assignee.to}`;
      }
      return `${name} changed the assignee`;
    }

    case 'task.updated': {
      const parts: string[] = [];
      if (changes.title) parts.push('title');
      if (changes.description) parts.push('description');
      if (changes.priority) {
        const p = changes.priority as { from: string; to: string };
        return `${name} changed priority from ${p.from} to ${p.to}`;
      }
      if (changes.dueDate) {
        const d = changes.dueDate as { from: string | null; to: string | null };
        if (d.to) return `${name} changed due date to ${d.to}`;
        return `${name} removed the due date`;
      }
      if (parts.length > 0) return `${name} updated ${parts.join(' and ')}`;
      return `${name} updated this task`;
    }

    case 'comment.created':
      return `${name} added a comment`;

    case 'time_entry.created': {
      const duration = changes.duration as string | undefined;
      const type = changes.type as string | undefined;
      if (type === 'timer_started') {
        return `${name} started a timer`;
      }
      if (duration) return `${name} tracked ${duration} on this task`;
      return `${name} tracked time on this task`;
    }

    case 'time_entry.stopped': {
      const stoppedDuration = changes.duration as string | undefined;
      const startTime = changes.startTime as string | undefined;
      const endTime = changes.endTime as string | undefined;
      let msg = `${name} stopped timer`;
      if (stoppedDuration) msg += ` (${stoppedDuration})`;
      if (startTime && endTime) {
        const start = new Date(startTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
        const end = new Date(endTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
        msg += ` — ${start} → ${end}`;
      }
      return msg;
    }

    default:
      return `${name} performed an action`;
  }
}

function ChangeDetail({ activity }: { activity: Activity }) {
  const changes = activity.changes as Record<string, unknown>;
  const details: { label: string; from: string; to: string }[] = [];

  if (changes.status) {
    const s = changes.status as { from: string; to: string };
    details.push({ label: 'Status', from: formatStatusLabel(s.from), to: formatStatusLabel(s.to) });
  }
  if (changes.priority) {
    const p = changes.priority as { from: string; to: string };
    details.push({ label: 'Priority', from: p.from, to: p.to });
  }
  if (changes.dueDate) {
    const d = changes.dueDate as { from: string | null; to: string | null };
    details.push({ label: 'Due date', from: d.from || 'None', to: d.to || 'None' });
  }
  if (changes.title) {
    const t = changes.title as { from: string; to: string };
    details.push({ label: 'Title', from: t.from, to: t.to });
  }

  if (details.length === 0) return null;

  return (
    <div className="mt-1.5 space-y-1">
      {details.map((d, i) => (
        <div key={i} className="flex items-center gap-1.5 text-[11px]">
          <span className="text-gray-400 dark:text-gray-500 line-through">{d.from}</span>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
          <span className="text-gray-600 dark:text-gray-300 font-medium">{d.to}</span>
        </div>
      ))}
    </div>
  );
}

export function ActivityItem({ activity }: Props) {
  const message = buildMessage(activity);
  const avatarColor = getAvatarColor(activity.userId);

  return (
    <div className="flex items-start gap-2.5 py-2 px-1 hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-md transition-colors">
      {/* Avatar */}
      {activity.user.avatarUrl ? (
        <img src={activity.user.avatarUrl} alt="" className="w-6 h-6 rounded-full object-cover shrink-0 mt-0.5 shadow-sm" />
      ) : (
        <div
          className="w-6 h-6 rounded-full text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5 shadow-sm"
          style={{ backgroundColor: avatarColor }}
        >
          {getInitials(activity.user.firstName, activity.user.lastName)}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <ActionIcon action={activity.action} />
            <span className="text-[12px] text-gray-600 dark:text-gray-300 leading-snug">{message}</span>
          </div>
          <span className="text-[10px] text-gray-400 dark:text-gray-500 shrink-0 mt-0.5">
            {formatTime(activity.createdAt)}
          </span>
        </div>
        <ChangeDetail activity={activity} />
      </div>
    </div>
  );
}
