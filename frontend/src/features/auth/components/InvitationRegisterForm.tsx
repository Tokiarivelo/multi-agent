'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Users, Loader2 } from 'lucide-react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { setApiToken, apiClient } from '@/lib/api-client';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

interface InvitationDetails {
  email: string;
  role: string;
  workflow: { id: string; name: string };
  inviter: { firstName: string; lastName: string };
}

const INPUT_CLS =
  'w-full px-4 py-3 bg-background/50 border border-border/60 rounded-xl focus:ring-2 focus:ring-primary/40 focus:border-primary/50 outline-none text-foreground placeholder-muted-foreground transition-all shadow-sm disabled:opacity-60';

export default function InvitationRegisterForm({ invitationToken }: { invitationToken: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const [invitation, setInvitation] = useState<InvitationDetails | null>(null);
  const [inviteError, setInviteError] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    axios
      .get(`${API_URL}/api/auth/invitation-preview?token=${invitationToken}`)
      .then((res) => {
        setInvitation(res.data);
        setEmail(res.data.email ?? '');
      })
      .catch(() => setInviteError(t('auth.invitationNotFound')));
  }, [invitationToken, t]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { data } = await axios.post(`${API_URL}/api/auth/register`, {
        firstName,
        lastName,
        email,
        password,
      });

      if (data.user?.id) {
        setApiToken(data.accessToken);
        try {
          await apiClient.post(
            `/api/workflows/invitations/accept?userId=${data.user.id}`,
            { token: invitationToken },
          );
        } catch (acceptErr) {
          console.error('[invitation] accept failed:', acceptErr);
        } finally {
          setApiToken(null);
        }
      }

      const workflowId = invitation?.workflow?.id;
      const loginUrl = workflowId
        ? `/login?registered=true&redirectTo=${encodeURIComponent(`/workflows/${workflowId}`)}`
        : '/login?registered=true';
      router.push(loginUrl);
    } catch (err: unknown) {
      setError(
        axios.isAxiosError(err)
          ? err.response?.data?.message || t('auth.registrationFailed')
          : t('auth.registrationFailed'),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md p-8 bg-card/60 backdrop-blur-2xl rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] border border-border/50">
      <div className="flex flex-col items-center mb-6">
        <div className="p-3 bg-primary/10 rounded-full mb-4 ring-1 ring-primary/20">
          <Users className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-3xl font-bold tracking-tight text-foreground/90">
          {t('auth.createAccount')}
        </h2>
        {invitation && (
          <div className="mt-3 w-full rounded-xl bg-primary/10 border border-primary/20 p-3 text-sm text-center">
            <p className="text-foreground/80">
              <span className="font-semibold">
                {invitation.inviter.firstName} {invitation.inviter.lastName}
              </span>{' '}
              {t('auth.invitedYouTo')}{' '}
              <span className="font-semibold">{invitation.workflow.name}</span>
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {t('auth.inviteRole')}: {invitation.role}
            </p>
          </div>
        )}
        {inviteError && <p className="mt-3 text-sm text-amber-500">{inviteError}</p>}
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
            <label className="text-sm font-medium text-foreground/80">{t('auth.firstNameLabel')}</label>
            <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} className={INPUT_CLS} placeholder="Ada" required />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground/80">{t('auth.lastNameLabel')}</label>
            <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} className={INPUT_CLS} placeholder="Lovelace" required />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground/80">{t('auth.emailLabel')}</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={INPUT_CLS} placeholder="name@company.com" required readOnly={!!invitation} />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground/80">{t('auth.passwordLabel')}</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={INPUT_CLS} placeholder="••••••••" required />
        </div>

        <button type="submit" disabled={loading} className="w-full py-3 px-4 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-xl transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary/20 flex justify-center items-center gap-2">
          {loading ? (
            <><Loader2 className="w-5 h-5 animate-spin" />{t('auth.creatingAccount')}</>
          ) : (
            t('auth.signUp')
          )}
        </button>

        <div className="mt-4 text-center text-sm text-muted-foreground">
          {t('auth.alreadyHaveAccount')}{' '}
          <a
            href={`/login?redirectTo=${encodeURIComponent(`/invitations/accept?token=${invitationToken}`)}`}
            className="text-primary hover:text-primary/80 font-medium"
          >
            {t('auth.signInLink')}
          </a>
        </div>
      </form>
    </div>
  );
}
