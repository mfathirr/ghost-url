import React, { useState, useEffect, useMemo } from 'react';
import {
  Copy,
  Check,
  Download,
  Flame,
  ShieldCheck,
  FileText,
  Clock,
} from 'lucide-react';
import Prism from 'prismjs';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-sql';
import 'prismjs/components/prism-markdown';
import 'prismjs/components/prism-go';
import 'prismjs/components/prism-rust';
import { copyToClipboard } from '../utils/clipboard';
import { soundFx } from '../utils/soundEngine';
import { useTranslation } from '../hooks/useTranslation';

interface SecretNoteViewerProps {
  content: string;
  language?: string;
  burned?: boolean;
  expiresAt?: string;
}

export const SecretNoteViewer: React.FC<SecretNoteViewerProps> = ({
  content,
  language = 'auto',
  burned = false,
  expiresAt,
}) => {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [countdown, setCountdown] = useState<number>(30); // 30 second advisory countdown for burned notes

  // Resolve language for Prism highlighting
  const detectedLang = useMemo(() => {
    const lang = (language || 'auto').toLowerCase();
    if (lang === 'js' || lang === 'javascript') return 'javascript';
    if (lang === 'ts' || lang === 'typescript') return 'typescript';
    if (lang === 'py' || lang === 'python') return 'python';
    if (lang === 'sh' || lang === 'bash' || lang === 'shell') return 'bash';
    if (lang === 'json') return 'json';
    if (lang === 'sql') return 'sql';
    if (lang === 'md' || lang === 'markdown') return 'markdown';
    if (lang === 'go') return 'go';
    if (lang === 'rs' || lang === 'rust') return 'rust';

    if (lang === 'auto') {
      const trimmed = content.trim();
      if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
        try {
          JSON.parse(trimmed);
          return 'json';
        } catch {
          // not json
        }
      }
      if (trimmed.includes('def ') || (trimmed.includes('import ') && trimmed.includes(':'))) return 'python';
      if (trimmed.includes('const ') || trimmed.includes('function ') || trimmed.includes('=>')) return 'javascript';
      if (trimmed.includes('SELECT ') || trimmed.includes('FROM ') || trimmed.includes('WHERE ')) return 'sql';
      if (trimmed.startsWith('#!/') || trimmed.includes('echo ')) return 'bash';
    }

    return 'plaintext';
  }, [language, content]);

  const highlightedCode = useMemo(() => {
    try {
      const grammar = Prism.languages[detectedLang] || Prism.languages.plain || Prism.languages.text;
      if (grammar) {
        return Prism.highlight(content, grammar, detectedLang);
      }
    } catch {
      // fallback
    }
    return '';
  }, [content, detectedLang]);

  useEffect(() => {
    if (!burned) return;
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          soundFx.playIncinerator();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [burned]);

  const handleCopy = async () => {
    const ok = await copyToClipboard(content);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    let ext = '.txt';
    if (detectedLang === 'javascript') ext = '.js';
    else if (detectedLang === 'typescript') ext = '.ts';
    else if (detectedLang === 'python') ext = '.py';
    else if (detectedLang === 'json') ext = '.json';
    else if (detectedLang === 'sql') ext = '.sql';
    else if (detectedLang === 'bash') ext = '.sh';
    else if (detectedLang === 'markdown') ext = '.md';
    else if (detectedLang === 'go') ext = '.go';
    else if (detectedLang === 'rust') ext = '.rs';

    a.download = `ghost-note-${Date.now()}${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const lines = content.split('\n');

  return (
    <div className="w-full max-w-3xl mx-auto space-y-5 animate-fade-in">
      {/* Burned Warning Banner */}
      {burned && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/80 border border-rose-200 dark:border-rose-500/40 text-slate-900 dark:text-white shadow-sm animate-fade-in font-sans">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 dark:bg-rose-500/20 border border-rose-300 dark:border-rose-400/40 flex items-center justify-center text-rose-500 dark:text-rose-400 shrink-0">
              <Flame className="w-4 h-4" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-rose-800 dark:text-rose-200">
                  {t('secretNote.selfDestructTriggered')}
                </h3>
                <span className="text-[10px] font-mono font-bold bg-rose-100 dark:bg-rose-500/30 border border-rose-200 dark:border-rose-400/40 px-2 py-0.5 rounded text-rose-800 dark:text-rose-200">
                  {countdown > 0
                    ? t('secretNote.viewWindow', { count: countdown })
                    : t('secretNote.permanentlyErased')}
                </span>
              </div>
              <p className="mt-1 text-xs text-rose-700 dark:text-rose-200/90 leading-relaxed">
                {t('secretNote.burnedPurgedNotice')}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main Secret Note Card */}
      <div className="stealth-card rounded-2xl p-5 sm:p-7 border border-slate-200/90 dark:border-white/10">
        {/* Card Header & Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200/80 dark:border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-500">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                  {t('secretNote.decryptedTitle')}
                </h2>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-slate-300">
                  {detectedLang}
                </span>
              </div>
              <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                {t('secretNote.linesChars', { lines: lines.length, chars: content.length })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            <button
              type="button"
              onClick={handleDownload}
              className="py-2 px-3 rounded-lg border border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700 text-slate-700 dark:text-slate-200 text-xs font-mono font-semibold flex items-center gap-1.5 transition-colors"
              title={t('secretNote.downloadTooltip')}
            >
              <Download className="w-3.5 h-3.5" />
              <span>{t('secretNote.downloadTxt')}</span>
            </button>

            <button
              type="button"
              onClick={handleCopy}
              className={`py-2 px-4 rounded-lg text-xs font-mono font-bold transition-all flex items-center gap-1.5 shadow-sm active:-translate-y-[1px] ${
                copied
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-500 hover:bg-emerald-400 text-black'
              }`}
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>{t('secretNote.copied')}</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>{t('secretNote.copyContent')}</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Code / Text Viewer */}
        <div className="mt-4 rounded-xl overflow-hidden border border-slate-200 dark:border-zinc-800 bg-slate-50/80 dark:bg-[#0c0f14] relative text-xs sm:text-sm shadow-inner">
          <div className="max-h-[500px] overflow-auto p-4 font-mono leading-relaxed">
            {highlightedCode ? (
              <pre
                className="!m-0 !p-0 !bg-transparent text-slate-800 dark:text-slate-100 selection:bg-emerald-500/20"
                dangerouslySetInnerHTML={{ __html: highlightedCode }}
              />
            ) : (
              <pre className="!m-0 !p-0 !bg-transparent text-slate-800 dark:text-slate-100 whitespace-pre-wrap break-words selection:bg-emerald-500/20">
                {content}
              </pre>
            )}
          </div>
        </div>

        {/* Security & Verification Footer */}
        <div className="mt-5 pt-3.5 border-t border-slate-200/70 dark:border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] font-mono text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>{t('secretNote.e2eeDecryptedNotice')}</span>
          </div>
          {expiresAt && !burned && (
            <div className="flex items-center gap-1 font-mono">
              <Clock className="w-3.5 h-3.5 text-amber-500" />
              <span>
                {t('secretNote.expiresAt', {
                  time: new Date(expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                })}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SecretNoteViewer;
