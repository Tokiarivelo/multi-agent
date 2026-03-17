'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { LogIn, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import OAuthButtons from './OAuthButtons';

export default function LoginForm() {
  const { t } = useTranslation();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError(t('auth.invalidCredentials'));
      } else {
        router.push('/dashboard');
        router.refresh();
      }
    } catch {
      setError(t('auth.unexpectedError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md p-8 bg-card/60 backdrop-blur-2xl rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] border border-border/50 transition-all">
      <div className="flex flex-col items-center mb-8">
        <div className="p-3 bg-primary/10 rounded-full mb-4 ring-1 ring-primary/20">
          <LogIn className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-3xl font-bold tracking-tight text-foreground/90">
          {t('auth.welcomeBack')}
        </h2>
        <p className="text-muted-foreground mt-2">{t('auth.signInSubtitle')}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="p-4 bg-red-900/30 border border-red-800 text-red-200 text-sm rounded-lg flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-red-500 rounded-full" />
            {error}
          </div>
        )}

        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground/80">{t('auth.emailLabel') || 'Email'}</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 bg-background/50 border border-border/60 rounded-xl focus:ring-2 focus:ring-primary/40 focus:border-primary/50 outline-none text-foreground placeholder-muted-foreground transition-all shadow-sm"
            placeholder="name@company.com"
            required
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground/80">{t('auth.passwordLabel') || 'Password'}</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 bg-background/50 border border-border/60 rounded-xl focus:ring-2 focus:ring-primary/40 focus:border-primary/50 outline-none text-foreground placeholder-muted-foreground transition-all shadow-sm"
            placeholder="••••••••"
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 px-4 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-xl transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none shadow-lg shadow-primary/20 flex justify-center items-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              {t('auth.signingIn')}
            </>
          ) : (
            t('auth.signIn')
          )}
        </button>

        <OAuthButtons callbackUrl="/dashboard" mode="signIn" />

        <div className="mt-4 text-center text-sm text-muted-foreground">
          {t('auth.dontHaveAccount')}{' '}
          <a href="/register" className="text-primary hover:text-primary/80 font-medium">
            {t('auth.signUpLink')}
          </a>
        </div>
      </form>
    </div>
  );
}
