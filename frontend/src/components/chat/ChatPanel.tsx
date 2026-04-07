import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Plus,
  ChevronDown,
  Paperclip,
  Video,
  Send,
  Loader2,
  FileText,
  Download
} from 'lucide-react';
import './ChatPanel.css';
import api from '../../services/api';
import { useSocket } from '../../hooks/useSocket';
import { VideoCallModal } from './VideoCallModal';
import { useAppDispatch } from '../../store';
import { markAsRead, setActiveChat } from '../../store/slices/messageSlice';
import { useToast } from '../../components/ui/Toast';

interface Message {
  id: string;
  text?: string;
  imageUrl?: string;
  fileUrl?: string;
  fileName?: string;
  fileType?: string;
  fileSize?: number;
  senderId: string;
  receiverId: string;
  createdAt: string;
  readAt?: string;
}

function ChatAvatar({ colorIdx, initials, avatarUrl }: { colorIdx: number; initials: string; avatarUrl?: string }) {
  if (avatarUrl) {
    return <img src={avatarUrl} alt="" className="w-10 h-10 rounded-xl object-cover shadow-md ring-2 ring-white dark:ring-gray-900 shrink-0" />;
  }
  return (
    <div
      className={`w-10 h-10 rounded-xl flex items-center justify-center text-[13px] font-black text-white shadow-md ring-2 ring-white dark:ring-gray-900 shrink-0 select-none avatar-container avatar-bg-${(colorIdx || 0) % 6}`}
    >
      <span className="avatar-content">{initials}</span>
    </div>
  );
}

function FilePreview({ name, size, type, url }: { name: string; size?: number; type?: string; url: string }) {
  const isImage = type?.startsWith('image/');

  if (isImage) {
    return (
      <div className="mt-2.5 relative inline-block max-w-[85%]">
        <div className="rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-800 shadow-xl bg-gray-100 dark:bg-gray-900 hover:scale-[1.01] transition-transform duration-300">
          <img src={url} alt={name} className="max-h-[450px] w-auto object-cover cursor-zoom-in" loading="lazy" />
        </div>
      </div>
    );
  }

  const formatSize = (bytes?: number) => {
    if (!bytes) return '';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-2 flex items-center gap-3 p-3 rounded-2xl bg-white dark:bg-gray-800/80 border border-gray-100 dark:border-gray-700/50 hover:border-indigo-200 dark:hover:border-indigo-800 hover:bg-gray-50 dark:hover:bg-indigo-900/10 transition-all max-w-sm group shadow-sm"
    >
      <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-500 shrink-0 group-hover:scale-110 transition-transform">
        <FileText size={22} strokeWidth={2.5} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-bold text-gray-800 dark:text-gray-200 truncate group-hover:text-indigo-500 transition-colors uppercase tracking-tight">{name}</p>
        <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">{formatSize(size)} • {type?.split('/')[1] || 'file'}</p>
      </div>
      <div className="p-2 text-gray-300 group-hover:text-indigo-500 transition-colors transform group-hover:translate-y-0.5">
        <Download size={18} strokeWidth={3} />
      </div>
    </a>
  );
}

interface ChatPanelProps {
  currentUserId: string;
  targetUser: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string;
    colorIdx?: number;
  };
  onlineUsers?: Set<string>;
  onMessagesRead?: (senderId: string) => void;
  onBack?: () => void;
}

const formatTime = (dateStr: string) => {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: 'numeric',
      hour12: true
    }).format(date);
  } catch (err) {
    console.error('Date formatting error:', err);
    return '';
  }
};

export const ChatPanel: React.FC<ChatPanelProps> = ({
  currentUserId,
  targetUser,
  onlineUsers,
  onMessagesRead,
  onBack
}) => {
  const dispatch = useAppDispatch();
  const socket = useSocket();
  const { error: showError } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isVideoCallOpen, setIsVideoCallOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const initials = targetUser?.name
    ? targetUser.name.split(' ').filter(Boolean).map((n: string) => n[0]).join('').toUpperCase() || 'U'
    : 'U';

  const avatarColors = [
    '#f31260', '#0070f3', '#17c964',
    '#9333ea', '#f5a623', '#eb00ff'
  ];
  const avatarColor = avatarColors[(targetUser?.colorIdx || 0) % avatarColors.length];

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  const fetchMessages = useCallback(async () => {
    if (!targetUser.id) return;
    setLoading(true);
    try {
      const res = await api.get<{ success: boolean; data: Message[] }>(`/messages/${targetUser.id}`);
      if (res.data.success) {
        setMessages(res.data.data);
        setTimeout(() => scrollToBottom('auto'), 100);
      }
    } catch (err) {
      console.error('Failed to fetch messages:', err);
    } finally {
      setLoading(false);
    }
  }, [targetUser.id]);

  const markConversationAsRead = useCallback(async () => {
    if (!targetUser.id) return;
    dispatch(markAsRead(targetUser.id));
    if (onMessagesRead) onMessagesRead(targetUser.id);
  }, [targetUser.id, onMessagesRead, dispatch]);

  useEffect(() => {
    fetchMessages();
    markConversationAsRead();
    dispatch(setActiveChat(targetUser.id));
    return () => {
      dispatch(setActiveChat(null));
    };
  }, [targetUser.id, fetchMessages, markConversationAsRead, dispatch]);

  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (msg: Message) => {
      if (!targetUser?.id) return;
      if (msg.senderId === targetUser.id || msg.senderId === currentUserId) {
        setMessages(prev => {
          // Prevent duplicates (especially for sender who already added via API/Optimistic)
          if (prev.some(m => m.id === msg.id)) return prev;
          return [...(prev || []), msg];
        });
        setTimeout(() => scrollToBottom('smooth'), 100);
        if (msg.senderId === targetUser.id) {
          markConversationAsRead();
        }
      }
    };

    const handleMessagesRead = (data: { readBy: string }) => {
      if (targetUser?.id && data.readBy === targetUser.id) {
        setMessages(prev => (prev || []).map(m =>
          m.senderId === currentUserId ? { ...m, readAt: new Date().toISOString() } : m
        ));
      }
    };

    socket.on('message:new', handleNewMessage);
    socket.on('messages:read-receipt', handleMessagesRead);
    return () => {
      socket.off('message:new', handleNewMessage);
      socket.off('messages:read-receipt', handleMessagesRead);
    };
  }, [socket, targetUser.id, currentUserId, markConversationAsRead]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isSending) return;
    const text = inputValue.trim();
    setInputValue('');
    setIsSending(true);

    // Optimistic update
    const tempId = `temp-${Date.now()}`;
    const optimisticMsg: Message = {
      id: tempId,
      text,
      senderId: currentUserId,
      receiverId: targetUser.id,
      createdAt: new Date().toISOString()
    };

    setMessages(prev => [...prev, optimisticMsg]);
    setTimeout(() => scrollToBottom('smooth'), 100);

    try {
      const res = await api.post<{ success: boolean; data: Message }>('/messages', {
        receiverId: targetUser.id,
        text
      });
      if (res.data.success) {
        // Replace optimistic message with real message from server
        setMessages(prev => prev.map(m => m.id === tempId ? res.data.data : m));
      } else {
        showError('Could not send message. Please try again.');
        setMessages(prev => prev.filter(m => m.id !== tempId));
        console.error('Send failed:', res.data);
      }
    } catch (err: any) {
      console.error('Send failed:', err);
      const errorMessage = err.response?.data?.message || err.message || 'Connection to server failed.';
      showError(`Chat Error: ${errorMessage}`);
      // Remove optimistic message on error
      setMessages(prev => prev.filter(m => m.id !== tempId));
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      setIsUploading(true);
      const res = await api.post<{
        success: boolean;
        fileUrl: string;
        fileName: string;
        fileType: string;
        fileSize: number;
      }>('/messages/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (res.data.success) {
        const isImage = res.data.fileType.startsWith('image/');
        const msgRes = await api.post<{ success: boolean; data: Message }>('/messages', {
          receiverId: targetUser.id,
          imageUrl: isImage ? res.data.fileUrl : null,
          fileUrl: res.data.fileUrl,
          fileName: res.data.fileName,
          fileType: res.data.fileType,
          fileSize: res.data.fileSize
        });

        if (msgRes.data.success) {
          setMessages(prev => [...prev, msgRes.data.data]);
          setTimeout(() => scrollToBottom('smooth'), 100);
        }
      }
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleStartCall = () => {
    setIsVideoCallOpen(true);
    if (socket) {
      socket.emit('video:call:initiate', {
        targetUserId: targetUser.id,
        callerName: `${localStorage.getItem('firstName') || 'Team Member'} ${localStorage.getItem('lastName') || ''}`
      });
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-white dark:bg-[#0F1116] text-gray-900 dark:text-gray-100 font-sans relative overflow-hidden transition-colors duration-300">
      <header className="sticky top-0 flex items-center justify-between px-10 h-[80px] border-b border-gray-100 dark:border-gray-800/20 shrink-0 bg-white/80 dark:bg-[#0F1116]/80 backdrop-blur-md z-50 shadow-sm">
        <div className="flex items-center gap-6 h-full">
          <div className="flex items-center gap-3">
            <div className="relative">
              <ChatAvatar colorIdx={targetUser.colorIdx || 0} initials={initials} avatarUrl={targetUser.avatarUrl} />
              {onlineUsers?.has(targetUser.id) && (
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-[#0F1116] bg-green-500" />
              )}
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5 cursor-pointer hover:opacity-80">
                <span className="text-[14px] font-bold text-gray-800 dark:text-gray-200">{targetUser?.name || 'User'}</span>
                <ChevronDown size={14} className="text-gray-400" />
              </div>
              <span className="text-[10px] text-gray-400 font-medium">#{targetUser.id.slice(0, 8)}</span>
            </div>
          </div>
          <nav className="hidden md:flex items-center gap-8 h-full text-[12px] font-semibold pt-1 ml-4">
            <button className="text-gray-900 dark:text-white border-b-2 border-indigo-500 dark:border-indigo-400 h-full px-1">Chat</button>
            <button className="text-gray-400 dark:text-gray-500 hover:text-gray-700 h-full px-1 transition-colors">Calendar</button>
            <button className="text-gray-400 dark:text-gray-500 hover:text-gray-700 h-full px-1 transition-colors">Files</button>
          </nav>
        </div>
        <div className="flex items-center gap-4 pr-2">
          {onBack && (
            <button onClick={onBack} className="p-2 text-gray-400 hover:text-gray-600 transition-colors" title="Go back">
              <ChevronDown size={20} className="rotate-90" />
            </button>
          )}
        </div>
      </header>
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-gray-50/30 dark:bg-[#0F1116]">
        <div className="flex-1 flex flex-col relative overflow-hidden">
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
              <div className="max-w-2xl w-full flex flex-col items-center space-y-8 -mt-20">
                <div className="space-y-2">
                  <h1 className="text-[20px] font-bold tracking-tight text-gray-900 dark:text-white">This is your conversation with {targetUser.name}</h1>
                  <p className="text-[13px] text-gray-400 dark:text-gray-500 leading-relaxed max-w-sm mx-auto font-medium">
                    Send a message to start chatting!
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-0.5 custom-scrollbar pb-10">
              {messages.map((msg, idx) => {
                const isMe = msg.senderId === currentUserId;
                const showHeader = idx === 0 || messages[idx - 1].senderId !== msg.senderId;
                return (
                  <div key={msg.id} className={`flex gap-3 px-4 py-1 group hover:bg-gray-100/30 dark:hover:bg-white/5 transition-colors relative ${showHeader ? 'mt-4' : 'mt-0'}`}>
                    <div className="w-10 shrink-0 flex flex-col items-center">
                      {showHeader ? (
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center text-[13px] font-black text-white shadow-md ring-2 ring-white dark:ring-gray-900 shrink-0 select-none overflow-hidden avatar-container ${isMe ? 'avatar-bg-me' : `avatar-bg-${(targetUser?.colorIdx || 0) % 6}`}`}
                        >
                          <span className="avatar-content">{isMe ? 'ME' : initials}</span>
                        </div>
                      ) : (
                        <span className="text-[9px] text-gray-400 dark:text-gray-600 opacity-0 group-hover:opacity-100 select-none pt-1 transition-opacity">
                          {formatTime(msg.createdAt).split(' ')[0]}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col">
                      {showHeader && (
                        <div className="flex items-center gap-2 mb-1 leading-none">
                          <span className="text-[14px] font-extrabold text-gray-900 dark:text-gray-100 tracking-tight cursor-pointer hover:underline">{isMe ? 'You' : targetUser.name}</span>
                          <span className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest pt-0.5">{formatTime(msg.createdAt)}</span>
                        </div>
                      )}
                      <div className="text-[13.5px] leading-relaxed text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words font-medium">
                        {msg.text}
                        {msg.fileUrl && (
                          <FilePreview
                            name={msg.fileName || 'file'}
                            size={msg.fileSize}
                            type={msg.fileType}
                            url={msg.fileUrl}
                          />
                        )}
                      </div>
                      {isMe && !msg.imageUrl && !msg.fileUrl && (
                        <div className={`mt-0.5 flex items-center gap-1.5 text-[9px] font-black uppercase tracking-tighter transition-all duration-300 ${msg.readAt ? 'text-indigo-500 opacity-100' : 'text-gray-300 opacity-0 group-hover:opacity-100'}`}>
                          {msg.readAt ? 'SEEN' : 'DELIVERED'}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </div>
      <div className="px-8 pb-8 pt-2 shrink-0 bg-white dark:bg-[#0F1116] z-10">
        <div className="w-full max-w-4xl mx-auto flex flex-col bg-white dark:bg-[#181A20] border border-gray-200 dark:border-gray-800 rounded-[22px] shadow-xl dark:shadow-2xl overflow-hidden ring-1 ring-black/5 focus-within:ring-indigo-500/30 transition-all">
          <div className="px-5 pt-4 pb-1">
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Write to ${targetUser?.name || 'Dhruvik'}`}
              className="w-full bg-transparent border-none focus:ring-0 resize-none text-[13px] placeholder-gray-400 text-gray-700 dark:text-gray-200 min-h-[44px]"
              rows={1}
            />
          </div>
          <div className="flex items-center justify-between px-4 py-3 bg-gray-50/30 dark:bg-transparent">
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => fileInputRef.current?.click()}
                title="Create"
                className="w-7 h-7 rounded-full bg-blue-500 hover:bg-blue-600 flex items-center justify-center text-white transition-colors shadow-lg active:scale-95"
              >
                <Plus size={16} strokeWidth={3} />
              </button>
              <div className="w-px h-4 bg-gray-200 dark:bg-gray-800 mx-2" />
              <button onClick={handleStartCall} title="Screen Live" className="p-1.5 text-gray-400 hover:text-indigo-500 transition-colors active:scale-95"><Video size={19} strokeWidth={2.2} /></button>
              <button onClick={() => fileInputRef.current?.click()} disabled={isUploading} title="Upload Img" className="p-1.5 text-gray-400 hover:text-indigo-500 transition-colors active:scale-95">{isUploading ? <Loader2 size={19} className="animate-spin" /> : <Paperclip size={19} strokeWidth={2.2} />}</button>
              <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} title="Upload a file" />
            </div>
            <div className="flex items-center h-9 rounded-xl bg-indigo-50 dark:bg-gray-800/80 text-indigo-600 dark:text-gray-300 overflow-hidden ring-1 ring-indigo-100 dark:ring-gray-700 transition-all focus-within:ring-2 focus-within:ring-indigo-500">
              <button onClick={handleSendMessage} disabled={!inputValue.trim() || isSending} className="px-4 flex items-center justify-center h-full border-r border-indigo-100 dark:border-gray-700 hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-500 transition-all disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-inherit">{isSending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} fill="currentColor" />}</button>
              <button className="px-2.5 flex items-center justify-center h-full hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-500 transition-all" title="More options"><ChevronDown size={14} strokeWidth={3} /></button>
            </div>
          </div>
        </div>
      </div>
      {isVideoCallOpen && (
        <VideoCallModal
          onClose={() => setIsVideoCallOpen(false)}
          targetUser={{
            name: targetUser.name,
            initials,
            color: avatarColor
          }}
        />
      )}
    </div>
  );
};