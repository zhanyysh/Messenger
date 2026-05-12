import { useEffect, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Save, UserRound, Camera, Upload, Trash2 } from 'lucide-react';
import { apiUrl, resolveApiUrl } from '../lib/api';
import { useAuthStore } from '../store/useAuthStore';
import { cn } from '../lib/utils';

interface ProfileResponse {
  id: number;
  username: string | null;
  email: string;
  full_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  last_seen: string | null;
}

interface ProfileProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export default function Profile({ isOpen, onClose }: ProfileProps) {
  const navigate = useNavigate();
  const { token, user, updateUser, logout } = useAuthStore();

  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const isModal = isOpen !== undefined;

  useEffect(() => {
    const loadProfile = async () => {
      if (!token) {
        navigate('/login', { replace: true });
        return;
      }

      try {
        const res = await fetch(apiUrl('/api/v1/users/me'), {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.status === 401 || res.status === 403) {
          logout();
          navigate('/login', { replace: true });
          return;
        }

        if (!res.ok) {
          throw new Error('Failed to load profile');
        }

        const data: ProfileResponse = await res.json();
        setUsername(data.username ?? '');
        setFullName(data.full_name ?? '');
        setBio(data.bio ?? '');
        setAvatarUrl(data.avatar_url ?? '');
      } catch (err: unknown) {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError('Failed to load profile');
        }
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [token, navigate, logout]);

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;

    setUploadingAvatar(true);
    setError('');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(apiUrl('/api/v1/upload/'), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.detail || 'Upload failed');
      }

      const data = await res.json();
      setAvatarUrl(data.url);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to upload image');
      }
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    if (!token) {
      navigate('/login', { replace: true });
      return;
    }

    try {
      const res = await fetch(apiUrl('/api/v1/users/me'), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          username: username.trim() || null,
          full_name: fullName.trim() || null,
          bio: bio.trim() || null,
          avatar_url: avatarUrl.trim() || null,
        }),
      });

      if (res.status === 401 || res.status === 403) {
        logout();
        navigate('/login', { replace: true });
        return;
      }

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.detail || 'Failed to save profile');
      }

      const updated: ProfileResponse = await res.json();
      updateUser({
        id: updated.id,
        username: updated.username,
        email: updated.email,
        full_name: updated.full_name,
        bio: updated.bio,
        avatar_url: updated.avatar_url,
        last_seen: updated.last_seen,
      });
      setSuccess('Profile updated successfully.');
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to save profile');
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className={isModal ? 'fixed inset-0 z-[130] flex items-center justify-center' : 'min-h-screen flex items-center justify-center'}>
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isOpen === false) {
    return null;
  }

  return (
    <div
      className={isModal ? 'fixed inset-0 z-[130] flex items-center justify-center p-4 sm:p-6' : 'min-h-screen w-full relative overflow-hidden flex items-center justify-center p-0 lg:p-0'}
      onClick={isModal ? onClose : undefined}
    >
      <div className={isModal ? 'absolute inset-0 bg-black/75 backdrop-blur-md' : 'fixed top-0 left-0 w-full h-full pointer-events-none mix-blend-screen opacity-20'}>
        {isModal ? (
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.06),_transparent_45%),radial-gradient(circle_at_bottom,_rgba(255,255,255,0.03),_transparent_40%)]" />
        ) : (
          <>
            <div className="absolute top-10 left-10 w-[500px] h-[500px] bg-primary/30 rounded-full filter blur-[150px] animate-blob"></div>
            <div className="absolute bottom-10 right-10 w-[600px] h-[600px] bg-secondary/30 rounded-full filter blur-[150px] animate-blob" style={{ animationDelay: '2s' }}></div>
          </>
        )}
      </div>

      <div
        className={isModal ? 'glass-panel w-full max-w-4xl max-h-[90vh] p-6 lg:p-8 relative z-10 overflow-hidden shadow-2xl animate-in fade-in zoom-in slide-in-from-bottom-4 duration-300' : 'w-full h-full glass-panel border-0 rounded-none p-6 lg:p-12 relative z-10 overflow-y-auto'}
        onClick={isModal ? (e) => e.stopPropagation() : undefined}
      >
        <div className={isModal ? 'max-w-4xl mx-auto max-h-[calc(90vh-3rem)] overflow-y-auto pr-1' : 'max-w-4xl mx-auto'}>
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-4xl font-display font-bold text-gradient">Identity Profile</h1>
              <p className="text-textMuted text-base mt-1 font-medium tracking-wide">Manage your public identity across the secure network.</p>
            </div>
            {isModal ? (
              <button type="button" onClick={onClose} className="p-3 bg-surface border border-border rounded-xl text-textMuted hover:text-white transition-all shadow-lg" title="Close profile">
                <ArrowLeft className="w-6 h-6" />
              </button>
            ) : (
              <Link to="/" className="p-3 bg-surface border border-border rounded-xl text-textMuted hover:text-white transition-all shadow-lg" title="Back to chat">
                <ArrowLeft className="w-6 h-6" />
              </Link>
            )}
          </div>

        <form onSubmit={handleSave} className="space-y-8">
          {/* Avatar Section */}
          <div className="flex flex-col items-center gap-4">
            <div className="relative group">
              <div 
                className={cn(
                  "w-32 h-32 rounded-full border-2 border-dashed border-border flex items-center justify-center overflow-hidden bg-surface transition-all",
                  !avatarUrl && "hover:border-primary/50",
                  avatarUrl && "border-solid border-primary/30 shadow-[0_0_20px_rgba(212,255,0,0.1)]"
                )}
              >
                {avatarUrl ? (
                  <img 
                    src={resolveApiUrl(avatarUrl)} 
                    alt="Profile" 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <UserRound className="w-12 h-12 text-textMuted" />
                )}
                
                {uploadingAvatar && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleAvatarClick}
                  disabled={uploadingAvatar}
                  className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white transition-all disabled:hidden"
                >
                  <Camera className="w-6 h-6 mb-1" />
                  <span className="text-[10px] font-bold uppercase tracking-widest">Change</span>
                </button>
              </div>
              
              {avatarUrl && !uploadingAvatar && (
                <button
                  type="button"
                  onClick={() => setAvatarUrl('')}
                  className="absolute -top-1 -right-1 p-1.5 bg-secondary text-black rounded-full shadow-lg hover:scale-110 transition-all"
                  title="Remove Photo"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*"
              className="hidden"
            />
            
            {!avatarUrl && (
              <button
                type="button"
                onClick={handleAvatarClick}
                className="flex items-center gap-2 text-xs font-bold text-primary uppercase tracking-widest hover:opacity-80 transition-all"
              >
                <Upload className="w-3 h-3" />
                Upload Photo
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] text-textMuted uppercase tracking-[0.2em] font-bold ml-1">Username</label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="agent_zero"
                className="w-full bg-surface border border-border rounded-xl py-3 px-4 text-sm text-white placeholder-textMuted/30 focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] text-textMuted uppercase tracking-[0.2em] font-bold ml-1">Full Name</label>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Agent Zero"
                className="w-full bg-surface border border-border rounded-xl py-3 px-4 text-sm text-white placeholder-textMuted/30 focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] text-textMuted uppercase tracking-[0.2em] font-bold ml-1">Bio</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={4}
              placeholder="Operational status or short bio..."
              className="w-full bg-surface border border-border rounded-xl py-3 px-4 text-sm text-white placeholder-textMuted/30 focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all resize-none"
            />
          </div>

          <div className="rounded-xl border border-border/50 bg-black/20 p-4 text-xs text-textMuted flex items-center justify-between">
            <div className="flex items-center gap-3">
              <UserRound className="w-4 h-4 text-primary/50" />
              <span>Identity verified as <span className="text-white font-semibold">{user?.email}</span></span>
            </div>
            <div className="hidden sm:block text-[10px] uppercase tracking-widest opacity-40">
              UID: {user?.id}
            </div>
          </div>

          {error && (
            <div className="p-4 bg-secondary/10 border border-secondary/30 rounded-xl text-sm text-secondary animate-shake">
              {error}
            </div>
          )}
          
          {success && (
            <div className="p-4 bg-primary/10 border border-primary/30 rounded-xl text-sm text-primary">
              {success}
            </div>
          )}

          <button
            type="submit"
            disabled={saving || uploadingAvatar}
            className="w-full flex items-center justify-center gap-3 bg-primary text-black font-bold py-4 rounded-xl disabled:opacity-50 hover:shadow-[0_0_25px_rgba(212,255,0,0.2)] active:scale-[0.98] transition-all"
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            SYNCHRONIZE IDENTITY
          </button>
        </form>
        </div>
      </div>
    </div>
  );
}
