import { useState } from 'react';
import { useTheme } from '../../hooks/useTheme';
import type { Theme } from '../../store/slices/themeSlice';

const DATE_FORMATS = [
  { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY', example: '03/21/2026' },
  { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY', example: '21/03/2026' },
  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD', example: '2026-03-21' },
  { value: 'DD MMM YYYY', label: 'DD MMM YYYY', example: '21 Mar 2026' },
];

const WEEK_STARTS = [
  { value: 'sunday', label: 'Sunday' },
  { value: 'monday', label: 'Monday' },
];

export function PreferencesSettings() {
  const { theme: currentTheme, setTheme: handleThemeChange } = useTheme();
  const [dateFormat, setDateFormat] = useState('MM/DD/YYYY');
  const [weekStart, setWeekStart] = useState('monday');
  const [notifications, setNotifications] = useState({
    taskAssigned: true,
    taskUpdated: true,
    taskComments: true,
    dueDateReminder: true,
    weeklyDigest: false,
  });

  const toggleNotification = (key: keyof typeof notifications) => {
    setNotifications((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="space-y-8">
      {/* Theme */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Theme</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Choose your preferred appearance</p>
        <div className="grid grid-cols-3 gap-4">
          {([
            {
              key: 'light' as Theme,
              label: 'Light',
              bgClass: 'bg-white border border-gray-200',
              icon: (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2">
                  <circle cx="12" cy="12" r="5" />
                  <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                </svg>
              ),
            },
            {
              key: 'dark' as Theme,
              label: 'Dark',
              bgClass: 'bg-gray-800 border border-gray-700',
              icon: (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="2">
                  <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
                </svg>
              ),
            },
            {
              key: 'system' as Theme,
              label: 'System',
              bgClass: 'bg-gradient-to-r from-white to-gray-800 border border-gray-300 dark:border-gray-600',
              icon: (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2">
                  <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                  <path d="M8 21h8M12 17v4" />
                </svg>
              ),
            },
          ]).map((opt) => (
            <button
              key={opt.key}
              onClick={() => handleThemeChange(opt.key)}
              className={`rounded-xl border-2 p-4 transition-all ${
                currentTheme === opt.key
                  ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/20 shadow-sm'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              <div className={`w-full h-16 rounded-lg ${opt.bgClass} mb-3 flex items-center justify-center`}>
                {opt.icon}
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${currentTheme === opt.key ? 'border-indigo-500' : 'border-gray-300 dark:border-gray-600'}`}>
                  {currentTheme === opt.key && <div className="w-2 h-2 rounded-full bg-indigo-500" />}
                </div>
                <span className="text-sm font-medium text-gray-900 dark:text-white">{opt.label}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Date Format */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Date format</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">How dates are displayed throughout the app</p>
        <div className="space-y-2">
          {DATE_FORMATS.map((fmt) => (
            <label
              key={fmt.value}
              className={`flex items-center justify-between px-4 py-3 rounded-lg border cursor-pointer transition-colors ${
                dateFormat === fmt.value
                  ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              <div className="flex items-center gap-3">
                <input
                  type="radio"
                  name="dateFormat"
                  checked={dateFormat === fmt.value}
                  onChange={() => setDateFormat(fmt.value)}
                  className="w-4 h-4 text-indigo-600 border-gray-300 dark:border-gray-600 focus:ring-indigo-500"
                />
                <span className="text-sm font-medium text-gray-900 dark:text-white">{fmt.label}</span>
              </div>
              <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">{fmt.example}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Start of Week */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Start of week</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">First day of the week in calendars</p>
        <div className="flex gap-3">
          {WEEK_STARTS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setWeekStart(opt.value)}
              className={`flex-1 px-4 py-2.5 text-sm font-medium rounded-lg border-2 transition-all ${
                weekStart === opt.value
                  ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300'
                  : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Notifications */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Notifications</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Control what notifications you receive</p>
        <div className="space-y-1">
          {([
            { key: 'taskAssigned' as const, label: 'Task assigned to me', desc: 'When someone assigns a task to you' },
            { key: 'taskUpdated' as const, label: 'Task updates', desc: 'When a task you\'re involved in is updated' },
            { key: 'taskComments' as const, label: 'Comments', desc: 'When someone comments on your tasks' },
            { key: 'dueDateReminder' as const, label: 'Due date reminders', desc: 'Reminders before task deadlines' },
            { key: 'weeklyDigest' as const, label: 'Weekly digest', desc: 'Weekly summary of activity' },
          ]).map(({ key, label, desc }) => (
            <div
              key={key}
              className="flex items-center justify-between px-4 py-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
            >
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">{label}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{desc}</p>
              </div>
              <button
                onClick={() => toggleNotification(key)}
                className={`relative w-10 h-6 rounded-full transition-colors ${
                  notifications[key] ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-gray-600'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                    notifications[key] ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
