import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LogIn, Mail, Lock, ShieldAlert } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';

export default function Login() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const login = useAuthStore((state) => state.login);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const formData = new URLSearchParams();
      formData.append('username', identifier);
      formData.append('password', password);

      const response = await fetch('http://127.0.0.1:8000/api/v1/login/access-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Invalid credentials');
      }

      const data = await response.json();
      
      const userRes = await fetch('http://127.0.0.1:8000/api/v1/users/me', {
        headers: { 'Authorization': `Bearer ${data.access_token}` }
      });
      const userData = await userRes.json();

      login(data.access_token, userData);
      navigate('/');
    } catch {
      setError('Invalid email/username or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-screen items-center justify-center p-4 lg:p-12 overflow-hidden relative">
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none mix-blend-screen opacity-40">
        <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] bg-primary/20 rounded-full filter blur-[100px] animate-blob"></div>
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-secondary/20 rounded-full filter blur-[120px] animate-blob" style={{ animationDelay: '2s' }}></div>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 50, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="glass-panel w-full max-w-lg p-10 z-10 relative"
      >
        <div className="text-center mb-10">
          <motion.div 
            initial={{ scale: 0 }} 
            animate={{ scale: 1 }} 
            transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.2 }}
            className="w-16 h-16 bg-surface border border-border rounded-2xl mx-auto flex items-center justify-center mb-6 shadow-2xl overflow-hidden relative"
          >
            <div className="absolute inset-0 bg-gradient-to-tr from-primary/20 to-transparent"></div>
            <ShieldAlert className="w-8 h-8 text-primary relative z-10" />
          </motion.div>
          
          <h1 className="text-5xl font-display font-bold tracking-tighter mb-3">
            GLS<span className="text-gradient">MSG</span>
          </h1>
          <p className="text-textMuted font-sans text-lg tracking-wide">Enter the grid.</p>
        </div>

        {error && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mb-6 p-4 rounded-xl bg-secondary/10 border border-secondary/20 text-secondary text-sm text-center font-medium">
            {error}
          </motion.div>
        )}

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-textMuted uppercase tracking-[0.2em]">Identifier (Email or Username)</label>
            <div className="relative group">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-textMuted/50 transition-colors group-focus-within:text-primary" />
              <input 
                type="text" 
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="w-full bg-[#0a0a0c]/50 backdrop-blur-md border border-border rounded-xl py-4 pl-12 pr-4 text-white placeholder-textMuted/30 focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50 transition-all font-sans shadow-inner"
                placeholder="operative@network.local or agent_zero"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-textMuted uppercase tracking-[0.2em]">Passphrase</label>
            <div className="relative group">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-textMuted/50 transition-colors group-focus-within:text-primary" />
              <input 
                type="password" 
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#0a0a0c]/50 backdrop-blur-md border border-border rounded-xl py-4 pl-12 pr-4 text-white placeholder-textMuted/30 focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50 transition-all font-sans shadow-inner"
                placeholder="••••••••••••"
              />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full btn-primary flex items-center justify-center gap-2 mt-10 text-lg group tracking-wide disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Authenticating Object...' : 'Access Terminal'}
            {!loading && <LogIn className="w-5 h-5 transition-transform group-hover:translate-x-1" />}
          </button>
        </form>

        <div className="mt-8 text-center text-sm text-textMuted tracking-wide">
          Unregistered node? <Link to="/register" className="text-white hover:text-primary transition-colors underline decoration-border hover:decoration-primary underline-offset-4">Establish connection</Link>.
        </div>
      </motion.div>
    </div>
  );
}
