import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCreateModel, useProviderModels } from '../hooks/useModels';
import { ModelProvider, ProviderModel } from '@/types';

interface CreateModelModalProps {
  onClose: () => void;
}

export function CreateModelModal({ onClose }: CreateModelModalProps) {
  const { t } = useTranslation();

  const [name, setName] = useState('');
  const [provider, setProvider] = useState<string>(ModelProvider.OPENAI);
  const [modelId, setModelId] = useState('');
  const [maxTokens, setMaxTokens] = useState<number>(4000);
  const [useCustomModelId, setUseCustomModelId] = useState(false);
  const [apiBaseUrl, setApiBaseUrl] = useState('');

  const isCustomProvider = provider === ModelProvider.CUSTOM;

  const createModelMutation = useCreateModel();
  const {
    data: providerModels,
    isLoading: isLoadingModels,
    error: modelsError,
  } = useProviderModels(isCustomProvider ? null : provider);

  // Reset selection when provider changes (inline, no useEffect)
  const handleProviderChange = (newProvider: string) => {
    setProvider(newProvider);
    setModelId('');
    setUseCustomModelId(false);
    setApiBaseUrl('');
  };

  // Auto-fill maxTokens when a provider model is selected
  const handleModelSelect = (selectedModelId: string) => {
    setModelId(selectedModelId);
    const selected = providerModels?.find((m: ProviderModel) => m.id === selectedModelId);
    if (selected?.maxTokens) {
      setMaxTokens(selected.maxTokens);
    }
    if (selected?.name && !name) {
      setName(selected.name);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createModelMutation.mutate(
      {
        name,
        provider,
        modelId,
        maxTokens,
        supportsStreaming: true,
        isActive: true,
      },
      { onSuccess: () => onClose() },
    );
  };

  const hasModels = providerModels && providerModels.length > 0;

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card text-card-foreground shadow-lg border rounded-xl w-full max-w-md p-6 space-y-6">
        <div>
          <h3 className="text-xl font-semibold">{t('models.create.title')}</h3>
          <p className="text-sm text-muted-foreground">{t('models.create.subtitle')}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Provider */}
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('models.create.provider')}</label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              value={provider}
              onChange={(e) => handleProviderChange(e.target.value)}
            >
              {Object.values(ModelProvider).map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            {isCustomProvider && (
              <p className="text-xs text-muted-foreground">{t('models.create.customHint')}</p>
            )}
          </div>

          {/* Model Engine ID */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">{t('models.create.modelEngineId')}</label>
              {!isCustomProvider && hasModels && (
                <button
                  type="button"
                  className="text-xs text-primary hover:underline cursor-pointer"
                  onClick={() => {
                    setUseCustomModelId(!useCustomModelId);
                    if (!useCustomModelId) setModelId('');
                  }}
                >
                  {useCustomModelId
                    ? t('models.create.selectFromList')
                    : t('models.create.enterManually')}
                </button>
              )}
            </div>

            {isCustomProvider ? (
              <Input
                required
                placeholder={t('models.create.customModelPlaceholder')}
                value={modelId}
                onChange={(e) => setModelId(e.target.value)}
              />
            ) : isLoadingModels ? (
              <div className="flex items-center gap-2 h-10 px-3 py-2 rounded-md border border-input bg-background text-sm text-muted-foreground">
                <svg
                  className="animate-spin h-4 w-4"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                {t('models.create.fetchingModels')}
              </div>
            ) : modelsError ? (
              <div className="space-y-2">
                <div className="text-xs text-amber-500 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-md px-3 py-2">
                  {t('models.create.fetchError')}
                </div>
                <Input
                  required
                  placeholder="e.g. gpt-4-turbo-preview"
                  value={modelId}
                  onChange={(e) => setModelId(e.target.value)}
                />
              </div>
            ) : !hasModels || useCustomModelId ? (
              <Input
                required
                placeholder="e.g. gpt-4-turbo-preview"
                value={modelId}
                onChange={(e) => setModelId(e.target.value)}
              />
            ) : (
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={modelId}
                required
                onChange={(e) => handleModelSelect(e.target.value)}
              >
                <option value="" disabled>
                  {t('models.create.selectModel')}
                </option>
                {providerModels?.map((m: ProviderModel) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                    {m.maxTokens ? ` (${m.maxTokens.toLocaleString()} tokens)` : ''}
                  </option>
                ))}
              </select>
            )}

            {!isCustomProvider && modelId && !useCustomModelId && hasModels && (
              <p className="text-xs text-muted-foreground">
                {providerModels?.find((m: ProviderModel) => m.id === modelId)?.description}
              </p>
            )}
          </div>

          {/* API Base URL — only for CUSTOM provider */}
          {isCustomProvider && (
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('models.create.apiBaseUrl')}</label>
              <Input
                placeholder="e.g. https://my-llm-server.com/v1"
                value={apiBaseUrl}
                onChange={(e) => setApiBaseUrl(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">{t('models.create.apiBaseUrlHint')}</p>
            </div>
          )}

          {/* Model Display Name */}
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('models.create.displayName')}</label>
            <Input
              required
              placeholder="e.g. GPT-4 Turbo"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Max Tokens */}
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('models.create.maxTokens')}</label>
            <Input
              type="number"
              required
              value={maxTokens}
              onChange={(e) => setMaxTokens(Number(e.target.value))}
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              {t('models.create.cancel')}
            </Button>
            <Button type="submit" disabled={createModelMutation.isPending}>
              {createModelMutation.isPending ? t('models.create.saving') : t('models.create.save')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
