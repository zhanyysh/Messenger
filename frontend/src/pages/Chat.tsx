import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, LogOut, Plus, MessageSquare, Hash, User as UserIcon, Loader2, Search, UserPlus, Paperclip, Mic, File as FileIcon, Play, Square, Music, Trash2, UserRoundCog, Star, Crown, Users, Edit3, X, Upload, Image as ImageIcon, MoreHorizontal, Maximize2 } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { useLocation, useNavigate } from 'react-router-dom';
import { apiUrl, resolveApiUrl, wsUrl } from '../lib/api';
import { cn } from '../lib/utils';
import CreateChatModal from '../components/CreateChatModal';
import AddMemberModal from '../components/AddMemberModal';
import Profile from './Profile';

interface ChatParticipant {
  user_id: number;
  role: string;
  joined_at: string;
  user: {
    id: number;
    email: string;
    full_name: string | null;
    avatar_url: string | null;
    last_seen?: string | null;
  };
}

interface Chat {
  id: number;
  type: 'private' | 'group';
  name: string | null;
  image_url: string | null;
  created_at: string;
  unread_count?: number;
  last_message_content?: string | null;
  last_message_type?: 'text' | 'image' | 'file' | 'voice' | null;
  last_message_sender_id?: number | null;
  last_message_sender_name?: string | null;
  last_message_timestamp?: string | null;
  participants: ChatParticipant[];
}

interface Message {
  id: number;
  content: string;
  type: 'text' | 'image' | 'file' | 'voice';
  sender_id: number;
  sender_name: string;
  sender_avatar_url?: string | null;
  timestamp: string;
  is_edited?: boolean;
}

interface ContextMenu {
  x: number;
  y: number;
  messageId: number;
}

interface ConfirmationDialogState {
  title: string;
  message: string;
  confirmText: string;
  action: 'leave_chat' | 'delete_chat' | 'remove_group_photo' | 'remove_member';
  payload?: {
    userId?: number;
  };
}

interface NotificationState {
  message: string;
  tone: 'success' | 'error' | 'info';
}

interface AIReplySuggestionResponse {
  chat_id: number;
  message_id: number;
  suggestions: string[];
  rationale?: string | null;
}

interface HistoryMessageApi {
  id: number;
  content: string;
  type: 'text' | 'image' | 'file' | 'voice';
  sender_id: number;
  timestamp: string;
  sender?: {
    email: string;
    full_name: string | null;
    avatar_url: string | null;
  };
}

interface PresenceSnapshotMessage {
  event: 'presence_snapshot';
  chat_id: number;
  online_user_ids: number[];
}

interface PresenceUpdateMessage {
  event: 'presence_update';
  user_id: number;
  is_online: boolean;
  last_seen?: string | null;
}

interface ChatDashboardProps {
  profileOpenOnLoad?: boolean;
}

interface AssistantMessageTarget {
  id: number;
  sender_name: string;
  content: string;
}

interface AssistantThreadMessage {
  id: number;
  role: 'user' | 'assistant';
  content: string;
}

interface AssistantPopoverPosition {
  left: number;
  bottom: number;
  width: number;
  maxHeight: number;
}

export default function ChatDashboard({ profileOpenOnLoad = false }: ChatDashboardProps) {
  const { token, user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChat, setActiveChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(profileOpenOnLoad);
  const [showGroupSettingsModal, setShowGroupSettingsModal] = useState(false);
  const [showParticipantsPanel, setShowParticipantsPanel] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Record<number, string>>({});
  const [onlineUsers, setOnlineUsers] = useState<Record<number, boolean>>({});
  const [lastSeenByUserId, setLastSeenByUserId] = useState<Record<number, string | null>>({});
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  const [confirmationDialog, setConfirmationDialog] = useState<ConfirmationDialogState | null>(null);
  const [notification, setNotification] = useState<NotificationState | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Message[]>([]);
  const [searching, setSearching] = useState(false);
  const [highlightedMessageId, setHighlightedMessageId] = useState<number | null>(null);
  const [assistantTarget, setAssistantTarget] = useState<AssistantMessageTarget | null>(null);
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [assistantError, setAssistantError] = useState<string | null>(null);
  const [assistantMessages, setAssistantMessages] = useState<AssistantThreadMessage[]>([]);
  const [assistantDraft, setAssistantDraft] = useState('');
  const [assistantPopoverPosition, setAssistantPopoverPosition] = useState<AssistantPopoverPosition | null>(null);
  const [assistantPopoverOffset, setAssistantPopoverOffset] = useState({ x: 0, y: 0 });
  const [assistantExpanded, setAssistantExpanded] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const groupPhotoInputRef = useRef<HTMLInputElement>(null);
  const assistantPopoverRef = useRef<HTMLDivElement>(null);
  const assistantDragStateRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const assistantThreadEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const typingStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const remoteTypingTimeoutsRef = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  const isTypingRef = useRef(false);

  const handleUnauthorized = React.useCallback(() => {
    logout();
    navigate('/login', { replace: true });
  }, [logout, navigate]);

  const closeProfileModal = React.useCallback(() => {
    setIsProfileModalOpen(false);

    if (location.pathname === '/profile') {
      navigate('/', { replace: true });
    }
  }, [location.pathname, navigate]);

  const authFetch = React.useCallback(async (
    input: RequestInfo | URL,
    init: RequestInit = {}
  ) => {
    if (!token) {
      handleUnauthorized();
      return null;
    }

    const headers = new Headers(init.headers || {});
    headers.set('Authorization', `Bearer ${token}`);

    const response = await fetch(input, { ...init, headers });
    if (response.status === 401 || response.status === 403) {
      handleUnauthorized();
      return null;
    }

    return response;
  }, [token, handleUnauthorized]);

  const sendTypingState = React.useCallback((isTyping: boolean) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ event: 'typing', is_typing: isTyping }));
  }, []);

  const stopTyping = React.useCallback(() => {
    if (typingStopTimerRef.current) {
      clearTimeout(typingStopTimerRef.current);
      typingStopTimerRef.current = null;
    }
    if (isTypingRef.current) {
      sendTypingState(false);
      isTypingRef.current = false;
    }
  }, [sendTypingState]);

  const pushNotification = React.useCallback((message: string, tone: NotificationState['tone'] = 'info') => {
    setNotification({ message, tone });
    window.setTimeout(() => {
      setNotification((current) => (current?.message === message ? null : current));
    }, 2800);
  }, []);

  const handleMessageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNewMessage(value);

    if (!value.trim()) {
      stopTyping();
      return;
    }

    if (!isTypingRef.current) {
      sendTypingState(true);
      isTypingRef.current = true;
    }

    if (typingStopTimerRef.current) {
      clearTimeout(typingStopTimerRef.current);
    }

    typingStopTimerRef.current = setTimeout(() => {
      if (isTypingRef.current) {
        sendTypingState(false);
        isTypingRef.current = false;
      }
      typingStopTimerRef.current = null;
    }, 1200);
  };

  const formatLastSeen = React.useCallback((lastSeen: string | null | undefined) => {
    if (!lastSeen) return 'Offline';

    const diffMs = Date.now() - new Date(lastSeen).getTime();
    if (Number.isNaN(diffMs) || diffMs < 0) return 'Offline';

    const minutes = Math.floor(diffMs / 60000);
    if (minutes < 1) return 'Last seen just now';
    if (minutes < 60) return `Last seen ${minutes}m ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `Last seen ${hours}h ago`;

    const days = Math.floor(hours / 24);
    return `Last seen ${days}d ago`;
  }, []);

  const getParticipantStatus = React.useCallback((participant: ChatParticipant) => {
    if (onlineUsers[participant.user_id]) {
      return 'Online';
    }

    return formatLastSeen(lastSeenByUserId[participant.user_id] ?? participant.user.last_seen);
  }, [formatLastSeen, lastSeenByUserId, onlineUsers]);

  const isParticipantOnline = React.useCallback((userId: number) => {
    return Boolean(onlineUsers[userId]);
  }, [onlineUsers]);

  const formatChatPreview = React.useCallback((chat: Chat) => {
    if (!chat.last_message_content) {
      return 'No messages yet';
    }

    const prefix = chat.last_message_sender_id === user?.id
      ? 'You'
      : chat.type === 'group' && chat.last_message_sender_name
        ? chat.last_message_sender_name
        : null;

    const body = chat.last_message_type === 'image'
      ? 'Photo'
      : chat.last_message_type === 'file'
        ? 'File'
        : chat.last_message_type === 'voice'
          ? 'Voice message'
          : chat.last_message_content;

    return prefix ? `${prefix}: ${body}` : body;
  }, [user?.id]);

  useEffect(() => {
    if (!activeChat) {
      setOnlineUsers({});
      setLastSeenByUserId({});
      setAssistantTarget(null);
      setAssistantError(null);
      setAssistantLoading(false);
      setAssistantMessages([]);
      setAssistantDraft('');
      setAssistantPopoverPosition(null);
      setAssistantPopoverOffset({ x: 0, y: 0 });
      setAssistantExpanded(false);
      return;
    }

    setOnlineUsers({});
    setLastSeenByUserId((previous) => {
      const next = { ...previous };
      activeChat.participants.forEach((participant) => {
        next[participant.user_id] = participant.user.last_seen ?? next[participant.user_id] ?? null;
      });
      return next;
    });
    setAssistantTarget(null);
    setAssistantError(null);
    setAssistantLoading(false);
    setAssistantMessages([]);
    setAssistantDraft('');
    setAssistantPopoverPosition(null);
    setAssistantPopoverOffset({ x: 0, y: 0 });
    setAssistantExpanded(false);
  }, [activeChat?.id]);

  useEffect(() => {
    if (!assistantTarget) return;

    const refreshAssistantPosition = () => {
      const nextPosition = calculateAssistantPopoverPosition(assistantTarget.id);
      if (nextPosition) {
        setAssistantPopoverPosition(nextPosition);
      }
    };

    refreshAssistantPosition();
    window.addEventListener('resize', refreshAssistantPosition);
    window.addEventListener('scroll', refreshAssistantPosition, true);

    const handleOutsidePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (assistantPopoverRef.current && target && !assistantPopoverRef.current.contains(target)) {
        closeAssistant();
      }
    };

    const handlePointerMove = (event: PointerEvent) => {
      const dragState = assistantDragStateRef.current;
      if (!dragState || dragState.pointerId !== event.pointerId) return;

      setAssistantPopoverOffset({
        x: dragState.offsetX + (event.clientX - dragState.startX),
        y: dragState.offsetY + (event.clientY - dragState.startY),
      });
    };

    const handlePointerUp = (event: PointerEvent) => {
      const dragState = assistantDragStateRef.current;
      if (!dragState || dragState.pointerId !== event.pointerId) return;

      assistantDragStateRef.current = null;
      document.body.style.userSelect = '';
    };

    document.addEventListener('pointerdown', handleOutsidePointerDown);
    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);
    document.addEventListener('pointercancel', handlePointerUp);

    return () => {
      window.removeEventListener('resize', refreshAssistantPosition);
      window.removeEventListener('scroll', refreshAssistantPosition, true);
      document.removeEventListener('pointerdown', handleOutsidePointerDown);
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
      document.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [assistantTarget?.id, assistantExpanded, calculateAssistantPopoverPosition, closeAssistant]);

  useEffect(() => {
    if (!activeChat) return;

    setLastSeenByUserId((previous) => {
      const next = { ...previous };
      activeChat.participants.forEach((participant) => {
        if (!(participant.user_id in next) || next[participant.user_id] == null) {
          next[participant.user_id] = participant.user.last_seen ?? null;
        }
      });
      return next;
    });
  }, [activeChat?.participants]);

  // Initialize and refresh chats to surface unread counters across chat rooms
  useEffect(() => {
    const refreshChats = async () => {
      const res = await authFetch(apiUrl('/api/v1/chats/'));
      if (!res) return;

      const data: Chat[] = await res.json();
      const currentActiveChatId = activeChat?.id;

      const withActiveReset = data.map((chat) =>
        currentActiveChatId && chat.id === currentActiveChatId
          ? { ...chat, unread_count: 0 }
          : chat
      );

      setChats(withActiveReset);

      if (!currentActiveChatId && withActiveReset.length > 0) {
        setLoadingHistory(true);
        setActiveChat(withActiveReset[0]);
        return;
      }

      if (currentActiveChatId) {
        const refreshedActive = withActiveReset.find(c => c.id === currentActiveChatId);
        if (refreshedActive) {
          setActiveChat(refreshedActive);
        }
      }
    };

    refreshChats();
    const interval = setInterval(refreshChats, 8000);
    return () => clearInterval(interval);
  }, [authFetch, activeChat?.id]);

  // Connect WebSockets when active chat changes
  useEffect(() => {
    if (!activeChat) return;

    const loadMessages = async () => {
      const res = await authFetch(apiUrl(`/api/v1/chats/${activeChat.id}/messages`));
      if (!res) {
        setLoadingHistory(false);
        return;
      }

      const data: HistoryMessageApi[] = await res.json();
      // Map API history data layout to strictly match our standardized Message format
      const history: Message[] = data.map((d) => ({
        id: d.id, content: d.content, sender_id: d.sender_id, timestamp: d.timestamp,
        type: d.type,
        sender_name: d.sender?.full_name || d.sender?.email || "Unknown",
        sender_avatar_url: d.sender?.avatar_url || null,
      }));
      setMessages(history);
      setLoadingHistory(false);
    };

    loadMessages();

    // Close existing socket if any
    if (wsRef.current) wsRef.current.close();

    if (!token) {
      handleUnauthorized();
      return;
    }

    const socket = new WebSocket(`${wsUrl(`/ws/chat/${activeChat.id}`)}?token=${token}`);
    
    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.event === 'presence_snapshot') {
          const presenceData = data as PresenceSnapshotMessage;
          const nextOnlineUsers: Record<number, boolean> = {};
          presenceData.online_user_ids.forEach((userId) => {
            nextOnlineUsers[userId] = true;
          });
          setOnlineUsers(nextOnlineUsers);
          return;
        }

        if (data.event === 'presence_update') {
          const presenceUpdate = data as PresenceUpdateMessage;
          if (presenceUpdate.user_id === user?.id) {
            return;
          }

          setOnlineUsers((previous) => ({
            ...previous,
            [presenceUpdate.user_id]: presenceUpdate.is_online,
          }));

          if (!presenceUpdate.is_online) {
            setLastSeenByUserId((previous) => ({
              ...previous,
              [presenceUpdate.user_id]: presenceUpdate.last_seen ?? previous[presenceUpdate.user_id] ?? null,
            }));
          }
          return;
        }

        if (data.event === 'typing') {
          if (data.sender_id === user?.id) return;

          if (data.is_typing) {
            setTypingUsers(prev => ({ ...prev, [data.sender_id]: data.sender_name || 'Unknown' }));
            const existingTimeout = remoteTypingTimeoutsRef.current[data.sender_id];
            if (existingTimeout) {
              clearTimeout(existingTimeout);
            }
            remoteTypingTimeoutsRef.current[data.sender_id] = setTimeout(() => {
              setTypingUsers(prev => {
                const next = { ...prev };
                delete next[data.sender_id];
                return next;
              });
              delete remoteTypingTimeoutsRef.current[data.sender_id];
            }, 1800);
          } else {
            const existingTimeout = remoteTypingTimeoutsRef.current[data.sender_id];
            if (existingTimeout) {
              clearTimeout(existingTimeout);
              delete remoteTypingTimeoutsRef.current[data.sender_id];
            }
            setTypingUsers(prev => {
              const next = { ...prev };
              delete next[data.sender_id];
              return next;
            });
          }
          return;
        }

        if (data.event === 'edit_message') {
          setMessages(prev => {
            const next = prev.map(m => m.id === data.id ? { ...m, content: data.content, is_edited: true } : m);
            if (next[next.length - 1]?.id === data.id) {
              setChats(previous => previous.map((chat) => (
                chat.id === activeChat.id
                  ? {
                      ...chat,
                      last_message_content: data.content,
                      last_message_type: 'text',
                    }
                  : chat
              )));
            }
            return next;
          });
          return;
        }

        if (data.event === 'delete_message') {
          setMessages(prev => {
            const next = prev.filter(m => m.id !== data.id);
            if (prev[prev.length - 1]?.id === data.id) {
              const lastVisibleMessage = next[next.length - 1];
              setChats(previous => previous.map((chat) => (
                chat.id === activeChat.id
                  ? {
                      ...chat,
                      last_message_content: lastVisibleMessage?.content ?? null,
                      last_message_type: lastVisibleMessage?.type ?? null,
                      last_message_sender_id: lastVisibleMessage?.sender_id ?? null,
                      last_message_sender_name: lastVisibleMessage?.sender_name ?? null,
                      last_message_timestamp: lastVisibleMessage?.timestamp ?? null,
                    }
                  : chat
              )));
            }
            return next;
          });
          return;
        }

        const incomingMessage: Message = {
          id: data.id,
          content: data.content,
          type: data.type,
          sender_id: data.sender_id,
          sender_name: data.sender_name || 'Unknown',
          sender_avatar_url: data.sender_avatar_url || null,
          timestamp: data.timestamp,
        };

        setMessages(prev => [...prev, incomingMessage]);
        setChats((previous) => previous.map((chat) => (
          chat.id === activeChat.id
            ? {
                ...chat,
                last_message_content: incomingMessage.content,
                last_message_type: incomingMessage.type,
                last_message_sender_id: incomingMessage.sender_id,
                last_message_sender_name: incomingMessage.sender_name,
                last_message_timestamp: incomingMessage.timestamp,
                unread_count: chat.id === activeChat.id ? 0 : (chat.unread_count ?? 0) + 1,
              }
            : chat
        )));
        if (data.sender_id) {
          setTypingUsers(prev => {
            if (!prev[data.sender_id]) return prev;
            const next = { ...prev };
            delete next[data.sender_id];
            return next;
          });
        }
      } catch {
        // Ignore malformed WS packets
      }
    };

    wsRef.current = socket;

    return () => {
      stopTyping();
      setTypingUsers({});
      Object.values(remoteTypingTimeoutsRef.current).forEach(clearTimeout);
      remoteTypingTimeoutsRef.current = {};
      socket.close();
      wsRef.current = null;
    };
  }, [activeChat?.id, token, authFetch, handleUnauthorized, stopTyping, user?.id]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (wsRef.current && newMessage.trim()) {
      if (editingMessage) {
        wsRef.current.send(
          JSON.stringify({ event: 'edit_message', message_id: editingMessage.id, content: newMessage })
        );
        setEditingMessage(null);
      } else {
        wsRef.current.send(
          JSON.stringify({ event: 'message', content: newMessage, type: 'text' })
        );
      }
      setNewMessage('');
      stopTyping();
    }
  };

  const handleContextMenu = (e: React.MouseEvent, message: Message) => {
    if (message.type !== 'text') return;
    e.preventDefault();
    setContextMenu({
      x: e.pageX,
      y: e.pageY,
      messageId: message.id
    });
  };

  const closeContextMenu = () => setContextMenu(null);

  const startEdit = (message: Message) => {
    setEditingMessage(message);
    setNewMessage(message.content);
    closeContextMenu();
  };

  const deleteMessage = (messageId: number) => {
    if (wsRef.current) {
      wsRef.current.send(
        JSON.stringify({ event: 'delete_message', message_id: messageId })
      );
    }
    closeContextMenu();
  };

  function calculateAssistantPopoverPosition(messageId: number) {
    const messageElement = document.getElementById(`msg-${messageId}`);
    if (!messageElement) return null;

    const rect = messageElement.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const preferredWidth = assistantExpanded ? 560 : 420;
    const width = Math.min(preferredWidth, viewportWidth - 24);
    const centerX = rect.left + rect.width / 2;
    const left = Math.max(
      width / 2 + 12,
      Math.min(viewportWidth - width / 2 - 12, centerX)
    );

    return {
      left,
      bottom: Math.max(12, window.innerHeight - rect.top + 12),
      width,
      maxHeight: Math.max(240, rect.top - 28),
    };
  }

  async function submitAssistantPrompt(
    target: AssistantMessageTarget,
    promptText: string,
    options: { showUserBubble?: boolean } = {}
  ) {
    const trimmedPrompt = promptText.trim();
    if (!trimmedPrompt || !activeChat) return;

    const showUserBubble = options.showUserBubble ?? true;
    const userMessageId = Date.now();
    const assistantMessageId = userMessageId + 1;

    if (showUserBubble) {
      setAssistantMessages((previous) => [
        ...previous,
        { id: userMessageId, role: 'user', content: trimmedPrompt },
      ]);
    }

    setAssistantLoading(true);
    setAssistantError(null);

    const response = await authFetch(apiUrl('/api/v1/ai/reply-suggestion'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: activeChat.id,
        message_id: target.id,
        suggestion_count: 3,
        user_prompt: trimmedPrompt,
      }),
    });

    if (!response) {
      setAssistantLoading(false);
      return;
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      setAssistantError(errorData?.detail || 'Assistant is unavailable right now.');
      setAssistantLoading(false);
      return;
    }

    const data: AIReplySuggestionResponse & { reply?: string } = await response.json();
    const assistantReply = data.reply || data.rationale || data.suggestions?.[0] || 'I can help refine that answer.';

    setAssistantMessages((previous) => [
      ...previous,
      { id: assistantMessageId, role: 'assistant', content: assistantReply },
    ]);
    setAssistantLoading(false);
    setAssistantDraft('');
  }

  async function openAssistantForMessage(message: Message) {
    if (!activeChat) return;

    setAssistantTarget({
      id: message.id,
      sender_name: message.sender_name,
      content: message.content,
    });
    setAssistantMessages([]);
    setAssistantDraft('');
    setAssistantError(null);
    setAssistantLoading(true);
    setAssistantExpanded(false);
    setAssistantPopoverPosition(calculateAssistantPopoverPosition(message.id));
    setAssistantPopoverOffset({ x: 0, y: 0 });
    closeContextMenu();

    await submitAssistantPrompt(
      {
        id: message.id,
        sender_name: message.sender_name,
        content: message.content,
      },
      'Help me draft a concise answer to this message.',
      { showUserBubble: false }
    );
  }

  function closeAssistant() {
    setAssistantTarget(null);
    setAssistantError(null);
    setAssistantLoading(false);
    setAssistantMessages([]);
    setAssistantDraft('');
    setAssistantPopoverPosition(null);
    setAssistantPopoverOffset({ x: 0, y: 0 });
    setAssistantExpanded(false);
  }

  const startAssistantDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!assistantPopoverPosition) return;

    event.preventDefault();
    assistantDragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      offsetX: assistantPopoverOffset.x,
      offsetY: assistantPopoverOffset.y,
    };

    event.currentTarget.setPointerCapture(event.pointerId);
    document.body.style.userSelect = 'none';
  };

  const handleAssistantSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!assistantTarget || !assistantDraft.trim()) return;

    const prompt = assistantDraft;
    setAssistantDraft('');
    void submitAssistantPrompt(assistantTarget, prompt);
  };

  useEffect(() => {
    assistantThreadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [assistantMessages, assistantLoading]);

  const handleJumpToMessage = async (messageId: number) => {
    if (!activeChat) return;
    
    // Check if message is already in our current messages state
    const existingIndex = messages.findIndex(m => m.id === messageId);
    
    if (existingIndex === -1) {
      // Not in current list, fetch context around this message
      setLoadingHistory(true);
      try {
        const res = await authFetch(apiUrl(`/api/v1/chats/${activeChat.id}/messages/${messageId}/context`));
        if (res && res.ok) {
          const data: HistoryMessageApi[] = await res.json();
          const history: Message[] = data.map((d) => ({
            id: d.id, content: d.content, sender_id: d.sender_id, timestamp: d.timestamp,
            type: d.type,
            sender_name: d.sender?.full_name || d.sender?.email || "Unknown",
            sender_avatar_url: d.sender?.avatar_url || null,
          }));
          setMessages(history);
        }
      } catch (err) {
        console.error("Failed to fetch context", err);
      } finally {
        setLoadingHistory(false);
      }
    }

    // Close search
    setShowSearch(false);
    
    // Scroll and highlight
    setTimeout(() => {
      const element = document.getElementById(`msg-${messageId}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setHighlightedMessageId(messageId);
        setTimeout(() => setHighlightedMessageId(null), 2500);
      }
    }, 100);
  };

  useEffect(() => {
    const handleClick = () => closeContextMenu();
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  useEffect(() => {
    if (!showSearch || !searchQuery.trim() || !activeChat) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await authFetch(apiUrl(`/api/v1/chats/${activeChat.id}/search?query=${encodeURIComponent(searchQuery)}`));
        if (res && res.ok) {
          const data: HistoryMessageApi[] = await res.json();
          const mapped: Message[] = data.map(d => ({
            id: d.id, content: d.content, sender_id: d.sender_id, timestamp: d.timestamp,
            type: d.type,
            sender_name: d.sender?.full_name || d.sender?.email || "Unknown",
            sender_avatar_url: d.sender?.avatar_url || null,
          }));
          setSearchResults(mapped);
        }
      } catch (err) {
        console.error("Search failed", err);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, activeChat, showSearch, authFetch]);

  const handleChatCreated = (newChat: Chat) => {
    const normalizedChat = { ...newChat, unread_count: newChat.unread_count ?? 0 };
    setChats([normalizedChat, ...chats]);
    setLoadingHistory(true);
    setActiveChat(normalizedChat);
  };

  const handleMembersAdded = (newMembers: ChatParticipant[]) => {
    if (!activeChat) return;
    const updatedChat = {
      ...activeChat,
      participants: [...activeChat.participants, ...newMembers]
    };
    setActiveChat(updatedChat);
    setChats(prev => prev.map(c => c.id === updatedChat.id ? updatedChat : c));
  };

  const syncUpdatedChat = (updatedChat: Chat) => {
    setActiveChat(prev => (prev?.id === updatedChat.id ? updatedChat : prev));
    setChats(prev => prev.map((chat) => (chat.id === updatedChat.id ? updatedChat : chat)));
  };

  const updateGroupPhoto = async (imageUrl: string | null) => {
    if (!activeChat || activeChat.type !== 'group') return;

    try {
      const res = await authFetch(apiUrl(`/api/v1/chats/${activeChat.id}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_url: imageUrl }),
      });

      if (!res) return;

      if (res.ok) {
        const updatedChat: Chat = await res.json();
        syncUpdatedChat(updatedChat);
        pushNotification('Group photo updated.', 'success');
      } else {
        const err = await res.json();
        pushNotification(err.detail || 'Failed to update group photo.', 'error');
      }
    } catch {
      pushNotification('Network failure during photo update.', 'error');
    }
  };

  const handleGroupPhotoUpload = async (file: File) => {
    if (!token) return;

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await authFetch(apiUrl('/api/v1/upload/'), {
        method: 'POST',
        body: formData,
      });

      if (!res) return;

      if (res.ok) {
        const data = await res.json();
        await updateGroupPhoto(data.url);
        pushNotification('Group photo uploaded.', 'success');
      } else {
        const err = await res.json();
        pushNotification(err.detail || 'Failed to upload group photo.', 'error');
      }
    } catch {
      pushNotification('Network failure during photo upload.', 'error');
    } finally {
      if (groupPhotoInputRef.current) {
        groupPhotoInputRef.current.value = '';
      }
    }
  };

  const handleRemoveGroupPhoto = async () => {
    if (!activeChat || activeChat.type !== 'group') return;
    setConfirmationDialog({
      title: 'Remove group photo?',
      message: 'This will clear the current group avatar. You can upload a new one later.',
      confirmText: 'Remove photo',
      action: 'remove_group_photo',
    });
  };

  const toggleParticipantsPanel = () => {
    setShowParticipantsPanel((prev) => !prev);
    setShowGroupSettingsModal(false);
  };

  const openAddMembers = () => {
    setIsAddMemberModalOpen(true);
    setShowGroupSettingsModal(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !wsRef.current) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await authFetch(apiUrl('/api/v1/upload/'), {
        method: 'POST',
        body: formData
      });
      if (!res) return;
      
      if (res.ok) {
        const data = await res.json();
        const type = file.type.startsWith('image/') ? 'image' : 'file';
        wsRef.current.send(JSON.stringify({
          content: data.url,
          type: type
        }));
      }
    } catch (err) {
      console.error("Upload failed", err);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        setAudioBlob(blob);
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setIsRecording(true);
      setRecordingDuration(0);
      timerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Voice recording failed", err);
      pushNotification('Mic access denied.', 'error');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current !== null) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const submitVoice = async () => {
    if (!audioBlob || !wsRef.current) return;

    const formData = new FormData();
    formData.append('file', audioBlob, 'voice.webm');

    try {
      const res = await authFetch(apiUrl('/api/v1/upload/'), {
        method: 'POST',
        body: formData
      });
      if (!res) return;
      
      if (res.ok) {
        const data = await res.json();
        wsRef.current.send(JSON.stringify({
          content: data.url,
          type: 'voice'
        }));
        setAudioBlob(null);
        setRecordingDuration(0);
      }
    } catch (err) {
      console.error("Voice upload failed", err);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleRemoveMember = async (userId: number) => {
    if (!activeChat || !token) return;

    setConfirmationDialog({
      title: 'Remove this operative?',
      message: 'This will remove the user from the group.',
      confirmText: 'Remove operative',
      action: 'remove_member',
      payload: { userId },
    });
  };

  const performRemoveMember = async (userId: number) => {
    if (!activeChat || !token) return;

    try {
      const res = await authFetch(
        apiUrl(`/api/v1/chats/${activeChat.id}/members/${userId}`),
        { method: 'DELETE' }
      );
      if (!res) return;

      if (res.ok) {
        const updatedChat = {
          ...activeChat,
          participants: activeChat.participants.filter(p => p.user_id !== userId)
        };
        setActiveChat(updatedChat);
        setChats(prev => prev.map(c => c.id === updatedChat.id ? updatedChat : c));
        pushNotification('Operative removed.', 'success');
      } else {
        const err = await res.json();
        pushNotification(err.detail || 'Failed to remove operative.', 'error');
      }
    } catch {
      pushNotification('Network failure during removal.', 'error');
    }
  };

  const handleUpdateRole = async (userId: number, newRole: string) => {
    if (!activeChat || !token) return;

    try {
      const res = await authFetch(
        apiUrl(`/api/v1/chats/${activeChat.id}/members/${userId}/role`),
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role: newRole })
        }
      );
      if (!res) return;

      if (res.ok) {
        const updatedParticipant = await res.json();
        const updatedChat = {
          ...activeChat,
          participants: activeChat.participants.map(p =>
            p.user_id === userId ? updatedParticipant : p
          )
        };
        setActiveChat(updatedChat);
        setChats(prev => prev.map(c => c.id === updatedChat.id ? updatedChat : c));
        const action = newRole === 'admin' ? 'promoted to' : 'demoted to';
        pushNotification(`Operative ${action} ${newRole}.`, 'success');
      } else {
        const err = await res.json();
        pushNotification(err.detail || 'Failed to update operative role.', 'error');
      }
    } catch {
      pushNotification('Network failure during role update.', 'error');
    }
  };

  const handleLeaveChat = async () => {
    if (!activeChat || !token) return;

    setConfirmationDialog({
      title: 'Leave this chat?',
      message: 'You will be removed from this conversation and will not receive new messages here.',
      confirmText: 'Leave chat',
      action: 'leave_chat',
    });
  };

  const performLeaveChat = async () => {
    if (!activeChat || !token) return;

    try {
      const res = await authFetch(
        apiUrl(`/api/v1/chats/${activeChat.id}/me`),
        { method: 'DELETE' }
      );
      if (!res) return;

      if (res.ok) {
        setChats(prev => prev.filter(c => c.id !== activeChat.id));
        setActiveChat(null);
        setMessages([]);
        pushNotification('You have left the secure node.', 'success');
      } else {
        const err = await res.json();
        pushNotification(err.detail || 'Failed to leave chat.', 'error');
      }
    } catch {
      pushNotification('Network failure during leave operation.', 'error');
    }
  };

  const handleDeleteChat = async () => {
    if (!activeChat || !token) return;

    setConfirmationDialog({
      title: activeChat.type === 'group' ? 'Delete this group?' : 'Delete this chat?',
      message:
        activeChat.type === 'group'
          ? 'This will permanently remove the group for everyone.'
          : 'This will permanently remove the conversation for everyone.',
      confirmText: 'Delete chat',
      action: 'delete_chat',
    });
  };

  const performDeleteChat = async () => {
    if (!activeChat || !token) return;

    try {
      const res = await authFetch(
        apiUrl(`/api/v1/chats/${activeChat.id}`),
        { method: 'DELETE' }
      );
      if (!res) return;

      if (res.ok) {
        setChats(prev => prev.filter(c => c.id !== activeChat.id));
        setActiveChat(null);
        setMessages([]);
        setShowGroupSettingsModal(false);
        pushNotification('Chat deleted.', 'success');
      } else {
        const err = await res.json();
        pushNotification(err.detail || 'Failed to delete chat.', 'error');
      }
    } catch {
      pushNotification('Network failure during delete operation.', 'error');
    }
  };

  const handleConfirmDialogAction = async () => {
    if (!confirmationDialog) return;

    const currentAction = confirmationDialog.action;
    const currentPayload = confirmationDialog.payload;
    setConfirmationDialog(null);

    if (currentAction === 'remove_group_photo') {
      await updateGroupPhoto(null);
      return;
    }

    if (currentAction === 'remove_member' && currentPayload?.userId !== undefined) {
      await performRemoveMember(currentPayload.userId);
      return;
    }

    if (currentAction === 'leave_chat') {
      await performLeaveChat();
      return;
    }

    if (currentAction === 'delete_chat') {
      await performDeleteChat();
    }
  };

  // Helper to get chat name (If private, show other person's name)
  const getChatName = (chat: Chat) => {
    if (chat.type === 'group' && chat.name) return chat.name;
    const otherParticipant = chat.participants.find(p => p.user_id !== user?.id);
    return otherParticipant?.user.full_name || otherParticipant?.user.email || "Unknown Agent";
  };

  const getOtherParticipant = (chat: Chat) => {
    if (chat.type !== 'private') return null;
    return chat.participants.find((p) => p.user_id !== user?.id) ?? null;
  };

  const getChatAvatarUrl = (chat: Chat): string | null => {
    if (chat.type === 'group') {
      return chat.image_url || null;
    }
    return getOtherParticipant(chat)?.user.avatar_url || null;
  };

  const getParticipantAvatarUrl = (senderId: number): string | null => {
    if (senderId === user?.id) {
      return user?.avatar_url || null;
    }

    const participant = activeChat?.participants.find((p) => p.user_id === senderId);
    return participant?.user.avatar_url || null;
  };

  const getMessageAvatarUrl = (message: Message): string | null => {
    if (message.sender_avatar_url) {
      return message.sender_avatar_url;
    }
    return getParticipantAvatarUrl(message.sender_id);
  };

  const typingNames = Object.values(typingUsers);
  const contextMessage = contextMenu ? messages.find((message) => message.id === contextMenu.messageId) ?? null : null;

  return (
    <div className="flex h-screen w-full relative overflow-hidden">
      {/* Background Animated Blobs */}
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none mix-blend-screen opacity-20">
        <div className="absolute top-10 left-10 w-[500px] h-[500px] bg-primary/30 rounded-full filter blur-[150px] animate-blob"></div>
        <div className="absolute bottom-10 right-10 w-[600px] h-[600px] bg-secondary/30 rounded-full filter blur-[150px] animate-blob" style={{ animationDelay: '2s' }}></div>
      </div>

      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            className="fixed top-4 right-4 z-[200] max-w-sm"
          >
            <div
              className={cn(
                "rounded-2xl border px-4 py-3 shadow-2xl backdrop-blur-xl",
                notification.tone === 'success' && "border-primary/30 bg-primary/10 text-white",
                notification.tone === 'error' && "border-secondary/40 bg-secondary/10 text-white",
                notification.tone === 'info' && "border-border bg-black/70 text-white"
              )}
            >
              <p className="text-sm font-medium leading-snug">{notification.message}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="w-full h-full flex flex-col md:flex-row z-10 relative overflow-hidden">
        
        {/* SIDEBAR */}
        <div className="w-full md:w-80 border-r border-border/50 bg-[#0a0a0c]/40 backdrop-blur-3xl flex flex-col relative z-20">
          
          {/* Header */}
          <div className="p-6 border-b border-border/50 flex justify-between items-center bg-black/20">
            <div>
              <h1 className="text-2xl font-display font-bold text-gradient tracking-tighter">Wazzup</h1>
              <p className="text-[10px] text-textMuted uppercase tracking-widest mt-1">User: {user?.username || user?.full_name || user?.email}</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsProfileModalOpen(true)}
                className="text-textMuted hover:text-primary transition-colors"
                title="Profile"
              >
                {user?.avatar_url ? (
                  <img
                    src={resolveApiUrl(user.avatar_url)}
                    alt="Profile"
                    className="w-8 h-8 rounded-full object-cover border border-border"
                  />
                ) : (
                  <UserRoundCog className="w-5 h-5" />
                )}
              </button>
              <button onClick={handleLogout} className="text-textMuted hover:text-secondary transition-colors" title="Disconnect">
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="p-4 border-b border-border/50">
            <button onClick={() => setIsCreateModalOpen(true)} className="w-full flex items-center justify-center gap-2 bg-surface hover:bg-white/5 border border-border rounded-xl p-3 text-sm text-white transition-all">
              <Plus className="w-4 h-4 text-primary" />
              Find friend
            </button>
          </div>

          {/* Chat List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {chats.length === 0 && (
              <div className="p-4 text-center text-textMuted text-sm">No active lines found.</div>
            )}
            
            <AnimatePresence>
              {chats.map((chat) => {
                const isActive = activeChat?.id === chat.id;
                const otherParticipant = getOtherParticipant(chat);
                return (
                  <motion.div 
                    initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                    key={chat.id} 
                    onClick={() => {
                      setLoadingHistory(true);
                      const selectedChat = { ...chat, unread_count: 0 };
                      setActiveChat(selectedChat);
                      setChats(prev => prev.map(c => c.id === chat.id ? selectedChat : c));
                    }}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all border",
                      isActive 
                        ? "bg-primary/10 border-primary/30 shadow-[0_0_15px_rgba(212,255,0,0.1)]" 
                        : "bg-surface border-transparent hover:border-border hover:bg-white/5"
                    )}
                  >
                    <div className={cn("relative w-10 h-10 shrink-0", isActive ? "text-primary" : "text-textMuted") }>
                      <div className={cn("w-10 h-10 rounded-full flex items-center justify-center border", isActive ? "bg-primary/20 border-primary/50 text-primary" : "bg-black/50 border-border text-textMuted") }>
                        {getChatAvatarUrl(chat) ? (
                          <img
                            src={resolveApiUrl(getChatAvatarUrl(chat) || '')}
                            alt={getChatName(chat)}
                            className="w-full h-full rounded-full object-cover"
                          />
                        ) : chat.type === 'group' ? (
                          <Hash className="w-5 h-5" />
                        ) : otherParticipant?.user.avatar_url ? (
                          <img
                            src={resolveApiUrl(otherParticipant.user.avatar_url)}
                            alt={otherParticipant.user.full_name || otherParticipant.user.email || 'User avatar'}
                            className="w-full h-full rounded-full object-cover"
                          />
                        ) : (
                          <UserIcon className="w-5 h-5" />
                        )}
                      </div>

                      {chat.type === 'private' && otherParticipant && isParticipantOnline(otherParticipant.user_id) && (
                        <span className="absolute -bottom-0 -right-0 h-3 w-3 rounded-full border-2 border-[#0a0a0c] bg-emerald-500 shadow-[0_0_0_2px_rgba(16,185,129,0.2)]" />
                      )}
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <h3 className={cn("text-sm font-semibold truncate", isActive ? "text-primary" : "text-white")}>
                        {getChatName(chat)}
                      </h3>
                      <p className="text-xs text-textMuted truncate">{formatChatPreview(chat)}</p>
                    </div>
                    {(chat.unread_count ?? 0) > 0 && !isActive && (
                      <div className="shrink-0 min-w-6 h-6 px-1 rounded-full bg-secondary/90 text-[10px] font-bold text-black flex items-center justify-center border border-secondary shadow-[0_0_12px_rgba(249,115,22,0.45)]">
                        {(chat.unread_count ?? 0) > 99 ? '99+' : (chat.unread_count ?? 0)}
                      </div>
                    )}
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>
        </div>

        {/* MAIN CHAT AREA */}
        <div className="flex-1 flex flex-col bg-black/10 relative">
          {activeChat ? (
            <>
              {/* Chat Header */}
              <div className="h-20 border-b border-border/50 px-8 flex items-center justify-between bg-[#0a0a0c]/60 backdrop-blur-md sticky top-0 z-10 shadow-sm">
                <div className="flex items-center gap-4">
                  {(() => {
                    const otherParticipant = getOtherParticipant(activeChat);
                    const chatAvatarUrl = getChatAvatarUrl(activeChat);
                    return (
                      <div className="relative w-12 h-12 bg-surface border border-border rounded-xl flex items-center justify-center text-white">
                        {chatAvatarUrl ? (
                          <img
                            src={resolveApiUrl(chatAvatarUrl)}
                            alt={getChatName(activeChat)}
                            className="w-full h-full rounded-xl object-cover"
                          />
                        ) : activeChat.type === 'group' ? (
                          <Hash className="w-6 h-6" />
                        ) : otherParticipant?.user.avatar_url ? (
                          <img
                            src={resolveApiUrl(otherParticipant.user.avatar_url)}
                            alt={otherParticipant.user.full_name || otherParticipant.user.email || 'User avatar'}
                            className="w-full h-full rounded-xl object-cover"
                          />
                        ) : (
                          <UserIcon className="w-6 h-6" />
                        )}
                        {activeChat.type === 'private' && otherParticipant && isParticipantOnline(otherParticipant.user_id) && (
                          <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-[#0a0a0c] bg-emerald-500 shadow-[0_0_0_2px_rgba(16,185,129,0.2)]" />
                        )}
                      </div>
                    );
                  })()}
                  <div>
                    <h2 className="text-xl font-display font-semibold text-white tracking-tight">{getChatName(activeChat)}</h2>
                    {activeChat.type === 'private' && (() => {
                      const otherParticipant = getOtherParticipant(activeChat);
                      if (!otherParticipant) return null;

                      const statusLabel = getParticipantStatus(otherParticipant);
                      return (
                        <p className="text-[11px] text-textMuted uppercase tracking-wider flex items-center gap-2">
                          <span className={cn(
                            "w-1.5 h-1.5 rounded-full",
                            onlineUsers[otherParticipant.user_id] ? "bg-primary animate-pulse" : "bg-textMuted"
                          )} />
                          {statusLabel}
                        </p>
                      );
                    })()}
                    {activeChat.type === 'group' && (
                      <p className="text-[11px] text-textMuted uppercase tracking-wider flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
                        Members: {activeChat.participants.length}
                      </p>
                    )}
                  </div>
                </div>

                {/* Group Admin Actions */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      setShowSearch(!showSearch);
                      if (!showSearch) setSearchQuery('');
                    }}
                    className={cn(
                      "p-2 bg-surface border border-border rounded-xl text-textMuted hover:text-primary transition-all",
                      showSearch && "border-primary/50 text-primary bg-primary/5"
                    )}
                    title="Search Messages"
                  >
                    <Search className="w-5 h-5" />
                  </button>

                  <button
                    onClick={handleDeleteChat}
                    className="p-2 bg-surface border border-border rounded-xl text-textMuted hover:text-secondary hover:border-secondary/50 hover:bg-secondary/5 transition-all"
                    title={activeChat.type === 'group' ? 'Delete group' : 'Delete chat'}
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>

                  {activeChat.type === 'group' && (
                    <button 
                      onClick={() => setShowGroupSettingsModal(true)}
                      className="flex items-center justify-center w-10 h-10 bg-surface border border-border hover:border-primary/50 hover:bg-primary/5 rounded-xl text-xs text-textMuted hover:text-primary transition-all"
                      title="Group settings"
                    >
                      <MoreHorizontal className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Search Bar Overlay */}
              <AnimatePresence>
                {showSearch && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="border-b border-border/50 bg-[#0a0a0c]/80 backdrop-blur-xl overflow-hidden"
                  >
                    <div className="p-4 max-w-4xl mx-auto space-y-4">
                      <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-textMuted" />
                        <input
                          autoFocus
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Search in conversation..."
                          className="w-full bg-surface border border-border rounded-xl py-3 pl-12 pr-4 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary/50"
                        />
                        {searching && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-primary animate-spin" />}
                      </div>

                      {searchResults.length > 0 && (
                        <div className="max-h-60 overflow-y-auto space-y-2 pb-2 custom-scrollbar">
                          {searchResults.map((result) => (
                            <div 
                              key={result.id}
                              onClick={() => handleJumpToMessage(result.id)}
                              className="p-3 bg-surface/50 border border-border/30 rounded-xl hover:bg-primary/5 hover:border-primary/20 transition-all cursor-pointer group"
                            >
                              <div className="flex items-start justify-between mb-1 gap-3">
                                <div className="flex items-center gap-2 min-w-0">
                                  <div className="w-6 h-6 rounded-full bg-surface border border-border shrink-0 overflow-hidden flex items-center justify-center text-textMuted">
                                    {getMessageAvatarUrl(result) ? (
                                      <img
                                        src={resolveApiUrl(getMessageAvatarUrl(result) || '')}
                                        alt={result.sender_name || 'User avatar'}
                                        className="w-full h-full object-cover"
                                      />
                                    ) : (
                                      <UserIcon className="w-3.5 h-3.5" />
                                    )}
                                  </div>
                                  <span className="text-[10px] font-bold text-primary uppercase tracking-widest truncate">{result.sender_name}</span>
                                </div>
                                <span className="text-[9px] text-textMuted opacity-50 shrink-0">
                                  {new Date(result.timestamp).toLocaleDateString()}
                                </span>
                              </div>
                              <p className="text-xs text-white line-clamp-2">{result.content}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      {searchQuery.trim() && !searching && searchResults.length === 0 && (
                        <div className="text-center py-4 text-textMuted text-sm italic">No matching signals found in this intercept.</div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Messages Area and Participants */}
              <div className="flex-1 flex flex-col md:flex-row gap-4 min-h-0 overflow-hidden">
                {/* Messages Column */}
                <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                  {/* Messages List */}
                  <div className="flex-1 overflow-y-auto p-4 lg:p-8 space-y-6 min-h-0">
                    {loadingHistory ? (
                      <div className="flex h-full items-center justify-center">
                        <Loader2 className="w-8 h-8 text-primary animate-spin" />
                      </div>
                    ) : (
                      messages.map((msg) => {
                        const isMe = msg.sender_id === user?.id;
                        const avatarUrl = getMessageAvatarUrl(msg);
                        return (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            key={msg.id}
                            id={`msg-${msg.id}`}
                            onContextMenu={(e) => handleContextMenu(e, msg)}
                            className={cn("flex w-full items-end gap-2", isMe ? "justify-end" : "justify-start")}
                          >
                            {!isMe && (
                              <div className="relative shrink-0 w-8 h-8 overflow-visible">
                                <div className="w-8 h-8 rounded-full bg-surface border border-border overflow-hidden flex items-center justify-center text-textMuted">
                                  {avatarUrl ? (
                                    <img
                                      src={resolveApiUrl(avatarUrl)}
                                      alt={msg.sender_name || 'User avatar'}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <UserIcon className="w-4 h-4" />
                                  )}
                                </div>
                                {isParticipantOnline(msg.sender_id) && (
                                  <span className="absolute z-10 -bottom-0 -right-0 h-2.5 w-2.5 rounded-full border-2 border-[#0a0a0c] bg-emerald-500 shadow-[0_0_0_2px_rgba(16,185,129,0.2)] pointer-events-none" />
                                )}
                              </div>
                            )}

                            <div
                              className={cn(
                                "max-w-[75%] lg:max-w-[50%] p-4 rounded-2xl relative shadow-lg overflow-hidden transition-all duration-500",
                                isMe
                                  ? "bg-primary text-black rounded-tr-sm"
                                  : "bg-surface border border-border text-white rounded-tl-sm backdrop-blur-md",
                                highlightedMessageId === msg.id && "ring-4 ring-primary ring-offset-4 ring-offset-black scale-105 z-50 shadow-[0_0_30px_rgba(212,255,0,0.4)]"
                              )}
                            >
                              {!isMe && (
                                <div className="text-[10px] font-bold uppercase tracking-widest opacity-60 mb-2">
                                  {msg.sender_name}
                                </div>
                              )}

                              {/* Rich Media Rendering */}
                              {msg.type === 'text' && (
                                <div className="flex flex-col">
                                  <p className="leading-relaxed font-sans text-[15px]">{msg.content}</p>
                                  {msg.is_edited && (
                                    <span className="text-[9px] opacity-40 mt-1 italic text-right">edited</span>
                                  )}
                                </div>
                              )}

                              {msg.type === 'image' && (
                                <img
                                  src={resolveApiUrl(msg.content)}
                                  alt="Uploaded content"
                                  className="rounded-lg max-w-full h-auto border border-black/10 cursor-pointer hover:opacity-90 transition-opacity"
                                  onClick={() =>
                                    window.open(resolveApiUrl(msg.content), '_blank')
                                  }
                                />
                              )}

                              {msg.type === 'file' && (
                                <a
                                  href={resolveApiUrl(msg.content)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={cn(
                                    "flex items-center gap-3 p-3 rounded-xl border transition-all",
                                    isMe
                                      ? "bg-black/10 border-black/10 hover:bg-black/20"
                                      : "bg-white/5 border-border hover:bg-white/10"
                                  )}
                                >
                                  <div
                                    className={cn(
                                      "w-10 h-10 rounded-lg flex items-center justify-center",
                                      isMe ? "bg-black/20" : "bg-primary/20"
                                    )}
                                  >
                                    <FileIcon className={cn("w-5 h-5", isMe ? "text-black" : "text-primary")} />
                                  </div>
                                  <div className="overflow-hidden">
                                    <p className="text-xs font-bold truncate">File Attachment</p>
                                    <p className="text-[10px] opacity-60">Click to Download</p>
                                  </div>
                                </a>
                              )}

                              {msg.type === 'voice' && (
                                <div className="flex items-center gap-3 min-w-[200px]">
                                  <button
                                    onClick={() => {
                                      const audio = new Audio(resolveApiUrl(msg.content));
                                      audio.play();
                                    }}
                                    className={cn(
                                      "w-10 h-10 rounded-full flex items-center justify-center transition-all",
                                      isMe ? "bg-black/20 hover:bg-black/30" : "bg-primary/20 hover:bg-primary/30"
                                    )}
                                  >
                                    <Play className={cn("w-4 h-4 fill-current", isMe ? "text-black" : "text-primary")} />
                                  </button>
                                  <div className="flex-1 h-1.5 bg-black/10 rounded-full overflow-hidden">
                                    <motion.div
                                      initial={{ width: 0 }}
                                      animate={{ width: '100%' }}
                                      transition={{ duration: 2, repeat: Infinity }}
                                      className={cn("h-full", isMe ? "bg-black/40" : "bg-primary/60")}
                                    />
                                  </div>
                                  <Music className="w-3 h-3 opacity-40" />
                                </div>
                              )}

                              <div
                                className={cn(
                                  "text-[9px] mt-2 opacity-50",
                                  isMe ? "text-right text-black/70" : "text-left"
                                )}
                              >
                                {new Date(msg.timestamp).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </div>
                            </div>

                            {isMe && (
                              <div className="relative shrink-0 w-8 h-8 overflow-visible">
                                <div className="w-8 h-8 rounded-full bg-surface border border-border overflow-hidden flex items-center justify-center text-textMuted">
                                  {avatarUrl ? (
                                    <img
                                      src={resolveApiUrl(avatarUrl)}
                                      alt={msg.sender_name || 'User avatar'}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <UserIcon className="w-4 h-4" />
                                  )}
                                </div>
                                {isParticipantOnline(msg.sender_id) && (
                                  <span className="absolute z-10 -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#0a0a0c] bg-emerald-500 shadow-[0_0_0_2px_rgba(16,185,129,0.2)] pointer-events-none" />
                                )}
                              </div>
                            )}
                          </motion.div>
                        );
                      })
                    )}
                    {typingNames.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-primary/20 bg-primary/5 text-primary/90"
                      >
                        <span className="inline-flex gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
                          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" style={{ animationDelay: '0.2s' }}></span>
                          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" style={{ animationDelay: '0.4s' }}></span>
                        </span>
                        <span className="text-xs font-semibold tracking-wide">
                          {typingNames.length === 1
                            ? `${typingNames[0]} is typing...`
                            : `${typingNames.length} users are typing...`}
                        </span>
                      </motion.div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Message Input */}
                  <div className="p-6 bg-[#0a0a0c]/60 backdrop-blur-xl border-t border-border/50">
                    {editingMessage && (
                      <div className="mb-3 flex w-full items-center justify-between px-4 py-2 bg-primary/10 border border-primary/30 rounded-xl">
                        <div className="flex items-center gap-2 text-primary">
                          <Edit3 className="w-4 h-4" />
                          <span className="text-xs font-bold uppercase tracking-widest">Editing Signal Intercept</span>
                        </div>
                        <button onClick={() => { setEditingMessage(null); setNewMessage(''); }} className="text-textMuted hover:text-white">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                    <form onSubmit={handleSend} className="relative flex w-full items-center gap-4">
                  
                  {/* Media Upload Buttons */}
                  <div className="flex items-center gap-2">
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      className="hidden" 
                      onChange={handleFileUpload}
                    />
                    <button 
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="p-3 bg-surface border border-border rounded-xl text-textMuted hover:text-primary hover:border-primary/50 transition-all"
                      title="Attach File"
                    >
                      <Paperclip className="w-5 h-5" />
                    </button>
                    
                    {!isRecording ? (
                      <button 
                        type="button"
                        onClick={startRecording}
                        className="p-3 bg-surface border border-border rounded-xl text-textMuted hover:text-secondary hover:border-secondary/50 transition-all"
                        title="Voice Note"
                      >
                        <Mic className="w-5 h-5" />
                      </button>
                    ) : (
                      <button 
                        type="button"
                        onClick={stopRecording}
                        className="p-3 bg-secondary/20 border border-secondary/50 rounded-xl text-secondary animate-pulse transition-all"
                        title="Stop Recording"
                      >
                        <Square className="w-5 h-5 fill-current" />
                      </button>
                    )}
                  </div>

                  {/* Input or Voice Preview */}
                  <div className="flex-1 relative">
                    {isRecording ? (
                      <div className="w-full bg-secondary/10 border border-secondary/30 rounded-2xl py-4 px-6 flex items-center justify-between text-secondary">
                        <div className="flex items-center gap-3">
                          <span className="w-2 h-2 rounded-full bg-secondary animate-ping"></span>
                          <span className="text-sm font-bold uppercase tracking-widest">Recording Stream...</span>
                        </div>
                        <span className="font-mono text-sm">{Math.floor(recordingDuration / 60)}:{(recordingDuration % 60).toString().padStart(2, '0')}</span>
                      </div>
                    ) : audioBlob ? (
                      <div className="w-full bg-primary/10 border border-primary/30 rounded-2xl py-3 px-6 flex items-center justify-between">
                        <div className="flex items-center gap-3 text-primary">
                          <Music className="w-4 h-4" />
                          <span className="text-sm font-bold uppercase tracking-widest">Voice Packet Ready</span>
                        </div>
                        <div className="flex gap-2">
                          <button 
                            type="button" 
                            onClick={() => setAudioBlob(null)}
                            className="p-2 hover:bg-black/20 rounded-lg text-textMuted transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          <button 
                            type="button" 
                            onClick={submitVoice}
                            className="bg-primary text-black px-4 py-1.5 rounded-lg text-xs font-bold hover:scale-105 transition-all shadow-lg shadow-primary/20"
                          >
                            SEND VOICE
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center pointer-events-none">
                          <MessageSquare className="w-4 h-4 text-primary" />
                        </div>
                        <input
                          type="text"
                          value={newMessage}
                          onChange={handleMessageInputChange}
                          onBlur={stopTyping}
                          placeholder={editingMessage ? "Updating broadcast..." : "Broadcast intercept..."}
                          className={cn(
                            "w-full bg-surface border rounded-2xl py-4 pl-16 pr-16 text-white placeholder-textMuted/40 focus:outline-none transition-all font-sans",
                            editingMessage ? "border-primary/50 ring-1 ring-primary/30" : "border-border focus:ring-1 focus:ring-primary/50"
                          )}
                          autoComplete="off"
                        />
                        <button 
                          type="submit" 
                          disabled={!newMessage.trim()}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-3 bg-primary text-black rounded-xl hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100 transition-all shadow-[0_0_15px_rgba(212,255,0,0.3)]"
                        >
                          <Send className="w-5 h-5" />
                        </button>
                      </>
                    )}
                  </div>
                    </form>
                  </div>
                </div>

              {/* Participants Panel */}
              {activeChat.type === 'group' && showParticipantsPanel && (
                <div className="w-full md:w-72 border-l border-border/50 bg-[#0a0a0c]/40 backdrop-blur-xl flex flex-col max-h-96 md:max-h-full overflow-hidden">
                  <div className="p-4 border-b border-border/50 sticky top-0 bg-black/20">
                    <div className="flex items-center gap-2 text-sm font-semibold text-white">
                      <Users className="w-4 h-4 text-primary" />
                      <span>Members ({activeChat.participants.length})</span>
                    </div>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-3 space-y-2">
                    <AnimatePresence>
                      {activeChat.participants.map((participant) => {
                        const isMe = participant.user_id === user?.id;
                        const isAdmin = participant.role === 'admin';
                        const iAmAdmin = activeChat.participants.find(p => p.user_id === user?.id)?.role === 'admin';
                        
                        return (
                          <motion.div 
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            key={participant.user_id}
                            className="p-3 rounded-lg bg-surface hover:bg-white/5 border border-border/20 transition-all"
                          >
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <div className="relative shrink-0 w-8 h-8 overflow-visible">
                                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center overflow-hidden">
                                    {participant.user.avatar_url ? (
                                      <img
                                        src={resolveApiUrl(participant.user.avatar_url)}
                                        alt={participant.user.full_name || participant.user.email || 'User avatar'}
                                        className="w-full h-full rounded-full object-cover"
                                      />
                                    ) : isAdmin ? (
                                      <Crown className="w-4 h-4 text-primary" />
                                    ) : (
                                      <UserIcon className="w-4 h-4 text-textMuted" />
                                    )}
                                  </div>
                                  {isParticipantOnline(participant.user_id) && (
                                    <span className="absolute z-10 -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#0a0a0c] bg-emerald-500 shadow-[0_0_0_2px_rgba(16,185,129,0.2)] pointer-events-none" />
                                  )}
                                </div>
                                <div className="overflow-hidden flex-1">
                                  <p className="text-xs font-semibold text-white truncate">
                                    {participant.user.full_name || participant.user.email}
                                  </p>
                                  {isMe && <p className="text-[10px] text-primary">You</p>}
                                  {isAdmin && !isMe && <p className="text-[10px] text-secondary">Admin</p>}
                                  {!isMe && (
                                    <p className={cn(
                                      "text-[10px] mt-0.5",
                                      onlineUsers[participant.user_id] ? "text-primary" : "text-textMuted"
                                    )}>
                                      {getParticipantStatus(participant)}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                            
                            {/* Action Buttons (Admin only, not for self) */}
                            {iAmAdmin && !isMe && (
                              <div className="flex gap-2 pt-2 border-t border-border/20">
                                {!isAdmin ? (
                                  <button
                                    onClick={() => handleUpdateRole(participant.user_id, 'admin')}
                                    className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-primary/10 hover:bg-primary/20 border border-primary/30 rounded text-[10px] text-primary transition-all"
                                    title="Promote to admin"
                                  >
                                    <Star className="w-3 h-3" />
                                    <span>Promote</span>
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleUpdateRole(participant.user_id, 'member')}
                                    className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-textMuted/10 hover:bg-textMuted/20 border border-textMuted/30 rounded text-[10px] text-textMuted transition-all"
                                    title="Demote to member"
                                  >
                                    <UserIcon className="w-3 h-3" />
                                    <span>Demote</span>
                                  </button>
                                )}
                                
                                <button
                                  onClick={() => handleRemoveMember(participant.user_id)}
                                  className="flex items-center justify-center px-2 py-1.5 bg-secondary/10 hover:bg-secondary/20 border border-secondary/30 rounded text-[10px] text-secondary transition-all"
                                  title="Remove from chat"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            )}
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </div>
                </div>
              )}
            </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center p-8 relative">
                <motion.div 
                  initial={{ scale: 0.8, opacity: 0 }} 
                  animate={{ scale: 1, opacity: 1 }} 
                  className="w-32 h-32 rounded-full border border-dashed border-border flex items-center justify-center mb-6 relative"
                >
                  <Search className="w-8 h-8 text-textMuted animate-pulse" />
                  <div className="absolute inset-0 bg-primary/5 rounded-full filter blur-xl animate-pulse"></div>
                </motion.div>
                <h2 className="text-2xl font-display text-white mb-2">No Active Chat</h2>
                <p className="text-textMuted max-w-sm">Select a chat from the sidebar or create a new one to begin messaging by searching for a user.</p>
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {assistantTarget && assistantPopoverPosition && (
          <motion.div
            ref={assistantPopoverRef}
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className="fixed z-[160] rounded-3xl border border-border/70 bg-[#09090b]/95 shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-2xl overflow-hidden"
            style={{
              left: assistantPopoverPosition.left + assistantPopoverOffset.x,
              bottom: assistantPopoverPosition.bottom - assistantPopoverOffset.y,
              width: assistantPopoverPosition.width,
              maxHeight: assistantPopoverPosition.maxHeight,
              transform: 'translateX(-50%)',
            }}
          >
            <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3 bg-black/30">
              <div
                className="min-w-0 flex-1 cursor-grab select-none touch-none"
                onPointerDown={startAssistantDrag}
              >
                <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-primary">Assistant</p>
                <p className="text-xs text-textMuted truncate mt-1">
                  Replying to {assistantTarget.sender_name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAssistantExpanded((previous) => !previous)}
                className="shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/80 hover:text-white hover:bg-white/10 transition-all"
                title="Resize assistant window"
              >
                <Maximize2 className={cn("w-4 h-4 transition-transform", assistantExpanded && "rotate-90")} />
              </button>
            </div>

            <div className="flex min-h-0 flex-col" style={{ maxHeight: assistantPopoverPosition.maxHeight }}>
              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 space-y-4 custom-scrollbar">
                <div className="space-y-3">
                  <div className="rounded-2xl border border-border/40 bg-white/5 px-3 py-2 text-xs text-textMuted">
                    {assistantTarget.content}
                  </div>

                  {assistantMessages.map((message) => (
                    <div
                      key={message.id}
                      className={cn(
                        "flex w-full",
                        message.role === 'user' ? 'justify-end' : 'justify-start'
                      )}
                    >
                      {message.role === 'user' ? (
                        <div className="max-w-[85%] rounded-2xl rounded-tr-md bg-primary/15 px-3 py-2 text-sm text-white">
                          {message.content}
                        </div>
                      ) : (
                        <p className="max-w-full text-left text-sm leading-relaxed text-white whitespace-pre-wrap">
                          {message.content}
                        </p>
                      )}
                    </div>
                  ))}

                  {assistantLoading && (
                    <div className="flex items-center gap-2 text-sm text-primary">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Thinking...</span>
                    </div>
                  )}

                  {assistantError && (
                    <p className="text-sm text-secondary">{assistantError}</p>
                  )}

                  <div ref={assistantThreadEndRef} />
                </div>
              </div>

              <form onSubmit={handleAssistantSubmit} className="border-t border-white/10 bg-black/35 p-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <input
                    type="text"
                    value={assistantDraft}
                    onChange={(e) => setAssistantDraft(e.target.value)}
                    placeholder="Ask for assist"
                    className="w-full bg-transparent text-sm text-white placeholder:text-textMuted focus:outline-none"
                    autoComplete="off"
                  />
                </div>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <CreateChatModal 
        isOpen={isCreateModalOpen} 
        onClose={() => setIsCreateModalOpen(false)} 
        onChatCreated={handleChatCreated}
      />

      <Profile
        isOpen={isProfileModalOpen}
        onClose={closeProfileModal}
      />

      <AnimatePresence>
        {confirmationDialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[150] flex items-center justify-center p-4"
          >
            <div
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => setConfirmationDialog(null)}
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 16 }}
              className="relative z-10 w-full max-w-md rounded-3xl border border-border/50 bg-[#0a0a0c]/95 backdrop-blur-2xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-border/50 bg-black/20">
                <h3 className="text-xl font-display font-bold text-white tracking-tight">{confirmationDialog.title}</h3>
                <p className="text-sm text-textMuted mt-2">{confirmationDialog.message}</p>
              </div>

              <div className="p-6 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setConfirmationDialog(null)}
                  className="px-4 py-2 rounded-xl border border-border bg-surface text-sm text-textMuted hover:text-white hover:border-border/80 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleConfirmDialogAction()}
                  className="px-4 py-2 rounded-xl border border-secondary/30 bg-secondary/10 text-sm text-secondary hover:bg-secondary/20 hover:border-secondary/50 transition-all"
                >
                  {confirmationDialog.confirmText}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {activeChat && activeChat.type === 'group' && showGroupSettingsModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] flex items-center justify-center p-4"
          >
            <div
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => setShowGroupSettingsModal(false)}
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 18 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 18 }}
              className="relative z-10 w-full max-w-xl rounded-3xl border border-border/50 bg-[#0a0a0c]/95 backdrop-blur-2xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-border/50 flex items-center justify-between bg-black/20">
                <div>
                  <h3 className="text-2xl font-display font-bold text-white tracking-tight">Group Settings</h3>
                  <p className="text-xs uppercase tracking-widest text-textMuted mt-1">Manage photo and members</p>
                </div>
                <button
                  onClick={() => setShowGroupSettingsModal(false)}
                  className="text-textMuted hover:text-white transition-colors"
                  title="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                {activeChat.participants.find(p => p.user_id === user?.id)?.role === 'admin' && (
                  <input
                    ref={groupPhotoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        void handleGroupPhotoUpload(file);
                      }
                    }}
                  />
                )}

                <div className="flex flex-col items-center gap-4 pb-6 border-b border-border/50">
                  <div className="relative group">
                    <div
                      className={cn(
                        "w-32 h-32 rounded-full border-2 border-dashed border-border flex items-center justify-center overflow-hidden bg-surface transition-all",
                        activeChat.image_url && "border-solid border-primary/30 shadow-[0_0_20px_rgba(212,255,0,0.1)]",
                        !activeChat.image_url && activeChat.participants.find(p => p.user_id === user?.id)?.role === 'admin' && "group-hover:border-primary/50"
                      )}
                    >
                      {activeChat.image_url ? (
                        <img
                          src={resolveApiUrl(activeChat.image_url)}
                          alt={getChatName(activeChat)}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <ImageIcon className="w-12 h-12 text-textMuted" />
                      )}
                    </div>

                    {activeChat.participants.find(p => p.user_id === user?.id)?.role === 'admin' && (
                      <button
                        type="button"
                        onClick={() => groupPhotoInputRef.current?.click()}
                        className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white transition-all rounded-full"
                        title={activeChat.image_url ? 'Change group photo' : 'Add group photo'}
                      >
                        <Upload className="w-6 h-6 mb-1" />
                        <span className="text-[10px] font-bold uppercase tracking-widest">Change</span>
                      </button>
                    )}
                  </div>

                  <div className="text-center">
                    <p className="text-lg font-semibold text-white">{getChatName(activeChat)}</p>
                    <p className="text-xs text-textMuted mt-1">Group avatar and identity</p>
                  </div>

                  {activeChat.participants.find(p => p.user_id === user?.id)?.role === 'admin' && activeChat.image_url && (
                    <button
                      type="button"
                      onClick={handleRemoveGroupPhoto}
                      className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-secondary/30 bg-secondary/10 text-sm text-secondary hover:bg-secondary/20 transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                      Remove Photo
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={toggleParticipantsPanel}
                  className="w-full flex items-center justify-between rounded-2xl border border-border/50 bg-surface/60 px-4 py-4 text-left hover:border-primary/30 hover:bg-primary/5 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                      <Users className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">{showParticipantsPanel ? 'Hide members' : 'Show members'}</p>
                      <p className="text-xs text-textMuted">Open or hide the members panel.</p>
                    </div>
                  </div>
                </button>

                {activeChat.participants.find(p => p.user_id === user?.id)?.role === 'admin' && (
                  <button
                    type="button"
                    onClick={openAddMembers}
                    className="w-full flex items-center justify-between rounded-2xl border border-border/50 bg-surface/60 px-4 py-4 text-left hover:border-primary/30 hover:bg-primary/5 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                        <UserPlus className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">Add members</p>
                        <p className="text-xs text-textMuted">Invite new people to this group.</p>
                      </div>
                    </div>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleLeaveChat}
                  className="w-full flex items-center justify-between rounded-2xl border border-secondary/30 bg-secondary/10 px-4 py-4 text-left hover:border-secondary/50 hover:bg-secondary/20 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-secondary/15 border border-secondary/20 flex items-center justify-center text-secondary">
                      <LogOut className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">Leave group</p>
                      <p className="text-xs text-textMuted">Exit this chat.</p>
                    </div>
                  </div>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {activeChat && (
        <AddMemberModal
          isOpen={isAddMemberModalOpen}
          onClose={() => setIsAddMemberModalOpen(false)}
          chatId={activeChat.id}
          onMembersAdded={handleMembersAdded}
          existingParticipantIds={activeChat.participants.map(p => p.user_id)}
        />
      )}

      {/* Context Menu */}
      <AnimatePresence>
        {contextMenu && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            style={{ top: contextMenu.y, left: contextMenu.x }}
            className="fixed z-[100] min-w-[160px] bg-[#0a0a0c]/90 backdrop-blur-2xl border border-white/10 rounded-xl shadow-2xl overflow-hidden p-1.5"
          >
            {contextMessage && contextMessage.sender_id !== user?.id && (
              <button
                onClick={() => void openAssistantForMessage(contextMessage)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-textMuted hover:text-primary hover:bg-white/5 transition-all text-left"
              >
                <MessageSquare className="w-4 h-4" />
                <span>How to answer?</span>
              </button>
            )}
            {contextMessage && contextMessage.sender_id !== user?.id && (
              <div className="h-px bg-white/5 my-1 mx-1" />
            )}
            {contextMessage && contextMessage.sender_id === user?.id && (
              <button
                onClick={() => startEdit(contextMessage)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-textMuted hover:text-primary hover:bg-white/5 transition-all text-left"
              >
                <Edit3 className="w-4 h-4" />
                <span>Edit Message</span>
              </button>
            )}
            {contextMessage && contextMessage.sender_id === user?.id && (
              <div className="h-px bg-white/5 my-1 mx-1" />
            )}
            {contextMessage && contextMessage.sender_id === user?.id && (
              <button
                onClick={() => deleteMessage(contextMenu.messageId)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-textMuted hover:text-secondary hover:bg-secondary/5 transition-all text-left"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete Securely</span>
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
