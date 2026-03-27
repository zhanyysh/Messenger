import { useState, useEffect } from 'react';
import { Search, User as UserIcon, X, Check, Loader2 } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { cn } from '../lib/utils.ts';

interface User {
  id: number;
  email: string;
  full_name: string | null;
}

interface UserSearchProps {
  onSelect: (user: User) => void;
  selectedUsers: User[];
  onRemove: (userId: number) => void;
  placeholder?: string;
  multiSelect?: boolean;
}

export default function UserSearch({ 
  onSelect, 
  selectedUsers, 
  onRemove, 
  placeholder = "Search operatives...",
  multiSelect = true
}: UserSearchProps) {
  const { token } = useAuthStore();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (query.length < 1) {
        setResults([]);
        return;
      }

      setLoading(true);
      try {
        const res = await fetch(`http://127.0.0.1:8000/api/v1/users/search?query=${encodeURIComponent(query)}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setResults(data);
        }
      } catch (err) {
        console.error("Search failed", err);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, token]);

  const handleSelect = (user: User) => {
    if (!multiSelect && selectedUsers.length > 0) {
      onRemove(selectedUsers[0].id);
    }
    
    if (!selectedUsers.find(u => u.id === user.id)) {
      onSelect(user);
    }
    setQuery('');
    setShowResults(false);
  };

  return (
    <div className="space-y-4">
      {/* Selected Chips */}
      {selectedUsers.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedUsers.map(user => (
            <div 
              key={user.id} 
              className="flex items-center gap-2 bg-primary/20 border border-primary/30 text-primary px-3 py-1.5 rounded-full text-xs font-medium animate-in fade-in zoom-in duration-200"
            >
              <span>{user.full_name || user.email}</span>
              <button 
                onClick={() => onRemove(user.id)}
                className="hover:bg-primary/20 rounded-full p-0.5 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input Field */}
      <div className="relative">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-textMuted">
          {loading ? <Loader2 className="w-4 h-4 animate-spin text-primary" /> : <Search className="w-4 h-4" />}
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShowResults(true);
          }}
          onFocus={() => setShowResults(true)}
          placeholder={placeholder}
          className="w-full bg-surface border border-border rounded-xl py-3 pl-12 pr-4 text-sm text-white placeholder-textMuted/40 focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all"
        />

        {/* Results Dropdown */}
        {showResults && (query.length > 0 || results.length > 0) && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-[#0a0a0c] border border-border rounded-xl shadow-2xl z-50 max-h-60 overflow-y-auto overflow-x-hidden backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-200">
            {results.length > 0 ? (
              <div className="p-2 space-y-1">
                {results.map(user => {
                  const isSelected = selectedUsers.some(u => u.id === user.id);
                  return (
                    <button
                      key={user.id}
                      onClick={() => handleSelect(user)}
                      disabled={isSelected}
                      className={cn(
                        "w-full flex items-center justify-between p-3 rounded-lg text-left transition-all",
                        isSelected 
                          ? "opacity-50 cursor-default bg-white/5" 
                          : "hover:bg-white/5 group"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-surface border border-border flex items-center justify-center text-textMuted group-hover:text-primary group-hover:border-primary/50 transition-colors">
                          <UserIcon className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white">{user.full_name || "Anonymous Operative"}</p>
                          <p className="text-xs text-textMuted">{user.email}</p>
                        </div>
                      </div>
                      {isSelected && <Check className="w-4 h-4 text-primary" />}
                    </button>
                  );
                })}
              </div>
            ) : !loading && query.length > 0 ? (
              <div className="p-8 text-center">
                <p className="text-sm text-textMuted">No operatives found matching "{query}"</p>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
