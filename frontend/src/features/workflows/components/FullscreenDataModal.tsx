'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { StructuredDataViewer } from './StructuredDataViewer';

interface FullscreenDataModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  data: unknown;
}

export function FullscreenDataModal({ open, onClose, title, data }: FullscreenDataModalProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const text = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl w-full h-[85vh] flex flex-col gap-0 p-0">
        <DialogHeader className="flex-row items-center justify-between px-4 py-3 border-b shrink-0">
          <DialogTitle className="text-sm font-semibold">{title}</DialogTitle>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs gap-1.5"
              onClick={handleCopy}
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-emerald-500" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              {copied
                ? t('workflows.fullscreen.copied')
                : t('workflows.fullscreen.copy')}
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>
        <div className="flex-1 min-h-0 overflow-auto p-4">
          <StructuredDataViewer data={data} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
