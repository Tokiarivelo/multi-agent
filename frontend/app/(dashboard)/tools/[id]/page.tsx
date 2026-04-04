'use client';

import { use } from 'react';
import { useTool } from '@/features/tools/hooks/useTools';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { EditToolForm } from '@/features/tools/components/EditToolForm';
import { useTranslation } from 'react-i18next';

export default function ToolDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t } = useTranslation();
  const { data: tool, isLoading, error } = useTool(id);

  if (isLoading) return <LoadingSpinner />;
  if (error) return <div className="text-destructive">{t('tools.error')}</div>;
  if (!tool) return <div>{t('tools.notFound')}</div>;

  return <EditToolForm tool={tool} />;
}
