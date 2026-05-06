'use client';

import { useState, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Wrench, Search, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Tool } from '@/types';
import { toolsApi } from '@/features/tools/api/tools.api';
import { useAuthStore } from '@/store/auth.store';

interface AgentToolsConfigProps {
  selectedTools: string[];
  toggleTool: (toolId: string) => void;
  availableTools: Tool[];
}

export function AgentToolsConfig({ selectedTools, toggleTool, availableTools }: AgentToolsConfigProps) {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const [query, setQuery] = useState('');
  const [vectorMatches, setVectorMatches] = useState<Map<string, number>>(new Map());
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleQueryChange = useCallback(
    (value: string) => {
      setQuery(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (!value.trim()) {
        setVectorMatches(new Map());
        setSearching(false);
        return;
      }
      setSearching(true);
      debounceRef.current = setTimeout(async () => {
        try {
          const results = await toolsApi.searchByVector(value, availableTools, user?.id ?? '');
          setVectorMatches(new Map(results.map((r) => [r.toolId, r.score])));
        } catch {
          setVectorMatches(new Map());
        } finally {
          setSearching(false);
        }
      }, 400);
    },
    [user?.id, availableTools],
  );

  const filteredTools = query.trim()
    ? availableTools
        .filter(
          (tool) =>
            tool.name.toLowerCase().includes(query.toLowerCase()) ||
            tool.description.toLowerCase().includes(query.toLowerCase()) ||
            vectorMatches.has(tool.id),
        )
        .sort((a, b) => (vectorMatches.get(b.id) ?? 0) - (vectorMatches.get(a.id) ?? 0))
    : availableTools;

  return (
    <Card className="border-none shadow-xl bg-card/60 backdrop-blur-md overflow-hidden">
      <CardHeader className="bg-muted/20 border-b border-border/5 pb-4">
        <div className="flex items-center gap-2">
          <Wrench className="h-5 w-5 text-amber-500" />
          <div>
            <CardTitle className="text-lg">{t('agents.form.tools_config')}</CardTitle>
            <CardDescription>{t('agents.form.tools_desc')}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        {availableTools.length === 0 ? (
          <div className="flex flex-col items-center py-6 text-center space-y-3 border-2 border-dashed border-border/40 rounded-xl bg-muted/10">
            <Wrench className="h-8 w-8 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">
              {t('agents.form.tools_no_results')}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                {t('agents.form.tools_config')}
              </span>
              <span className="text-xs font-mono font-semibold bg-amber-500/10 text-amber-600 px-2 py-0.5 rounded-md border border-amber-500/20">
                {selectedTools.length} selected
              </span>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
              {searching && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-amber-500 animate-spin" />
              )}
              <Input
                value={query}
                onChange={(e) => handleQueryChange(e.target.value)}
                placeholder={t('agents.form.tools_search_placeholder')}
                className="pl-8 pr-8 h-8 text-sm bg-muted/30 border-border/40 focus:border-amber-500/50 rounded-lg"
              />
            </div>

            {filteredTools.length === 0 ? (
              <div className="flex flex-col items-center py-4 text-center border border-dashed border-border/30 rounded-lg bg-muted/10">
                <p className="text-xs text-muted-foreground">{t('agents.form.tools_no_results')}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2 max-h-[300px] overflow-y-auto pr-1">
                {filteredTools.map((tool) => {
                  const isSelected = selectedTools.includes(tool.id);
                  const score = vectorMatches.get(tool.id);
                  return (
                    <div
                      key={tool.id}
                      onClick={() => toggleTool(tool.id)}
                      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all duration-200 ${
                        isSelected
                          ? 'bg-amber-500/10 border-amber-500/30 shadow-sm'
                          : 'bg-muted/30 border-border/40 hover:bg-muted/60 hover:border-border/60'
                      }`}
                    >
                      <div
                        className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                          isSelected
                            ? 'bg-amber-500 border-amber-500 text-white'
                            : 'border-muted-foreground/40 bg-background'
                        }`}
                      >
                        {isSelected && (
                          <svg width="10" height="8" viewBox="0 0 10 8" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M1 4L3.5 6.5L9 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </div>
                      <div className="flex-1 space-y-0.5">
                        <div className="flex items-center gap-2">
                          <p className={`text-sm font-bold ${isSelected ? 'text-amber-700 dark:text-amber-500' : 'text-foreground/80'}`}>
                            {tool.name}
                          </p>
                          {score !== undefined && score > 0.7 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500 border border-blue-500/20 font-medium">
                              {Math.round(score * 100)}%
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                          {tool.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
