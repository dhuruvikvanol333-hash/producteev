import { FormEvent, useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { APP_NAME } from '../../utils/constants';
import api from '../../services/api';

type Step = 'email' | 'register' | 'reset-password';

function FloatingParticles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="auth-orb" {...{ style: { width: 300, height: 300, background: 'rgba(16, 185, 129, 0.25)', top: -50, left: -50, borderRadius: '50%', filter: 'blur(60px)', animation: 'floatingOrb 15s ease-in-out infinite', position: 'absolute' } }} />
      <div className="auth-orb" {...{ style: { width: 250, height: 250, background: 'rgba(6, 182, 212, 0.2)', bottom: -30, right: -30, borderRadius: '50%', filter: 'blur(60px)', animation: 'floatingOrb 15s ease-in-out infinite', animationDelay: '-5s', position: 'absolute' } }} />
      <div className="auth-orb" {...{ style: { width: 200, height: 200, background: 'rgba(59, 130, 246, 0.15)', top: '40%', left: '60%', borderRadius: '50%', filter: 'blur(60px)', animation: 'floatingOrb 15s ease-in-out infinite', animationDelay: '-10s', position: 'absolute' } }} />
      <div className="absolute inset-0 opacity-[0.03]"
        {...{
          style: {
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                           linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: '64px 64px',
          }
        }}
      />
    </div>
  );
}

export function RegisterPage() {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [errorRetryCount, setErrorRetryCount] = useState(0);
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetToken, setResetToken] = useState('');
  const [mounted, setMounted] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get('token');
  const [invitationOrg, setInvitationOrg] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);

    // Validate invite token if present
    if (inviteToken) {
      setLoading(true);
      api.get<{ success: boolean; data: { email: string; organization: { name: string } } }>(`/invitations/validate?token=${inviteToken}`)
        .then(res => {
          setEmail(res.data.data.email);
          setInvitationOrg(res.data.data.organization.name);
          setStep('register');
        })
        .catch(err => {
          setError(err.response?.data?.message || 'Invalid or expired invitation link');
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [inviteToken]);

  const handleEmailCheck = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post<{ success: boolean; data: { exists: boolean } }>('/auth/check-email', { email });
      if (res.data.data.exists) {
        const resetRes = await api.post<{ success: boolean; data: { message: string; resetToken?: string } }>('/auth/forgot-password', { email });
        if (resetRes.data.data.resetToken) setResetToken(resetRes.data.data.resetToken);
        setStep('reset-password');
      } else {
        setStep('register');
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register({ email, password, firstName, lastName, inviteToken: inviteToken || undefined });
      navigate('/');
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosErr = err as { response?: { data?: { message?: string } } };
        setError(axiosErr.response?.data?.message || 'Registration failed. Please try again.');
      } else {
        setError('Registration failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      await api.post<{ success: boolean; data: { message: string } }>('/auth/reset-password', { token: resetToken, password });
      setSuccess('Password reset successfully! Redirecting to login...');
      setTimeout(() => navigate('/login'), 2000);
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosErr = err as { response?: { data?: { message?: string } } };
        setError(axiosErr.response?.data?.message || 'Password reset failed. Please try again.');
      } else {
        setError('Password reset failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const PasswordToggle = () => (
    <button
      type="button"
      onClick={() => setShowPassword(!showPassword)}
      className="absolute right-3 top-[36px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-all"
      title={showPassword ? "Hide password" : "Show password"}
    >
      {showPassword ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
          <line x1="1" y1="1" x2="23" y2="23" />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      )}
    </button>
  );

  const ErrorAlert = () =>
    error ? (
      <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm p-3.5 rounded-xl border border-red-100 dark:border-red-800/50 flex flex-col gap-2.5 animate-fade-in mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <span className="font-medium flex-1">{error}</span>
          <button
            type="button"
            onClick={() => { setError(''); setErrorRetryCount(c => c + 1); }}
            className="text-xs bg-red-100 dark:bg-red-900/40 hover:bg-red-200 dark:hover:bg-red-900/60 px-2 py-1 rounded font-bold transition-colors"
            title="Clear error"
          >
            Clear
          </button>
        </div>

        {errorRetryCount > 0 && (
          <div className="flex items-center justify-between pt-1 border-t border-red-100 dark:border-red-800/30">
            <p className="text-[10px] opacity-70">Having trouble?</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="text-[10px] font-bold underline hover:no-underline"
            >
              Reload Page
            </button>
          </div>
        )}
      </div>
    ) : null;

  const SuccessAlert = () =>
    success ? (
      <div className="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 text-sm p-3.5 rounded-xl border border-emerald-100 dark:border-emerald-800/50 flex items-center gap-2.5 animate-fade-in">
        <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <span className="font-medium">{success}</span>
      </div>
    ) : null;

  const stepTitles = {
    email: 'Get started',
    register: 'Create your account',
    'reset-password': 'Reset password',
  };

  const stepSubtitles = {
    email: 'Enter your email to begin',
    register: 'Fill in your details to join',
    'reset-password': 'This email is already registered',
  };

  const heroTitle = step === 'reset-password'
    ? (invitationOrg ? <>Join {invitationOrg},<br /><span className="bg-gradient-to-r from-emerald-300 via-teal-300 to-cyan-300 bg-clip-text text-transparent">welcome back.</span></> : <>Reset your<br /><span className="bg-gradient-to-r from-emerald-300 via-teal-300 to-cyan-300 bg-clip-text text-transparent">password.</span></>)
    : <>Join your team,<br /><span className="bg-gradient-to-r from-emerald-300 via-teal-300 to-cyan-300 bg-clip-text text-transparent">start building.</span></>;

  return (
    <div className="min-h-screen w-full flex">
      {/* Left - Premium branding panel */}
      <div className="hidden lg:flex lg:w-[52%] relative overflow-hidden"
        {...{ style: { background: 'linear-gradient(135deg, #064e3b 0%, #065f46 40%, #0f766e 100%)' } }}
      >
        <FloatingParticles />
        <div className={`relative z-10 flex flex-col justify-between py-12 px-12 xl:px-16 w-full transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/30">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
            </div>
            <span className="text-white font-bold text-lg tracking-tight">{APP_NAME}</span>
          </div>

          {/* Hero */}
          <div className="space-y-8">
            <div>
              <h1 className="text-4xl xl:text-5xl font-extrabold text-white leading-[1.1] tracking-tight">
                {heroTitle}
              </h1>
              <p className="mt-5 text-base text-emerald-200/50 max-w-md leading-relaxed">
                {step === 'reset-password'
                  ? 'Set a new password to regain access to your workspace.'
                  : 'Create your account and start collaborating with your team in seconds.'}
              </p>
            </div>

            <div className="flex items-center gap-3">
              {[
                { icon: '✓', text: 'Free forever' },
                { icon: '✓', text: 'No credit card' },
                { icon: '✓', text: 'Instant setup' },
              ].map((item) => (
                <div key={item.text} className="flex items-center gap-2 bg-white/[0.07] backdrop-blur-sm rounded-xl px-4 py-2.5 border border-white/[0.08]">
                  <span className="text-emerald-300 text-xs font-bold">{item.icon}</span>
                  <span className="text-xs text-emerald-100/80 font-medium">{item.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom */}
          <div className="flex items-center gap-4">
            <div className="flex -space-x-2.5">
              {[
                'bg-gradient-to-br from-emerald-400 to-green-500',
                'bg-gradient-to-br from-teal-400 to-cyan-500',
                'bg-gradient-to-br from-blue-400 to-indigo-500',
              ].map((gradient, i) => (
                <div key={i} className={`w-8 h-8 rounded-full ${gradient} border-2 border-emerald-900 flex items-center justify-center text-[10px] font-bold text-white`}>
                  {['A', 'B', 'C'][i]}
                </div>
              ))}
            </div>
            <p className="text-xs text-emerald-200/40">Join <span className="text-emerald-200/70 font-semibold">thousands</span> of teams</p>
          </div>
        </div>
      </div>

      {/* Right - Form */}
      <div className="flex-1 flex items-center justify-center px-4 sm:px-8 bg-gray-50 dark:bg-gray-950 relative">
        <div className="absolute inset-0 pattern-dots" />
        <div className={`w-full max-w-md relative z-10 transition-all duration-500 delay-200 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
          <div className="text-center mb-8">
            <div className="lg:hidden mb-5">
              <div className="w-14 h-14 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-2xl flex items-center justify-center mx-auto shadow-xl shadow-emerald-500/20">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
              </div>
            </div>
            <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
              {invitationOrg ? `Join ${invitationOrg}` : stepTitles[step]}
            </h2>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              {invitationOrg ? `You've been invited to join ${invitationOrg}` : stepSubtitles[step]}
            </p>
          </div>

          {/* Step 1: Email check */}
          {step === 'email' && (
            <form onSubmit={handleEmailCheck} className="glass-card p-7 sm:p-8 rounded-2xl space-y-5">
              <ErrorAlert />
              <p className="text-sm text-gray-500 dark:text-gray-400">
                We&apos;ll check if you already have an account.
              </p>
              <Input
                id="email"
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="input-premium"
              />
              <Button type="submit" className="w-full btn-premium" size="lg" disabled={loading}>
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Checking...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    Continue
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </span>
                )}
              </Button>
              <p className="text-center text-sm text-gray-600 dark:text-gray-400">
                Already have an account?{' '}
                <Link to="/login" className="text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 font-bold hover:underline underline-offset-2">
                  Sign in
                </Link>
              </p>
            </form>
          )}

          {/* Step 2a: New registration */}
          {step === 'register' && (
            <form onSubmit={handleRegister} className="glass-card p-7 sm:p-8 rounded-2xl space-y-5">
              <ErrorAlert />
              <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-700/50 p-3 rounded-xl border border-gray-100 dark:border-gray-600">
                <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">{email}</span>
                {!inviteToken && (
                  <button
                    type="button"
                    onClick={() => { setStep('email'); setError(''); }}
                    className="ml-auto text-xs text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 font-bold hover:underline underline-offset-2"
                  >
                    Change
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input id="firstName" label="First name" value={firstName} onChange={(e) => { setFirstName(e.target.value); setError(''); }} required className="input-premium" />
                <Input id="lastName" label="Last name" value={lastName} onChange={(e) => { setLastName(e.target.value); setError(''); }} required className="input-premium" />
              </div>
              <div className="relative">
                <Input
                  id="password"
                  label="Password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 8 characters"
                  minLength={8}
                  required
                  className="input-premium"
                />
                <PasswordToggle />
              </div>
              <Button type="submit" className="w-full btn-premium" size="lg" disabled={loading}>
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Creating account...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    Create account
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </span>
                )}
              </Button>
              <p className="text-center text-sm text-gray-600 dark:text-gray-400">
                Already have an account?{' '}
                <Link to="/login" className="text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 font-bold hover:underline underline-offset-2">
                  Sign in
                </Link>
              </p>
            </form>
          )}

          {/* Step 2b: Reset password */}
          {step === 'reset-password' && (
            <form onSubmit={handleResetPassword} className="glass-card p-7 sm:p-8 rounded-2xl space-y-5">
              <ErrorAlert />
              <SuccessAlert />
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 p-3.5 rounded-xl">
                <p className="text-sm text-amber-800 dark:text-amber-300 font-medium">
                  {invitationOrg
                    ? `An account with ${email} already exists. Sign in to join ${invitationOrg} or reset your password.`
                    : `An account with ${email} already exists. Reset your password below.`}
                </p>
              </div>
              {invitationOrg && (
                <Button
                  type="button"
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
                  size="lg"
                  onClick={() => navigate(`/login?email=${email}&token=${inviteToken}`)}
                >
                  Sign in to join {invitationOrg}
                </Button>
              )}
              <div className="relative">
                <Input
                  id="newPassword"
                  label="New Password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 8 characters"
                  minLength={8}
                  required
                  className="input-premium"
                />
                <PasswordToggle />
              </div>
              <Input
                id="confirmPassword"
                label="Confirm Password"
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
                minLength={8}
                required
                className="input-premium"
              />
              <Button type="submit" className="w-full btn-premium" size="lg" disabled={loading || !!success}>
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Resetting...
                  </span>
                ) : 'Reset Password'}
              </Button>
              <div className="flex justify-between text-sm">
                <button
                  type="button"
                  onClick={() => { setStep('email'); setError(''); setSuccess(''); setPassword(''); setConfirmPassword(''); }}
                  className="text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 font-bold hover:underline underline-offset-2"
                >
                  Use different email
                </button>
                <Link to="/login" className="text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 font-bold hover:underline underline-offset-2">
                  Sign in
                </Link>
              </div>
            </form>
          )}

          <p className="text-center text-[11px] text-gray-400 dark:text-gray-600 mt-6">
            © {new Date().getFullYear()} {APP_NAME}. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
