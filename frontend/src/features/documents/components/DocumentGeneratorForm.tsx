'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { DocumentFormat, DocumentSection, TableData } from '../api/documents.api';

interface Props {
  formats: DocumentFormat[];
  onSubmit: (data: {
    format: string;
    title: string;
    author: string;
    sections: DocumentSection[];
    table: TableData | null;
    metadata: { subject: string; keywords: string; company: string };
  }) => void;
  loading: boolean;
}

export function DocumentGeneratorForm({ formats, onSubmit, loading }: Props) {
  const { t } = useTranslation();
  const [format, setFormat] = useState(formats[0]?.id ?? 'pdf');

  // Keep the selected format in sync when the formats list loads asynchronously.
  useEffect(() => {
    if (formats.length > 0 && !formats.some((f) => f.id === format)) {
      setFormat(formats[0].id);
    }
  }, [formats]);
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [sections, setSections] = useState<DocumentSection[]>([{ heading: '', body: '', level: 1 }]);
  const [useTable, setUseTable] = useState(false);
  const [tableHeaders, setTableHeaders] = useState(['Column 1', 'Column 2']);
  const [tableRows, setTableRows] = useState([['', '']]);
  const [subject, setSubject] = useState('');
  const [keywords, setKeywords] = useState('');
  const [company, setCompany] = useState('');
  const [showMeta, setShowMeta] = useState(false);

  const addSection = () => setSections((s) => [...s, { heading: '', body: '', level: 1 }]);

  const removeSection = (i: number) => setSections((s) => s.filter((_, idx) => idx !== i));

  const updateSection = (i: number, field: keyof DocumentSection, value: string | number) =>
    setSections((s) => s.map((sec, idx) => (idx === i ? { ...sec, [field]: value } : sec)));

  const addTableColumn = () => {
    setTableHeaders((h) => [...h, `Column ${h.length + 1}`]);
    setTableRows((rows) => rows.map((r) => [...r, '']));
  };

  const removeTableColumn = (ci: number) => {
    setTableHeaders((h) => h.filter((_, i) => i !== ci));
    setTableRows((rows) => rows.map((r) => r.filter((_, i) => i !== ci)));
  };

  const addTableRow = () => setTableRows((r) => [...r, tableHeaders.map(() => '')]);

  const removeTableRow = (ri: number) => setTableRows((r) => r.filter((_, i) => i !== ri));

  const updateCell = (ri: number, ci: number, val: string) =>
    setTableRows((rows) => rows.map((r, i) => (i === ri ? r.map((c, j) => (j === ci ? val : c)) : r)));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      format,
      title: title || t('documents.form.defaultTitle'),
      author,
      sections: sections.filter((s) => s.heading || s.body),
      table: useTable ? { headers: tableHeaders, rows: tableRows } : null,
      metadata: { subject, keywords, company },
    });
  };

  const inputCls = 'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40';
  const labelCls = 'block text-xs font-medium text-muted-foreground mb-1';

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic Info */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelCls}>{t('documents.form.format')}</label>
          <select className={inputCls} value={format} onChange={(e) => setFormat(e.target.value)}>
            {formats.map((f) => (
              <option key={f.id} value={f.id}>{f.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>{t('documents.form.title')}</label>
          <input
            className={inputCls}
            placeholder={t('documents.form.titlePlaceholder')}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div>
          <label className={labelCls}>{t('documents.form.author')}</label>
          <input
            className={inputCls}
            placeholder={t('documents.form.authorPlaceholder')}
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
          />
        </div>
      </div>

      {/* Sections */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">{t('documents.form.sections')}</span>
          <button type="button" onClick={addSection} className="flex items-center gap-1 text-xs text-primary hover:underline">
            <Plus className="h-3.5 w-3.5" /> {t('documents.form.addSection')}
          </button>
        </div>
        <div className="space-y-3">
          {sections.map((sec, i) => (
            <div key={i} className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <input
                  className={inputCls + ' flex-1'}
                  placeholder={t('documents.form.sectionHeading')}
                  value={sec.heading ?? ''}
                  onChange={(e) => updateSection(i, 'heading', e.target.value)}
                />
                <select
                  className="rounded-lg border border-border bg-background px-2 py-2 text-sm w-20"
                  value={sec.level ?? 1}
                  onChange={(e) => updateSection(i, 'level', Number(e.target.value))}
                >
                  {[1, 2, 3].map((l) => <option key={l} value={l}>H{l}</option>)}
                </select>
                {sections.length > 1 && (
                  <button type="button" onClick={() => removeSection(i)} className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
              <textarea
                className={inputCls + ' resize-none'}
                rows={3}
                placeholder={t('documents.form.sectionBody')}
                value={sec.body ?? ''}
                onChange={(e) => updateSection(i, 'body', e.target.value)}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Table */}
      <div>
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input type="checkbox" checked={useTable} onChange={(e) => setUseTable(e.target.checked)} className="rounded" />
          <span className="text-sm font-medium">{t('documents.form.includeTable')}</span>
        </label>
        {useTable && (
          <div className="mt-3 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              {tableHeaders.map((h, ci) => (
                <div key={ci} className="flex items-center gap-1">
                  <input
                    className="rounded-lg border border-border bg-background px-2 py-1 text-xs w-28"
                    value={h}
                    onChange={(e) => setTableHeaders((hs) => hs.map((v, i) => (i === ci ? e.target.value : v)))}
                  />
                  {tableHeaders.length > 1 && (
                    <button type="button" onClick={() => removeTableColumn(ci)} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
              <button type="button" onClick={addTableColumn} className="flex items-center gap-1 text-xs text-primary hover:underline">
                <Plus className="h-3.5 w-3.5" /> {t('documents.form.addColumn')}
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <tbody>
                  {tableRows.map((row, ri) => (
                    <tr key={ri} className="border-b border-border">
                      {row.map((cell, ci) => (
                        <td key={ci} className="p-1">
                          <input
                            className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
                            value={cell}
                            onChange={(e) => updateCell(ri, ci, e.target.value)}
                          />
                        </td>
                      ))}
                      <td className="p-1">
                        {tableRows.length > 1 && (
                          <button type="button" onClick={() => removeTableRow(ri)} className="text-muted-foreground hover:text-destructive">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button type="button" onClick={addTableRow} className="flex items-center gap-1 text-xs text-primary hover:underline">
              <Plus className="h-3.5 w-3.5" /> {t('documents.form.addRow')}
            </button>
          </div>
        )}
      </div>

      {/* Metadata (collapsed) */}
      <div>
        <button
          type="button"
          onClick={() => setShowMeta((v) => !v)}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          {showMeta ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          {t('documents.form.metadata')}
        </button>
        {showMeta && (
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className={labelCls}>{t('documents.form.subject')}</label>
              <input className={inputCls} value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>{t('documents.form.keywords')}</label>
              <input className={inputCls} value={keywords} onChange={(e) => setKeywords(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>{t('documents.form.company')}</label>
              <input className={inputCls} value={company} onChange={(e) => setCompany(e.target.value)} />
            </div>
          </div>
        )}
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
      >
        {loading ? t('documents.form.generating') : t('documents.form.generate')}
      </button>
    </form>
  );
}
