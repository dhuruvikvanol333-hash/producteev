import { useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { useNotifications } from '../../hooks/useNotifications';
import { motion, AnimatePresence } from 'framer-motion';

const INBOX_TABS = [
  { id: 'Primary', label: 'Primary', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg> },
  { id: 'Other', label: 'Other', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg> },
  { id: 'Later', label: 'Later', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
  { id: 'Cleared', label: 'Cleared', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> },
];

export function InboxPage() {
  const [activeTab, setActiveTab] = useState('Primary');
  const { notifications, unreadCount, markAsRead, markAllAsRead, loading } = useNotifications();
  const navigate = useNavigate();
  const location = useLocation();

  const filteredNotifications = useMemo(() => {
    // Current mapping:
    // Primary/Other/Later = Unread
    // Cleared = Read
    if (activeTab === 'Cleared') return notifications.filter(n => n.isRead);
    return notifications.filter(n => !n.isRead);
  }, [notifications, activeTab]);

  const groupedNotifications = useMemo(() => {
    const groups: Record<string, typeof notifications> = {
      'Today': [],
      'Tomorrow': [],
      'Last 7 Days': [],
      'Older': []
    };

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const last7Days = new Date(today);
    last7Days.setDate(today.getDate() - 7);

    filteredNotifications.forEach(n => {
      const date = new Date(n.createdAt);
      const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());

      if (d.getTime() === tomorrow.getTime()) groups['Tomorrow'].push(n);
      else if (d.getTime() === today.getTime()) groups['Today'].push(n);
      else if (d.getTime() >= last7Days.getTime()) groups['Last 7 Days'].push(n);
      else groups['Older'].push(n);
    });

    return groups;
  }, [filteredNotifications]);

  const handleNotificationClick = async (id: string, link: string | null) => {
    if (id) await markAsRead(id);
    if (link) {
      if (link.startsWith('/tasks/')) {
        navigate(link, { state: { backgroundLocation: location } });
      } else {
        navigate(link);
      }
    }
  };

  const GroupSection = ({ title, items }: { title: string, items: typeof notifications }) => {
    if (items.length === 0) return null;
    return (
      <div className="mb-8 font-sans">
        <h3 className="px-2 mb-3 text-[11px] font-bold text-gray-500 dark:text-gray-400">
          {title}
        </h3>
        <div className="space-y-2">
          {items.map((notif) => {
            return (
              <button
                key={notif.id}
                onClick={() => handleNotificationClick(notif.id, notif.link)}
                className={`
                  w-full group flex items-center gap-4 px-6 py-3 rounded-xl transition-all text-left
                  ${!notif.isRead
                    ? 'bg-white dark:bg-[#1E2530] shadow-sm border border-gray-100 dark:border-gray-800'
                    : 'bg-black/5 dark:bg-white/5 border border-transparent opacity-60'
                  }
                  hover:scale-[1.002] hover:shadow-md hover:bg-gray-50 dark:hover:bg-[#1f2733]
                `}
              >
                {/* Left: Task Name */}
                <div className="flex items-center gap-4 w-[240px] shrink-0">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 border-2 ${!notif.isRead ? 'border-red-500 bg-red-50/50 text-red-600' : 'border-gray-300 dark:border-gray-700 text-gray-400'}`}>
                    <div className="w-1.5 h-1.5 rounded-full bg-current" />
                  </div>
                  <p className={`text-[13px] tracking-tight truncate ${!notif.isRead ? 'font-medium text-gray-900 dark:text-white' : 'font-normal text-gray-500'}`}>
                    {notif.title}
                  </p>
                </div>

                {/* Center: Activity Message with User Avatar Icon */}
                <div className="flex-1 flex items-center gap-3 px-6 border-l border-gray-100 dark:border-gray-800/30">
                  <div className="w-6 h-6 rounded-lg bg-gray-50 dark:bg-gray-800 flex items-center justify-center text-gray-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                  </div>
                  <p className={`text-[13px] line-clamp-1 ${!notif.isRead ? 'text-gray-600 dark:text-gray-400' : 'text-gray-400'}`}>
                    {notif.message}
                  </p>
                </div>

                {/* Right: Date */}
                <div className="w-[120px] shrink-0 text-right">
                  <span className="text-[11px] font-medium text-gray-400">
                    {new Intl.DateTimeFormat(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                      hour12: true
                    }).format(new Date(notif.createdAt))}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col bg-white dark:bg-[#1E2530] h-full overflow-hidden animate-fade-in font-sans">

      {/* Top Navigation Tabs */}
      <div className="flex border-b border-gray-100 dark:border-gray-800 px-4">
        {INBOX_TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex items-center gap-2.5 px-6 py-4 text-[13px] font-medium transition-all relative
                ${isActive
                  ? 'text-indigo-600 dark:text-indigo-400'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                }
              `}
            >
              <span className={`transition-transform duration-200 ${isActive ? 'scale-110' : 'scale-100'}`}>
                {tab.icon}
              </span>
              {tab.label}
              {tab.id === 'Primary' && unreadCount > 0 && (
                <span className="flex items-center justify-center min-w-[18px] h-[18px] text-[10px] bg-red-500 text-white rounded-full font-bold px-1 ring-2 ring-white dark:ring-gray-900">
                  {unreadCount}
                </span>
              )}
              {isActive && (
                <motion.div
                  layoutId="tabUnderline"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 dark:bg-indigo-400"
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Filter and Clear Actions Bar */}
      <div className="px-8 py-3 flex items-center justify-between">
        <button className="flex items-center gap-2 px-3 py-1.5 text-[11px] font-semibold text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white bg-gray-50 dark:bg-gray-800 rounded-lg transition-colors" title="Filter notifications">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
          Filter
        </button>

        <div className="flex items-center gap-4">
          {activeTab === 'Primary' && (
            <button
              onClick={markAllAsRead}
              className="flex items-center gap-2 px-3 py-1.5 text-[11px] font-bold text-gray-500 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-400 bg-gray-50 dark:bg-gray-800 rounded-lg transition-colors"
              title="Mark all as read"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
              Clear all
            </button>
          )}
          <button className="p-1.5 text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors bg-gray-50 dark:bg-gray-800 rounded-lg" title="Settings">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-800">
        <AnimatePresence mode="wait">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <svg className="animate-spin w-8 h-8 text-indigo-500" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                <path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" fill="currentColor" className="opacity-75" />
              </svg>
            </div>
          ) : filteredNotifications.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex-1 flex flex-col items-center justify-center p-20 text-center"
            >
              <div className="w-20 h-20 bg-gray-50 dark:bg-gray-800/50 rounded-full flex items-center justify-center mb-6">
                <svg className="w-10 h-10 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M16 11V7a4 4 0 118 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Zero notifications</h2>
              <p className="text-[14px] text-gray-500 max-w-[300px]">You're all caught up! Enjoy your distraction-free day.</p>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="px-8 py-4"
            >
              <GroupSection title="Tomorrow" items={groupedNotifications['Tomorrow']} />
              <GroupSection title="Today" items={groupedNotifications['Today']} />
              <GroupSection title="Last 7 Days" items={groupedNotifications['Last 7 Days']} />
              <GroupSection title="Older" items={groupedNotifications['Older']} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
