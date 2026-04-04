'use client';

import { useTranslation } from 'react-i18next';
import { Github, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useGitHub } from '../hooks/useGitHub';
import { GitHubConnectButton } from './GitHubConnectButton';
import { GitHubRepoList } from './GitHubRepoList';

export function GitHubIntegrationPage() {
  const { t } = useTranslation();
  const { connection, connect, disconnect, repos, isLoadingRepos } = useGitHub();

  const capabilities = [
    t('github.capabilities.codeBrowsing'),
    t('github.capabilities.fileEditing'),
    t('github.capabilities.branchManagement'),
    t('github.capabilities.issuesPRs'),
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-[#24292e] flex items-center justify-center shadow-sm">
            <Github className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">{t('github.title')}</h2>
            <p className="text-muted-foreground text-sm">{t('github.subtitle')}</p>
          </div>
        </div>

        <GitHubConnectButton
          connection={connection}
          onConnect={connect}
          onDisconnect={disconnect}
        />
      </div>

      <hr className="border-border/50" />

      {/* Info banner */}
      <div className="flex items-start gap-3 rounded-lg border border-blue-500/20 bg-blue-500/5 p-4">
        <ShieldCheck className="h-5 w-5 text-blue-500 mt-0.5 shrink-0" />
        <div className="text-sm">
          <p className="font-medium text-blue-500 mb-1">{t('github.howItWorks')}</p>
          <p
            className="text-muted-foreground"
            dangerouslySetInnerHTML={{ __html: t('github.howItWorksDesc') }}
          />
        </div>
      </div>

      {/* Category badges */}
      <div className="flex gap-2 flex-wrap">
        {capabilities.map((cap) => (
          <Badge key={cap} variant="secondary" className="text-xs">
            {cap}
          </Badge>
        ))}
      </div>

      {/* Repository list */}
      <GitHubRepoList
        repos={repos}
        isLoading={isLoadingRepos}
        connected={connection.connected}
      />
    </div>
  );
}
