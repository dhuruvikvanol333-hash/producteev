import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../../services/api';
import type { TimeEntry } from '../../types';

interface TimeTrackerProps {
  taskId: string;
  onEntryChange?: () => void;
}

function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function TimeTracker({ taskId, onEntryChange }: TimeTrackerProps) {
  const [activeEntry, setActiveEntry] = useState<TimeEntry | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [manualHours, setManualHours] = useState('');
  const [manualMinutes, setManualMinutes] = useState('');
  const [manualDesc, setManualDesc] = useState('');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load active timer on mount
  useEffect(() => {
    loadActiveTimer();
  }, [taskId]);

  // Tick elapsed every second when active
  useEffect(() => {
    if (activeEntry?.startTime) {
      const startMs = new Date(activeEntry.startTime).getTime();
      const tick = () => setElapsed(Math.floor((Date.now() - startMs) / 1000));
      tick();
      intervalRef.current = setInterval(tick, 1000);
    } else {
      setElapsed(0);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [activeEntry]);

  // Keyboard shortcut: Alt+T to toggle timer
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.altKey && e.key === 't') {
        e.preventDefault();
        if (activeEntry) handleStop();
        else handleStart();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [activeEntry, description]);

  const loadActiveTimer = async () => {
    try {
      const res = await api.get<{ success: boolean; data: TimeEntry | null }>('/users/me/time-entries/active');
      const entry = res.data.data;
      if (entry && entry.taskId === taskId) {
        setActiveEntry(entry);
      } else {
        setActiveEntry(null);
      }
    } catch {
      // ignore
    }
  };

  const handleStart = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    try {
      const res = await api.post<{ success: boolean; data: TimeEntry }>(
        `/tasks/${taskId}/time-entries`,
        { description: description || undefined }
      );
      setActiveEntry(res.data.data);
      setDescription('');
      // Persist active timer info for GlobalTimer
      localStorage.setItem('activeTimer', JSON.stringify({
        entryId: res.data.data.id,
        taskId: res.data.data.taskId,
        taskTitle: res.data.data.task?.title || '',
        startTime: res.data.data.startTime,
      }));
      onEntryChange?.();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      alert(msg || 'Failed to start timer');
    } finally {
      setLoading(false);
    }
  }, [taskId, description, loading, onEntryChange]);

  const playNotificationSound = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(440, audioCtx.currentTime); // A4
      oscillator.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.1); // A5
      
      gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.5, audioCtx.currentTime + 0.05);
      gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.3);
      
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      oscillator.start(audioCtx.currentTime);
      oscillator.stop(audioCtx.currentTime + 0.3);
    } catch (e) {
      console.warn('AudioContext not supported or blocked', e);
    }
  };

  const notifyTimerStopped = (durationStr: string) => {
    playNotificationSound();
    if (Notification.permission === 'granted') {
      new Notification('Timer Stopped', {
        body: `You tracked time for ${durationStr}`,
        icon: '/favicon.ico', // assuming there's a favicon
      });
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          new Notification('Timer Stopped', {
            body: `You tracked time for ${durationStr}`,
          });
        }
      });
    }
  };

  const handleStop = useCallback(async () => {
    if (!activeEntry || loading) return;
    setLoading(true);
    try {
      const startMs = new Date(activeEntry.startTime!).getTime();
      const finalElapsed = Math.floor((Date.now() - startMs) / 1000);
      
      await api.put(`/time-entries/${activeEntry.id}/stop`);
      setActiveEntry(null);
      setElapsed(0);
      localStorage.removeItem('activeTimer');
      onEntryChange?.();
      
      notifyTimerStopped(formatDuration(finalElapsed));
    } catch {
      alert('Failed to stop timer');
    } finally {
      setLoading(false);
    }
  }, [activeEntry, loading, onEntryChange]);

  const handleManualAdd = async () => {
    const h = parseInt(manualHours) || 0;
    const m = parseInt(manualMinutes) || 0;
    const totalSeconds = h * 3600 + m * 60;
    if (totalSeconds <= 0) return;

    try {
      await api.post(`/tasks/${taskId}/time-entries`, {
        durationSeconds: totalSeconds,
        description: manualDesc || undefined,
      });
      setManualHours('');
      setManualMinutes('');
      setManualDesc('');
      setShowManual(false);
      onEntryChange?.();
    } catch {
      alert('Failed to add time entry');
    }
  };

  const isActive = !!activeEntry;

  return (
    <div className="space-y-2">
      {/* Timer display */}
      <div className="flex items-center gap-2">
        <button
          onClick={isActive ? handleStop : handleStart}
          disabled={loading}
          className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
            isActive
              ? 'bg-red-500 hover:bg-red-600'
              : 'bg-green-500 hover:bg-green-600'
          } disabled:opacity-50`}
          title={isActive ? 'Stop timer (Alt+T)' : 'Start timer (Alt+T)'}
        >
          {isActive ? (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="white">
              <rect x="6" y="4" width="4" height="16" />
              <rect x="14" y="4" width="4" height="16" />
            </svg>
          ) : (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="white">
              <polygon points="5,3 19,12 5,21" />
            </svg>
          )}
        </button>

        <span className={`font-mono text-sm font-semibold tabular-nums ${
          isActive ? 'text-green-600 dark:text-green-400' : 'text-gray-700 dark:text-gray-300'
        }`}>
          {formatDuration(elapsed)}
        </span>

        {isActive && (
          <>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
            </span>
            {activeEntry?.startTime && (
              <span className="text-[10px] text-gray-400 dark:text-gray-500">
                Started {new Date(activeEntry.startTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
              </span>
            )}
          </>
        )}

        {!isActive && (
          <button
            onClick={() => setShowManual(!showManual)}
            className="text-[11px] text-gray-400 dark:text-gray-500 hover:text-indigo-500 ml-1"
            title="Add manual time"
          >
            + Manual
          </button>
        )}
      </div>

      {/* Description input when not tracking */}
      {!isActive && !showManual && (
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleStart(); }}
          placeholder="What are you working on?"
          className="w-full text-xs border border-gray-200 dark:border-gray-700 rounded px-2 py-1.5 outline-none focus:border-indigo-400 bg-transparent dark:text-gray-300 placeholder-gray-400 dark:placeholder-gray-500"
          title="Status description"
        />
      )}

      {/* Manual time entry form */}
      {showManual && (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700 space-y-2">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <input
                type="number"
                min="0"
                value={manualHours}
                onChange={(e) => setManualHours(e.target.value)}
                placeholder="0"
                className="w-12 text-xs text-center border border-gray-200 dark:border-gray-700 rounded px-1 py-1 outline-none focus:border-indigo-400 bg-transparent dark:text-gray-300"
                title="Manual hours"
              />
              <span className="text-[11px] text-gray-500">h</span>
            </div>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min="0"
                max="59"
                value={manualMinutes}
                onChange={(e) => setManualMinutes(e.target.value)}
                placeholder="0"
                className="w-12 text-xs text-center border border-gray-200 dark:border-gray-700 rounded px-1 py-1 outline-none focus:border-indigo-400 bg-transparent dark:text-gray-300"
                title="Manual minutes"
              />
              <span className="text-[11px] text-gray-500">m</span>
            </div>
          </div>
          <input
            type="text"
            value={manualDesc}
            onChange={(e) => setManualDesc(e.target.value)}
            placeholder="Description (optional)"
            className="w-full text-xs border border-gray-200 dark:border-gray-700 rounded px-2 py-1 outline-none focus:border-indigo-400 bg-transparent dark:text-gray-300"
            title="Manual entry description"
          />
          <div className="flex items-center gap-2">
            <button
              onClick={handleManualAdd}
              disabled={!(parseInt(manualHours) > 0 || parseInt(manualMinutes) > 0)}
              className="px-3 py-1 bg-indigo-500 text-white text-xs rounded hover:bg-indigo-600 disabled:opacity-50"
            >
              Add
            </button>
            <button
              onClick={() => setShowManual(false)}
              className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
