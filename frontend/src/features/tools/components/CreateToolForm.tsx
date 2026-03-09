'use client';

import { useState } from 'react';
import { useCreateTool } from '../hooks/useTools';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Save, ChevronLeft, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';

export function CreateToolForm() {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('CUSTOM');
  const [code, setCode] = useState('');
  const [icon, setIcon] = useState('');
  const [parameters, setParameters] = useState<
    Array<{ name: string; type: string; description: string; required: boolean }>
  >([]);

  const createTool = useCreateTool();

  const handleSave = () => {
    const toolData = {
      name,
      description,
      category,
      icon: icon || undefined,
      code: category === 'CUSTOM' ? code : undefined,
      parameters,
    };

    createTool.mutate(toolData);
  };

  const addParameter = () => {
    setParameters([...parameters, { name: '', type: 'string', description: '', required: false }]);
  };

  const updateParameter = (index: number, field: string, value: string | boolean) => {
    const newParams = [...parameters];
    newParams[index] = { ...newParams[index], [field]: value };
    setParameters(newParams);
  };

  const removeParameter = (index: number) => {
    setParameters(parameters.filter((_, i) => i !== index));
  };

  const isLoading = createTool.isPending;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/tools">
            <Button variant="ghost" size="icon">
              <ChevronLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h2 className="text-2xl font-bold">New Tool</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handleSave} disabled={isLoading} className="gap-2">
            <Save className="h-4 w-4" />
            {isLoading ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tool Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="my_custom_tool"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (Used by Agent to know when to use it)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this tool do?"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Select Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CUSTOM">Custom Code</SelectItem>
                <SelectItem value="API">API Integration</SelectItem>
                <SelectItem value="DATABASE">Database</SelectItem>
                <SelectItem value="FUNCTION">Function Node</SelectItem>
                <SelectItem value="WEB">Web Browser</SelectItem>
                <SelectItem value="FILE">File System</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="icon">Icon Name (Optional)</Label>
            <p className="text-xs text-muted-foreground mb-1">
              Enter a Lucide icon name (e.g. Wrench, Bot, Database).
            </p>
            <Input
              id="icon"
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              placeholder="Wrench"
            />
          </div>

          {category === 'CUSTOM' && (
            <div className="space-y-2 border-t pt-4">
              <Label htmlFor="code">Execution Script (JavaScript/Node.js)</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Write the script that will be executed securely in a sandbox. Access params via
                `params`. Must end with a return statment.
              </p>
              <Textarea
                id="code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="const res = await fetch(`https://api.github.com/users/${params.username}`); return await res.json();"
                className="font-mono text-xs"
                rows={8}
              />
            </div>
          )}

          <div className="space-y-4 border-t pt-4">
            <div className="flex items-center justify-between">
              <Label>Parameters Definition</Label>
              <Button onClick={addParameter} variant="outline" size="sm" className="gap-2">
                <Plus className="h-3.5 w-3.5" />
                Add Parameter
              </Button>
            </div>

            {parameters.length === 0 ? (
              <p className="text-sm text-muted-foreground italic text-center py-4 bg-muted/20 rounded-md">
                No parameters defined. The tool will not receive any input variables.
              </p>
            ) : (
              <div className="space-y-3">
                {parameters.map((param, index) => (
                  <div
                    key={index}
                    className="flex gap-3 items-start border border-border/50 p-3 rounded-md bg-muted/10 relative group"
                  >
                    <div className="flex-1 grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label className="text-xs">Prop Name</Label>
                        <Input
                          placeholder="e.g. username"
                          value={param.name}
                          onChange={(e) => updateParameter(index, 'name', e.target.value)}
                          className="h-8 text-xs"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Type</Label>
                        <Select
                          value={param.type}
                          onValueChange={(v) => updateParameter(index, 'type', v)}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="string">String</SelectItem>
                            <SelectItem value="number">Number</SelectItem>
                            <SelectItem value="boolean">Boolean</SelectItem>
                            <SelectItem value="object">Object</SelectItem>
                            <SelectItem value="array">Array</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2 col-span-2">
                        <Label className="text-xs">Description</Label>
                        <Input
                          placeholder="What is this param used for?"
                          value={param.description}
                          onChange={(e) => updateParameter(index, 'description', e.target.value)}
                          className="h-8 text-xs"
                        />
                      </div>
                      <div className="space-y-2 col-span-2 flex items-center justify-between">
                        <Label className="text-xs font-normal">Required field?</Label>
                        <input
                          type="checkbox"
                          checked={param.required}
                          onChange={(e) => updateParameter(index, 'required', e.target.checked)}
                          className="h-4 w-4"
                        />
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeParameter(index)}
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
