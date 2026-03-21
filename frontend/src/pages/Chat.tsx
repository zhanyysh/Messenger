import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, LogOut, Plus, MessageSquare, Hash, User as UserIcon, Loader2, Search } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { useNavigate } from 'react-router-dom';
import { cn } from '../lib/utils';

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
  type: 'PRIVATE' | 'GROUP';
  name: string | null;
  created_at: string;
  participants: ChatParticipant[];
}

interface Message {
  id: number;
  content: string;
  sender_id: number;
  sender_name: string;
  timestamp: string;
}

export default function ChatDashboard() {
  const { token, user, logout } = useAuthStore();
  const navigate = useNavigate();
  
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChat, setActiveChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize Chats
  useEffect(() => {
    fetch('http://127.0.0.1:8000/api/v1/chats/', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => res.json())
    .then(data => {
      setChats(data);
      if (data.length > 0) setActiveChat(data[0]);
    });
  }, [token]);

  // Connect WebSockets when active chat changes
  useEffect(() => {
    if (!activeChat) return;

    setLoadingHistory(true);
    fetch(`http://127.0.0.1:8000/api/v1/chats/${activeChat.id}/messages`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => res.json())
    .then(data => {
      // Map API history data layout to strictly match our standardized Message format
      const history = data.map((d: any) => ({
        id: d.id, content: d.content, sender_id: d.sender_id, timestamp: d.timestamp,
        sender_name: d.sender?.full_name || d.sender?.email || "Unknown"
      }));
      setMessages(history);
      setLoadingHistory(false);
    });

    // Close existing socket if any
    if (ws) ws.close();

    const socket = new WebSocket(`ws://127.0.0.1:8000/ws/chat/${activeChat.id}?token=${token}`);
    
    socket.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      setMessages(prev => [...prev, msg]);
    };

    setWs(socket);

    return () => socket.close();
  }, [activeChat, token]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (ws && newMessage.trim()) {
      ws.send(newMessage);
      setNewMessage('');
    }
  };

  const handleCreateChat = async () => {
    const email = prompt("Establish secure line: Enter the exact email of the target operative.");
    if (!email) return;

    const res = await fetch('http://127.0.0.1:8000/api/v1/chats/', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        type: "PRIVATE",
        name: null,
        participant_emails: [email]
      })
    });
    
    if (res.ok) {
      const newChat = await res.json();
      setChats([newChat, ...chats]);
      setActiveChat(newChat);
    } else {
      alert("Failed to establish line. Ensure the identifier exists.");
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Helper to get chat name (If private, show other person's name)
  const getChatName = (chat: Chat) => {
    if (chat.type === 'GROUP' && chat.name) return chat.name;
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
            <button onClick={handleCreateChat} className="w-full flex items-center justify-center gap-2 bg-surface hover:bg-white/5 border border-border rounded-xl p-3 text-sm text-white transition-all">
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
                    onClick={() => setActiveChat(chat)}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all border",
                      isActive 
                        ? "bg-primary/10 border-primary/30 shadow-[0_0_15px_rgba(212,255,0,0.1)]" 
                        : "bg-surface border-transparent hover:border-border hover:bg-white/5"
                    )}
                  >
                    <div className={cn("w-10 h-10 rounded-full flex items-center justify-center shrink-0 border", isActive ? "bg-primary/20 border-primary/50 text-primary" : "bg-black/50 border-border text-textMuted")}>
                      {chat.type === 'GROUP' ? <Hash className="w-5 h-5" /> : <UserIcon className="w-5 h-5" />}
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
              <div className="h-20 border-b border-border/50 px-8 flex items-center bg-[#0a0a0c]/60 backdrop-blur-md sticky top-0 z-10 shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-surface border border-border rounded-xl flex items-center justify-center text-white">
                    {activeChat.type === 'GROUP' ? <Hash className="w-6 h-6" /> : <UserIcon className="w-6 h-6" />}
                  </div>
                  <div>
                    <h2 className="text-xl font-display font-semibold text-white tracking-tight">{getChatName(activeChat)}</h2>
                    <p className="text-[11px] text-textMuted uppercase tracking-wider flex items-center gap-2">
                       <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
                       Encrypted UDP Stream
                    </p>
                  </div>
                </div>
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
                          "max-w-[75%] lg:max-w-[50%] p-4 rounded-2xl relative shadow-lg",
                          isMe 
                            ? "bg-primary text-black rounded-tr-sm" 
                            : "bg-surface border border-border text-white rounded-tl-sm backdrop-blur-md"
                        )}>
                          {!isMe && <div className="text-[10px] font-bold uppercase tracking-widest opacity-60 mb-1">{msg.sender_name}</div>}
                          <p className="leading-relaxed font-sans text-[15px]">{msg.content}</p>
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
                <form onSubmit={handleSend} className="relative flex items-center max-w-4xl mx-auto">
                  <div className="absolute left-4 w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
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
                    className="absolute right-2 p-3 bg-primary text-black rounded-xl hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100 transition-all shadow-[0_0_15px_rgba(212,255,0,0.3)]"
                  >
                    <Send className="w-5 h-5" />
                  </button>
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
    </div>
  );
}
