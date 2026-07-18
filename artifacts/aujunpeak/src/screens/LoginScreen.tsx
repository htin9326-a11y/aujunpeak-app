import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { KeyRound, Gift, ChevronRight, LogIn } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGoogleLogin } from '@react-oauth/google';
import { useAppContext } from '@/contexts/AppContext';
import { verifyKey } from '@/lib/api';
import { ParticleField } from '@/components/ui/ParticleField';
import { toast } from 'sonner';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

export function LoginScreen() {
  const [, setLocation] = useLocation();
  const { authState, setAuthState, deviceId, setCurrentTab } = useAppContext();
  const [keyInput, setKeyInput] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);
  const [activePanel, setActivePanel] = useState<'key' | 'google'>(
    authState.googleUser ? 'key' : 'google'
  );

  const isGoogleUser = !!authState.googleUser;

  /* ── Google OAuth ── */
  const googleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setGoogleLoading(true);
      try {
        const userInfo = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
        }).then(r => r.json());

        const googleUser = {
          avatar: userInfo.picture ?? null,
          name:   userInfo.name   ?? 'Google User',
          email:  userInfo.email  ?? '',
          sub:    userInfo.sub    ?? '',
        };
        setAuthState({ ...authState, googleUser });
        toast.success(`Xin chào, ${googleUser.name}!`, {
          style: { background: '#111', border: '1px solid rgba(66,133,244,0.4)', color: '#fff' },
        });
        setCurrentTab('profile');
        setLocation('/');
      } catch {
        toast.error('Không lấy được thông tin Google.', {
          style: { background: '#111', border: '1px solid rgba(255,23,68,0.4)', color: '#fff' },
        });
      } finally {
        setGoogleLoading(false);
      }
    },
    onError: () => {
      setGoogleLoading(false);
      toast.error('Đăng nhập Google thất bại.', {
        style: { background: '#111', border: '1px solid rgba(255,23,68,0.4)', color: '#fff' },
      });
    },
  });

  /* ── Key login ── */
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyInput.trim()) return;
    setStatus('loading');
    setErrorMsg('');
    try {
      const res = await verifyKey(keyInput.trim(), deviceId, navigator.userAgent);
      setStatus('success');
      setTimeout(() => {
        setAuthState({
          isLoggedIn: true,
          keyData: res.data,
          googleUser: authState.googleUser,
        });
        setCurrentTab('home');
        setLocation('/');
      }, 900);
    } catch (err: any) {
      setStatus('error');
      setErrorMsg(err.message || 'Key không hợp lệ.');
    }
  };

  const raindrops = Array.from({ length: 28 }).map((_, i) => ({
    id: i,
    left: `${(i * 3.6) % 100}%`,
    delay: `${(i * 0.07) % 2}s`,
    duration: `${0.8 + (i % 7) * 0.1}s`,
  }));

  return (
    <div className="fixed inset-0 z-[100] bg-[#080808] max-w-[430px] mx-auto flex flex-col overflow-hidden">

      {/* ── Background gif ── */}
      <div className="absolute inset-0 pointer-events-none">
        <img
          src={`${import.meta.env.BASE_URL}bg.gif`}
          alt=""
          className="w-full h-full object-cover opacity-10"
          draggable={false}
        />
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(to bottom, rgba(8,8,8,0.7) 0%, rgba(8,8,8,0.5) 50%, rgba(8,8,8,0.88) 100%)' }}
        />
      </div>

      {/* ── Code rain ── */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-15">
        {raindrops.map(d => (
          <div
            key={d.id}
            className="absolute text-primary text-[10px] font-mono font-black select-none"
            style={{
              left: d.left,
              top: '-20px',
              animationName: 'fall',
              animationDuration: d.duration,
              animationDelay: d.delay,
              animationIterationCount: 'infinite',
              animationTimingFunction: 'linear',
            }}
          >
            {['0', '1', '⚡', '#', '$'][d.id % 5]}
          </div>
        ))}
      </div>

      {/* ── Particles ── */}
      <div className="absolute inset-0 pointer-events-none">
        <ParticleField color="#FF1744" count={12} className="opacity-30" />
      </div>

      <div className="relative z-10 flex flex-col h-full px-6 pt-12 pb-8">

        {/* ── HEADER — chỉ chữ AUJUNPEAK ── */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          {/* Tên app với glow đỏ nổi bật */}
          <motion.h1
            className="text-white font-black tracking-[0.3em] uppercase"
            style={{
              fontSize: '28px',
              textShadow: '0 0 30px rgba(255,23,68,0.7), 0 0 60px rgba(255,23,68,0.3)',
              letterSpacing: '0.28em',
            }}
            animate={{
              textShadow: [
                '0 0 24px rgba(255,23,68,0.5), 0 0 48px rgba(255,23,68,0.2)',
                '0 0 40px rgba(255,23,68,0.85), 0 0 80px rgba(255,23,68,0.4)',
                '0 0 24px rgba(255,23,68,0.5), 0 0 48px rgba(255,23,68,0.2)',
              ],
            }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          >
            AUJUNPEAK
          </motion.h1>

          {/* Đường kẻ đỏ trang trí dưới tên */}
          <div className="flex items-center justify-center gap-3 mt-2 mb-1">
            <motion.div
              className="h-px flex-1 max-w-[60px]"
              style={{ background: 'linear-gradient(to right, transparent, rgba(255,23,68,0.6))' }}
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: 0.3, duration: 0.5 }}
            />
            <motion.div
              className="w-1.5 h-1.5 rounded-full bg-primary"
              style={{ boxShadow: '0 0 6px rgba(255,23,68,0.8)' }}
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
            <motion.div
              className="h-px flex-1 max-w-[60px]"
              style={{ background: 'linear-gradient(to left, transparent, rgba(255,23,68,0.6))' }}
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: 0.3, duration: 0.5 }}
            />
          </div>

          <motion.p
            className="text-white/30 text-[10px] font-bold tracking-[0.35em] uppercase"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            Kích hoạt tài khoản
          </motion.p>
        </motion.div>

        {/* ── GOOGLE USER BANNER ── */}
        <AnimatePresence>
          {isGoogleUser && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="mb-4 rounded-2xl px-4 py-3 flex items-center gap-3"
              style={{ background: 'rgba(66,133,244,0.08)', border: '1px solid rgba(66,133,244,0.2)' }}
            >
              {authState.googleUser?.avatar ? (
                <img
                  src={authState.googleUser.avatar}
                  alt=""
                  className="w-8 h-8 rounded-full object-cover flex-shrink-0 ring-1 ring-blue-400/30"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-sm font-black text-blue-400 flex-shrink-0">
                  {(authState.googleUser?.name || 'G')[0]}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-[#4285F4] font-black text-[11px] uppercase tracking-widest">Đã đăng nhập Google</div>
                <div className="text-white/60 text-[10px] truncate mt-0.5">{authState.googleUser?.email}</div>
              </div>
              <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                <span className="text-green-400 text-[9px]">✓</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── PANEL TABS — only when not Google user ── */}
        {!isGoogleUser && CLIENT_ID && (
          <div
            className="flex rounded-xl mb-4 overflow-hidden"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            {[
              {
                id: 'google',
                label: 'Google',
                icon: (
                  <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                ),
              },
              { id: 'key', label: 'Nhập Key', icon: <KeyRound className="w-4 h-4" /> },
            ].map(panel => (
              <button
                key={panel.id}
                onClick={() => setActivePanel(panel.id as 'key' | 'google')}
                className="flex-1 flex items-center justify-center gap-2 py-3 text-[11px] font-black tracking-widest uppercase transition-all"
                style={{
                  background: activePanel === panel.id ? 'rgba(255,23,68,0.15)' : 'transparent',
                  color: activePanel === panel.id ? '#FF1744' : 'rgba(255,255,255,0.35)',
                  borderBottom: activePanel === panel.id ? '2px solid #FF1744' : '2px solid transparent',
                }}
              >
                {panel.icon} {panel.label}
              </button>
            ))}
          </div>
        )}

        {/* ── PANELS ── */}
        <AnimatePresence mode="wait">

          {/* KEY PANEL */}
          {(activePanel === 'key' || isGoogleUser) && (
            <motion.div
              key="key-panel"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <div
                className="rounded-2xl p-5 space-y-4"
                style={{
                  background: 'rgba(16,16,16,0.75)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  backdropFilter: 'blur(20px)',
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(255,23,68,0.12)', border: '1px solid rgba(255,23,68,0.2)' }}
                  >
                    <KeyRound className="w-4.5 h-4.5 text-primary" />
                  </div>
                  <div>
                    <div className="text-white font-black text-[11px] uppercase tracking-widest">Nhập Key kích hoạt</div>
                    <div className="text-white/30 text-[9px] font-bold mt-0.5">
                      {isGoogleUser ? 'Nhập key để mở toàn bộ tính năng' : 'Key FREE hoặc VIP'}
                    </div>
                  </div>
                </div>

                <form onSubmit={handleLogin} className="space-y-3">
                  <input
                    value={keyInput}
                    onChange={e => {
                      setKeyInput(e.target.value);
                      if (status !== 'idle') { setStatus('idle'); setErrorMsg(''); }
                    }}
                    className="w-full bg-black/40 border rounded-xl px-4 py-3.5 font-mono text-sm font-bold tracking-widest text-white placeholder-white/20 outline-none transition-all"
                    style={{
                      borderColor:
                        status === 'error'   ? 'rgba(255,23,68,0.5)'  :
                        status === 'success' ? 'rgba(34,197,94,0.5)'  :
                        'rgba(255,255,255,0.08)',
                      boxShadow:
                        status === 'error'   ? '0 0 0 2px rgba(255,23,68,0.12)'  :
                        status === 'success' ? '0 0 0 2px rgba(34,197,94,0.12)' :
                        'none',
                    }}
                    placeholder="FREE-XXXX-XXXX-XXXX-XXXX"
                    spellCheck={false}
                    autoComplete="off"
                    disabled={status === 'loading' || status === 'success'}
                  />

                  <AnimatePresence>
                    {errorMsg && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="px-3 py-2 rounded-xl text-[11px] font-bold text-red-400"
                        style={{ background: 'rgba(255,23,68,0.08)', border: '1px solid rgba(255,23,68,0.2)' }}
                      >
                        {errorMsg}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <motion.button
                    type="submit"
                    whileTap={{ scale: 0.97 }}
                    disabled={!keyInput.trim() || status === 'loading' || status === 'success'}
                    className="w-full h-12 rounded-xl font-black text-[11px] tracking-[0.2em] uppercase flex items-center justify-center gap-2.5 text-white disabled:opacity-50 transition-all"
                    style={{
                      background:
                        status === 'success'
                          ? 'linear-gradient(135deg,#22c55e,#15803d)'
                          : 'linear-gradient(135deg,#FF1744,#9a0000)',
                      boxShadow:
                        status === 'success'
                          ? '0 4px 20px rgba(34,197,94,0.4)'
                          : '0 4px 20px rgba(255,23,68,0.4)',
                    }}
                  >
                    {status === 'loading' && (
                      <>
                        {['-0.3s', '-0.15s', '0s'].map((d, i) => (
                          <span
                            key={i}
                            className="w-1.5 h-1.5 rounded-full bg-white block"
                            style={{ animation: 'bounce 1.4s ease-in-out infinite', animationDelay: d }}
                          />
                        ))}
                      </>
                    )}
                    {status === 'success' && <><span>✓</span> Thành công!</>}
                    {(status === 'idle' || status === 'error') && (
                      <><LogIn className="w-4 h-4" /> Kích hoạt Key</>
                    )}
                  </motion.button>
                </form>
              </div>
            </motion.div>
          )}

          {/* GOOGLE PANEL */}
          {activePanel === 'google' && !isGoogleUser && (
            <motion.div
              key="google-panel"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
            >
              <div
                className="rounded-2xl p-5 space-y-4"
                style={{
                  background: 'rgba(16,16,16,0.75)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  backdropFilter: 'blur(20px)',
                }}
              >
                <div className="text-center space-y-1">
                  <div className="text-white font-black text-[11px] uppercase tracking-widest">Đăng nhập nhanh với Google</div>
                  <div className="text-white/30 text-[9px] font-bold">Mở Settings · Nhập key để mở thêm tính năng</div>
                </div>

                {CLIENT_ID ? (
                  <motion.button
                    onClick={() => { setGoogleLoading(true); googleLogin(); }}
                    disabled={googleLoading}
                    whileTap={{ scale: 0.97 }}
                    className="w-full bg-white text-black font-black tracking-wider text-[11px] uppercase rounded-xl flex items-center justify-center gap-3 relative overflow-hidden disabled:opacity-70"
                    style={{ boxShadow: '0 4px 24px rgba(255,255,255,0.15)', height: '52px' }}
                  >
                    {googleLoading ? (
                      <div className="flex items-center gap-2">
                        {['-0.32s', '-0.16s', '0s'].map((d, i) => (
                          <span
                            key={i}
                            className="w-2 h-2 bg-black rounded-full"
                            style={{ animation: 'bounce 1.4s ease-in-out infinite', animationDelay: d }}
                          />
                        ))}
                      </div>
                    ) : (
                      <>
                        <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
                          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                        </svg>
                        Tiếp tục với Google
                      </>
                    )}
                  </motion.button>
                ) : (
                  <div
                    className="w-full rounded-xl border border-white/10 flex items-center justify-center gap-3 opacity-35 cursor-not-allowed"
                    style={{ height: '52px' }}
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    </svg>
                    <span className="text-white text-xs font-black tracking-wider">Google chưa cấu hình</span>
                  </div>
                )}

                {/* Divider */}
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full h-px" style={{ background: 'rgba(255,255,255,0.07)' }} />
                  </div>
                  <div className="relative flex justify-center">
                    <span
                      className="px-3 text-[9px] font-black text-white/25 uppercase tracking-widest"
                      style={{ background: 'rgba(16,16,16,0.9)' }}
                    >
                      hoặc
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => setActivePanel('key')}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-black text-[11px] tracking-widest uppercase transition-all"
                  style={{
                    background: 'rgba(255,23,68,0.08)',
                    border: '1px solid rgba(255,23,68,0.18)',
                    color: 'rgba(255,80,80,0.8)',
                  }}
                >
                  <KeyRound className="w-3.5 h-3.5" /> Nhập Key kích hoạt <ChevronRight className="w-3.5 h-3.5 opacity-50" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── FREE KEY LINK ── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-auto pt-6"
        >
          <button
            onClick={() => setLocation('/free-key')}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-[11px] tracking-wider uppercase transition-all press-effect"
            style={{
              background: 'rgba(0,229,255,0.05)',
              border: '1px solid rgba(0,229,255,0.12)',
              color: 'rgba(0,229,255,0.55)',
            }}
          >
            <Gift className="w-3.5 h-3.5" /> Nhận Key FREE miễn phí
          </button>
          <p className="text-white/15 text-[9px] font-bold text-center tracking-wider uppercase mt-3">
            {isGoogleUser
              ? 'Google ✓ · Key FREE → Home+Settings · Key VIP → toàn bộ'
              : 'Google → Settings · Key FREE → Home+Settings · Key VIP → toàn bộ'}
          </p>
        </motion.div>
      </div>

      <style>{`
        @keyframes fall {
          from { top: -20px; opacity: 1; }
          to   { top: 100%;  opacity: 0; }
        }
        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0); }
          40%           { transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
