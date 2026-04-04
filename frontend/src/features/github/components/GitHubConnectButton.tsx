'use client';

import { useTranslation } from 'react-i18next';
import { Github, CheckCircle2, LogOut, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { GitHubConnection } from '@/types';

interface GitHubConnectButtonProps {
  connection: GitHubConnection;
  onConnect: () => void;
  onDisconnect: () => void;
  isLoading?: boolean;
}

export function GitHubConnectButton({
  connection,
  onConnect,
  onDisconnect,
  isLoading,
}: GitHubConnectButtonProps) {
  const { t } = useTranslation();

  if (connection.connected) {
    return (
      <div className="flex items-center gap-3">
        <Badge
          variant="secondary"
          className="flex items-center gap-1.5 bg-emerald-500/10 text-emerald-500 border-emerald-500/20 px-3 py-1"
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          {t('github.connect.connected')}
        </Badge>

        <div className="flex items-center gap-2">
          {connection.avatarUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={connection.avatarUrl}
              alt={connection.login ?? 'GitHub user'}
              className="h-7 w-7 rounded-full border border-border"
            />
          ) : (
            <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
              {connection.login?.[0]?.toUpperCase()}
            </div>
          )}
          <span className="text-sm font-medium text-muted-foreground">
            @{connection.login}
          </span>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={onDisconnect}
          className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10"
        >
          <LogOut className="h-3.5 w-3.5" />
          {t('github.connect.disconnect')}
        </Button>
      </div>
    );
  }

  return (
    <Button
      onClick={onConnect}
      disabled={isLoading}
      className="gap-2 bg-[#24292e] hover:bg-[#1b1f23] text-white"
      size="default"
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Github className="h-4 w-4" />
      )}
      {t('github.connect.connectButton')}
    </Button>
  );
}
