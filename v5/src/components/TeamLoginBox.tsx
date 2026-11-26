import React, { useEffect, useRef, useState } from 'react';
import { Loader2, Lock, LogIn, User, X } from 'lucide-react';
import { adminFetch, readJsonSafe } from '../utils/mediaHelpers';

interface TeamLoginBoxProps {
  open: boolean;
  onClose: () => void;
  onLoggedIn: () => void;
}

/**
 * Team login box on the public home page (v5).
 * Uses the exact same /api/auth/login endpoint as the admin portal, so all
 * roles, lockouts, rate limits and session cookies behave identically. After a
 * successful login the caller navigates to /admin, where each role sees its
 * own workspace.
 */
export const TeamLoginBox: React.FC<TeamLoginBoxProps> = ({ open, onClose, onLoggedIn }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsBootstrap, setNeedsBootstrap] = useState(false);
  const usernameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setPassword('');
    const focusTimer = window.setTimeout(() => usernameRef.current?.focus(), 60);
    let cancelled = false;
    adminFetch('/api/bootstrap/status')
      .then((res) => readJsonSafe<{ needsBootstrap?: boolean }>(res))
      .then(({ data }) => {
        if (!cancelled) setNeedsBootstrap(Boolean(data?.needsBootstrap));
      })
      .catch(() => {
        // If the status check fails, the login attempt itself will surface any error.
      });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      cancelled = true;
      window.clearTimeout(focusTimer);
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await adminFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const { data: json } = await readJsonSafe<{ error?: string }>(res);
      if (!res.ok) {
        if (res.status === 429) {
          const retryAfter = Number(res.headers.get('Retry-After') || '0');
          const minutes = Math.max(1, Math.ceil(retryAfter / 60));
          setError(
            json?.error ||
              `محاولات تسجيل دخول كثيرة. يرجى الانتظار نحو ${minutes} دقيقة ثم المحاولة مجدداً.`
          );
        } else {
          setError(json?.error || 'اسم المستخدم أو كلمة المرور غير صحيحة.');
        }
        return;
      }
      onLoggedIn();
    } catch {
      setError('تعذر الاتصال بالخادم. يرجى المحاولة مرة أخرى.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-[#0A192F]/70 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="دخول فريق المشروع"
    >
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 bg-[#0A192F] text-white">
          <div className="flex items-center gap-2">
            <LogIn className="w-5 h-5 text-[#38BDF8]" />
            <h2 className="text-base font-bold">دخول فريق المشروع</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 cursor-pointer"
            aria-label="إغلاق نافذة الدخول"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-6">
          {needsBootstrap ? (
            <div className="space-y-4">
              <p className="text-sm leading-relaxed text-slate-600">
                الموقع حالياً بانتظار إكمال الإعداد الأول من قبل مسؤول النظام. بعد الإعداد يمكن
                لأعضاء الفريق تسجيل الدخول من هنا.
              </p>
              <button
                type="button"
                onClick={onLoggedIn}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-[#0284C7] hover:bg-[#0369A1] rounded-lg transition-colors cursor-pointer"
              >
                فتح بوابة الإعداد
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="team-login-username" className="block text-sm font-medium text-slate-700 mb-1.5">
                  اسم المستخدم
                </label>
                <div className="relative">
                  <User className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    id="team-login-username"
                    ref={usernameRef}
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoComplete="username"
                    required
                    className="w-full rounded-lg border border-slate-300 py-2.5 pr-10 pl-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#38BDF8] focus:border-[#38BDF8]"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="team-login-password" className="block text-sm font-medium text-slate-700 mb-1.5">
                  كلمة المرور
                </label>
                <div className="relative">
                  <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    id="team-login-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                    className="w-full rounded-lg border border-slate-300 py-2.5 pr-10 pl-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#38BDF8] focus:border-[#38BDF8]"
                  />
                </div>
              </div>

              {error && (
                <p className="text-sm leading-relaxed text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-[#0284C7] hover:bg-[#0369A1] disabled:opacity-60 disabled:cursor-not-allowed rounded-lg transition-colors cursor-pointer"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>{submitting ? 'جارٍ تسجيل الدخول...' : 'تسجيل الدخول'}</span>
              </button>

              <p className="text-xs leading-relaxed text-slate-400 text-center">
                هذه البوابة مخصصة لأعضاء فريق المشروع فقط.
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
