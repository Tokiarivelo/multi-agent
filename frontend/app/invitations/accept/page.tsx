'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { Loader2, Users, CheckCircle2, AlertCircle } from 'lucide-react';
import { acceptInvitation } from '@/features/workflows/api/workflow-sharing.api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

interface InvitationDetails {
  workflow: { id: string; name: string };
  inviter: { firstName: string; lastName: string };
  role: string;
  email: string;
}

type Phase = 'loading' | 'accepting' | 'done' | 'error' | 'redirecting-login';

function AcceptContent() {
  const { t } = useTranslation();
  const { data: session, status: authStatus } = useSession();
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token') ?? '';

  const [invitation, setInvitation] = useState<InvitationDetails | null>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  // Step 1 — fetch invitation details (public endpoint, no auth needed)
  useEffect(() => {
    if (!token) return;
    axios
      .get(`${API_URL}/api/workflows/invitations/by-token?token=${token}`)
      .then((res) => setInvitation(res.data))
      .catch(() => {
        setErrorMsg(t('auth.invitationNotFound'));
        setPhase('error');
      });
  }, [token, t]);

  // Step 2 — once invitation is loaded and auth state is resolved, act
  useEffect(() => {
    if (!invitation || authStatus === 'loading') return;

    if (authStatus === 'unauthenticated') {
      const redirectTo = encodeURIComponent(`/invitations/accept?token=${token}`);
      router.replace(`/login?redirectTo=${redirectTo}`);
      return;
    }

    // Authenticated — accept the invitation
    const userId = (session?.user as { id?: string })?.id;
    if (!userId) return;

    acceptInvitation(token, userId)
      .then(() => {
        setPhase('done');
        router.replace(`/workflows/${invitation.workflow.id}`);
      })
      .catch((err) => {
        const msg: string = (err as { response?: { data?: { message?: string } } }).response?.data?.message ?? '';
        if (msg.toLowerCase().includes('already')) {
          router.replace(`/workflows/${invitation.workflow.id}`);
          return;
        }
        setErrorMsg(msg || t('auth.invitationNotFound'));
        setPhase('error');
      });
  }, [invitation, authStatus, session, token, router, t]);

  // Derive display phase without storing it as state
  const effectivePhase: Phase = !token
    ? 'error'
    : authStatus === 'unauthenticated' && invitation !== null
    ? 'redirecting-login'
    : authStatus === 'authenticated' && invitation !== null && phase === 'loading'
    ? 'accepting'
    : phase;

  const effectiveErrorMsg = !token ? t('auth.invitationNotFound') : errorMsg;

  const inviterName = invitation
    ? `${invitation.inviter.firstName} ${invitation.inviter.lastName}`.trim()
    : '';

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="w-full max-w-md p-8 bg-card/60 backdrop-blur-2xl rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] border border-border/50 flex flex-col items-center gap-5">

        {(effectivePhase === 'loading' || effectivePhase === 'accepting' || effectivePhase === 'redirecting-login') && (
          <>
            <div className="p-3 bg-primary/10 rounded-full ring-1 ring-primary/20">
              <Users className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-2xl font-bold text-foreground/90">{t('auth.acceptInvitation')}</h2>

            {invitation && (
              <div className="w-full rounded-xl bg-primary/10 border border-primary/20 p-3 text-sm text-center">
                <p className="text-foreground/80">
                  <span className="font-semibold">{inviterName}</span>{' '}
                  {t('auth.invitedYouTo')}{' '}
                  <span className="font-semibold">{invitation.workflow.name}</span>
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('auth.inviteRole')}: {invitation.role}
                </p>
              </div>
            )}

            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              {effectivePhase === 'accepting'
                ? t('auth.acceptingInvitation')
                : effectivePhase === 'redirecting-login'
                  ? t('auth.loginToAccept')
                  : t('auth.acceptingInvitation')}
            </div>
          </>
        )}

        {effectivePhase === 'done' && (
          <>
            <div className="p-3 bg-green-500/10 rounded-full ring-1 ring-green-500/20">
              <CheckCircle2 className="w-8 h-8 text-green-500" />
            </div>
            <p className="text-foreground/80 text-sm">{t('auth.invitationAccepted')}</p>
          </>
        )}

        {effectivePhase === 'error' && (
          <>
            <div className="p-3 bg-destructive/10 rounded-full ring-1 ring-destructive/20">
              <AlertCircle className="w-8 h-8 text-destructive" />
            </div>
            <p className="text-destructive text-sm text-center">{effectiveErrorMsg}</p>
            <a
              href="/dashboard"
              className="text-primary hover:text-primary/80 text-sm font-medium"
            >
              {t('common.Dashboard') ?? 'Go to Dashboard'}
            </a>
          </>
        )}
      </div>
    </div>
  );
}

export default function AcceptInvitationPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      }
    >
      <AcceptContent />
    </Suspense>
  );
}
