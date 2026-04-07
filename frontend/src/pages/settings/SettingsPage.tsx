import { useState, useEffect, type ReactNode } from 'react';
import { useAppSelector } from '../../store';
import { ProfileSettings } from '../../components/settings/ProfileSettings';
import { PreferencesSettings } from '../../components/settings/PreferencesSettings';
import { AccountSettings } from '../../components/settings/AccountSettings';
import api from '../../services/api';
import { useSocket } from '../../hooks/useSocket';

type SettingsTab = 'profile' | 'preferences' | 'account' | 'team';

interface TeamMember {
   id: string;
   firstName: string;
   lastName: string;
   email: string;
   avatarUrl: string | null;
   mobileNo: string | null;
   technology: string | null;
   createdAt: string;
}

const TABS: { key: SettingsTab; label: string; icon: ReactNode }[] = [
   {
      key: 'profile',
      label: 'Profile',
      icon: (
         <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
         </svg>
      ),
   },
   {
      key: 'preferences',
      label: 'Preferences',
      icon: (
         <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
         </svg>
      ),
   },
   {
      key: 'account',
      label: 'Account',
      icon: (
         <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
         </svg>
      ),
   },
   {
      key: 'team',
      label: 'Team',
      icon: (
         <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
         </svg>
      ),
   },
];

export function SettingsPage() {
   const socket = useSocket();
   const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
   const currentUser = useAppSelector((state) => state.user.currentUser);

   // Team members
   const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
   const [teamLoading, setTeamLoading] = useState(true);
   const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());

   useEffect(() => {
      async function loadTeamMembers() {
         try {
            const res = await api.get<{ success: boolean; data: TeamMember[] }>('/users/all');
            if (res.data.success) setTeamMembers(res.data.data);
         } catch (err) {
            console.error('Failed to load team members:', err);
         } finally {
            setTeamLoading(false);
         }
      }
      loadTeamMembers();
   }, []);

   useEffect(() => {
      if (!socket) return;

      const handleOnlineList = (ids: string[]) => setOnlineUsers(new Set(ids));
      const handleOnline = (d: { userId: string }) => setOnlineUsers((p) => new Set(p).add(d.userId));
      const handleOffline = (d: { userId: string }) => {
         setOnlineUsers((p) => { const n = new Set(p); n.delete(d.userId); return n; });
      };

      socket.on('users:online-list', handleOnlineList);
      socket.on('user:online', handleOnline);
      socket.on('user:offline', handleOffline);

      return () => {
         socket.off('users:online-list', handleOnlineList);
         socket.off('user:online', handleOnline);
         socket.off('user:offline', handleOffline);
      };
   }, [socket]);

   return (
      <div className="-m-4 sm:-m-6 min-h-full bg-white dark:bg-gray-900">
         {/* Header */}
         <div className="px-6 pt-5 pb-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3 mb-1">
               {currentUser?.avatarUrl ? (
                  <img src={currentUser.avatarUrl} alt="Profile" className="w-10 h-10 rounded-full object-cover border-2 border-gray-200 dark:border-gray-600" />
               ) : (
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 text-white flex items-center justify-center text-sm font-bold">
                     {currentUser ? `${currentUser.firstName[0]}${currentUser.lastName[0]}`.toUpperCase() : 'U'}
                  </div>
               )}
               <div>
                  <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Settings</h1>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                     {currentUser?.email}
                  </p>
               </div>
            </div>
         </div>

         <div className="flex min-h-[calc(100vh-140px)]">
            {/* Sidebar Tabs */}
            <nav className="w-52 shrink-0 border-r border-gray-200 dark:border-gray-700 py-4 px-3">
               <div className="space-y-0.5">
                  {TABS.map((tab) => (
                     <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm rounded-lg transition-all ${activeTab === tab.key
                           ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 font-medium'
                           : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'
                           }`}
                     >
                        {tab.icon}
                        {tab.label}
                     </button>
                  ))}
               </div>
            </nav>

            {/* Content */}
            <div className="flex-1 py-6 px-8 max-w-2xl">
               {/* Tab Header */}
               <div className="mb-6">
                  <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                     {TABS.find((t) => t.key === activeTab)?.label}
                  </h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                     {activeTab === 'profile' && 'Manage your personal information and avatar'}
                     {activeTab === 'preferences' && 'Customize your app experience'}
                     {activeTab === 'account' && 'Security and account management'}
                     {activeTab === 'team' && 'View team members and online status'}
                  </p>
               </div>

               {/* Tab Content */}
               {activeTab === 'profile' && <ProfileSettings />}
               {activeTab === 'preferences' && <PreferencesSettings />}
               {activeTab === 'account' && <AccountSettings />}
               {activeTab === 'team' && (
                  <div>
                     {teamLoading ? (
                        <div className="flex justify-center py-12">
                           <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                        </div>
                     ) : (
                        <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
                           <table className="w-full text-sm">
                              <thead>
                                 <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                                    <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Member</th>
                                    <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Email</th>
                                    <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Mobile</th>
                                    <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Technology</th>
                                    <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                                 </tr>
                              </thead>
                              <tbody>
                                 {teamMembers.map((member) => {
                                    const isOnline = onlineUsers.has(member.id);
                                    return (
                                       <tr key={member.id} className="border-b border-gray-100 dark:border-gray-700 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                          <td className="px-4 py-3">
                                             <div className="flex items-center gap-3">
                                                <div className="relative shrink-0">
                                                   {member.avatarUrl ? (
                                                      <img src={member.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
                                                   ) : (
                                                      <div className="w-8 h-8 rounded-full bg-purple-600 text-white flex items-center justify-center text-xs font-bold">
                                                         {`${member.firstName[0]}${member.lastName[0]}`.toUpperCase()}
                                                      </div>
                                                   )}
                                                   <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-gray-900 ${isOnline ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`} />
                                                </div>
                                                <span className="font-medium text-gray-900 dark:text-white">{member.firstName} {member.lastName}</span>
                                             </div>
                                          </td>
                                          <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{member.email}</td>
                                          <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{member.mobileNo || '-'}</td>
                                          <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{member.technology || '-'}</td>
                                          <td className="px-4 py-3">
                                             <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full ${isOnline
                                                ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400'
                                                : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                                                }`}>
                                                <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-green-500' : 'bg-gray-400'}`} />
                                                {isOnline ? 'Online' : 'Offline'}
                                             </span>
                                          </td>
                                       </tr>
                                    );
                                 })}
                              </tbody>
                           </table>
                        </div>
                     )}
                  </div>
               )}
            </div>
         </div>
      </div>
   );
}
