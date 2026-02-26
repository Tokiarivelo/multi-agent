'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCreateApiKey } from '../hooks/useApiKeys';
import { ModelProvider } from '@/types';
import { useTranslation } from 'react-i18next';
import { KeyRound, X, ShieldCheck, Eye, EyeOff } from 'lucide-react';

interface CreateApiKeyModalProps {
  userId: string;
  onClose: () => void;
}

const PROVIDER_INFO: Record<string, { label: string; placeholder: string; color: string }> = {
  OPENAI: { label: 'OpenAI', placeholder: 'sk-proj-...', color: 'from-green-500 to-emerald-600' },
  ANTHROPIC: {
    label: 'Anthropic',
    placeholder: 'sk-ant-...',
    color: 'from-orange-500 to-amber-600',
  },
  GOOGLE: {
    label: 'Google AI',
    placeholder: 'AIzaSy...',
    color: 'from-blue-500 to-cyan-600',
  },
  AZURE: { label: 'Azure OpenAI', placeholder: 'xxxxxxxx...', color: 'from-sky-500 to-blue-600' },
  OLLAMA: { label: 'Ollama', placeholder: 'N/A (local)', color: 'from-gray-500 to-slate-600' },
  CUSTOM: {
    label: 'Custom',
    placeholder: 'your-api-key',
    color: 'from-purple-500 to-violet-600',
  },
};

export function CreateApiKeyModal({ userId, onClose }: CreateApiKeyModalProps) {
  const { t } = useTranslation();
  const [provider, setProvider] = useState<string>(ModelProvider.OPENAI);
  const [keyName, setKeyName] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);

  const createMutation = useCreateApiKey(userId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({ userId, provider, keyName, apiKey }, { onSuccess: () => onClose() });
  };

  const currentProvider = PROVIDER_INFO[provider] || PROVIDER_INFO.CUSTOM;

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
              <h3 className="text-xl font-bold text-white">{t('apiKeys.create.title')}</h3>
              <p className="text-sm text-white/80 mt-0.5">{t('apiKeys.create.subtitle')}</p>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 -mt-3">
          {/* Security note */}
          <div className="flex items-start gap-3 p-3 rounded-xl bg-primary/5 border border-primary/10">
            <ShieldCheck className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              {t('apiKeys.create.securityNote')}
            </p>
          </div>

          {/* Provider selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              {t('apiKeys.create.provider')}
            </label>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(PROVIDER_INFO).map(([key, info]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setProvider(key)}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all duration-200 ${
                    provider === key
                      ? 'bg-primary/10 border-primary/30 text-primary ring-1 ring-primary/20 shadow-sm'
                      : 'bg-muted/30 border-border/50 text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                  }`}
                >
                  {info.label}
                </button>
              ))}
            </div>
          </div>

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

          {/* API Key Value */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              {t('apiKeys.create.apiKeyValue')}
            </label>
            <div className="relative">
              <Input
                type={showKey ? 'text' : 'password'}
                required
                placeholder={currentProvider.placeholder}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
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
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="rounded-xl">
              {t('apiKeys.create.cancel')}
            </Button>
            <Button
              type="submit"
              disabled={createMutation.isPending || !keyName || !apiKey}
              className="rounded-xl"
            >
              {createMutation.isPending ? t('apiKeys.create.saving') : t('apiKeys.create.save')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
