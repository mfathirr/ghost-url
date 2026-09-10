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
import 'prismjs/themes/prism-tomorrow.css';
import { copyToClipboard } from '../utils/clipboard';

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
      if (trimmed.includes('def ') || trimmed.includes('import ') && trimmed.includes(':')) return 'python';
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
    <div className="w-full max-w-3xl mx-auto space-y-6 animate-fade-in">
      {/* Burned Warning Banner */}
      {burned && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-rose-950/80 via-red-900/60 to-amber-950/80 border border-rose-500/50 shadow-lg shadow-rose-950/50 text-white animate-fade-in">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-400/40 flex items-center justify-center text-rose-400 shrink-0">
              <Flame className="w-5 h-5 animate-pulse" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="text-sm font-black uppercase tracking-wider text-rose-200">
                  Self-Destruct Activated: Note Destroyed
                </h3>
                <span className="text-xs font-mono font-bold bg-rose-500/30 border border-rose-400/40 px-2.5 py-0.5 rounded-full text-rose-200">
                  {countdown > 0 ? `${countdown}s view advisory` : 'Permanently Erased'}
                </span>
              </div>
              <p className="mt-1 text-xs text-rose-200/90 leading-relaxed">
                This was a <span className="font-bold underline">single-use self-destructing</span> secret note. It has been permanently deleted from our servers. Once you close or refresh this page, this note cannot be recovered.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main Secret Note Card */}
      <div className="bg-white/80 dark:bg-slate-900/90 backdrop-blur-xl border border-slate-200/90 dark:border-slate-800/90 rounded-2xl p-5 sm:p-7 shadow-xl shadow-slate-200/50 dark:shadow-none">
        {/* Card Header & Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/70 border border-amber-200 dark:border-amber-800/70 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                  Secret Note
                </h2>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                  {detectedLang}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {lines.length} line{lines.length !== 1 ? 's' : ''} • {content.length} characters
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            <button
              type="button"
              onClick={handleDownload}
              className="py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors"
              title="Download content as text file"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download</span>
            </button>

            <button
              type="button"
              onClick={handleCopy}
              className={`py-2 px-4 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm ${
                copied
                  ? 'bg-emerald-600 text-white shadow-emerald-500/20'
                  : 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-500/20 active:scale-95'
              }`}
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Note</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Code / Text Viewer */}
        <div className="mt-4 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800/90 bg-[#1d1f21] relative text-sm">
          <div className="max-h-[500px] overflow-auto p-4 font-mono leading-relaxed">
            {highlightedCode ? (
              <pre
                className="!m-0 !p-0 !bg-transparent text-slate-100 selection:bg-indigo-500/30"
                dangerouslySetInnerHTML={{ __html: highlightedCode }}
              />
            ) : (
              <pre className="!m-0 !p-0 !bg-transparent text-slate-100 whitespace-pre-wrap break-words">
                {content}
              </pre>
            )}
          </div>
        </div>

        {/* Security & Verification Footer */}
        <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>Decrypted directly on your device. Our servers never had access to this secret.</span>
          </div>
          {expiresAt && !burned && (
            <div className="flex items-center gap-1 font-mono">
              <Clock className="w-3.5 h-3.5 text-amber-500" />
              <span>Expires: {new Date(expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
