import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, LogOut, Plus, MessageSquare, Hash, User as UserIcon, Loader2, Search, UserPlus, Paperclip, Mic, File as FileIcon, Play, Square, Music, Trash2 } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { useNavigate } from 'react-router-dom';
import { cn } from '../lib/utils.ts';
import CreateChatModal from '../components/CreateChatModal';

interface ChatParticipant {
  user_id: number;
  role: string;
  joined_at: string;
  user: {
    id: number;
    email: string;
    full_name: string | null;
  };
}

interface Chat {
  id: number;
  type: 'private' | 'group';
  name: string | null;
  created_at: string;
  participants: ChatParticipant[];
}

interface Message {
  id: number;
  content: string;
  type: 'text' | 'image' | 'file' | 'voice';
  sender_id: number;
  sender_name: string;
  timestamp: string;
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
  };
}

interface SearchUser {
  id: number;
  email: string;
  full_name: string | null;
}

export default function ChatDashboard() {
  const { token, user, logout } = useAuthStore();
  const navigate = useNavigate();
  
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChat, setActiveChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const handleUnauthorized = React.useCallback(() => {
    logout();
    navigate('/login', { replace: true });
  }, [logout, navigate]);

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

  // Initialize Chats
  useEffect(() => {
    const loadChats = async () => {
      const res = await authFetch('http://127.0.0.1:8000/api/v1/chats/');
      if (!res) return;

      const data = await res.json();
      setChats(data);
      if (data.length > 0) {
        setLoadingHistory(true);
        setActiveChat(data[0]);
      }
    };

    loadChats();
  }, [authFetch]);

  // Connect WebSockets when active chat changes
  useEffect(() => {
    if (!activeChat) return;

    const loadMessages = async () => {
      const res = await authFetch(`http://127.0.0.1:8000/api/v1/chats/${activeChat.id}/messages`);
      if (!res) {
        setLoadingHistory(false);
        return;
      }

      const data: HistoryMessageApi[] = await res.json();
      // Map API history data layout to strictly match our standardized Message format
      const history: Message[] = data.map((d) => ({
        id: d.id, content: d.content, sender_id: d.sender_id, timestamp: d.timestamp,
        type: d.type,
        sender_name: d.sender?.full_name || d.sender?.email || "Unknown"
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

    const socket = new WebSocket(`ws://127.0.0.1:8000/ws/chat/${activeChat.id}?token=${token}`);
    
    socket.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      setMessages(prev => [...prev, msg]);
    };

    wsRef.current = socket;

    return () => {
      socket.close();
      wsRef.current = null;
    };
  }, [activeChat, token, authFetch, handleUnauthorized]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (wsRef.current && newMessage.trim()) {
      wsRef.current.send(newMessage);
      setNewMessage('');
    }
  };

  const handleChatCreated = (newChat: Chat) => {
    setChats([newChat, ...chats]);
    setLoadingHistory(true);
    setActiveChat(newChat);
  };

  const handleAddMember = async () => {
    if (!activeChat || activeChat.type !== 'group') return;
    
    const email = prompt("Direct Invite: Enter the exact identifier of the new operative.");
    if (!email) return;

    // First find the user
    try {
      const searchRes = await authFetch(`http://127.0.0.1:8000/api/v1/users/search?query=${encodeURIComponent(email)}`);
      if (!searchRes) return;
      const users: SearchUser[] = await searchRes.json();
      const targetUser = users.find((u) => u.email === email);
      
      if (!targetUser) {
        alert("Operative not found in registry.");
        return;
      }

      const res = await authFetch(`http://127.0.0.1:8000/api/v1/chats/${activeChat.id}/members`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          user_id: targetUser.id,
          role: "member"
        })
      });
      if (!res) return;
      
      if (res.ok) {
        const newMember = await res.json();
        const updatedChat = {
          ...activeChat,
          participants: [...activeChat.participants, newMember]
        };
        setActiveChat(updatedChat);
        setChats(prev => prev.map(c => c.id === updatedChat.id ? updatedChat : c));
        alert("Operative successfully synchronized to node.");
      } else {
        const err = await res.json();
        alert(err.detail || "Access denied or synchronization failed.");
      }
    } catch {
      alert("Network failure during synchronization.");
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !wsRef.current) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await authFetch('http://127.0.0.1:8000/api/v1/upload/', {
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
      alert("Mic access denied.");
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
      const res = await authFetch('http://127.0.0.1:8000/api/v1/upload/', {
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

  // Helper to get chat name (If private, show other person's name)
  const getChatName = (chat: Chat) => {
    if (chat.type === 'group' && chat.name) return chat.name;
    const otherParticipant = chat.participants.find(p => p.user_id !== user?.id);
    return otherParticipant?.user.full_name || otherParticipant?.user.email || "Unknown Agent";
  };

  return (
    <div className="flex h-screen w-full p-2 lg:p-6 relative overflow-hidden">
      {/* Background Animated Blobs */}
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none mix-blend-screen opacity-20">
        <div className="absolute top-10 left-10 w-[500px] h-[500px] bg-primary/30 rounded-full filter blur-[150px] animate-blob"></div>
        <div className="absolute bottom-10 right-10 w-[600px] h-[600px] bg-secondary/30 rounded-full filter blur-[150px] animate-blob" style={{ animationDelay: '2s' }}></div>
      </div>

      <div className="glass-panel w-full max-w-7xl mx-auto h-full flex flex-col md:flex-row z-10 relative overflow-hidden shadow-2xl">
        
        {/* SIDEBAR */}
        <div className="w-full md:w-80 border-r border-border/50 bg-[#0a0a0c]/40 backdrop-blur-3xl flex flex-col relative z-20">
          
          {/* Header */}
          <div className="p-6 border-b border-border/50 flex justify-between items-center bg-black/20">
            <div>
              <h1 className="text-2xl font-display font-bold text-gradient tracking-tighter">GLSMSG</h1>
              <p className="text-[10px] text-textMuted uppercase tracking-widest mt-1">Node: {user?.full_name || user?.email}</p>
            </div>
            <button onClick={handleLogout} className="text-textMuted hover:text-secondary transition-colors" title="Disconnect">
              <LogOut className="w-5 h-5" />
            </button>
          </div>

          <div className="p-4 border-b border-border/50">
            <button onClick={() => setIsCreateModalOpen(true)} className="w-full flex items-center justify-center gap-2 bg-surface hover:bg-white/5 border border-border rounded-xl p-3 text-sm text-white transition-all">
              <Plus className="w-4 h-4 text-primary" />
              New Secure Line
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
                return (
                  <motion.div 
                    initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                    key={chat.id} 
                    onClick={() => {
                      setLoadingHistory(true);
                      setActiveChat(chat);
                    }}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all border",
                      isActive 
                        ? "bg-primary/10 border-primary/30 shadow-[0_0_15px_rgba(212,255,0,0.1)]" 
                        : "bg-surface border-transparent hover:border-border hover:bg-white/5"
                    )}
                  >
                    <div className={cn("w-10 h-10 rounded-full flex items-center justify-center shrink-0 border", isActive ? "bg-primary/20 border-primary/50 text-primary" : "bg-black/50 border-border text-textMuted")}>
                      {chat.type === 'group' ? <Hash className="w-5 h-5" /> : <UserIcon className="w-5 h-5" />}
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <h3 className={cn("text-sm font-semibold truncate", isActive ? "text-primary" : "text-white")}>
                        {getChatName(chat)}
                      </h3>
                      <p className="text-xs text-textMuted truncate">Connected securely.</p>
                    </div>
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
                  <div className="w-12 h-12 bg-surface border border-border rounded-xl flex items-center justify-center text-white">
                    {activeChat.type === 'group' ? <Hash className="w-6 h-6" /> : <UserIcon className="w-6 h-6" />}
                  </div>
                  <div>
                    <h2 className="text-xl font-display font-semibold text-white tracking-tight">{getChatName(activeChat)}</h2>
                    <p className="text-[11px] text-textMuted uppercase tracking-wider flex items-center gap-2">
                       <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
                       Encrypted UDP Stream
                    </p>
                  </div>
                </div>

                {/* Group Admin Actions */}
                {activeChat.type === 'group' && activeChat.participants.find(p => p.user_id === user?.id)?.role === 'admin' && (
                  <button 
                    onClick={handleAddMember}
                    className="flex items-center gap-2 px-4 py-2 bg-surface border border-border hover:border-primary/50 hover:bg-primary/5 rounded-xl text-xs text-textMuted hover:text-primary transition-all"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>Add Operative</span>
                  </button>
                )}
              </div>

              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto p-4 lg:p-8 space-y-6">
                {loadingHistory ? (
                  <div className="flex h-full items-center justify-center">
                    <Loader2 className="w-8 h-8 text-primary animate-spin" />
                  </div>
                ) : (
                  messages.map((msg, idx) => {
                    const isMe = msg.sender_id === user?.id;
                    return (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        key={idx} 
                        className={cn("flex w-full", isMe ? "justify-end" : "justify-start")}
                      >
                        <div className={cn(
                          "max-w-[75%] lg:max-w-[50%] p-4 rounded-2xl relative shadow-lg overflow-hidden",
                          isMe 
                            ? "bg-primary text-black rounded-tr-sm" 
                            : "bg-surface border border-border text-white rounded-tl-sm backdrop-blur-md"
                        )}>
                          {!isMe && <div className="text-[10px] font-bold uppercase tracking-widest opacity-60 mb-2">{msg.sender_name}</div>}
                          
                          {/* Rich Media Rendering */}
                          {msg.type === 'text' && <p className="leading-relaxed font-sans text-[15px]">{msg.content}</p>}
                          
                          {msg.type === 'image' && (
                            <img 
                              src={`http://127.0.0.1:8000${msg.content}`} 
                              alt="Uploaded content" 
                              className="rounded-lg max-w-full h-auto border border-black/10 cursor-pointer hover:opacity-90 transition-opacity"
                              onClick={() => window.open(`http://127.0.0.1:8000${msg.content}`, '_blank')}
                            />
                          )}

                          {msg.type === 'file' && (
                            <a 
                              href={`http://127.0.0.1:8000${msg.content}`} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className={cn(
                                "flex items-center gap-3 p-3 rounded-xl border transition-all",
                                isMe ? "bg-black/10 border-black/10 hover:bg-black/20" : "bg-white/5 border-border hover:bg-white/10"
                              )}
                            >
                              <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", isMe ? "bg-black/20" : "bg-primary/20")}>
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
                                  const audio = new Audio(`http://127.0.0.1:8000${msg.content}`);
                                  audio.play();
                                }}
                                className={cn("w-10 h-10 rounded-full flex items-center justify-center transition-all", isMe ? "bg-black/20 hover:bg-black/30" : "bg-primary/20 hover:bg-primary/30")}
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

                          <div className={cn("text-[9px] mt-2 opacity-50", isMe ? "text-right text-black/70" : "text-left")}>
                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      </motion.div>
                    )
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input */}
              <div className="p-6 bg-[#0a0a0c]/60 backdrop-blur-xl border-t border-border/50">
                <form onSubmit={handleSend} className="relative flex items-center max-w-4xl mx-auto gap-4">
                  
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
                          onChange={(e) => setNewMessage(e.target.value)}
                          placeholder="Broadcast intercept..."
                          className="w-full bg-surface border border-border rounded-2xl py-4 pl-16 pr-16 text-white placeholder-textMuted/40 focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all font-sans"
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
                <h2 className="text-2xl font-display text-white mb-2">No active intercepts.</h2>
                <p className="text-textMuted max-w-sm">Select a line from the sidebar or establish a secure connection using the Target Identifier to begin broadcasting.</p>
            </div>
          )}
        </div>
      </div>

      <CreateChatModal 
        isOpen={isCreateModalOpen} 
        onClose={() => setIsCreateModalOpen(false)} 
        onChatCreated={handleChatCreated}
      />
    </div>
  );
}
