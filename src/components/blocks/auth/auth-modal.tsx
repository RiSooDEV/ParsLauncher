import { useState } from 'react';
import { Eye, EyeOff, Lock, ShieldAlert, Sparkles, User, UserCheck, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAccountStore } from '@/stores/account';
import { backend } from '@/lib/utils';
import { useQueryClient } from '@tanstack/react-query';

export function AuthModal() {
  const { isAuthModalOpen, authModalTab, authModalReason, closeAuthModal, setUser } = useAccountStore();
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<'login' | 'register'>(authModalTab || 'login');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regError, setRegError] = useState<string | null>(null);

  if (!isAuthModalOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginIdentifier.trim() || !loginPassword) {
      toast.error('لطفاً نام کاربری/ایمیل و رمز عبور را وارد کنید.');
      return;
    }

    try {
      setLoading(true);
      const res = await backend('pars_account_login', {
        login: loginIdentifier.trim(),
        password: loginPassword,
      });

      if (res.success && res.user) {
        setUser(res.user);
        toast.success(`خوش آمدید، ${res.user.username}!`);
        queryClient.invalidateQueries({ queryKey: ['get_selected_profile'] });
        queryClient.invalidateQueries({ queryKey: ['get_profiles'] });
        closeAuthModal();
      } else {
        toast.error(res.error || 'خطا در ورود به حساب کاربری');
      }
    } catch (err: any) {
      toast.error(err?.message || 'خطا در برقراری ارتباط با سرور حساب کاربری');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError(null);

    const u = regUsername.trim();

    if (!u || !/^[a-zA-Z0-9_]{3,16}$/.test(u)) {
      setRegError('نام کاربری باید ۳ تا ۱۶ حرف و فقط شامل حروف انگلیسی، اعداد یا زیرخط باشد.');
      return;
    }

    if (regPassword.length < 6) {
      setRegError('رمز عبور باید حداقل ۶ کاراکتر باشد.');
      return;
    }

    try {
      setLoading(true);
      const res = await backend('pars_account_register', {
        username: u,
        email: '',
        password: regPassword,
      });

      if (res.success && res.user) {
        setUser(res.user);
        toast.success(`حساب کاربری ${res.user.username} با موفقیت ساخته شد!`);
        queryClient.invalidateQueries({ queryKey: ['get_selected_profile'] });
        queryClient.invalidateQueries({ queryKey: ['get_profiles'] });
        closeAuthModal();
      } else {
        setRegError(res.error || 'خطا در ساخت حساب کاربری');
      }
    } catch (err: any) {
      setRegError(err?.message || 'خطا در برقراری ارتباط با سرور');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className='fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200'
      dir='rtl'
    >
      <div className='relative w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-[#121216] p-6 shadow-2xl shadow-black/80'>
        {/* Glow Header */}
        <div className='absolute -top-24 -left-24 h-48 w-48 rounded-full bg-emerald-500/20 blur-3xl' />
        <div className='absolute -bottom-24 -right-24 h-48 w-48 rounded-full bg-primary/20 blur-3xl' />

        {/* Close Button */}
        <button
          onClick={closeAuthModal}
          type='button'
          className='absolute top-4 left-4 rounded-lg p-2 text-muted-foreground hover:bg-white/10 hover:text-white transition-colors'
        >
          <X className='size-5' />
        </button>

        {/* Header Title */}
        <div className='text-center mb-6'>
          <div className='inline-flex items-center justify-center size-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mb-3 shadow-inner'>
            <Sparkles className='size-6' />
          </div>
          <h2 className='text-xl font-black text-white tracking-wide'>
            حساب کاربری <span className='text-emerald-400'>Pars</span>
          </h2>
          <p className='text-xs text-muted-foreground mt-1'>
            حساب محلی روی سیستم خودت — ورود سریع، اسکین و همگام‌سازی تنظیمات
          </p>
        </div>

        {/* Warning Reason if opened required */}
        {authModalReason && (
          <div className='mb-5 flex items-center gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200'>
            <ShieldAlert className='size-5 shrink-0 text-amber-400' />
            <span>{authModalReason}</span>
          </div>
        )}

        {/* Tab Switcher */}
        <div className='flex rounded-xl bg-white/5 p-1 mb-6 border border-white/5'>
          <button
            type='button'
            onClick={() => {
              setTab('login');
              setRegError(null);
            }}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
              tab === 'login'
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                : 'text-muted-foreground hover:text-white'
            }`}
          >
            ورود به حساب
          </button>
          <button
            type='button'
            onClick={() => {
              setTab('register');
              setRegError(null);
            }}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
              tab === 'register'
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                : 'text-muted-foreground hover:text-white'
            }`}
          >
            ثبت‌نام حساب جدید
          </button>
        </div>

        {/* Forms */}
        {tab === 'login' ? (
          <form onSubmit={handleLogin} className='space-y-4'>
            <div>
              <label className='block text-xs font-medium text-muted-foreground mb-1.5'>
                نام کاربری
              </label>
              <div className='relative'>
                <User className='absolute right-3 top-3 size-4 text-muted-foreground' />
                <Input
                  dir='ltr'
                  value={loginIdentifier}
                  onChange={(e) => setLoginIdentifier(e.target.value)}
                  placeholder='Username'
                  required
                  className='h-11 pr-10 bg-white/5 border-white/10 text-white text-sm focus:border-emerald-500'
                />
              </div>
            </div>

            <div>
              <label className='block text-xs font-medium text-muted-foreground mb-1.5'>
                رمز عبور
              </label>
              <div className='relative'>
                <Lock className='absolute right-3 top-3 size-4 text-muted-foreground' />
                <Input
                  dir='ltr'
                  type={showPassword ? 'text' : 'password'}
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder='••••••••'
                  required
                  className='h-11 pr-10 pl-10 bg-white/5 border-white/10 text-white text-sm focus:border-emerald-500'
                />
                <button
                  type='button'
                  onClick={() => setShowPassword(!showPassword)}
                  className='absolute left-3 top-3 text-muted-foreground hover:text-white'
                >
                  {showPassword ? <EyeOff className='size-4' /> : <Eye className='size-4' />}
                </button>
              </div>
            </div>

            <Button
              type='submit'
              disabled={loading}
              className='w-full h-11 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg shadow-emerald-600/30 rounded-xl mt-2'
            >
              {loading ? 'در حال برقراری ارتباط...' : 'ورود به حساب کاربری'}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleRegister} className='space-y-3.5'>
            {regError && (
              <div className='rounded-lg bg-red-500/15 border border-red-500/30 p-2.5 text-xs text-red-300'>
                {regError}
              </div>
            )}

            <div>
              <label className='block text-xs font-medium text-muted-foreground mb-1'>
                نام کاربری ماینکرفت (درون بازی)
              </label>
              <div className='relative'>
                <UserCheck className='absolute right-3 top-3 size-4 text-muted-foreground' />
                <Input
                  dir='ltr'
                  value={regUsername}
                  onChange={(e) => setRegUsername(e.target.value)}
                  placeholder='e.g. Steve_99'
                  required
                  className='h-10 pr-10 bg-white/5 border-white/10 text-white text-sm focus:border-emerald-500'
                />
              </div>
              <span className='text-[10px] text-muted-foreground'>
                تنها شامل حروف انگلیسی، اعداد و _ (۳ تا ۱۶ حرف)
              </span>
            </div>

            <div>
              <label className='block text-xs font-medium text-muted-foreground mb-1'>
                رمز عبور (حداقل ۶ کاراکتر)
              </label>
              <div className='relative'>
                <Lock className='absolute right-3 top-3 size-4 text-muted-foreground' />
                <Input
                  dir='ltr'
                  type={showPassword ? 'text' : 'password'}
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  placeholder='••••••••'
                  required
                  className='h-10 pr-10 pl-10 bg-white/5 border-white/10 text-white text-sm focus:border-emerald-500'
                />
                <button
                  type='button'
                  onClick={() => setShowPassword(!showPassword)}
                  className='absolute left-3 top-3 text-muted-foreground hover:text-white'
                >
                  {showPassword ? <EyeOff className='size-4' /> : <Eye className='size-4' />}
                </button>
              </div>
            </div>

            <Button
              type='submit'
              disabled={loading}
              className='w-full h-11 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg shadow-emerald-600/30 rounded-xl mt-2'
            >
              {loading ? 'در حال ایجاد حساب...' : 'ساخت حساب کاربری پارس لانچر'}
            </Button>
          </form>
        )}

        <div className='mt-5 pt-4 border-t border-white/5 text-center text-[11px] text-muted-foreground'>
          <span>قابلیت بازی آفلاین حتی هنگام قطع اینترنت به طور کامل حفظ می‌شود.</span>
        </div>
      </div>
    </div>
  );
}
