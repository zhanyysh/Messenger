import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { UserPlus, Mail, Lock, User as UserIcon } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';

export default function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const login = useAuthStore((state) => state.login);
  const navigate = useNavigate();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // 1. Register User
      const regRes = await fetch('http://127.0.0.1:8000/api/v1/users/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, full_name: name, is_superuser: false }),
      });

      if (!regRes.ok) {
        const errorData = await regRes.json();
        throw new Error(errorData.detail || 'Registration failed');
      }

      // 2. Auto-Login
      const formData = new URLSearchParams();
      formData.append('username', email);
      formData.append('password', password);

      const loginRes = await fetch('http://127.0.0.1:8000/api/v1/login/access-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData,
      });

      if (!loginRes.ok) throw new Error('Auto-login failed');
      const data = await loginRes.json();
      
      const userRes = await fetch('http://127.0.0.1:8000/api/v1/users/me', {
        headers: { 'Authorization': `Bearer ${data.access_token}` }
      });
      const userData = await userRes.json();

      login(data.access_token, userData);
      navigate('/');
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Registration failed');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center p-4 lg:p-12 overflow-hidden relative">
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none mix-blend-screen opacity-40">
        <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] bg-primary/20 rounded-full filter blur-[100px] animate-blob" style={{ animationDelay: '1s' }}></div>
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-secondary/20 rounded-full filter blur-[120px] animate-blob" style={{ animationDelay: '3s' }}></div>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: -50, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="glass-panel w-full max-w-lg p-10 z-10 relative my-8"
      >
        <div className="text-center mb-10">
          <motion.div 
            initial={{ scale: 0 }} 
            animate={{ scale: 1, rotate: 360 }} 
            transition={{ type: "spring", stiffness: 150, damping: 20, delay: 0.2 }}
            className="w-16 h-16 bg-surface border border-border rounded-full mx-auto flex items-center justify-center mb-6 shadow-2xl relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-tr from-secondary/20 to-transparent"></div>
            <UserPlus className="w-8 h-8 text-secondary relative z-10" />
          </motion.div>
          
          <h1 className="text-4xl font-display font-bold tracking-tighter mb-3">
            INITIALIZE <span className="text-gradient">NODE</span>
          </h1>
          <p className="text-textMuted font-sans text-lg tracking-wide">Join the grid syndicate.</p>
        </div>

        {error && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mb-6 p-4 rounded-xl bg-secondary/10 border border-secondary/20 text-secondary text-sm text-center font-medium">
            {error}
          </motion.div>
        )}

        <form onSubmit={handleRegister} className="space-y-5">
           <div className="space-y-2">
            <label className="text-[10px] font-bold text-textMuted uppercase tracking-[0.2em]">Codename (Optional)</label>
            <div className="relative group">
              <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-textMuted/50 transition-colors group-focus-within:text-primary" />
              <input 
                type="text" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-[#0a0a0c]/50 backdrop-blur-md border border-border rounded-xl py-4 pl-12 pr-4 text-white placeholder-textMuted/30 focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50 transition-all font-sans shadow-inner"
                placeholder="Agent Zero"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-textMuted uppercase tracking-[0.2em]">Identifier (Email)</label>
            <div className="relative group">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-textMuted/50 transition-colors group-focus-within:text-primary" />
              <input 
                type="email" 
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#0a0a0c]/50 backdrop-blur-md border border-border rounded-xl py-4 pl-12 pr-4 text-white placeholder-textMuted/30 focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50 transition-all font-sans shadow-inner"
                placeholder="operative@network.local"
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
            className="w-full btn-primary relative overflow-hidden bg-white text-black flex items-center justify-center gap-2 mt-10 text-lg group tracking-wide disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(255,255,255,0.3)] hover:shadow-[0_0_30px_rgba(255,255,255,0.5)]"
          >
            {loading ? 'Processing...' : 'Establish Node'}
            {!loading && <UserPlus className="w-5 h-5 transition-transform group-hover:scale-110" />}
          </button>
        </form>

        <div className="mt-8 text-center text-sm text-textMuted tracking-wide">
          Already registered? <Link to="/login" className="text-white hover:text-primary transition-colors underline decoration-border hover:decoration-primary underline-offset-4">Access terminal</Link>.
        </div>
      </motion.div>
    </div>
  );
}
