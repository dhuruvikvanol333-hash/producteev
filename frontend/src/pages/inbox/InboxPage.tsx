import { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { useNotifications } from '../../hooks/useNotifications';
import { motion, AnimatePresence } from 'framer-motion';
import { Notification } from '../../types/notification.types';

const INBOX_TABS = [
  {
    id: 'Primary', label: 'Primary',
    icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
  },
  {
    id: 'Other', label: 'Other',
    icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
  },
  {
    id: 'Later', label: 'Later',
    icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
  },
  {
    id: 'Cleared', label: 'Cleared',
    icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" /></svg>
  },
];

function UserAvatar({ notif }: { notif: Notification }) {
  const ref = useRef<HTMLDivElement>(null);
  const initials = notif.message.split(' ')[0].substring(0, 2).toUpperCase();
  const hue = notif.id.charCodeAt(0) * 47 % 360;

  useEffect(() => {
    if (ref.current) {
      ref.current.style.background = `linear-gradient(135deg, hsl(${hue},70%,55%), hsl(${hue},80%,38%))`;
    }
  }, [hue]);

  return (
    <div
      ref={ref}
      className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-[10px] font-bold text-white"
    >
      {initials}
    </div>
  );
}

function SenderAvatar({ notif }: { notif: Notification }) {
  if (notif.senderAvatarUrl) {
    return (
      <img
        src={notif.senderAvatarUrl}
        alt="sender"
        className="w-7 h-7 rounded-full object-cover shrink-0 shadow-sm"
      />
    );
  }
  return <UserAvatar notif={notif} />;
}

function groupByDate(groups: { latest: Notification; count: number }[]) {
  const dateGroups: Record<string, { latest: Notification; count: number }[]> = {
    'Today': [], 'Yesterday': [], 'Last 7 Days': [], 'Older': []
  };
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  const last7 = new Date(today); last7.setDate(today.getDate() - 7);

  groups.forEach(g => {
    const d = new Date(g.latest.createdAt);
    const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    if (day.getTime() === today.getTime()) dateGroups['Today'].push(g);
    else if (day.getTime() === yesterday.getTime()) dateGroups['Yesterday'].push(g);
    else if (day.getTime() >= last7.getTime()) dateGroups['Last 7 Days'].push(g);
    else dateGroups['Older'].push(g);
  });
  return dateGroups;
}

const extractTaskId = (link: string | null | undefined) => {
  if (!link) return null;
  const match = link.match(/\/(?:tasks|inbox\/task)\/([^/?#]+)/);
  return match ? match[1] : null;
};

export function InboxPage() {
  const [activeTab, setActiveTab] = useState('Primary');
  const { notifications, unreadCount, markAsRead, markAllAsRead, markTaskAsRead, loading, refresh, resetUnreadCount } = useNotifications();
  const navigate = useNavigate();

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    // Mark as seen whenever we view the page
    resetUnreadCount();
  }, [resetUnreadCount, notifications.length]);


  const filteredNotifications = useMemo(() => {
    if (activeTab === 'Cleared') return notifications.filter(n => n.isRead);
    return notifications.filter(n => !n.isRead);
  }, [notifications, activeTab]);

  const deduplicatedByTask = useMemo(() => {
    const groups = new Map<string, { latest: Notification; count: number }>();
    filteredNotifications.forEach(n => {
      const taskId = extractTaskId(n.link) ?? n.id;
      const group = groups.get(taskId);
      if (!group) {
        groups.set(taskId, { latest: n, count: 1 });
      } else {
        group.count += 1;
        // Keep the latest one
        if (new Date(n.createdAt) > new Date(group.latest.createdAt)) {
          group.latest = n;
        }
      }
    });
    return Array.from(groups.values());
  }, [filteredNotifications]);

  const grouped = useMemo(() => groupByDate(deduplicatedByTask), [deduplicatedByTask]);

  const handleClick = async (notif: Notification) => {
    const taskId = extractTaskId(notif.link);
    if (taskId) {

      navigate(`/inbox/task/${taskId}`);
    } else {
      await markAsRead(notif.id);
    }
  };

  const NotifRow = ({ group }: { group: { latest: Notification; count: number } }) => {
  const notif = group.latest;
  const lastSeen = useMemo(() => parseInt(localStorage.getItem('inbox_last_seen') || '0', 10), []);
  const isNew = !notif.isRead && new Date(notif.createdAt).getTime() > lastSeen;

  return (
    <button
      key={notif.id}
      onClick={() => handleClick(notif)}
      className={`
        w-full group grid grid-cols-[280px_1fr_140px] items-center gap-4 px-5 py-3 rounded-xl text-left transition-all relative border
        ${!notif.isRead
          ? 'bg-white dark:bg-transparent border-gray-100 dark:border-gray-800/50 shadow-sm'
          : 'bg-transparent border-transparent opacity-60'
        }
        hover:bg-gray-50 dark:hover:bg-gray-800/50 dark:hover:border-transparent
      `}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className={`w-2 h-2 rounded-full shrink-0 ${!notif.isRead ? 'bg-indigo-600' : 'bg-gray-200'}`} />
        <div className="flex flex-col min-w-0">
          <span className={`text-[14px] truncate ${!notif.isRead ? 'font-bold text-gray-800 dark:text-gray-100' : 'text-gray-500'}`}>
            {notif.title}
          </span>
          {group.count > 1 && isNew && (
            <span className="flex items-center gap-1.5 px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold rounded-full border border-indigo-100 dark:border-indigo-800 animate-pulse">
               {group.count} Updates
            </span>
          )}
        </div>
      </div>

        <div className="flex items-center gap-3 min-w-0 overflow-hidden">
          <SenderAvatar notif={notif} />
          <span className={`text-[14px] truncate ${!notif.isRead ? 'text-gray-600 dark:text-gray-300' : 'text-gray-400'}`}>
            {notif.message}
          </span>
        </div>

        <div className="flex items-center justify-end">
          <span className="text-[12px] text-gray-400 group-hover:hidden">
            {new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(notif.createdAt))}
          </span>

          <div className="hidden group-hover:flex items-center gap-2">
            <button
              title="Mark unread"
              onClick={e => { e.stopPropagation(); }}
              className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </button>
            <button
              title="Snooze"
              onClick={e => { e.stopPropagation(); }}
              className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
            <button
              title="Clear"
              onClick={e => { e.stopPropagation(); markTaskAsRead(notif); }}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[12px] font-semibold rounded-lg transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
              Clear
            </button>
          </div>
        </div>
      </button>
    );
  };

  const DateGroup = ({ label, items }: { label: string; items: { latest: Notification; count: number }[] }) => {
    if (items.length === 0) return null;
    return (
      <div className="mb-6">
        <h3 className="px-2 mb-2 text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
          {label}
        </h3>
        <div className="space-y-1">
          {items.map(g => <NotifRow key={g.latest.id} group={g} />)}
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-white dark:bg-[#0F172A] font-sans">
      <div className="flex items-center border-b border-gray-100 dark:border-gray-800 px-2 shrink-0">
        {INBOX_TABS.map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex items-center gap-2 px-5 py-4 text-[13px] font-medium transition-all relative
                ${isActive
                  ? 'text-gray-900 dark:text-white'
                  : 'text-gray-400 hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-200'
                }
              `}
            >
              {tab.icon}
              {tab.label}
              {tab.id === 'Primary' && unreadCount > 0 && (
                <span className="flex items-center justify-center min-w-[17px] h-[17px] text-[10px] bg-red-500 text-white rounded-full font-bold px-1">
                  {unreadCount}
                </span>
              )}
              {isActive && (
                <motion.div
                  layoutId="inboxTabUnderline"
                  className="absolute bottom-0 left-0 right-0 h-[2px] bg-indigo-600 dark:bg-indigo-400"
                />
              )}
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between px-6 py-2.5 shrink-0">
        <button className="flex items-center gap-1.5 text-[12px] text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 transition-colors">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          Filter
        </button>
        <div className="flex items-center gap-3">
          <button className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors" title="Settings">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
          {activeTab === 'Primary' && (
            <button
              onClick={markAllAsRead}
              className="flex items-center gap-1.5 text-[12px] font-semibold text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Clear all
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-700">
        <AnimatePresence mode="wait">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <svg className="animate-spin w-8 h-8 text-indigo-500" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                <path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" fill="currentColor" className="opacity-75" />
              </svg>
            </div>
          ) : deduplicatedByTask.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center h-64 text-center"
            >
              <div className="w-16 h-16 bg-gray-50 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">You're all caught up!</p>
              <p className="text-xs text-gray-400 mt-1">No new notifications</p>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="px-6 py-4"
            >
              <DateGroup label="Today" items={grouped['Today']} />
              <DateGroup label="Yesterday" items={grouped['Yesterday']} />
              <DateGroup label="Last 7 Days" items={grouped['Last 7 Days']} />
              <DateGroup label="Older" items={grouped['Older']} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
