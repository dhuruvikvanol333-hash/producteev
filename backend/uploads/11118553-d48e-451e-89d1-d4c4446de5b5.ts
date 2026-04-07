import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { useSocket } from './useSocket';
import { Notification } from '../types/notification.types';

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const socket = useSocket();

  const loadData = useCallback(async () => {
    try {
      const [countRes, notifsRes] = await Promise.all([
        api.get<{ success: boolean; data: { count: number } }>('/notifications/unread-count'),
        api.get<{ success: boolean; data: Notification[] }>('/notifications'),
      ]);
      if (countRes.data.success) setUnreadCount(countRes.data.data.count);
      if (notifsRes.data.success) setNotifications(notifsRes.data.data);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!socket) return;

    const playNotificationSound = () => {
      const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
      audio.play().catch(e => console.log('Audio play failed:', e));
    };

    const handleNewNotification = (newNotif: Notification) => {
      setNotifications(prev => [newNotif, ...prev]);
      setUnreadCount(c => c + 1);

      // Play sound (always play if tab is active or visible)
      playNotificationSound();

      // Desktop notification - Show only once across all tabs
      const lastNotifTime = parseInt(localStorage.getItem('last_notif_time') || '0');
      const now = Date.now();

      // Ignore if another tab showed a notification in the last 1000ms
      if (now - lastNotifTime > 1000) {
        localStorage.setItem('last_notif_time', now.toString());

        if (typeof window !== 'undefined' && 'Notification' in window && window.Notification.permission === 'granted') {
          new window.Notification(newNotif.title, {
            body: newNotif.message,
            icon: '/favicon.ico'
          });
        }
      }
    };

    const handleReadSync = (data: { id: string }) => {
      setNotifications(prev => prev.map(n => n.id === data.id ? { ...n, isRead: true } : n));
      setUnreadCount(c => Math.max(0, c - 1));
    };

    const handleReadAllSync = () => {
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    };

    socket.on('notification:new', handleNewNotification);
    socket.on('notification:read_sync', handleReadSync);
    socket.on('notification:read_all_sync', handleReadAllSync);

    return () => {
      socket.off('notification:new', handleNewNotification);
      socket.off('notification:read_sync', handleReadSync);
      socket.off('notification:read_all_sync', handleReadAllSync);
    };
  }, [socket]);

  const markAsRead = async (id: string) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
      setUnreadCount(c => Math.max(0, c - 1));
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.patch('/notifications/mark-all-read');
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err);
    }
  };

  return {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    refresh: loadData
  };
}
