import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Plus,
  ChevronDown,
  Image as ImageIcon,
  Video,
  Send,
  Loader2
} from 'lucide-react';
import api from '../../services/api';
import { getSocket } from '../../services/socket';
import { VideoCallModal } from './VideoCallModal';

interface Message {
  id: string;
  text?: string;
  imageUrl?: string;
  senderId: string;
  receiverId: string;
  createdAt: string;
  readAt?: string;
}

interface ChatPanelProps {
  currentUserId: string;
  targetUser: {
    id: string;
    name: string;
    email: string;
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
    try {
      await api.post(`/messages/mark-read/${targetUser.id}`);
      if (onMessagesRead) onMessagesRead(targetUser.id);
    } catch (err) { }
  }, [targetUser.id, onMessagesRead]);

  // Initial load and Read receipt
  useEffect(() => {
    fetchMessages();
    markConversationAsRead();
  }, [targetUser.id, fetchMessages, markConversationAsRead]);

  // Socket Listener
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleNewMessage = (msg: Message) => {
      if (!targetUser?.id) return;
      // Only add to list if it's from current target OR we are current sender
      if (msg.senderId === targetUser.id || msg.senderId === currentUserId) {
        setMessages(prev => [...prev, msg]);
        setTimeout(() => scrollToBottom('smooth'), 100);

        // If it's a message from the target, mark it as read
        if (msg.senderId === targetUser.id) {
          markConversationAsRead();
        }
      }
    };

    const handleMessagesRead = (data: { readBy: string }) => {
      if (targetUser?.id && data.readBy === targetUser.id) {
        setMessages(prev => prev.map(m =>
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
  }, [targetUser.id, currentUserId, markConversationAsRead]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isSending) return;
    const text = inputValue.trim();
    setInputValue('');
    setIsSending(true);

    try {
      const res = await api.post<{ success: boolean; data: Message }>('/messages', {
        receiverId: targetUser.id,
        text
      });
      if (res.data.success) {
        // Socket will handle adding the message to the list via emit-to-self or manual push
        // In this app's architecture, we manually add it or wait for socket loopback
        // Based on controller, it emits to receiverID. We should add it locally.
        setMessages(prev => [...prev, res.data.data]);
        setTimeout(() => scrollToBottom('smooth'), 100);
      }
    } catch (err) {
      console.error('Send failed:', err);
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

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('image', file);

    try {
      setIsUploading(true);
      const res = await api.post<{ success: boolean; imageUrl: string }>('/messages/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data.success) {
        // Send a message with just the image
        const msgRes = await api.post<{ success: boolean; data: Message }>('/messages', {
          receiverId: targetUser.id,
          imageUrl: res.data.imageUrl
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
    const socket = getSocket();
    if (socket) {
      socket.emit('video:call:initiate', {
        targetUserId: targetUser.id,
        callerName: `${localStorage.getItem('firstName') || 'Team Member'} ${localStorage.getItem('lastName') || ''}`
      });
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-white dark:bg-[#0F1116] text-gray-900 dark:text-gray-100 font-sans relative overflow-hidden transition-colors duration-300">

      {/* --- HEADER --- */}
      <header className="flex items-center justify-between px-10 h-[80px] border-b border-gray-100 dark:border-gray-800/20 shrink-0 bg-white dark:bg-[#0F1116] z-10 shadow-sm">
        <div className="flex items-center gap-6 h-full">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-black text-white shadow-sm" {...{ style: { backgroundColor: avatarColor } }}>
                {initials}
              </div>
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

      {/* --- CONTENT AREA --- */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-gray-50/30 dark:bg-[#0F1116]">

        {/* --- MESSAGE LIST AREA --- */}
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
                    Send a message to start chatting! All conversations are secure and private.
                  </p>
                </div>
                <button className="flex items-center w-full max-w-md p-4 rounded-xl border border-red-50 dark:border-red-900/10 bg-[#FFFBFC] dark:bg-red-900/5 hover:shadow-sm transition-all text-left group">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-white dark:bg-[#1A1C23] shadow-sm flex flex-col items-center justify-center border border-red-100 dark:border-red-900/20">
                      <div className="bg-red-500 w-full h-2.5" />
                      <div className="flex-1 flex items-center justify-center">
                        <span className="text-[11px] font-black text-red-500">
                          {new Date().getDate()}
                        </span>
                      </div>
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-gray-900 dark:text-white group-hover:text-red-500 transition-colors">View your calendar</h3>
                      <p className="text-[11px] text-gray-400 dark:text-gray-500">Sync schedules together</p>
                    </div>
                  </div>
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 custom-scrollbar pb-10">
              {messages.map((msg, idx) => {
                const isMe = msg.senderId === currentUserId;
                const showAvatar = idx === 0 || messages[idx - 1].senderId !== msg.senderId;

                return (
                  <div key={msg.id} className={`flex gap-3 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                    <div className={`w-8 shrink-0 ${!showAvatar && 'opacity-0'}`}>
                      <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-[11px] font-bold text-gray-500">
                        {isMe ? 'Me' : initials}
                      </div>
                    </div>
                    <div className={`flex flex-col max-w-[70%] ${isMe ? 'items-end' : 'items-start'}`}>
                      {showAvatar && (
                        <div className="flex items-center gap-2 mb-1 px-1">
                          <span className="text-[12px] font-bold text-gray-700 dark:text-gray-300">
                            {isMe ? 'You' : targetUser.name}
                          </span>
                          <span className="text-[10px] text-gray-400 dark:text-gray-500">
                            {formatTime(msg.createdAt)}
                          </span>
                        </div>
                      )}
                      <div className={`px-4 py-2.5 rounded-2xl text-[13px] leading-relaxed shadow-sm transition-all
                        ${isMe
                          ? 'bg-indigo-600 text-white rounded-tr-none'
                          : 'bg-white dark:bg-[#1E2128] text-gray-800 dark:text-gray-200 border border-gray-100 dark:border-gray-800/50 rounded-tl-none'
                        }`}>
                        {msg.text}
                        {msg.imageUrl && (
                          <img src={msg.imageUrl} alt="upload" className="mt-2 rounded-lg max-h-60 object-cover" />
                        )}
                        {isMe && (
                          <div className={`flex justify-end mt-1 ${msg.readAt ? 'text-blue-300' : 'text-white/60'}`}>
                            {msg.readAt ? (
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7m-12 0l4 4L19 7" />
                              </svg>
                            ) : (
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>


      </div>

      {/* --- INPUT AREA --- */}
      <div className="px-8 pb-8 pt-2 shrink-0 bg-white dark:bg-[#0F1116] z-10">
        <div className="w-full max-w-4xl mx-auto flex flex-col bg-white dark:bg-[#181A20] border border-gray-200 dark:border-gray-800 rounded-[22px] shadow-xl dark:shadow-2xl overflow-hidden ring-1 ring-black/5 focus-within:ring-indigo-500/30 transition-all">
          <div className="px-5 pt-4 pb-1">
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Write to ${targetUser?.name || 'Dhruvik'}, press 'space' for AI, '/' for commands`}
              className="w-full bg-transparent border-none focus:ring-0 resize-none text-[13px] placeholder-gray-400 text-gray-700 dark:text-gray-200 min-h-[44px]"
              rows={1}
            />
          </div>

          <div className="flex items-center justify-between px-4 py-3 bg-gray-50/30 dark:bg-transparent">
            <div className="flex items-center gap-1.5">
              <button
                title="Create"
                className="w-7 h-7 rounded-full bg-blue-500 hover:bg-blue-600 flex items-center justify-center text-white transition-colors shadow-lg active:scale-95"
              >
                <Plus size={16} strokeWidth={3} />
              </button>
              <div className="w-px h-4 bg-gray-200 dark:bg-gray-800 mx-2" />

              <button 
                onClick={handleStartCall}
                title="Screen Live" 
                className="p-1.5 text-gray-400 hover:text-indigo-500 transition-colors active:scale-95"
              >
                <Video size={19} strokeWidth={2.2} />
              </button>
              <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                title="Upload Img" 
                className="p-1.5 text-gray-400 hover:text-indigo-500 transition-colors active:scale-95"
              >
                {isUploading ? <Loader2 size={19} className="animate-spin" /> : <ImageIcon size={19} strokeWidth={2.2} />}
              </button>
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*"
                onChange={handleImageUpload}
                title="Upload Photo"
                placeholder="Upload Photo"
              />
            </div>

            <div className="flex items-center h-9 rounded-xl bg-indigo-50 dark:bg-gray-800/80 text-indigo-600 dark:text-gray-300 overflow-hidden ring-1 ring-indigo-100 dark:ring-gray-700 transition-all focus-within:ring-2 focus-within:ring-indigo-500">
              <button
                onClick={handleSendMessage}
                disabled={!inputValue.trim() || isSending}
                className="px-4 flex items-center justify-center h-full border-r border-indigo-100 dark:border-gray-700 hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-500 transition-all disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-inherit"
              >
                {isSending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} fill="currentColor" />}
              </button>
              <button className="px-2.5 flex items-center justify-center h-full hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-500 transition-all" title="More options">
                <ChevronDown size={14} strokeWidth={3} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* --- MODALS --- */}
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