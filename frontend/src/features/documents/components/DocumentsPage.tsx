'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileDown, CheckCircle, AlertCircle } from 'lucide-react';
import { documentsApi, DocumentFormat, GenerateDocumentRequest } from '../api/documents.api';
import { DocumentGeneratorForm } from './DocumentGeneratorForm';

export function DocumentsPage() {
  const { t } = useTranslation();
  const [formats, setFormats] = useState<DocumentFormat[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingFormats, setLoadingFormats] = useState(true);
  const [successFile, setSuccessFile] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    documentsApi
      .getFormats()
      .then((res) => setFormats(res.formats))
      .catch(() => setError(t('documents.errorLoadingFormats')))
      .finally(() => setLoadingFormats(false));
  }, [t]);

  const handleGenerate = async (data: {
    format: string;
    title: string;
    author: string;
    sections: { heading?: string; body?: string; level?: number }[];
    table: { headers: string[]; rows: (string | number)[][] } | null;
    metadata: { subject: string; keywords: string; company: string };
  }) => {
    setLoading(true);
    setError(null);
    setSuccessFile(null);

    const req: GenerateDocumentRequest = {
      format: data.format,
      title: data.title,
      author: data.author || undefined,
      sections: data.sections.length > 0 ? data.sections : undefined,
      table: data.table ?? undefined,
      metadata:
        data.metadata.subject || data.metadata.keywords || data.metadata.company
          ? data.metadata
          : undefined,
    };

    try {
      const blob = await documentsApi.generate(req);
      const fmt = formats.find((f) => f.id === data.format);
      const filename = `${data.title || 'document'}${fmt?.ext ?? '.' + data.format}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      setSuccessFile(filename);
    } catch {
      setError(t('documents.errorGenerating'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="bg-primary/10 p-2.5 rounded-xl border border-primary/20">
          <FileDown className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">{t('documents.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('documents.description')}</p>
        </div>
      </div>

      {/* Format badges */}
      {!loadingFormats && (
        <div className="flex flex-wrap gap-2">
          {formats.map((f) => (
            <span
              key={f.id}
              className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground"
            >
              {f.label}
            </span>
          ))}
        </div>
      )}

      {/* Status messages */}
      {successFile && (
        <div className="flex items-center gap-2 rounded-lg bg-green-500/10 border border-green-500/20 px-4 py-3 text-sm text-green-700 dark:text-green-400">
          <CheckCircle className="h-4 w-4 shrink-0" />
          {t('documents.successDownload', { filename: successFile })}
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Form */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        {loadingFormats ? (
          <div className="flex justify-center py-8 text-muted-foreground text-sm">
            {t('documents.loadingFormats')}
          </div>
        ) : (
          <DocumentGeneratorForm formats={formats} onSubmit={handleGenerate} loading={loading} />
        )}
      </div>
    </div>
  );
}
