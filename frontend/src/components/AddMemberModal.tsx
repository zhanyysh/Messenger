import React, { useState } from 'react';
import { X, UserPlus, Loader2, Info } from 'lucide-react';
import UserSearch from './UserSearch';
import { useAuthStore } from '../store/useAuthStore';
import { apiUrl } from '../lib/api';

interface User {
  id: number;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
}

interface AddMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  chatId: number;
  onMembersAdded: (newMembers: any[]) => void;
  existingParticipantIds: number[];
}

export default function AddMemberModal({ 
  isOpen, 
  onClose, 
  chatId, 
  onMembersAdded,
  existingParticipantIds
}: AddMemberModalProps) {
  const { token } = useAuthStore();
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedUsers.length === 0) {
      setError("Identify at least one target operative.");
      return;
    }

    setLoading(true);
    setError(null);

    const results: any[] = [];
    let failureCount = 0;

    try {
      // The current API supports adding one by one
      for (const user of selectedUsers) {
        const res = await fetch(apiUrl(`/api/v1/chats/${chatId}/members`), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            user_id: user.id,
            role: "member"
          })
        });

        if (res.ok) {
          const newMember = await res.json();
          results.push(newMember);
        } else {
          failureCount++;
        }
      }

      if (results.length > 0) {
        onMembersAdded(results);
      }

      if (failureCount === 0) {
        onClose();
        setSelectedUsers([]);
      } else {
        setError(`Failed to synchronize ${failureCount} operative(s). Access denied or node error.`);
      }
    } catch {
      setError("Network failure. Intercept lost.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-md animate-in fade-in duration-300" 
        onClick={onClose}
      />
      
      <div className="glass-panel w-full max-w-md relative z-10 overflow-hidden animate-in fade-in zoom-in slide-in-from-bottom-4 duration-300">
        <div className="p-6 border-b border-border/50 flex justify-between items-center bg-primary/5">
          <div>
            <h2 className="text-xl font-display font-bold text-white tracking-tight">Expand Node</h2>
            <p className="text-xs text-primary uppercase tracking-[0.2em] mt-1 font-semibold">Authorized Personnel Only</p>
          </div>
          <button onClick={onClose} className="text-textMuted hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleAdd} className="p-6 space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-textMuted uppercase tracking-wider ml-1">New Operatives</label>
            <UserSearch 
              onSelect={(u) => setSelectedUsers(prev => [...prev, u])}
              selectedUsers={selectedUsers}
              onRemove={(id) => setSelectedUsers(prev => prev.filter(u => u.id !== id))}
              multiSelect={true}
              excludeIds={existingParticipantIds}
              placeholder="Search by identifier..."
            />
            <p className="text-[9px] text-textMuted italic ml-1 pt-1">Note: Only non-registered operatives in this node will be displayed.</p>
          </div>

          {error && (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-secondary/10 border border-secondary/20 text-secondary text-[11px]">
              <Info className="w-4 h-4 shrink-0" />
              <p>{error}</p>
            </div>
          )}

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading || selectedUsers.length === 0}
              className="w-full flex items-center justify-center gap-2 bg-primary text-black font-bold py-4 rounded-xl transition-all shadow-lg hover:shadow-primary/30 shadow-primary/10 disabled:opacity-50 disabled:grayscale"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <UserPlus className="w-5 h-5" />
                  SYNCHRONIZE TO NODE
                </>
              )}
            </button>
            <button 
              type="button"
              onClick={onClose}
              className="w-full mt-3 text-[10px] font-bold text-textMuted uppercase tracking-widest hover:text-white transition-all py-2"
            >
              Abort Mission
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
