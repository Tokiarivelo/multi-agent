'use client';

import { useApiKeys, useDeleteApiKey, useUpdateApiKey } from '../hooks/useApiKeys';
import { useSession } from 'next-auth/react';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { CreateApiKeyModal } from './CreateApiKeyModal';
import { useTranslation } from 'react-i18next';
import { ApiKey } from '@/types';
import {
  KeyRound,
  Plus,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Shield,
  Clock,
  Activity,
  AlertTriangle,
} from 'lucide-react';

const PROVIDER_STYLES: Record<string, { bg: string; text: string; border: string; icon: string }> =
  {
    OPENAI: {
      bg: 'bg-green-500/10 dark:bg-green-500/15',
      text: 'text-green-700 dark:text-green-400',
      border: 'border-green-500/20',
      icon: '🟢',
    },
    ANTHROPIC: {
      bg: 'bg-orange-500/10 dark:bg-orange-500/15',
      text: 'text-orange-700 dark:text-orange-400',
      border: 'border-orange-500/20',
      icon: '🟠',
    },
    GOOGLE: {
      bg: 'bg-blue-500/10 dark:bg-blue-500/15',
      text: 'text-blue-700 dark:text-blue-400',
      border: 'border-blue-500/20',
      icon: '🔵',
    },
    AZURE: {
      bg: 'bg-sky-500/10 dark:bg-sky-500/15',
      text: 'text-sky-700 dark:text-sky-400',
      border: 'border-sky-500/20',
      icon: '🔷',
    },
    OLLAMA: {
      bg: 'bg-gray-500/10 dark:bg-gray-500/15',
      text: 'text-gray-700 dark:text-gray-400',
      border: 'border-gray-500/20',
      icon: '⬜',
    },
    CUSTOM: {
      bg: 'bg-purple-500/10 dark:bg-purple-500/15',
      text: 'text-purple-700 dark:text-purple-400',
      border: 'border-purple-500/20',
      icon: '🟣',
    },
  };

function getProviderStyle(provider: string) {
  return (
    PROVIDER_STYLES[provider] || {
      bg: 'bg-muted/50',
      text: 'text-muted-foreground',
      border: 'border-border/50',
      icon: '⚪',
    }
  );
}

function formatDate(dateStr: string | undefined) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

interface ApiKeyCardProps {
  apiKey: ApiKey;
  onDelete: (id: string) => void;
  onToggleActive: (id: string, isActive: boolean) => void;
  isDeleting: boolean;
  isUpdating: boolean;
}

function ApiKeyCard({ apiKey, onDelete, onToggleActive, isDeleting, isUpdating }: ApiKeyCardProps) {
  const { t } = useTranslation();
  const style = getProviderStyle(apiKey.provider);

  return (
    <Card className="futuristic-card group overflow-hidden">
      <CardContent className="p-0">
        {/* Top colored accent bar */}
        <div className={`h-1 ${style.bg}`} />

        <div className="p-5">
          {/* Header row */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className={`shrink-0 p-2.5 rounded-xl ${style.bg} border ${style.border}`}>
                <KeyRound className={`h-5 w-5 ${style.text}`} />
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold text-foreground truncate">
                  {apiKey.keyName || t('apiKeys.card.unnamed')}
                </h3>
                <div className={`text-xs font-medium mt-0.5 ${style.text}`}>{apiKey.provider}</div>
              </div>
            </div>

            {/* Status badges */}
            <div className="flex items-center gap-2 shrink-0">
              {apiKey.isValid ? (
                <Badge variant="success" className="gap-1">
                  <Shield className="h-3 w-3" />
                  {t('apiKeys.card.valid')}
                </Badge>
              ) : (
                <Badge variant="destructive" className="gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {t('apiKeys.card.invalid')}
                </Badge>
              )}
              <Badge variant={apiKey.isActive ? 'default' : 'secondary'}>
                {apiKey.isActive ? t('apiKeys.card.active') : t('apiKeys.card.inactive')}
              </Badge>
            </div>
          </div>

          {/* Metadata row */}
          <div className="flex items-center gap-4 mt-4 pt-4 border-t border-border/40">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              <span>
                {t('apiKeys.card.created')}: {formatDate(apiKey.createdAt)}
              </span>
            </div>
            {apiKey.lastUsedAt && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Activity className="h-3.5 w-3.5" />
                <span>
                  {t('apiKeys.card.lastUsed')}: {formatDate(apiKey.lastUsedAt)}
                </span>
              </div>
            )}
          </div>

          {/* Actions row */}
          <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-border/40">
            <Button
              variant="outline"
              size="sm"
              disabled={isUpdating}
              onClick={() => onToggleActive(apiKey.id, !apiKey.isActive)}
              className="rounded-xl text-xs gap-1.5"
            >
              {apiKey.isActive ? (
                <>
                  <ToggleRight className="h-3.5 w-3.5" />
                  {t('apiKeys.card.deactivate')}
                </>
              ) : (
                <>
                  <ToggleLeft className="h-3.5 w-3.5" />
                  {t('apiKeys.card.activate')}
                </>
              )}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={isDeleting}
              onClick={() => {
                if (confirm(t('apiKeys.card.confirmDelete'))) {
                  onDelete(apiKey.id);
                }
              }}
              className="rounded-xl text-xs gap-1.5"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {t('apiKeys.card.delete')}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function ApiKeysPage() {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const user = session?.user;
  const { data, isLoading, error } = useApiKeys(user?.id);
  const deleteMutation = useDeleteApiKey(user?.id);
  const updateMutation = useUpdateApiKey(user?.id);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  if (!user) return null;

  const apiKeys: ApiKey[] = Array.isArray(data)
    ? data
    : data && typeof data === 'object' && 'data' in data
      ? (data as { data: ApiKey[] }).data
      : [];

  // Group keys by provider
  const grouped = apiKeys.reduce(
    (acc, key) => {
      const provider = key.provider;
      if (!acc[provider]) acc[provider] = [];
      acc[provider].push(key);
      return acc;
    },
    {} as Record<string, ApiKey[]>,
  );

  const handleToggleActive = (id: string, isActive: boolean) => {
    updateMutation.mutate({ id, input: { isActive } });
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="bg-primary/10 p-3 rounded-2xl border border-primary/20">
            <KeyRound className="h-7 w-7 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {t('apiKeys.title')}
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">{t('apiKeys.subtitle')}</p>
          </div>
        </div>
        <Button
          onClick={() => setIsCreateModalOpen(true)}
          className="rounded-xl gap-2 shadow-sm"
          id="add-api-key-btn"
        >
          <Plus className="h-4 w-4" />
          {t('apiKeys.addKey')}
        </Button>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="glass-panel rounded-2xl">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="bg-primary/10 p-2 rounded-xl">
              <KeyRound className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{apiKeys.length}</p>
              <p className="text-xs text-muted-foreground">{t('apiKeys.stats.total')}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-panel rounded-2xl">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="bg-green-500/10 p-2 rounded-xl">
              <Shield className="h-4 w-4 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">
                {apiKeys.filter((k) => k.isActive && k.isValid).length}
              </p>
              <p className="text-xs text-muted-foreground">{t('apiKeys.stats.active')}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-panel rounded-2xl">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="bg-accent p-2 rounded-xl">
              <Activity className="h-4 w-4 text-accent-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{Object.keys(grouped).length}</p>
              <p className="text-xs text-muted-foreground">{t('apiKeys.stats.providers')}</p>
            </div>
          </CardContent>
        </Card>
      </div>
      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <LoadingSpinner />
        </div>
      ) : error ? (
        <Card className="rounded-2xl border-destructive/20">
          <CardContent className="p-8 text-center">
            <AlertTriangle className="h-10 w-10 text-destructive mx-auto mb-3" />
            <p className="text-destructive font-medium">{t('apiKeys.error')}</p>
          </CardContent>
        </Card>
      ) : apiKeys.length === 0 ? (
        /* Empty state */
        <Card className="futuristic-card rounded-2xl">
          <CardContent className="p-12 text-center">
            <div className="bg-muted/50 p-4 rounded-2xl inline-block mb-4">
              <KeyRound className="h-12 w-12 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">
              {t('apiKeys.empty.title')}
            </h3>
            <p className="text-muted-foreground text-sm max-w-md mx-auto mb-6">
              {t('apiKeys.empty.description')}
            </p>
            <Button onClick={() => setIsCreateModalOpen(true)} className="rounded-xl gap-2">
              <Plus className="h-4 w-4" />
              {t('apiKeys.empty.addFirst')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        /* Keys grid grouped by provider */
        <div className="space-y-6">
          {Object.entries(grouped).map(([provider, keys]) => {
            const style = getProviderStyle(provider);
            return (
              <div key={provider}>
                <div className="flex items-center gap-2 mb-3 px-1">
                  <span className="text-sm">{style.icon}</span>
                  <h2 className={`text-sm font-semibold ${style.text}`}>{provider}</h2>
                  <span className="text-xs text-muted-foreground">
                    ({keys.length} {keys.length === 1 ? t('apiKeys.key') : t('apiKeys.keys')})
                  </span>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  {keys.map((key) => (
                    <ApiKeyCard
                      key={key.id}
                      apiKey={key}
                      onDelete={(id) => deleteMutation.mutate(id)}
                      onToggleActive={handleToggleActive}
                      isDeleting={deleteMutation.isPending}
                      isUpdating={updateMutation.isPending}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {/* Create Modal */}
      {isCreateModalOpen && (
        <CreateApiKeyModal userId={user.id} onClose={() => setIsCreateModalOpen(false)} />
      )}
    </div>
  );
}
