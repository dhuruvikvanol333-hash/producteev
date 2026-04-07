import { useEffect, useCallback } from 'react';
import { useSocket } from './useSocket';
import { Notification } from '../types/notification.types';
import { useAppSelector, useAppDispatch } from '../store';
import {
  fetchNotifications,
  addNotification,
  syncReadStatus,
  markAsReadAction,
  markTaskAsReadAction,
  markAllAsReadAction,
  markInboxSeen
} from '../store/slices/notificationSlice';


const extractTaskId = (link: string | null | undefined) => {
  if (!link) return null;
  const match = link.match(/\/(?:tasks|inbox\/task)\/([^/?#]+)/);
  return match ? match[1] : null;
};

export function useNotifications() {
  const dispatch = useAppDispatch();
  const { notifications, unreadCount, loading } = useAppSelector(state => state.notification);
  const currentOrg = useAppSelector(state => state.organization.currentOrg);
  const socket = useSocket();

  const loadData = useCallback(async (orgId?: string) => {
    dispatch(fetchNotifications(orgId));
  }, [dispatch]);

  useEffect(() => {
    loadData(currentOrg?.id);
  }, [loadData, currentOrg?.id]);

  useEffect(() => {
    if (!socket) return;

    const playNotificationSound = () => {
      const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
      audio.play().catch(e => console.log('Audio play failed:', e));
    };

    const handleNewNotification = (newNotif: Notification) => {
      dispatch(addNotification(newNotif));
      playNotificationSound();

      const lastNotifTime = parseInt(localStorage.getItem('last_notif_time') || '0');
      const now = Date.now();
      if (now - lastNotifTime > 1000) {
        localStorage.setItem('last_notif_time', now.toString());
        if (typeof window !== 'undefined' && 'Notification' in window && window.Notification.permission === 'granted') {
          new window.Notification(newNotif.title, { body: newNotif.message, icon: '/favicon.ico' });
        }
      }
    };

    const handleReadSync = (data: { id: string }) => {
      dispatch(syncReadStatus(data));
    };

    const handleReadAllSync = () => {
      dispatch(markAllAsReadAction());
    };

    const handleTaskReadSync = () => {
      dispatch(fetchNotifications(currentOrg?.id));
    };

    const handleMessagesRead = () => {
      loadData(currentOrg?.id);
    };

    socket.on('notification:new', handleNewNotification);
    socket.on('notification:read_sync', handleReadSync);
    socket.on('notification:read_all_sync', handleReadAllSync);
    socket.on('notification:task_read_sync', handleTaskReadSync);
    socket.on('messages:read-receipt', handleMessagesRead);

    return () => {
      socket.off('notification:new', handleNewNotification);
      socket.off('notification:read_sync', handleReadSync);
      socket.off('notification:read_all_sync', handleReadAllSync);
      socket.off('notification:task_read_sync', handleTaskReadSync);
      socket.off('messages:read-receipt', handleMessagesRead);
    };
  }, [socket, loadData, currentOrg?.id, dispatch]);

  const markAsRead = useCallback(async (id: string) => {
    dispatch(markAsReadAction(id));
  }, [dispatch]);

  const resetUnreadCount = useCallback(() => {
    dispatch(markInboxSeen());
  }, [dispatch]);

  const markAllAsRead = useCallback(async () => {
    dispatch(markAllAsReadAction(currentOrg?.id));
  }, [dispatch, currentOrg?.id]);

  const markTaskAsRead = useCallback(async (target: Notification | string) => {
    if (!target) return;
    const taskId = typeof target === 'string' ? target : extractTaskId(target.link);
    if (taskId) {
      dispatch(markTaskAsReadAction(taskId));
    } else if (typeof target !== 'string') {
      dispatch(markAsReadAction(target.id));
    }
  }, [dispatch]);

  return {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    markTaskAsRead,
    resetUnreadCount,
    refresh: loadData
  };
}
