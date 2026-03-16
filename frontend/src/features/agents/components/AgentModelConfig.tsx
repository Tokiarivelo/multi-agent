import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
          <Label htmlFor="model" className="text-sm font-bold text-foreground/70 flex items-center gap-1.5 mb-1.5 ml-0.5">
            <Cpu className="h-4 w-4 text-indigo-500/80" />
            {t('agents.table.model')}
          </Label>
          <Select value={modelId} onValueChange={setModelId}>
            <SelectTrigger
              id="model"
              className="h-11 bg-background/30 border-border/40 hover:bg-background/50 hover:border-border/60 transition-all backdrop-blur-sm"
            >
              <SelectValue placeholder={t('agents.form.select_model')}>
                {models.find(m => m.id === modelId) && (
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{models.find(m => m.id === modelId)?.name}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 uppercase font-bold tracking-tighter">
                      {models.find(m => m.id === modelId)?.provider}
                    </span>
                  </div>
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="backdrop-blur-xl bg-popover/95 border-border/40 shadow-2xl">
              {models.map((model) => (
                <SelectItem key={model.id} value={model.id} className="py-2.5">
                  <div className="flex items-center justify-between w-full">
                    <span className="font-medium">{model.name}</span>
                    <span className="text-[9px] uppercase tracking-widest text-muted-foreground/80 bg-muted/50 px-2 py-0.5 rounded-full border border-border/20 font-bold ml-4">
                      {model.provider}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-6 pt-6 border-t border-border/10">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="temperature" className="text-sm font-bold text-foreground/70 ml-0.5">
                {t('agents.form.temperature')}
              </Label>
              <span className="text-xs font-mono font-bold bg-indigo-500/10 text-indigo-400 px-2.5 py-1 rounded-md border border-indigo-500/20 shadow-sm">
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
               className="**:[[role=slider]]:bg-indigo-500 **:[[role=slider]]:border-indigo-400 **:[[role=slider]]:shadow-[0_0_10px_rgba(99,102,241,0.5)] [&_.bg-primary]:bg-indigo-500/40"
            />
            <div className="flex justify-between px-0.5">
              <span className="text-[10px] text-muted-foreground/60 font-bold uppercase tracking-wider">Precise</span>
              <span className="text-[10px] text-muted-foreground/60 font-bold uppercase tracking-wider">Creative</span>
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-border/5">
             <div className="flex items-center justify-between">
              <Label htmlFor="maxTokens" className="text-sm font-bold text-foreground/70 ml-0.5">
                {t('agents.form.max_tokens')}
              </Label>
              <span className="text-xs font-mono font-bold bg-indigo-500/10 text-indigo-400 px-2.5 py-1 rounded-md border border-indigo-500/20 shadow-sm">
                {maxTokens[0].toLocaleString()}
              </span>
            </div>
             <Slider
               id="maxTokens"
               min={256}
               max={32768}
               step={256}
               value={maxTokens}
               onValueChange={setMaxTokens}
               className="**:[[role=slider]]:bg-indigo-500 **:[[role=slider]]:border-indigo-400 **:[[role=slider]]:shadow-[0_0_10px_rgba(99,102,241,0.5)] [&_.bg-primary]:bg-indigo-500/40"
            />
             <div className="flex justify-between px-0.5">
              <span className="text-[10px] text-muted-foreground/60 font-bold uppercase tracking-wider">Short</span>
              <span className="text-[10px] text-muted-foreground/60 font-bold uppercase tracking-wider">Long</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
