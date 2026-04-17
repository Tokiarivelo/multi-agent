'use client';

import { useTools, useDeleteTool } from '../hooks/useTools';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Plus, Wrench, Play, Pencil, Trash2, Sparkles } from 'lucide-react';
import Link from 'next/link';
import * as LucideIcons from 'lucide-react';
import { useState } from 'react';
import { Tool } from '@/types';
import { ExecuteToolModal } from './ExecuteToolModal';
import { useTranslation } from 'react-i18next';
import { DeleteGuardDialog } from '@/components/shared/DeleteGuardDialog';
import { useDeleteGuard } from '@/hooks/useDeleteGuard';
import { ToolAiGenerateModal } from './ToolAiGenerateModal';

const DynamicIcon = ({ name, className }: { name?: string; className?: string }) => {
  if (!name) return <Wrench className={className} />;
  const icons = LucideIcons as unknown as Record<string, React.ElementType>;
  const IconComponent =
    icons[name] ||
    icons[name.charAt(0).toUpperCase() + name.slice(1)];
  if (!IconComponent) return <Wrench className={className} />;
  return <IconComponent className={className} />;
};

export function ToolList() {
  const { t } = useTranslation();
  const { data, isLoading, error } = useTools();
  const deleteTool = useDeleteTool();
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null);
  const [pendingDeleteTool, setPendingDeleteTool] = useState<Tool | null>(null);
  const deleteGuard = useDeleteGuard('tool');
  const [aiModalOpen, setAiModalOpen] = useState(false);

  if (isLoading) return <LoadingSpinner />;
  if (error) return <div className="text-destructive">{t('tools.error')}</div>;

  const tools = data?.data || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{t('tools.title')}</h2>
          <p className="text-muted-foreground">{t('tools.description')}</p>
        </div>
        <Button
          variant="outline"
          className="gap-2 border-amber-500/30 text-amber-600 hover:bg-amber-500/10 transition-all"
          onClick={() => setAiModalOpen(true)}
        >
          <Sparkles className="h-4 w-4" />
          Generate with AI
        </Button>
        <Link href="/tools/new">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            {t('tools.newTool')}
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('tools.allTools')}</CardTitle>
          <CardDescription>
            {t(`tools.count_${tools.length === 1 ? 'one' : 'other'}`, { count: tools.length })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {tools.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">{t('tools.noTools')}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">{t('tools.table.icon')}</TableHead>
                  <TableHead>{t('tools.table.tool')}</TableHead>
                  <TableHead>{t('tools.table.category')}</TableHead>
                  <TableHead>{t('tools.table.origin')}</TableHead>
                  <TableHead>{t('tools.table.params')}</TableHead>
                  <TableHead className="w-[140px]">{t('tools.table.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tools.map((tool) => (
                  <TableRow key={tool.id}>
                    <TableCell>
                      <div className="bg-muted/50 p-2 rounded-md inline-block">
                        <DynamicIcon name={tool.icon} className="h-4 w-4 text-primary" />
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col space-y-1">
                        <Link
                          href={`/tools/${tool.id}`}
                          className="font-semibold hover:underline flex items-center gap-2"
                        >
                          {tool.name}
                        </Link>
                        <span className="text-xs text-muted-foreground line-clamp-1">
                          {tool.description}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-background">
                        {tool.category || 'CUSTOM'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {tool.isBuiltIn ? (
                        <Badge
                          variant="secondary"
                          className="bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 border-transparent"
                        >
                          {t('tools.origin.builtIn')}
                        </Badge>
                      ) : (
                        <Badge
                          variant="secondary"
                          className="bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 border-transparent"
                        >
                          {t('tools.origin.custom')}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {t('tools.table.paramsDefined', {
                        count: Array.isArray(tool.parameters) ? tool.parameters.length : 0,
                      })}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1 h-7 px-2"
                          onClick={() => setSelectedTool(tool)}
                        >
                          <Play className="h-3 w-3" />
                          {t('tools.table.test')}
                        </Button>
                        <Link href={`/tools/${tool.id}`}>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <Pencil className="h-3 w-3" />
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          disabled={deleteTool.isPending}
                          onClick={() => {
                            setPendingDeleteTool(tool);
                            deleteGuard.openGuard(tool.id);
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <ExecuteToolModal
        tool={selectedTool}
        open={!!selectedTool}
        onOpenChange={(open) => {
          if (!open) setSelectedTool(null);
        }}
      />

      <DeleteGuardDialog
        open={deleteGuard.open}
        onOpenChange={(open) => {
          if (!open) {
            deleteGuard.close();
            setPendingDeleteTool(null);
          }
        }}
        entityName={pendingDeleteTool?.name ?? ''}
        entityType={t('deleteGuard.types.tool')}
        dependencies={deleteGuard.dependencies}
        isChecking={deleteGuard.isChecking}
        isDeleting={deleteTool.isPending}
        onConfirm={() => {
          if (!pendingDeleteTool) return;
          deleteTool.mutate(pendingDeleteTool.id, {
            onSuccess: () => {
              deleteGuard.close();
              setPendingDeleteTool(null);
            },
          });
        }}
      />

      <ToolAiGenerateModal
        open={aiModalOpen}
        onOpenChange={setAiModalOpen}
      />
    </div>
  );
}
