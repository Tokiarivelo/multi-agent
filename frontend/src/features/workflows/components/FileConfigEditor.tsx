'use client';

import { useState, useEffect, DragEvent, ClipboardEvent } from 'react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { X, File as FileIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { workflowsApi } from '@/features/workflows/api/workflows.api';

export type FileRecord = { id?: string; name?: string; url: string; type?: string };

function FilePreviewItem({
  file,
  onRemove,
  onClick,
}: {
  file: FileRecord;
  onRemove: () => void;
  onClick: () => void;
}) {
  const isAbsolute = file.url.startsWith('http://') || file.url.startsWith('https://');
  const [previewUrl, setPreviewUrl] = useState<string | null>(isAbsolute ? file.url : null);

  useEffect(() => {
    let active = true;
    if (
      !isAbsolute &&
      file.id &&
      (file.type?.startsWith('image/') || file.name?.match(/\.(jpg|jpeg|png|gif|webp)$/i))
    ) {
      workflowsApi
        .getFileUrl(file.id)
        .then((res) => {
          let u = res.url;
          if (u.includes('://minio:')) u = u.replace('://minio:', '://localhost:');
          if (active) setPreviewUrl(u);
        })
        .catch(() => {
          /* mute */
        });
    }
    return () => {
      active = false;
    };
  }, [file.id, file.url, file.type, file.name, isAbsolute]);

  return (
    <div
      className="flex items-center justify-between text-sm border border-border/50 rounded-md p-2 bg-muted/20 hover:bg-muted/30 transition-colors cursor-pointer"
      onClick={onClick}
    >
      <div className="flex items-center gap-3 overflow-hidden flex-1">
        {previewUrl ? (
          <div className="h-8 w-8 rounded overflow-hidden shrink-0 bg-black/5 flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt={file.name || 'Preview'}
              className="object-cover h-full w-full"
            />
          </div>
        ) : (
          <FileIcon className="h-5 w-5 text-muted-foreground shrink-0" />
        )}
        <span className="truncate max-w-[200px]" title={file.name || file.url}>
          {file.name || file.url}
        </span>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 ml-2 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 shrink-0"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

export function FileConfigEditor({
  config,
  handleConfigChange,
}: {
  config: Record<string, unknown>;
  handleConfigChange: (k: string, v: unknown) => void;
}) {
  const { t } = useTranslation();
  const [isUploading, setIsUploading] = useState(false);

  const processFiles = async (files: FileList | File[]) => {
    setIsUploading(true);
    let successCount = 0;
    const currentFiles = Array.isArray(config.files) ? [...config.files] : [];

    for (let i = 0; i < files.length; i++) {
      try {
        const res = await workflowsApi.uploadFile(files[i] as File);
        currentFiles.push({
          id: res.id,
          url: res.url || res.key,
          name: files[i].name,
          type: files[i].type || 'unknown',
        });
        successCount++;
      } catch {
        toast.error(
          t('workflows.node_editor.uploadError', { defaultValue: 'Failed to upload file' }),
        );
      }
    }

    if (successCount > 0) {
      handleConfigChange('files', currentFiles);
      toast.success(
        t('workflows.node_editor.uploadSuccess', { defaultValue: 'File(s) uploaded successfully' }),
      );
    }
    setIsUploading(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    await processFiles(e.target.files);
    e.target.value = '';
  };

  const handleDragOver = (e: DragEvent) => e.preventDefault();
  const handleDrop = async (e: DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files?.length) {
      await processFiles(e.dataTransfer.files);
    }
  };
  const handlePaste = async (e: ClipboardEvent) => {
    if (e.clipboardData.files?.length) {
      await processFiles(e.clipboardData.files);
    }
  };

  const filesArray: FileRecord[] = Array.isArray(config.files) ? config.files : [];
  const imageFiles = filesArray.filter(
    (f) => f.type?.startsWith('image/') || f.name?.match(/\.(jpg|jpeg|png|gif|webp)$/i),
  );

  const [carouselIndex, setCarouselIndex] = useState<number>(0);
  const [carouselOpen, setCarouselOpen] = useState(false);
  const [carouselUrls, setCarouselUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    if (carouselOpen && imageFiles[carouselIndex]) {
      const f = imageFiles[carouselIndex];
      const isAbsolute = f.url.startsWith('http://') || f.url.startsWith('https://');
      if (!isAbsolute && f.id && !carouselUrls[f.id]) {
        workflowsApi
          .getFileUrl(f.id)
          .then((res) => {
            let u = res.url;
            if (u.includes('://minio:')) u = u.replace('://minio:', '://localhost:');
            setCarouselUrls((prev) => ({ ...prev, [f.id as string]: u }));
          })
          .catch(() => {});
      }
    }
  }, [carouselOpen, carouselIndex, imageFiles, carouselUrls]);

  const handleFileClick = async (file: FileRecord) => {
    const isImage =
      file.type?.startsWith('image/') || file.name?.match(/\.(jpg|jpeg|png|gif|webp)$/i);
    if (isImage) {
      const idx = imageFiles.findIndex((f) => f === file);
      if (idx !== -1) {
        setCarouselIndex(idx);
        setCarouselOpen(true);
      }
    } else {
      const isAbsolute = file.url.startsWith('http://') || file.url.startsWith('https://');
      if (isAbsolute) {
        window.open(file.url, '_blank');
      } else if (file.id) {
        try {
          const res = await workflowsApi.getFileUrl(file.id);
          let u = res.url;
          if (u.includes('://minio:')) u = u.replace('://minio:', '://localhost:');
          window.open(u, '_blank');
        } catch {
          toast.error('Failed to open file');
        }
      }
    }
  };

  const nextImage = () => setCarouselIndex((i) => (i + 1) % imageFiles.length);
  const prevImage = () => setCarouselIndex((i) => (i - 1 + imageFiles.length) % imageFiles.length);

  // handle arrow keys
  useEffect(() => {
    if (!carouselOpen) return;
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'ArrowRight') setCarouselIndex((i) => (i + 1) % imageFiles.length);
      if (e.key === 'ArrowLeft')
        setCarouselIndex((i) => (i - 1 + imageFiles.length) % imageFiles.length);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [carouselOpen, imageFiles.length]);

  return (
    <div className="space-y-4" onPaste={handlePaste}>
      <div className="space-y-2">
        <Label>{t('workflows.node_editor.file', { defaultValue: 'Files' })}</Label>
        <div className="flex gap-2 items-center">
          <div className="relative flex-1">
            <div
              className="border border-dashed border-border/50 rounded-md p-6 text-center cursor-pointer hover:bg-muted/10 transition-colors"
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            >
              <span className="text-sm text-muted-foreground">
                {isUploading ? 'Uploading...' : 'Click to select, drag files, or paste image'}
              </span>
              <Input
                type="file"
                multiple
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                onChange={handleFileUpload}
                disabled={isUploading}
              />
            </div>
          </div>
        </div>

        {filesArray.length > 0 && (
          <div className="space-y-2 mt-4 max-h-[150px] overflow-y-auto pr-1">
            {filesArray.map((f, idx: number) => (
              <FilePreviewItem
                key={`${idx}-${f.url}`}
                file={f}
                onRemove={() => {
                  const newFiles = [...filesArray];
                  newFiles.splice(idx, 1);
                  handleConfigChange('files', newFiles);
                }}
                onClick={() => handleFileClick(f)}
              />
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Or Add URL Manually</Label>
        <div className="flex gap-2">
          <Input
            placeholder="https://..."
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                const val = e.currentTarget.value;
                if (val) {
                  const currentFiles = [...filesArray];
                  currentFiles.push({ url: val, name: val, type: 'url' });
                  handleConfigChange('files', currentFiles);
                  e.currentTarget.value = '';
                }
              }
            }}
          />
        </div>
        <p className="text-[10px] text-muted-foreground italic mt-1">
          Press Enter to add URL to the list.
        </p>
      </div>

      {/* Carousel Modal */}
      <Dialog open={carouselOpen} onOpenChange={setCarouselOpen}>
        <DialogContent className="max-w-[90vw] h-[90vh] bg-transparent border-none shadow-none flex flex-col items-center justify-center p-0">
          <DialogTitle className="sr-only">Image Preview</DialogTitle>
          {imageFiles.length > 0 && imageFiles[carouselIndex] && (
            <div className="relative w-full h-full object-contain flex items-center justify-center group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={
                  carouselUrls[imageFiles[carouselIndex].id as string] ||
                  (imageFiles[carouselIndex].url.startsWith('http')
                    ? imageFiles[carouselIndex].url
                    : '')
                }
                alt={imageFiles[carouselIndex].name || 'preview'}
                className="max-h-[85vh] max-w-full object-contain shadow-2xl transition-all"
              />

              {imageFiles.length > 1 && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute left-4 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full bg-black/40 hover:bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      prevImage();
                    }}
                  >
                    <ChevronLeft className="h-8 w-8" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-4 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full bg-black/40 hover:bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      nextImage();
                    }}
                  >
                    <ChevronRight className="h-8 w-8" />
                  </Button>
                </>
              )}

              <div className="absolute bottom-4 left-0 w-full text-center text-white/80 text-sm drop-shadow-md">
                {imageFiles[carouselIndex].name || imageFiles[carouselIndex].url}
                <span className="ml-4 opacity-75">
                  ({carouselIndex + 1} of {imageFiles.length})
                </span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
