'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Info, Mail, Plus, RefreshCw, Trash2, Zap, Download } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  useGmailSubscriptions,
  useRegisterGmailSubscription,
  useUnregisterGmailSubscription,
  useResumeGmailSubscription,
  useCallGmailWatch,
  usePullGmailNotifications,
} from '../hooks/useWorkflows';

interface WorkflowTriggersPanelProps {
  workflowId: string;
  userId: string;
}

export function WorkflowTriggersPanel({ workflowId, userId }: WorkflowTriggersPanelProps) {
  const { t } = useTranslation();
  const { data: subscriptions, isLoading } = useGmailSubscriptions(workflowId);
  const register = useRegisterGmailSubscription();
  const unregister = useUnregisterGmailSubscription();
  const resume = useResumeGmailSubscription();
  const callWatch = useCallGmailWatch();
  const pullNotifications = usePullGmailNotifications();

  const [gmailUser, setGmailUser] = useState('');
  const [refreshToken, setRefreshToken] = useState('');
  const [topicName, setTopicName] = useState('');
  const [labelIds, setLabelIds] = useState('INBOX');
  const [isAdding, setIsAdding] = useState(false);

  const handleRegister = async () => {
    if (!gmailUser || !refreshToken || !topicName) {
      toast.error('Please fill all required fields');
      return;
    }

    try {
      // 1. Call Gmail Watch tool to get historyId/expiration
      const response = await callWatch.mutateAsync({
        refreshToken,
        topicName,
        labelIds,
      });

      if (response.error) {
        const errorMsg =
          typeof response.error === 'object' ? response.error.message : response.error;
        toast.error(`Gmail Watch error: ${errorMsg}`);
        return;
      }

      const watchResult = response.result;
      if (!watchResult || !watchResult.content || !watchResult.content[0]) {
        toast.error('Invalid response from Gmail Watch');
        return;
      }

      // Parse JSON content if needed (MCP tool returns content array)
      const contentStr = watchResult.content[0].text;
      if (!contentStr) {
        toast.error('Empty response from Gmail Watch');
        return;
      }

      let data;
      try {
        data = JSON.parse(contentStr);
      } catch (e) {
        console.error('Failed to parse Gmail Watch response', e);
        toast.error('Failed to parse Gmail Watch response');
        return;
      }

      if (!data.success) {
        toast.error('Gmail Watch failed to activate');
        return;
      }

      // 2. Register in orchestration-service
      await register.mutateAsync({
        workflowId,
        userId,
        gmailUser,
        topicName,
        labelIds: labelIds
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        historyId: data.historyId,
        expiration: data.expiration,
      });

      setIsAdding(false);
      setGmailUser('');
      setRefreshToken('');
      // Keep topicName for convenience if they add another account
    } catch (err) {
      console.error(err);
    }
  };

  const handleUnregister = async (user: string) => {
    await unregister.mutateAsync({ workflowId, gmailUser: user });
  };

  const handleResume = async (user: string) => {
    await resume.mutateAsync({ workflowId, gmailUser: user });
  };

  const handlePull = async () => {
    await pullNotifications.mutateAsync();
  };

  return (
    <Card className="backdrop-blur-xl bg-white/40 dark:bg-black/40 border-border/50 shadow-xl shrink-0">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-yellow-500" />
            <span>{t('workflows.triggers.title', 'Automatic Triggers')}</span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={handlePull}
              disabled={pullNotifications.isPending}
              title={t('workflows.triggers.pullNotifications', 'Pull notifications')}
            >
              {pullNotifications.isPending ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setIsAdding(true)}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="text-sm text-muted-foreground animate-pulse">Loading triggers...</div>
        ) : subscriptions?.length === 0 ? (
          <div className="text-xs text-muted-foreground border border-dashed rounded-lg p-4 text-center">
            {t('workflows.triggers.empty', 'No automatic triggers configured.')}
          </div>
        ) : (
          <div className="space-y-2">
            {subscriptions?.map((sub) => (
              <div
                key={sub.id}
                className="flex items-center justify-between p-2 rounded-lg bg-white/50 dark:bg-black/20 border border-border/30"
              >
                <div className="flex items-center gap-2 overflow-hidden">
                  <Mail className="h-3 w-3 text-blue-500 shrink-0" />
                  <div className="flex flex-col overflow-hidden">
                    <span className="text-xs font-medium truncate">{sub.gmailUser}</span>
                    <span className="text-[10px] text-muted-foreground truncate">
                      {sub.topicName.split('/').pop()}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Badge
                    variant={sub.isActive ? 'success' : 'secondary'}
                    className="text-[9px] px-1 py-0 h-4"
                  >
                    {sub.isActive ? 'Active' : 'Paused'}
                  </Badge>
                  {sub.isActive ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-yellow-500"
                      onClick={() => handleUnregister(sub.gmailUser)}
                      title="Pause"
                    >
                      <Zap className="h-3 w-3" />
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-success"
                      onClick={() => handleResume(sub.gmailUser)}
                      title="Restart"
                    >
                      <RefreshCw className="h-3 w-3" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-destructive"
                    onClick={() => handleUnregister(sub.gmailUser)}
                    title="Delete"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {isAdding && (
          <div className="space-y-3 p-3 rounded-lg border border-border/50 bg-secondary/20">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase text-muted-foreground">
                Add Gmail Push Trigger
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-5 text-[10px]"
                onClick={() => setIsAdding(false)}
              >
                Cancel
              </Button>
            </div>

            <div className="space-y-2">
              <Input
                placeholder="Gmail Address (e.g. user@gmail.com)"
                value={gmailUser}
                onChange={(e) => setGmailUser(e.target.value)}
                className="h-8 text-xs"
              />
              <Input
                placeholder="Refresh Token"
                value={refreshToken}
                type="password"
                onChange={(e) => setRefreshToken(e.target.value)}
                className="h-8 text-xs"
              />
              <Input
                placeholder="Pub/Sub Topic (projects/.../topics/...)"
                value={topicName}
                onChange={(e) => setTopicName(e.target.value)}
                className="h-8 text-xs"
              />
              <Input
                placeholder="Label IDs (default: INBOX)"
                value={labelIds}
                onChange={(e) => setLabelIds(e.target.value)}
                className="h-8 text-xs"
              />
            </div>

            <Button
              className="w-full h-8 text-xs gap-2"
              onClick={handleRegister}
              disabled={register.isPending || callWatch.isPending}
            >
              {register.isPending || callWatch.isPending ? (
                <RefreshCw className="h-3 w-3 animate-spin" />
              ) : (
                <Plus className="h-3 w-3" />
              )}
              Register Trigger
            </Button>

            <div className="flex items-start gap-2 p-2 rounded bg-blue-500/10 border border-blue-500/20">
              <Info className="h-3 w-3 text-blue-500 shrink-0 mt-0.5" />
              <p className="text-[10px] text-blue-600 dark:text-blue-400 leading-tight">
                {t(
                  'workflows.triggers.info',
                  'Google watch expires every 7 days. You will need to renew this trigger manually or via a scheduled workflow. Notifications are pulled automatically every 30 seconds.',
                )}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
