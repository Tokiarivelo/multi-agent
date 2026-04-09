'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import axios from 'axios';
import { ExternalLink, Github, Search, Star, Lock, Globe, GitFork, Loader2, Plus } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { GitHubRepo, Tool } from '@/types';
import { githubApi } from '../api/github.api';

interface GitHubRepoListProps {
  repos: GitHubRepo[];
  isLoading: boolean;
  connected: boolean;
  mcpTools?: Tool[];
}

export function GitHubRepoList({ repos, isLoading, connected, mcpTools = [] }: GitHubRepoListProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [registering, setRegistering] = useState<Set<number>>(new Set());
  const [dialogRepo, setDialogRepo] = useState<GitHubRepo | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [customName, setCustomName] = useState('');
  const [customDescription, setCustomDescription] = useState('');

  function formatRelativeDate(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const days = Math.floor(diff / 86_400_000);
    if (days === 0) return t('github.date.today');
    if (days === 1) return t('github.date.yesterday');
    if (days < 30) return t('github.date.daysAgo', { count: days });
    if (days < 365) return t('github.date.monthsAgo', { count: Math.floor(days / 30) });
    return t('github.date.yearsAgo', { count: Math.floor(days / 365) });
  }

  function toolCountForRepo(repo: GitHubRepo): number {
    return mcpTools.filter((t) => t.repoFullName === repo.fullName).length;
  }

  const filtered = repos.filter(
    (r) =>
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.fullName.toLowerCase().includes(search.toLowerCase()) ||
      (r.description?.toLowerCase() ?? '').includes(search.toLowerCase()),
  );

  if (!connected) {
    return (
      <Card className="mt-6">
        <CardContent className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center">
            <Github className="h-7 w-7 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground text-sm">
            {t('github.repos.connectPrompt')}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className="mt-6">
        <CardContent className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const openDialog = (repo: GitHubRepo) => {
    setDisplayName(repo.name);
    setCustomName(`github_${repo.name.replace(/-/g, '_')}`);
    setCustomDescription(repo.description ?? `GitHub repository: ${repo.fullName}`);
    setDialogRepo(repo);
  };

  const closeDialog = () => setDialogRepo(null);

  const handleRegister = async () => {
    if (!dialogRepo) return;
    closeDialog();
    setRegistering((prev) => new Set(prev).add(dialogRepo.id));
    try {
      await githubApi.registerRepoTool(dialogRepo, { name: customName, description: customDescription || displayName });
      await queryClient.invalidateQueries({ queryKey: ['tools'] });
      toast.success(t('github.repos.registerSuccess'));
    } catch (err) {
      const status = axios.isAxiosError(err) ? err.response?.status : undefined;
      if (status === 409) {
        toast.error(t('github.repos.registerConflict', { name: customName }));
      } else {
        toast.error(t('github.repos.registerError'));
      }
    } finally {
      setRegistering((prev) => {
        const next = new Set(prev);
        next.delete(dialogRepo.id);
        return next;
      });
    }
  };

  return (
    <Card className="mt-6">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{t('github.repos.title')}</CardTitle>
            <CardDescription>{t('github.repos.count', { count: repos.length })}</CardDescription>
          </div>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="github-repo-search"
              placeholder={t('github.repos.searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">
            {t('github.repos.noMatch', { search })}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('github.repos.columns.repository')}</TableHead>
                <TableHead>{t('github.repos.columns.language')}</TableHead>
                <TableHead>{t('github.repos.columns.visibility')}</TableHead>
                <TableHead className="text-center">
                  <Star className="h-3.5 w-3.5 inline-block" />
                </TableHead>
                <TableHead>{t('github.repos.columns.updated')}</TableHead>
                <TableHead className="text-center">{t('github.repos.columns.tools')}</TableHead>
                <TableHead className="w-[110px]">{t('github.repos.columns.addToMcp')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((repo) => (
                <TableRow key={repo.id}>
                  <TableCell>
                    <div className="flex flex-col gap-0.5">
                      <a
                        href={repo.htmlUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium hover:underline flex items-center gap-1.5"
                      >
                        {repo.fork && <GitFork className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                        {repo.name}
                        <ExternalLink className="h-3 w-3 text-muted-foreground" />
                      </a>
                      {repo.description && (
                        <span className="text-xs text-muted-foreground line-clamp-1">
                          {repo.description}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {repo.language ? (
                      <Badge variant="outline" className="text-xs bg-background">
                        {repo.language}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {repo.private ? (
                      <span className="flex items-center gap-1 text-xs text-amber-500">
                        <Lock className="h-3.5 w-3.5" /> {t('github.repos.private')}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Globe className="h-3.5 w-3.5" /> {t('github.repos.public')}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-center text-sm text-muted-foreground">
                    {repo.stargazersCount}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatRelativeDate(repo.updatedAt)}
                  </TableCell>
                  <TableCell className="text-center text-sm">
                    {toolCountForRepo(repo) > 0 ? (
                      <Badge variant="secondary" className="text-xs">
                        {toolCountForRepo(repo)}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 h-7 text-xs"
                      disabled={registering.has(repo.id)}
                      onClick={() => openDialog(repo)}
                    >
                      {registering.has(repo.id) ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Plus className="h-3 w-3" />
                      )}
                      {t('github.repos.useInMcp')}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={!!dialogRepo} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('github.repos.registerDialogTitle')}</DialogTitle>
            <DialogDescription>{t('github.repos.registerDialogDescription')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="mcp-repo">{t('github.repos.registerRepoLabel')}</Label>
              <Input
                id="mcp-repo"
                value={dialogRepo?.fullName ?? ''}
                readOnly
                disabled
                className="font-mono text-sm bg-muted text-muted-foreground"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mcp-display-name">{t('github.repos.registerDisplayNameLabel')}</Label>
              <Input
                id="mcp-display-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="text-sm"
              />
              <p className="text-xs text-muted-foreground">{t('github.repos.registerDisplayNameHint')}</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mcp-name">{t('github.repos.registerNameLabel')}</Label>
              <Input
                id="mcp-name"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">{t('github.repos.registerNameHint')}</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mcp-description">{t('github.repos.registerDescriptionLabel')}</Label>
              <Textarea
                id="mcp-description"
                value={customDescription}
                onChange={(e) => setCustomDescription(e.target.value)}
                rows={3}
                className="text-sm"
              />
              <p className="text-xs text-muted-foreground">{t('github.repos.registerDescriptionHint')}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>{t('github.repos.registerCancel')}</Button>
            <Button onClick={handleRegister} disabled={!customName.trim() || !displayName.trim()}>
              {t('github.repos.registerConfirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
