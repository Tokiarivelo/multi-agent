'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { UserPlus, Loader2 } from 'lucide-react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import OAuthButtons from './OAuthButtons';

export default function RegisterForm() {
  const { t } = useTranslation();
  const router = useRouter();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Gateway service register endpoint — now explicitly including /api prefix
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
      await axios.post(`${API_URL}/api/auth/register`, {
        firstName,
        lastName,
        email,
        password,
      });

      router.push('/login?registered=true');
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.message || t('auth.registrationFailed'));
      } else {
        setError(t('auth.registrationFailed'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md p-8 bg-card/60 backdrop-blur-2xl rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] border border-border/50 transition-all">
      <div className="flex flex-col items-center mb-8">
        <div className="p-3 bg-primary/10 rounded-full mb-4 ring-1 ring-primary/20">
          <UserPlus className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-3xl font-bold tracking-tight text-foreground/90">
          {t('auth.createAccount')}
        </h2>
        <p className="text-muted-foreground mt-2">{t('auth.orchestrateSubtitle')}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-4 bg-red-900/30 border border-red-800 text-red-200 text-sm rounded-lg flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-red-500 rounded-full" />
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground/80">{t('auth.firstNameLabel') || 'First Name'}</label>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="w-full px-4 py-3 bg-background/50 border border-border/60 rounded-xl focus:ring-2 focus:ring-primary/40 focus:border-primary/50 outline-none text-foreground placeholder-muted-foreground transition-all shadow-sm"
              placeholder="Ada"
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground/80">{t('auth.lastNameLabel') || 'Last Name'}</label>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="w-full px-4 py-3 bg-background/50 border border-border/60 rounded-xl focus:ring-2 focus:ring-primary/40 focus:border-primary/50 outline-none text-foreground placeholder-muted-foreground transition-all shadow-sm"
              placeholder="Lovelace"
              required
            />
          </div>
        </div>

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
              {t('auth.creatingAccount')}
            </>
          ) : (
            t('auth.signUp')
          )}
        </button>

        <OAuthButtons callbackUrl="/dashboard" mode="signUp" />

        <div className="mt-4 text-center text-sm text-muted-foreground">
          {t('auth.alreadyHaveAccount')}{' '}
          <a href="/login" className="text-primary hover:text-primary/80 font-medium">
            {t('auth.signInLink')}
          </a>
        </div>
      </form>
    </div>
  );
}
