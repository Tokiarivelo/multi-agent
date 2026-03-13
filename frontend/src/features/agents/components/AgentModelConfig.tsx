import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Sliders, Cpu } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Model } from '@/types';

interface AgentModelConfigProps {
  modelId: string;
  setModelId: (val: string) => void;
  temperature: number[];
  setTemperature: (val: number[]) => void;
  maxTokens: number[];
  setMaxTokens: (val: number[]) => void;
  models: Model[];
}

export function AgentModelConfig({
  modelId, setModelId,
  temperature, setTemperature,
  maxTokens, setMaxTokens,
  models
}: AgentModelConfigProps) {
  const { t } = useTranslation();

  return (
    <Card className="border-none shadow-xl bg-card/60 backdrop-blur-md overflow-hidden">
      <CardHeader className="bg-muted/20 border-b border-border/5 pb-4">
        <div className="flex items-center gap-2">
          <Sliders className="h-5 w-5 text-indigo-500" />
          <div>
            <CardTitle className="text-lg">{t('agents.form.model_config')}</CardTitle>
            <CardDescription>{t('agents.form.model_desc')}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6 p-6">
        <div className="space-y-2">
          <Label htmlFor="model" className="text-sm font-bold text-foreground/80 flex items-center gap-1.5">
            <Cpu className="h-3.5 w-3.5" />
            {t('agents.table.model')}
          </Label>
          <select
            id="model"
            value={modelId}
            onChange={(e) => setModelId(e.target.value)}
            className="flex h-10 w-full rounded-lg border border-border/50 bg-muted/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-medium"
            required
          >
            <option value="" disabled>{t('agents.form.select_model')}</option>
            {models.map((model) => (
              <option key={model.id} value={model.id}>
                {model.name} ({model.provider})
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-4 pt-4 border-t border-border/20">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="temperature" className="text-sm font-bold text-foreground/80">
                {t('agents.form.temperature')}
              </Label>
              <span className="text-xs font-mono font-semibold bg-muted px-2 py-0.5 rounded-md border border-border/50">
                {temperature[0].toFixed(2)}
              </span>
            </div>
            <Slider
               id="temperature"
               min={0}
               max={2}
               step={0.01}
               value={temperature}
               onValueChange={setTemperature}
               className="**:[[role=slider]]:bg-indigo-500 **:[[role=slider]]:border-indigo-600 [&_.bg-primary]:bg-indigo-500/30"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
              <span>Precise</span>
              <span>Creative</span>
            </div>
          </div>

          <div className="space-y-3 pt-4 border-t border-border/20">
             <div className="flex items-center justify-between">
              <Label htmlFor="maxTokens" className="text-sm font-bold text-foreground/80">
                {t('agents.form.max_tokens')}
              </Label>
              <span className="text-xs font-mono font-semibold bg-muted px-2 py-0.5 rounded-md border border-border/50">
                {maxTokens[0]}
              </span>
            </div>
             <Slider
               id="maxTokens"
               min={256}
               max={32768}
               step={256}
               value={maxTokens}
               onValueChange={setMaxTokens}
               className="**:[[role=slider]]:bg-indigo-500 **:[[role=slider]]:border-indigo-600 [&_.bg-primary]:bg-indigo-500/30"
            />
             <div className="flex justify-between text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
              <span>Short</span>
              <span>Long</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
