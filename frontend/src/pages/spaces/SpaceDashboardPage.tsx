import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'react-router';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../services/api';
import { Loading } from '../../components/ui/Loading';
import { Space, Task } from '../../types';
import { BarChart2, CheckCircle2, Calendar, AlertCircle, List, Star, ArrowLeft, X, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useSocket } from '../../hooks/useSocket';
import { useAppSelector } from '../../store';
import { Modal } from '../../components/ui/Modal';
import { TaskDetailPage } from '../tasks/TaskDetailPage';

interface SpaceStats {
  active: number;
  completed: number;
  dueToday: number;
  late: number;
  all: number;
  starred: number;
}

export function SpaceDashboardPage() {
  const { id } = useParams<{ id: string }>();
  const [space, setSpace] = useState<Space | null>(null);
  const [stats, setStats] = useState<SpaceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [filteredTasks, setFilteredTasks] = useState<Task[]>([]);
  const [fetchingTasks, setFetchingTasks] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const navigate = useNavigate();
  const socket = useSocket();
  const currentOrg = useAppSelector(state => state.organization.currentOrg);

  const fetchStats = useCallback(async () => {
    try {
      const [spaceRes, statsRes] = await Promise.all([
        api.get<{ success: boolean; data: Space }>(`/spaces/${id}`),
        api.get<{ success: boolean; data: SpaceStats }>(`/spaces/${id}/stats`)
      ]);
      if (spaceRes.data.success) setSpace(spaceRes.data.data);
      if (statsRes.data.success) setStats(statsRes.data.data);
    } catch (err) {
      console.error('Failed to fetch space stats:', err);
    }
  }, [id]);

  const fetchFilteredTasks = useCallback(async (filterId: string) => {
    setFetchingTasks(true);
    try {
      const res = await api.get<{ success: boolean; data: Task[] }>(`/spaces/${id}/tasks?filter=${filterId}`);
      if (res.data.success) setFilteredTasks(res.data.data);
    } catch (err) {
      console.error('Failed to fetch filtered tasks:', err);
    } finally {
      setFetchingTasks(false);
    }
  }, [id]);

  useEffect(() => {
    setLoading(true);
    fetchStats().finally(() => setLoading(false));
  }, [fetchStats]);

  // Use a ref for activeFilter to use inside the socket effect without re-subscribing
  const activeFilterRef = useRef(activeFilter);
  useEffect(() => {
    activeFilterRef.current = activeFilter;
  }, [activeFilter]);

  // Real-time updates
  useEffect(() => {
    if (!socket || !currentOrg?.id) return;
    
    socket.emit('join-organization', currentOrg.id);
    
    let timeout: any;
    const handleRefresh = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        fetchStats();
        // If there's an active filter, refresh that too
        const activeLabel = activeFilterRef.current;
        if (activeLabel) {
           const map: Record<string, string> = {
             'Active': 'active', 'Completed': 'completed', 'Due today': 'dueToday', 
             'Late': 'late', 'All': 'all', 'Starred': 'starred'
           };
           fetchFilteredTasks(map[activeLabel]);
        }
      }, 500);
    };

    socket.on('task:updated', handleRefresh);
    socket.on('dashboard:refresh', handleRefresh);

    return () => {
      clearTimeout(timeout);
      socket.off('task:updated', handleRefresh);
      socket.off('dashboard:refresh', handleRefresh);
    };
  }, [socket, currentOrg?.id, fetchStats, fetchFilteredTasks]);

  const selectFilter = async (filterId: string, label: string) => {
    setActiveFilter(label);
    fetchFilteredTasks(filterId);
  };

  if (loading) return <Loading size="lg" text="Loading dashboard..." />;
  if (!space || !stats) return (
    <div className="flex flex-col items-center justify-center h-full gap-4">
      <div className="text-gray-400">Space not found</div>
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-indigo-500 hover:underline">
        <ArrowLeft size={16} /> Go back
      </button>
    </div>
  );

  const statCards = [
    { id: 'active', label: 'Active', value: stats.active, icon: BarChart2, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/10' },
    { id: 'completed', label: 'Completed', value: stats.completed, icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/10' },
    { id: 'dueToday', label: 'Due today', value: stats.dueToday, icon: Calendar, color: 'text-indigo-500', bg: 'bg-indigo-50 dark:bg-indigo-900/10' },
    { id: 'late', label: 'Late', value: stats.late, icon: AlertCircle, color: 'text-rose-500', bg: 'bg-rose-50 dark:bg-rose-900/10' },
    { id: 'all', label: 'All', value: stats.all, icon: List, color: 'text-gray-500', bg: 'bg-gray-50 dark:bg-gray-800' },
    { id: 'starred', label: 'Starred', value: stats.starred, icon: Star, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/10' },
  ];

  return (
    <div className="h-full overflow-y-auto bg-gray-50/50 dark:bg-[#0F172A] font-sans">
      <div className="max-w-7xl mx-auto p-8 lg:p-12">
        
        {/* Header Section */}
        <motion.header 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-12 flex flex-col md:flex-row md:items-center justify-between gap-6"
        >
          <div className="flex items-center gap-6">
            <motion.div 
              whileHover={{ scale: 1.05, rotate: 2 }}
              className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl text-white shadow-xl shadow-indigo-500/20"
              style={{ backgroundColor: space.color || '#6366f1' }}
            >
              {space.icon || space.name.charAt(0).toUpperCase()}
            </motion.div>
            <div>
              <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight leading-tight">
                {space.name} Dashboard
              </h1>
              <p className="text-gray-500 dark:text-gray-400 font-medium mt-1">
                {space.description || 'Manage and track your space-level objectives'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
             <button 
               onClick={() => navigate(-1)}
               className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl text-sm font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all shadow-sm"
             >
               Back
             </button>
             <div className="h-10 w-[1px] bg-gray-200 dark:bg-gray-700 mx-1 hidden md:block" />
             <div className="text-right flex flex-col items-end">
                <div className="flex items-center gap-2">
                   <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                   <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest leading-none">Live Sync</p>
                </div>
                <p className="text-xs font-bold text-gray-400 dark:text-gray-500 mt-1 uppercase tracking-tighter">Updated Just Now</p>
             </div>
          </div>
        </motion.header>

        {/* Stats Grid */}
        <motion.div 
          layout
          className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 md:gap-6 mb-12"
        >
          <AnimatePresence mode="popLayout">
            {statCards.map((card, idx) => (
              <motion.div
                key={card.label}
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ delay: idx * 0.05, type: 'spring', stiffness: 200, damping: 20 }}
                whileHover={{ y: -4, boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' }}
                onClick={() => selectFilter(card.id, card.label)}
                className={`${card.bg} p-6 rounded-3xl border border-white/50 dark:border-gray-800/50 flex flex-col gap-4 backdrop-blur-sm shadow-sm transition-all relative overflow-hidden group cursor-pointer ${activeFilter === card.label ? 'ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-[#0F172A]' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <div className={`p-2.5 rounded-xl ${card.bg.replace('bg-', 'bg-opacity-20 bg-')} ${card.color} border border-current border-opacity-10`}>
                    <card.icon size={18} strokeWidth={2.5} />
                  </div>
                  <motion.span 
                    key={card.value}
                    initial={{ scale: 1.2, color: '#6366f1' }}
                    animate={{ scale: 1, color: 'inherit' }}
                    className="text-2xl font-black text-gray-900 dark:text-white tabular-nums tracking-tighter"
                  >
                    {card.value}
                  </motion.span>
                </div>
                <p className="text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                  {card.label}
                </p>

                {/* Decorative background element */}
                <div className={`absolute -right-2 -bottom-2 opacity-5 group-hover:opacity-10 transition-opacity ${card.color}`}>
                   <card.icon size={64} strokeWidth={3} />
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>

        {/* Dynamic Content Area */}
        <div className="grid lg:grid-cols-2 gap-8 min-h-[460px]">
           <AnimatePresence mode="wait">
             {!activeFilter ? (
               <motion.div 
                 key="overview"
                 initial={{ opacity: 0, x: -20 }}
                 animate={{ opacity: 1, x: 0 }}
                 exit={{ opacity: 0, x: -20 }}
                 className="bg-white dark:bg-[#1E2530] p-8 rounded-[32px] border border-gray-100 dark:border-gray-800 shadow-xl shadow-gray-200/50 dark:shadow-none"
               >
                  <h3 className="text-xl font-black text-gray-900 dark:text-white mb-6 flex items-center gap-3">
                     <div className="w-2 h-2 rounded-full bg-indigo-500" />
                     Space Overview
                  </h3>
                  <div className="space-y-6">
                     <div className="flex items-center justify-between p-4 rounded-2xl bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                        <span className="text-sm font-bold text-gray-500 uppercase tracking-tight">Folders</span>
                        <span className="text-lg font-black text-gray-900 dark:text-white">{space.folders?.length || 0}</span>
                     </div>
                     <div className="flex items-center justify-between p-4 rounded-2xl bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                        <span className="text-sm font-bold text-gray-500 uppercase tracking-tight">Total Lists</span>
                        <span className="text-lg font-black text-gray-900 dark:text-white">
                          {(space.lists?.length || 0) + (space.folders?.reduce((acc, f) => acc + (f.lists?.length || 0), 0) || 0)}
                        </span>
                     </div>
                     <div className="flex items-center justify-between p-4 rounded-2xl bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                        <span className="text-sm font-bold text-gray-500 uppercase tracking-tight">Members</span>
                        <span className="text-lg font-black text-gray-900 dark:text-white">{space.members?.length || 0}</span>
                     </div>
                  </div>
               </motion.div>
             ) : (
                <motion.div 
                  key="tasks"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="bg-white dark:bg-[#1E2530] p-8 rounded-[32px] border border-gray-100 dark:border-gray-800 shadow-xl flex flex-col h-full"
                >
                   <div className="flex items-center justify-between mb-6">
                      <h3 className="text-xl font-black text-gray-900 dark:text-white flex items-center gap-3">
                         <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                         {activeFilter} Tasks
                      </h3>
                      <button onClick={() => setActiveFilter(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-all group">
                         <X size={20} className="text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-200" />
                      </button>
                   </div>
                   
                   <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar max-h-[320px]">
                      {fetchingTasks ? (
                         <div className="flex items-center justify-center h-full py-12"><Loading size="md" /></div>
                      ) : filteredTasks.length === 0 ? (
                         <div className="flex flex-col items-center justify-center h-full py-12 text-gray-400 gap-2 opacity-50">
                            <List size={32} strokeWidth={1} />
                            <p className="font-bold uppercase tracking-widest text-[10px]">No tasks found</p>
                         </div>
                      ) : (
                         <div className="space-y-3">
                            {filteredTasks.map((task, idx) => (
                               <motion.div 
                                 key={task.id}
                                 initial={{ opacity: 0, y: 10 }}
                                 animate={{ opacity: 1, y: 0 }}
                                 transition={{ delay: idx * 0.03 }}
                                 onClick={() => setSelectedTaskId(task.id)}
                                 className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-800/50 hover:bg-white dark:hover:bg-gray-800 border border-transparent hover:border-indigo-500/20 shadow-sm hover:shadow-md transition-all cursor-pointer group flex items-center justify-between"
                               >
                                  <div className="flex items-center gap-4 min-w-0">
                                     <div className={`w-8 h-8 rounded-lg bg-white dark:bg-gray-700 flex items-center justify-center text-[10px] font-black uppercase tracking-tighter shadow-sm border border-gray-100 dark:border-gray-600 ${
                                        task.priority === 'URGENT' ? 'text-rose-500' : 
                                        task.priority === 'HIGH' ? 'text-orange-500' : 
                                        'text-indigo-500'
                                     }`}>
                                        {task.priority.charAt(0)}
                                     </div>
                                     <div className="min-w-0">
                                        <p className="text-sm font-bold text-gray-900 dark:text-white truncate group-hover:text-indigo-500 transition-colors">{task.title}</p>
                                        <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wide mt-0.5">{task.project?.name || 'No Project'}</p>
                                     </div>
                                  </div>
                                  <ChevronRight size={16} className="text-gray-300 group-hover:text-indigo-500 group-hover:translate-x-1 transition-all shrink-0" />
                               </motion.div>
                            ))}
                         </div>
                      )}
                   </div>
                </motion.div>
             )}
           </AnimatePresence>

           <motion.div 
             initial={{ opacity: 0, x: 20 }}
             animate={{ opacity: 1, x: 0 }}
             transition={{ delay: 0.5 }}
             className="bg-gradient-to-br from-indigo-500 to-indigo-700 p-8 rounded-[32px] text-white shadow-xl shadow-indigo-500/20 flex flex-col justify-between"
           >
              <div>
                <h3 className="text-xl font-black mb-2">Workspace Insight</h3>
                <p className="text-indigo-100 font-medium text-sm leading-relaxed max-w-sm">
                   Your productivity in "{space.name}" is currently based on {stats.active} active tasks. Focus on resolving the {stats.late} late items to stay ahead of your schedule.
                </p>
              </div>
              <div className="mt-8 flex items-end justify-between">
                 <div className="flex -space-x-3">
                    {[...Array(4)].map((_, i) => (
                       <div key={i} className="w-10 h-10 rounded-full border-2 border-indigo-500 bg-indigo-100 flex items-center justify-center text-indigo-500 text-[10px] font-black uppercase">
                          M{i+1}
                       </div>
                    ))}
                 </div>
                 <div className="text-right">
                    <p className="text-[10px] font-black text-indigo-200 uppercase tracking-widest">Efficiency</p>
                    <p className="text-4xl font-black">
                       {Math.round((stats.completed / (stats.all || 1)) * 100)}%
                    </p>
                 </div>
              </div>
           </motion.div>
        </div>

        <Modal 
          open={!!selectedTaskId} 
          onClose={() => setSelectedTaskId(null)}
          className="max-w-6xl w-[95%] h-[90vh] p-0 overflow-hidden"
        >
          {selectedTaskId && (
            <TaskDetailPage 
              isModal={true} 
              taskId={selectedTaskId} 
              onClose={() => setSelectedTaskId(null)} 
            />
          )}
        </Modal>

      </div>
    </div>
  );
}
