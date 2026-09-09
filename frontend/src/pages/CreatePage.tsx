import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Link as LinkIcon,
  Clock,
  KeyRound,
  Sparkles,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Eye,
  EyeOff,
  Flame,
  ShieldAlert,
} from 'lucide-react';
import { createLink } from '../services/api';
import type { CreateLinkPayload } from '../types';

export const CreatePage: React.FC = () => {
  const navigate = useNavigate();

  const [url, setUrl] = useState('');
  const [alias, setAlias] = useState('');
  const [passcode, setPasscode] = useState('');
  const [showPasscode, setShowPasscode] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // TTL states
  const [expiryOption, setExpiryOption] = useState<string>('1h');
  const [customValue, setCustomValue] = useState<number>(12);
  const [customUnit, setCustomUnit] = useState<'m' | 'h' | 'd'>('h');

  // Submission states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedUrl = url.trim();
    if (!trimmedUrl) {
      setErrorMessage('Please enter a destination URL');
      return;
    }

    if (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://')) {
      setErrorMessage('URL must start with http:// or https://');
      return;
    }

    const payload: CreateLinkPayload = {
      url: trimmedUrl,
    };

    if (alias.trim()) {
      payload.alias = alias.trim();
    }

    if (passcode.trim()) {
      payload.passcode = passcode.trim();
    }

    if (expiryOption === 'custom') {
      if (!customValue || customValue <= 0) {
        setErrorMessage('Custom expiration value must be greater than zero');
        return;
      }
      let seconds = customValue * 60;
      if (customUnit === 'h') seconds = customValue * 3600;
      if (customUnit === 'd') seconds = customValue * 86400;

      // Validate bounds: max 7 days = 604800s
      if (seconds < 60 || seconds > 7 * 86400) {
        setErrorMessage('Custom expiration must be between 1 minute and 7 days');
        return;
      }
      payload.ttl_seconds = seconds;
    } else {
      payload.expires_in = expiryOption;
    }

    try {
      setIsSubmitting(true);
      const data = await createLink(payload);
      navigate('/created', {
        state: {
          slug: data.slug,
          short_url: data.short_url,
          expires_at: data.expires_at,
          ttl_seconds: data.ttl_seconds,
          has_passcode: data.has_passcode,
          original_url: trimmedUrl,
        },
      });
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Failed to create ephemeral link');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-12 sm:py-16">
      {/* Hero Header */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/80 dark:border-indigo-800/80 text-xs font-semibold text-indigo-600 dark:text-indigo-400 mb-4 shadow-sm">
          <Flame className="w-3.5 h-3.5 text-amber-500" />
          <span>Self-Destructing URL Redirection</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          Links that vanish{' '}
          <span className="bg-gradient-to-r from-indigo-500 to-violet-500 bg-clip-text text-transparent">
            into thin air.
          </span>
        </h1>
        <p className="mt-4 text-base sm:text-lg text-slate-600 dark:text-slate-400 max-w-xl mx-auto">
          Share sensitive or temporary links. No accounts, no persistent tracking, and automatic expiration backed by Redis TTL.
        </p>
      </div>

      {/* Main Creation Card */}
      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/90 dark:border-slate-800/90 rounded-2xl p-6 sm:p-8 shadow-xl shadow-slate-200/50 dark:shadow-none transition-all">
        {errorMessage && (
          <div className="mb-6 p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 flex items-start gap-3 text-rose-700 dark:text-rose-300 text-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div className="flex-1">{errorMessage}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* URL Input */}
          <div>
            <label htmlFor="url-input" className="block text-sm font-semibold text-slate-800 dark:text-slate-200 mb-2">
              Destination URL <span className="text-indigo-600 dark:text-indigo-400">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
                <LinkIcon className="w-5 h-5" />
              </div>
              <input
                id="url-input"
                type="url"
                required
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/confidential-proposal-doc"
                className="w-full pl-11 pr-4 py-3.5 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50/50 dark:bg-slate-950/60 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm sm:text-base font-mono"
              />
            </div>
          </div>

          {/* Expiration Selector */}
          <div>
            <label className="block text-sm font-semibold text-slate-800 dark:text-slate-200 mb-2">
              Expiration Lifetime
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              {[
                { id: '5m', label: '5 Minutes' },
                { id: '30m', label: '30 Minutes' },
                { id: '1h', label: '1 Hour' },
                { id: '24h', label: '24 Hours' },
                { id: 'custom', label: 'Custom' },
              ].map((opt) => (
                <button
                  type="button"
                  key={opt.id}
                  onClick={() => setExpiryOption(opt.id)}
                  className={`py-2.5 px-3 rounded-xl text-xs sm:text-sm font-medium border transition-all flex items-center justify-center gap-1.5 ${
                    expiryOption === opt.id
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm shadow-indigo-500/25'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>

            {/* Custom TTL inputs */}
            {expiryOption === 'custom' && (
              <div className="mt-3 p-4 rounded-xl bg-slate-50/70 dark:bg-slate-950/50 border border-slate-200/80 dark:border-slate-800/80 flex flex-wrap items-center gap-3 animate-fade-in">
                <span className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">Expire after:</span>
                <input
                  type="number"
                  min={1}
                  max={customUnit === 'd' ? 7 : customUnit === 'h' ? 168 : 10080}
                  value={customValue}
                  onChange={(e) => setCustomValue(parseInt(e.target.value) || 1)}
                  className="w-24 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <select
                  value={customUnit}
                  onChange={(e) => setCustomUnit(e.target.value as 'm' | 'h' | 'd')}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="m">Minutes</option>
                  <option value="h">Hours</option>
                  <option value="d">Days (max 7)</option>
                </select>
                <span className="text-xs text-slate-500 dark:text-slate-400 ml-auto">
                  Max TTL: 7 days
                </span>
              </div>
            )}
          </div>

          {/* Advanced Collapsible Section */}
          <div className="border-t border-slate-100 dark:border-slate-800/80 pt-4">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center justify-between w-full text-left py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
            >
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-indigo-500" />
                <span>Security & Customization (Optional)</span>
              </div>
              {showAdvanced ? (
                <ChevronUp className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              )}
            </button>

            {showAdvanced && (
              <div className="space-y-4 pt-3 pb-1 animate-fade-in">
                {/* Custom Alias */}
                <div>
                  <label htmlFor="alias-input" className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                    Custom Alias
                  </label>
                  <div className="relative">
                    <input
                      id="alias-input"
                      type="text"
                      value={alias}
                      onChange={(e) => setAlias(e.target.value)}
                      placeholder="e.g. quarterly-review-2026"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50/50 dark:bg-slate-950/60 text-slate-900 dark:text-white text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                    Optional 3–64 alphanumeric characters, hyphens, and underscores. Leave blank for a random 8-character slug.
                  </p>
                </div>

                {/* Passcode Protection */}
                <div>
                  <label htmlFor="passcode-input" className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                    Passcode Lock
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <KeyRound className="w-4 h-4" />
                    </div>
                    <input
                      id="passcode-input"
                      type={showPasscode ? 'text' : 'password'}
                      value={passcode}
                      onChange={(e) => setPasscode(e.target.value)}
                      placeholder="Enter a secret passcode"
                      className="w-full pl-9 pr-10 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50/50 dark:bg-slate-950/60 text-slate-900 dark:text-white text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasscode(!showPasscode)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      {showPasscode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                    If provided, visitors must enter this passcode before being redirected. Secured with bcrypt.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting || !url.trim()}
            className="w-full py-4 rounded-xl font-bold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:from-indigo-600 disabled:hover:to-violet-600 shadow-lg shadow-indigo-500/25 transition-all flex items-center justify-center gap-2 text-base"
          >
            {isSubmitting ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Creating Ephemeral Link...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                <span>Create Ghost Link</span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* Trust Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8 text-center sm:text-left">
        <div className="p-4 rounded-xl border border-slate-200/60 dark:border-slate-800/60 bg-white/40 dark:bg-slate-900/40">
          <div className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 mb-1">
            Hard TTL Expiration
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Keys are purged directly by Redis memory management when TTL expires.
          </p>
        </div>

        <div className="p-4 rounded-xl border border-slate-200/60 dark:border-slate-800/60 bg-white/40 dark:bg-slate-900/40">
          <div className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-1">
            Account-less Privacy
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            No signup, cookies, or user tracking. Ephemeral by design.
          </p>
        </div>

        <div className="p-4 rounded-xl border border-slate-200/60 dark:border-slate-800/60 bg-white/40 dark:bg-slate-900/40">
          <div className="text-xs font-bold uppercase tracking-wider text-violet-600 dark:text-violet-400 mb-1">
            Bcrypt Protection
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Passcodes are hashed with bcrypt before storing. Plaintext is never saved.
          </p>
        </div>
      </div>
    </div>
  );
};
export default CreatePage;
