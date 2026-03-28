import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Save, UserRound } from 'lucide-react';
import { apiUrl } from '../lib/api';
import { useAuthStore } from '../store/useAuthStore';

interface ProfileResponse {
  id: number;
  username: string | null;
  email: string;
  full_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  last_seen: string | null;
}

export default function Profile() {
  const navigate = useNavigate();
  const { token, user, updateUser, logout } = useAuthStore();

  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

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
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full p-4 lg:p-8">
      <div className="max-w-3xl mx-auto glass-panel p-6 lg:p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-display font-bold text-white">Identity Profile</h1>
            <p className="text-textMuted text-sm mt-1">Manage your public identity across chats.</p>
          </div>
          <Link to="/" className="text-textMuted hover:text-white transition-colors" title="Back to chat">
            <ArrowLeft className="w-5 h-5" />
          </Link>
        </div>

        <form onSubmit={handleSave} className="space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="space-y-2">
              <label className="text-xs text-textMuted uppercase tracking-wider">Username</label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="agent_zero"
                className="w-full bg-surface border border-border rounded-xl py-3 px-4 text-sm text-white placeholder-textMuted/40 focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-textMuted uppercase tracking-wider">Full Name</label>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Agent Zero"
                className="w-full bg-surface border border-border rounded-xl py-3 px-4 text-sm text-white placeholder-textMuted/40 focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs text-textMuted uppercase tracking-wider">Avatar URL</label>
            <input
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://example.com/avatar.png"
              className="w-full bg-surface border border-border rounded-xl py-3 px-4 text-sm text-white placeholder-textMuted/40 focus:outline-none focus:ring-1 focus:ring-primary/50"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs text-textMuted uppercase tracking-wider">Bio</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={4}
              placeholder="Short profile message"
              className="w-full bg-surface border border-border rounded-xl py-3 px-4 text-sm text-white placeholder-textMuted/40 focus:outline-none focus:ring-1 focus:ring-primary/50"
            />
          </div>

          <div className="rounded-xl border border-border bg-surface/60 p-4 text-sm text-textMuted flex items-center gap-3">
            <UserRound className="w-4 h-4" />
            <span>Signed in as {user?.email}</span>
          </div>

          {error && <div className="text-sm text-secondary">{error}</div>}
          {success && <div className="text-sm text-primary">{success}</div>}

          <button
            type="submit"
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 bg-primary text-black font-semibold py-3 rounded-xl disabled:opacity-60"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Profile
          </button>
        </form>
      </div>
    </div>
  );
}
