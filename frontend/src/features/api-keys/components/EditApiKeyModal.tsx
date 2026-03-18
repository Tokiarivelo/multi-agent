'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useUpdateApiKey } from '../hooks/useApiKeys';
import { ApiKey } from '@/types';
import { useTranslation } from 'react-i18next';
import { KeyRound, X, Eye, EyeOff } from 'lucide-react';

interface EditApiKeyModalProps {
  userId: string;
  apiKey: ApiKey;
  onClose: () => void;
}

const PROVIDER_INFO: Record<string, { label: string; color: string }> = {
  OPENAI: { label: 'OpenAI', color: 'from-green-500 to-emerald-600' },
  ANTHROPIC: { label: 'Anthropic', color: 'from-orange-500 to-amber-600' },
  GOOGLE: { label: 'Google AI', color: 'from-blue-500 to-cyan-600' },
  AZURE: { label: 'Azure OpenAI', color: 'from-sky-500 to-blue-600' },
  OLLAMA: { label: 'Ollama', color: 'from-gray-500 to-slate-600' },
  CUSTOM: { label: 'Custom', color: 'from-purple-500 to-violet-600' },
};

export function EditApiKeyModal({ userId, apiKey, onClose }: EditApiKeyModalProps) {
  const { t } = useTranslation();
  const [keyName, setKeyName] = useState(apiKey.keyName || '');
  const [apiKeyValue, setApiKeyValue] = useState('');
  const [showKey, setShowKey] = useState(false);

  const updateMutation = useUpdateApiKey(userId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(
      { id: apiKey.id, input: { keyName, ...(apiKeyValue ? { apiKey: apiKeyValue } : {}) } },
      { onSuccess: () => onClose() },
    );
  };

  const currentProvider = PROVIDER_INFO[apiKey.provider] || PROVIDER_INFO.CUSTOM;

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div
        className="bg-card text-card-foreground shadow-2xl border border-border/60 rounded-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with gradient accent */}
        <div className={`relative bg-linear-to-r ${currentProvider.color} p-6 pb-8`}>
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors rounded-lg p-1 hover:bg-white/10"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="bg-white/20 backdrop-blur-sm p-2.5 rounded-xl border border-white/20">
              <KeyRound className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">{t('apiKeys.edit.title', 'Edit API Key')}</h3>
              <p className="text-sm text-white/80 mt-0.5">{t('apiKeys.edit.subtitle', 'Update your API key details')}</p>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 -mt-3">
          {/* Key Name */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              {t('apiKeys.create.keyName')}
            </label>
            <Input
              required
              placeholder={t('apiKeys.create.keyNamePlaceholder')}
              value={keyName}
              onChange={(e) => setKeyName(e.target.value)}
              className="rounded-xl"
            />
          </div>

          {/* Provider (Readonly for reference) */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              {t('apiKeys.create.provider')}
            </label>
            <Input
              disabled
              value={currentProvider.label}
              className="rounded-xl bg-muted/50 text-muted-foreground"
            />
          </div>

          {/* Prefix (Readonly) */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Key Prefix
            </label>
            <Input
              disabled
              value={`${apiKey.keyPrefix}...`}
              className="rounded-xl bg-muted/50 text-muted-foreground font-mono"
            />
          </div>

          {/* API Key Value */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              {t('apiKeys.edit.newApiKeyValue', 'New API Key (Optional)')}
            </label>
            <div className="relative">
              <Input
                type={showKey ? 'text' : 'password'}
                placeholder={t('apiKeys.edit.leaveBlankUnchanged', 'Leave blank to keep current key')}
                value={apiKeyValue}
                onChange={(e) => setApiKeyValue(e.target.value)}
                className="rounded-xl pr-10"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Enter a new key only if you want to replace the existing one.
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="rounded-xl">
              {t('apiKeys.create.cancel')}
            </Button>
            <Button
              type="submit"
              disabled={updateMutation.isPending || !keyName}
              className="rounded-xl"
            >
              {updateMutation.isPending ? t('apiKeys.create.saving') : t('apiKeys.create.save')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
