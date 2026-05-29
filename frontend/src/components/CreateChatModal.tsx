import React, { useRef, useState } from 'react';
import { X, Users, MessageSquare, Shield, Loader2, Info, Image as ImageIcon, Trash2 } from 'lucide-react';
import UserSearch from './UserSearch';
import { useAuthStore } from '../store/useAuthStore';
import { apiUrl, resolveApiUrl } from '../lib/api';
import { cn } from '../lib/utils';

interface User {
  id: number;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
}

interface CreateChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  onChatCreated: (chat: Chat) => void;
}

interface ChatParticipant {
  user_id: number;
  role: string;
  joined_at: string;
  user: User;
}

interface Chat {
  id: number;
  type: 'private' | 'group';
  name: string | null;
  image_url: string | null;
  created_at: string;
  participants: ChatParticipant[];
}

export default function CreateChatModal({ isOpen, onClose, onChatCreated }: CreateChatModalProps) {
  const { token } = useAuthStore();
  const [type, setType] = useState<'private' | 'group'>('private');
  const [name, setName] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const groupImageInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (type === 'group' && !name.trim()) {
      setError("Group name is required");
      return;
    }
    if (selectedUsers.length === 0) {
      setError("Select at least one operative");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(apiUrl('/api/v1/chats/'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          type,
          name: type === 'group' ? name : null,
          image_url: type === 'group' ? imageUrl || null : null,
          participant_emails: selectedUsers.map(u => u.email)
        })
      });

      if (res.ok) {
        const newChat = await res.json();
        onChatCreated(newChat);
        onClose();
        // Reset
        setName('');
        setImageUrl('');
        setSelectedUsers([]);
        setType('private');
      } else {
        const data = await res.json();
        setError(data.detail || "Failed to establish line");
      }
    } catch {
      setError("Network failure. Connection lost.");
    } finally {
      setLoading(false);
    }
  };

  const handleGroupImageUpload = async (file: File) => {
    if (!token) return;

    setUploadingImage(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(apiUrl('/api/v1/upload/'), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Upload failed');
      }

      const data = await res.json();
      setImageUrl(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload group photo');
    } finally {
      setUploadingImage(false);
      if (groupImageInputRef.current) {
        groupImageInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300" 
        onClick={onClose}
      />
      
      <div className="glass-panel w-full max-w-lg relative z-10 overflow-hidden animate-in fade-in zoom-in slide-in-from-bottom-4 duration-300">
        <div className="p-6 border-b border-border/50 flex justify-between items-center bg-black/20">
          <div>
            <h2 className="text-xl font-display font-bold text-white tracking-tight">Create New Chat</h2>
          </div>
          <button onClick={onClose} className="text-textMuted hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleCreate} className="p-6 space-y-6">
          {/* Protocol Type Selection */}
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => { setType('private'); setSelectedUsers(prev => prev.slice(0, 1)); }}
              className={cn(
                "flex-1 flex items-center gap-3 p-4 rounded-xl border transition-all text-left",
                type === 'private' 
                  ? "bg-primary/10 border-primary/40 text-primary shadow-[0_0_15px_rgba(212,255,0,0.1)]" 
                  : "bg-surface border-transparent hover:border-border text-textMuted"
              )}
            >
              <MessageSquare className="w-5 h-5" />
              <div>
                <p className="text-sm font-bold">Private Chat</p>
                <p className="text-[10px] opacity-60">1:1 Direct Message</p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setType('group')}
              className={cn(
                "flex-1 flex items-center gap-3 p-4 rounded-xl border transition-all text-left",
                type === 'group' 
                  ? "bg-secondary/10 border-secondary/40 text-secondary shadow-[0_0_15px_rgba(255,0,85,0.1)]" 
                  : "bg-surface border-transparent hover:border-border text-textMuted"
              )}
            >
              <Users className="w-5 h-5" />
              <div>
                <p className="text-sm font-bold">Group Chat</p>
                <p className="text-[10px] opacity-60">Multi-User Conversation</p>
              </div>
            </button>
          </div>

          {/* Group Name (Only for GROUP) */}
          {type === 'group' && (
            <div className="space-y-2 animate-in slide-in-from-top-2 duration-300">
              <label className="text-xs font-bold text-textMuted uppercase tracking-wider ml-1">Frequency Identifier (Name)</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter cluster name..."
                className="w-full bg-surface border border-border rounded-xl py-3 px-4 text-sm text-white placeholder-textMuted/40 focus:outline-none focus:ring-1 focus:ring-secondary/50 transition-all"
              />
            </div>
          )}

          {type === 'group' && (
            <div className="space-y-2 animate-in slide-in-from-top-2 duration-300">
              <label className="text-xs font-bold text-textMuted uppercase tracking-wider ml-1">Group Photo</label>
              <input
                ref={groupImageInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    void handleGroupImageUpload(file);
                  }
                }}
              />

              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => groupImageInputRef.current?.click()}
                  disabled={uploadingImage}
                  className={cn(
                    "w-16 h-16 rounded-2xl border border-dashed border-border flex items-center justify-center overflow-hidden bg-surface text-textMuted transition-all",
                    imageUrl && "border-solid border-primary/30",
                    !uploadingImage && "hover:border-primary/50 hover:text-primary"
                  )}
                  title="Upload group photo"
                >
                  {uploadingImage ? (
                    <Loader2 className="w-5 h-5 animate-spin text-primary" />
                  ) : imageUrl ? (
                    <img
                      src={resolveApiUrl(imageUrl)}
                      alt="Group preview"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <ImageIcon className="w-5 h-5" />
                  )}
                </button>

                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white font-medium">
                    {imageUrl ? 'Photo ready' : 'Add a group cover'}
                  </p>
                  <p className="text-[10px] text-textMuted mt-1">
                    JPG, PNG or WebP. Used as the group avatar.
                  </p>
                </div>

                {imageUrl && (
                  <button
                    type="button"
                    onClick={() => setImageUrl('')}
                    className="p-2 rounded-xl bg-secondary/10 text-secondary border border-secondary/20 hover:bg-secondary/20 transition-all"
                    title="Remove photo"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* User Search */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-textMuted uppercase tracking-wider ml-1">Target Operatives</label>
            <UserSearch 
              onSelect={(u) => setSelectedUsers(prev => type === 'private' ? [u] : [...prev, u])}
              selectedUsers={selectedUsers}
              onRemove={(id) => setSelectedUsers(prev => prev.filter(u => u.id !== id))}
              multiSelect={type === 'group'}
              placeholder={type === 'private' ? "Identify target..." : "Add operatives to node..."}
            />
          </div>

          {error && (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-secondary/10 border border-secondary/20 text-secondary text-xs">
              <Info className="w-4 h-4 shrink-0" />
              <p>{error}</p>
            </div>
          )}

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className={cn(
                "w-full flex items-center justify-center gap-2 font-bold py-4 rounded-xl transition-all shadow-lg",
                type === 'private' 
                  ? "bg-primary text-black hover:shadow-primary/30 shadow-primary/10" 
                  : "bg-secondary text-white hover:shadow-secondary/30 shadow-secondary/10"
              )}
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Shield className="w-5 h-5" />
                  Create Chat
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
