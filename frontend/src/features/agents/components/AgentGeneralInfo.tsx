import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Box } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface AgentGeneralInfoProps {
  name: string;
  setName: (val: string) => void;
  description: string;
  setDescription: (val: string) => void;
  systemPrompt: string;
  setSystemPrompt: (val: string) => void;
}

export function AgentGeneralInfo({
  name, setName,
  description, setDescription,
  systemPrompt, setSystemPrompt
}: AgentGeneralInfoProps) {
  const { t } = useTranslation();

  return (
    <Card className="border-none shadow-xl bg-card/60 backdrop-blur-md overflow-hidden">
      <CardHeader className="bg-muted/20 border-b border-border/5 pb-4">
        <div className="flex items-center gap-2">
          <Box className="h-5 w-5 text-blue-500" />
          <div>
            <CardTitle className="text-lg">{t('agents.form.general_info')}</CardTitle>
            <CardDescription>{t('agents.form.general_desc')}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5 p-6">
        <div className="space-y-2">
          <Label htmlFor="name" className="text-sm font-bold text-foreground/80">
            {t('agents.form.name_label')}
          </Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('agents.form.name_placeholder')}
            required
            className="bg-muted/40 border-border/50 focus-visible:ring-blue-500/50 h-11 transition-all"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description" className="text-sm font-bold text-foreground/80">
            {t('agents.form.desc_label')}
          </Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t('agents.form.desc_placeholder')}
            rows={2}
            className="bg-muted/40 border-border/50 focus-visible:ring-blue-500/50 resize-none transition-all"
          />
        </div>

        <div className="space-y-2 pt-2">
          <Label htmlFor="systemPrompt" className="text-sm font-bold text-foreground/80">
            {t('agents.form.system_prompt_label')}
          </Label>
          <Textarea
            id="systemPrompt"
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            placeholder={t('agents.form.system_prompt_placeholder')}
            rows={8}
            className="bg-muted/40 border-border/50 focus-visible:ring-blue-500/50 font-mono text-sm leading-relaxed transition-all"
          />
        </div>
      </CardContent>
    </Card>
  );
}
