'use client';

import { useTranslation } from 'react-i18next';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useModels } from '@/features/models/hooks/useModels';

interface ModelSelectorProps {
  value: string;
  onChange: (modelId: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

export function ModelSelector({
  value,
  onChange,
  disabled,
  placeholder,
  className,
}: ModelSelectorProps) {
  const { t } = useTranslation();
  const { data: modelsData, isLoading } = useModels(1, 100);
  const models = modelsData?.data ?? [];

  const isDisabled = disabled || isLoading;

  return (
    <Select value={value} onValueChange={isDisabled ? undefined : onChange}>
      <SelectTrigger className={className} disabled={isDisabled}>
        <SelectValue placeholder={placeholder ?? t('workflows.ai.selectModel', 'Select a model…')} />
      </SelectTrigger>
      <SelectContent>
        {models.length === 0 && (
          <SelectItem value="_none">
            {isLoading
              ? t('workflows.ai.loadingModels', 'Loading models…')
              : t('workflows.ai.noModels', 'No models configured')}
          </SelectItem>
        )}
        {models.map((model) => (
          <SelectItem key={model.id} value={model.id}>
            <span className="font-medium">{model.name}</span>
            {model.provider && (
              <span className="ml-1.5 text-xs text-muted-foreground">({model.provider as string})</span>
            )}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
