import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router';
import { motion } from 'framer-motion';
import api from '../../services/api';
import { useAppSelector } from '../../store';
import { useSocket } from '../../hooks/useSocket';
import type { DashboardStats, Task } from '../../types';

/* ── Custom Widgets & Sub-components ── */

function GreetingSection({ name }: { name: string }) {
  const hour = new Date().getHours();
  let greetingText = 'Good evening';
  let icon = '🌙';
  if (hour < 12) { greetingText = 'Good morning'; icon = '☀️'; }
  else if (hour < 17) { greetingText = 'Good afternoon'; icon = '🌤️'; }

  return (
    <motion.div 
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-800 p-8 text-white shadow-2xl"
    >
      <div className="relative z-10">
        <span className="text-4xl mb-4 block">{icon}</span>
        <h1 className="text-3xl font-extrabold tracking-tight mb-2">
          {greetingText}, <span className="text-indigo-200">{name}</span>!
        </h1>
        <p className="text-indigo-100/80 max-w-md text-lg font-medium">
          Welcome back to your workspace. Everything is updated in real-time.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link to="/tasks/assigned" className="bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
            My Open Tasks
          </Link>
          <Link to="/inbox" className="bg-indigo-500/30 hover:bg-indigo-500/40 backdrop-blur-md border border-white/10 px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
            Review Inbox
          </Link>
        </div>
      </div>
      <div className="absolute top-[-20%] right-[-10%] w-64 h-64 bg-white/10 rounded-full blur-3xl" />
      <div className="absolute bottom-[-20%] left-[-10%] w-48 h-48 bg-purple-400/20 rounded-full blur-2xl" />
    </motion.div>
  );
}

function StatCard({ label, value, icon, link, colorClass, delay = 0, avatars = [] }: any) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay }}
    >
      <Link to={link} className="group relative bg-white dark:bg-gray-800/80 rounded-2xl p-6 border border-gray-100 dark:border-gray-700/50 shadow-sm hover:shadow-xl transition-all overflow-hidden flex flex-col h-full">
        <div className="flex items-center gap-4 mb-3">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110 shadow-sm ${colorClass}`}>
            {icon}
          </div>
          <div>
            <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">{label}</p>
            <div className="flex items-baseline gap-2">
              <h3 className="text-2xl font-black text-gray-900 dark:text-white mt-0.5">{value}</h3>
              <span className="flex h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />
            </div>
          </div>
        </div>
        <div className="mt-auto pt-4 flex items-center justify-between">
          <div className="flex -space-x-2">
            {avatars.length > 0 ? (
              avatars.slice(0, 4).map((m: any, i: number) => (
                <div key={m.id || i} title={m.name} className="w-7 h-7 rounded-full border-2 border-white dark:border-gray-800 bg-indigo-500 dark:bg-indigo-900 overflow-hidden shrink-0 flex items-center justify-center text-[10px] font-bold text-white shadow-sm ring-1 ring-black/5">
                  {m.avatarUrl ? (
                    <img src={m.avatarUrl} alt={m.name} className="w-full h-full object-cover" />
                  ) : (
                    <span>{m.name?.charAt(0).toUpperCase()}</span>
                  )}
                </div>
              ))
            ) : (
              [1, 2, 3].map(i => (
                <div key={i} className="w-7 h-7 rounded-full border-2 border-white dark:border-gray-800 bg-gray-200 dark:bg-gray-700 overflow-hidden shrink-0" />
              ))
            )}
            {avatars.length > 4 && (
              <div className="w-7 h-7 rounded-full border-2 border-white dark:border-gray-800 bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-[10px] font-black text-gray-400 shrink-0">
                +{avatars.length - 4}
              </div>
            )}
          </div>
          <svg className="w-4 h-4 text-gray-300 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        </div>
      </Link>
    </motion.div>
  );
}

export function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentTasks, setRecentTasks] = useState<Task[]>([]);
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadDMCount, setUnreadDMCount] = useState(0);
  const currentUser = useAppSelector((state) => state.user.currentUser);
  const socket = useSocket();

  const loadDashboard = useCallback(async () => {
    try {
      const res = await api.get('/dashboard/stats');
      if (res.data.success) {
        setStats(res.data.data);
        setRecentTasks(res.data.data.recentTasks || []);
        
        // Fetch unread DM total
        const dmRes = await api.get<{ success: boolean; data: Record<string, number> }>('/messages/unread-counts');
        if (dmRes.data.success) {
          const total = Object.values(dmRes.data.data).reduce((a, b) => a + b, 0);
          setUnreadDMCount(total);
        }
      }
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  // Real-time listeners
  useEffect(() => {
    if (!socket) return;

    const handleRefresh = () => {
      // Debounce the refresh
      const timeout = setTimeout(loadDashboard, 200);
      return () => clearTimeout(timeout);
    };

    socket.on('notification:new', handleRefresh);
    socket.on('dashboard:refresh', handleRefresh);
    socket.on('people:updated', handleRefresh);
    
    socket.on('users:online-list', (users: string[]) => {
      if (Array.isArray(users)) setOnlineUserIds(users);
    });
    
    socket.on('user:online', (data: { userId: string }) => {
      if (data?.userId) {
        setOnlineUserIds(prev => Array.from(new Set([...prev, data.userId])));
      }
    });

    socket.on('message:new', (msg: any) => {
      if (msg?.receiverId === currentUser?.id) {
        setUnreadDMCount(prev => prev + 1);
      }
    });

    socket.on('messages:read-receipt', (data: any) => {
      if (data?.readBy === currentUser?.id) {
        loadDashboard();
      }
    });

    socket.on('user:offline', (data: { userId: string }) => {
      if (data?.userId) {
        setOnlineUserIds(prev => prev.filter(id => id !== data.userId));
      }
    });

    return () => {
      socket.off('notification:new', handleRefresh);
      socket.off('dashboard:refresh', handleRefresh);
      socket.off('people:updated', handleRefresh);
      socket.off('message:new');
      socket.off('messages:read-receipt');
      socket.off('users:online-list');
      socket.off('user:online');
      socket.off('user:offline');
    };
  }, [socket, loadDashboard]);

  if (loading) {
    return (
      <div className="max-w-[1400px] mx-auto p-4 md:p-8 space-y-8">
        <div className="h-48 w-full rounded-2xl animate-pulse bg-gray-100 dark:bg-gray-800" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-32 rounded-2xl animate-pulse bg-gray-50 dark:bg-gray-800/50" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto p-4 md:p-8 space-y-8 font-sans">
      
      {/* ── Welcome Area ── */}
      <GreetingSection name={currentUser?.firstName || 'there'} />

      {/* ── Highlights Grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard delay={0.1} label="Total Folders" value={stats?.projectCount || 0} link="/projects" colorClass="bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400" icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>} />
        <StatCard delay={0.2} label="Tasks Assigned" value={stats?.taskCount || 0} link="/tasks/assigned" colorClass="bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400" icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>} />
        <StatCard delay={0.3} label="Team Members" value={stats?.memberCount || 0} avatars={stats?.members} link="/people" colorClass="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400" icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>} />
        <StatCard delay={0.4} label="Real-time Feed" value={((stats as any)?.unreadNotifCount || 0) + unreadDMCount} link="/inbox" colorClass="bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400" icon={<div className="relative"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg><span className="absolute -top-1 -right-1 flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span></span></div>} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Main Workspace Column */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-white dark:bg-gray-800/80 rounded-3xl border border-gray-100 dark:border-gray-700/50 p-8 shadow-sm">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-xl font-black text-gray-900 dark:text-white">Active Work Stream</h2>
                <p className="text-sm text-gray-400 dark:text-gray-500 font-medium italic">Updates live as they happen</p>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-full text-[10px] font-black uppercase tracking-widest border border-emerald-100 dark:border-emerald-800/50">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live
              </div>
            </div>

            {recentTasks.length === 0 ? (
              <div className="text-center py-16 bg-gray-50/50 dark:bg-gray-700/20 rounded-3xl border-2 border-dashed border-gray-100 dark:border-gray-700">
                <p className="text-gray-400 font-bold">No recent task activity discovered.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {recentTasks.map((task) => (
                  <motion.div key={task.id} whileHover={{ x: 6 }} className="group">
                    <Link to={`/tasks/${task.id}`} className="flex items-center justify-between p-4 rounded-2xl border border-gray-100 dark:border-gray-700 hover:border-indigo-200 dark:hover:border-indigo-800 hover:bg-indigo-50/20 dark:hover:bg-indigo-900/10 transition-all shadow-sm">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className={`w-3 h-3 rounded-full shrink-0 ${task.priority === 'HIGH' ? 'bg-red-500' : 'bg-indigo-500'}`} />
                        <span className="font-bold text-gray-800 dark:text-gray-200 truncate">{task.title}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-500">
                          {task.status.replace('_', ' ')}
                        </span>
                        <svg className="w-5 h-5 text-gray-300 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Sidebar: Real-time Presence */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-indigo-600 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden">
            <div className="relative z-10">
              <h3 className="text-lg font-black mb-1">Collaboration Pulse</h3>
              <p className="text-xs text-indigo-200 font-bold uppercase tracking-widest mb-8">{onlineUserIds.length} Team Members Online</p>
              
              <div className="flex flex-wrap gap-3">
                {onlineUserIds.map((userId, idx) => {
                  const member = stats?.members?.find(m => m.id === userId);
                  const name = member?.name || 'Teammate';
                  const avatar = member?.avatarUrl;

                  return (
                    <motion.div key={userId} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: idx * 0.1 }}>
                      <div className="relative group" title={name}>
                        <div className="w-12 h-12 rounded-2xl bg-indigo-500 border-2 border-indigo-400/30 overflow-hidden shadow-lg group-hover:scale-110 transition-transform flex items-center justify-center font-black text-lg">
                          {avatar ? (
                            <img src={avatar} alt={name} className="w-full h-full object-cover" />
                          ) : (
                            <span>{name.charAt(0).toUpperCase()}</span>
                          )}
                        </div>
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-indigo-600 ring-2 ring-emerald-500/50" />
                      </div>
                    </motion.div>
                  );
                })}
                {onlineUserIds.length === 0 && <p className="text-sm font-medium opacity-60 italic">Your team is resting...</p>}
              </div>
              
              <button className="w-full mt-10 py-3.5 bg-white text-indigo-600 text-[10px] font-black rounded-2xl uppercase tracking-widest shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all active:scale-95">
                Start Group Chat
              </button>
            </div>
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl -translate-y-12 translate-x-12" />
          </div>

          <div className="bg-white dark:bg-gray-800/80 rounded-3xl border border-gray-100 dark:border-gray-700/50 p-7 shadow-sm">
            <h3 className="text-sm font-black text-gray-900 dark:text-white mb-4 uppercase tracking-widest">Real-time Stats</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-500">Sync Status</span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 text-[10px] font-black uppercase tracking-tighter shadow-sm border border-emerald-100 dark:border-emerald-800">Connected</span>
              </div>
              <div className="h-1 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                <motion.div initial={{ width: "0%" }} animate={{ width: "100%" }} transition={{ duration: 2, repeat: Infinity }} className="h-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
