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
  Radio,
  Share2,
  Check,
  Zap,
  Lock,
  Globe2,
  LogOut,
  FileText,
  Code2,
} from 'lucide-react';
import { createLink } from '../services/api';
import type { CreateLinkPayload } from '../types';
import { useP2PContext } from '../context/P2PContext';
import { GhostDropZone } from '../components/GhostDropZone';
import { PeerAvatarWithProgress } from '../components/PeerAvatarWithProgress';
import type { PeerInfo } from '../types/p2p';
import { copyToClipboard } from '../utils/clipboard';
import { SEO } from '../components/SEO';
import { generateKey, exportKeyToBase64, encrypt } from '../utils/crypto';

const HOME_JSON_LD = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebSite',
      '@id': 'https://www.ghosturl.web.id/#website',
      url: 'https://www.ghosturl.web.id/',
      name: 'GhostURL',
      description: 'Share self-destructing links, end-to-end encrypted secret notes, and direct P2P files that disappear forever. No account needed.',
    },
    {
      '@type': 'WebApplication',
      '@id': 'https://www.ghosturl.web.id/#app',
      name: 'GhostURL',
      url: 'https://www.ghosturl.web.id/',
      applicationCategory: 'SecurityApplication',
      operatingSystem: 'All',
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
      },
      featureList: [
        'Self-destructing short links with automatic expiration timers',
        'Burn-on-Read single-view links and secret notes (disappear after 1 open)',
        'End-to-end encrypted secret notes (GhostPaste) for passwords and code snippets',
        'Zero-knowledge encryption where secret keys never touch backend servers',
        'Optional password protection for shared links and notes',
        'Direct browser-to-browser P2P file transfers with zero server storage',
        'No account, no sign-up, and no cookies required',
      ],
    },
    {
      '@type': 'FAQPage',
      '@id': 'https://www.ghosturl.web.id/#faq',
      mainEntity: [
        {
          '@type': 'Question',
          name: 'What is a Burn-on-Read self-destructing link?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'A Burn-on-Read link is a one-time link that permanently erases itself the instant it is opened. Once the recipient views it, the record is wiped and cannot be accessed again.',
          },
        },
        {
          '@type': 'Question',
          name: 'How does end-to-end encryption work on GhostURL?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'When you share a secret note or enable encryption on a link, your content is encrypted directly in your browser before being sent. The secret key stays in the link itself and is never sent to our servers.',
          },
        },
        {
          '@type': 'Question',
          name: 'Can GhostURL or anyone else read my secret notes?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'No. GhostURL servers and databases are completely blind to encrypted notes and links. Only someone with the full link containing the secret key can decrypt and read the message.',
          },
        },
        {
          '@type': 'Question',
          name: 'Do I or my recipient need an account to use GhostURL?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'No. GhostURL is 100% account-free and anonymous. No personal data, email addresses, or phone numbers are ever required.',
          },
        },
      ],
    },
  ],
};

export const CreatePage: React.FC = () => {
  const navigate = useNavigate();

  // Mode switcher: GhostLink, GhostPaste, or GhostDrop
  const [mode, setMode] = useState<'link' | 'paste' | 'drop'>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.has('room') || window.location.hash.includes('room=')) {
        return 'drop';
      }
    }
    return 'link';
  });

  // Link mode states
  const [url, setUrl] = useState('');
  const [isE2EE, setIsE2EE] = useState(false);

  // Secret Note (GhostPaste) states
  const [noteContent, setNoteContent] = useState('');
  const [noteLanguage, setNoteLanguage] = useState('auto');

  // Shared security & limits
  const [viewLimit, setViewLimit] = useState<number>(0); // 0 = unlimited, 1 = 1 view burn, 3, 5
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

  // GhostDrop states
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [sendingToPeerId, setSendingToPeerId] = useState<Record<string, boolean>>({});
  const [sentToPeerId, setSentToPeerId] = useState<Record<string, boolean>>({});
  const [dropLinkCopied, setDropLinkCopied] = useState(false);

  // P2P Context for GhostDrop
  const {
    roomCode,
    setRoomCode,
    wsStatus,
    peers,
    sendFileToPeer,
    outgoingProgress,
    reconnect,
  } = useP2PContext();

  const handleSendFileToPeer = async (peer: PeerInfo) => {
    if (!selectedFile || sendingToPeerId[peer.id]) return;
    setSendingToPeerId((prev) => ({ ...prev, [peer.id]: true }));
    try {
      const ok = await sendFileToPeer(peer.id, selectedFile);
      if (ok) {
        setSentToPeerId((prev) => ({ ...prev, [peer.id]: true }));
        setTimeout(() => {
          setSentToPeerId((prev) => {
            const next = { ...prev };
            delete next[peer.id];
            return next;
          });
        }, 3000);
      }
    } finally {
      setSendingToPeerId((prev) => ({ ...prev, [peer.id]: false }));
    }
  };

  const handleCopyDropLink = async () => {
    let targetRoom = roomCode;
    if (!targetRoom) {
      targetRoom = Math.floor(100000 + Math.random() * 900000).toString();
      setRoomCode(targetRoom);
      const newUrl = `${window.location.pathname}?room=${targetRoom}`;
      window.history.replaceState(null, '', newUrl);
    }
    const dropUrl = `${window.location.origin}/?room=${encodeURIComponent(targetRoom)}`;
    const copied = await copyToClipboard(dropUrl);
    if (copied) {
      setDropLinkCopied(true);
      setTimeout(() => setDropLinkCopied(false), 2500);
    }
  };

  const handleLeaveRoom = () => {
    setRoomCode('');
    window.history.replaceState(null, '', window.location.pathname);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    let trimmedUrl = '';
    let payloadUrl = '';
    let fragmentKey = '';

    if (mode === 'link') {
      trimmedUrl = url.trim();
      if (!trimmedUrl) {
        setErrorMessage('Please enter a destination URL');
        return;
      }

      if (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://')) {
        setErrorMessage('URL must start with http:// or https://');
        return;
      }

      if (isE2EE) {
        try {
          const cryptoKey = await generateKey();
          fragmentKey = await exportKeyToBase64(cryptoKey);
          payloadUrl = await encrypt(cryptoKey, trimmedUrl);
        } catch {
          setErrorMessage('Client-side encryption failed. Please try again.');
          return;
        }
      } else {
        payloadUrl = trimmedUrl;
      }
    } else if (mode === 'paste') {
      const trimmedNote = noteContent.trim();
      if (!trimmedNote) {
        setErrorMessage('Please enter note or code snippet content');
        return;
      }

      // GhostPaste notes are ALWAYS client-side end-to-end encrypted
      try {
        const cryptoKey = await generateKey();
        fragmentKey = await exportKeyToBase64(cryptoKey);
        payloadUrl = await encrypt(cryptoKey, trimmedNote);
      } catch {
        setErrorMessage('Client-side encryption failed. Please try again.');
        return;
      }
    }

    const payload: CreateLinkPayload = {
      url: payloadUrl,
    };

    if (viewLimit > 0) {
      payload.max_views = viewLimit;
    }

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
          max_views: viewLimit > 0 ? viewLimit : undefined,
          original_url: mode === 'link' ? trimmedUrl : undefined,
          original_note: mode === 'paste' ? noteContent : undefined,
          fragment_key: fragmentKey || undefined,
          content_type: mode === 'paste' ? 'note' : 'url',
          note_language: mode === 'paste' ? noteLanguage : undefined,
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
      <SEO
        title={
          mode === 'paste'
            ? 'Encrypted Secret Notes & Self-Destructing Pastes'
            : mode === 'drop'
            ? 'Direct P2P File Beaming & Nearby Transfer'
            : 'Self-Destructing Links & Ephemeral URL Shortener'
        }
        description={
          mode === 'paste'
            ? 'Share encrypted passwords, private notes, and code snippets that self-destruct after reading. End-to-end encrypted directly in your browser.'
            : mode === 'drop'
            ? 'Send files directly between nearby devices at local Wi-Fi speeds. Zero cloud storage, lightning-fast browser-to-browser streaming.'
            : 'Create private, expiring short links that auto-delete on your schedule or self-destruct after 1 view. No account required, zero tracking.'
        }
        keywords={
          mode === 'paste'
            ? 'self destructing notes, secret notes, privnote alternative, encrypted pastebin, burn on read text, private code share, temporary paste, end to end encrypted notes'
            : mode === 'drop'
            ? 'p2p file sharing, airdrop alternative, snapdrop alternative, local file transfer, browser to browser file transfer, zero storage file send'
            : 'self destructing link, expiring url shortener, burn on read link, one time link, temporary url, private link sharing, ephemeral links, privnote alternative'
        }
        canonical="https://www.ghosturl.web.id/"
        jsonLd={HOME_JSON_LD}
      />

      {/* Mode Switcher Pill */}
      <div className="flex justify-center mb-8">
        <div
          role="tablist"
          aria-label="Sharing Mode Selection"
          className="inline-flex p-1.5 rounded-2xl bg-slate-200/70 dark:bg-slate-900/90 border border-slate-300/70 dark:border-slate-800 shadow-inner"
        >
          <button
            type="button"
            role="tab"
            id="tab-ghost-link"
            aria-selected={mode === 'link'}
            aria-controls="panel-ghost-link"
            onClick={() => setMode('link')}
            className={`flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
              mode === 'link'
                ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-md shadow-slate-200/50 dark:shadow-none'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <LinkIcon className="w-4 h-4" />
            <span>Ghost Link</span>
          </button>
          <button
            type="button"
            role="tab"
            id="tab-ghost-paste"
            aria-selected={mode === 'paste'}
            aria-controls="panel-ghost-paste"
            onClick={() => setMode('paste')}
            className={`flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
              mode === 'paste'
                ? 'bg-white dark:bg-slate-800 text-amber-600 dark:text-amber-400 shadow-md shadow-slate-200/50 dark:shadow-none'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <FileText className="w-4 h-4 text-amber-500" />
            <span>Ghost Paste</span>
            <span className="px-1.5 py-0.5 rounded text-[10px] uppercase font-extrabold bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/60">
              Secret Note
            </span>
          </button>
          <button
            type="button"
            role="tab"
            id="tab-ghost-drop"
            aria-selected={mode === 'drop'}
            aria-controls="panel-ghost-drop"
            onClick={() => setMode('drop')}
            className={`flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
              mode === 'drop'
                ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-md shadow-slate-200/50 dark:shadow-none'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Radio className="w-4 h-4 text-emerald-500" />
            <span>Ghost Drop</span>
            <span className="px-1.5 py-0.5 rounded text-[10px] uppercase font-extrabold bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60">
              Send File
            </span>
          </button>
        </div>
      </div>

      {/* Hero Header */}
      <div className="text-center mb-10">
        {mode === 'link' ? (
          <>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/80 dark:border-indigo-800/80 text-xs font-semibold text-indigo-600 dark:text-indigo-400 mb-4 shadow-sm">
              <Flame className="w-3.5 h-3.5 text-amber-500" />
              <span>Self-Destructing Short Link</span>
            </div>
            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Links that vanish{' '}
              <span className="bg-gradient-to-r from-indigo-500 to-violet-500 bg-clip-text text-transparent">
                into thin air.
              </span>
            </h1>
            <p className="mt-4 text-base sm:text-lg text-slate-600 dark:text-slate-400 max-w-xl mx-auto">
              Share sensitive or temporary links. Set an automatic expiration timer or let them self-destruct after reading.
            </p>
          </>
        ) : mode === 'paste' ? (
          <>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-950/60 border border-amber-200/80 dark:border-amber-800/80 text-xs font-semibold text-amber-600 dark:text-amber-400 mb-4 shadow-sm">
              <Lock className="w-3.5 h-3.5 text-amber-500" />
              <span>Private Secret Note</span>
            </div>
            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Secret notes that vanish{' '}
              <span className="bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 bg-clip-text text-transparent">
                into thin air.
              </span>
            </h1>
            <p className="mt-4 text-base sm:text-lg text-slate-600 dark:text-slate-400 max-w-xl mx-auto">
              Share passwords, private messages, or code snippets. Encrypted directly in your browser so no one — not even our servers — can read it.
            </p>
          </>
        ) : (
          <>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/80 dark:border-emerald-800/80 text-xs font-semibold text-emerald-600 dark:text-emerald-400 mb-4 shadow-sm">
              <Radio className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
              <span>Direct Device-to-Device</span>
            </div>
            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Files that beam{' '}
              <span className="bg-gradient-to-r from-emerald-500 via-teal-500 to-indigo-500 bg-clip-text text-transparent">
                without cloud storage.
              </span>
            </h1>
            <p className="mt-4 text-base sm:text-lg text-slate-600 dark:text-slate-400 max-w-xl mx-auto">
              Send files directly to nearby computers and phones. Nothing is saved or uploaded to the cloud.
            </p>
          </>
        )}
      </div>

      {/* Main Card */}
      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/90 dark:border-slate-800/90 rounded-2xl p-6 sm:p-8 shadow-xl shadow-slate-200/50 dark:shadow-none transition-all">
        {mode === 'link' || mode === 'paste' ? (
          <div id="panel-ghost-link" role="tabpanel" aria-labelledby={mode === 'link' ? 'tab-ghost-link' : 'tab-ghost-paste'}>
            {errorMessage && (
              <div className="mb-6 p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 flex items-start gap-3 text-rose-700 dark:text-rose-300 text-sm">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div className="flex-1">{errorMessage}</div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Conditional Input: Link vs Paste */}
              {mode === 'link' ? (
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
                      placeholder="https://example.com/confidential-document"
                      className="w-full pl-11 pr-4 py-3.5 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50/50 dark:bg-slate-950/60 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm sm:text-base font-mono"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label htmlFor="note-input" className="block text-sm font-semibold text-slate-800 dark:text-slate-200">
                      Secret Note or Code Snippet <span className="text-amber-500">*</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <Code2 className="w-3.5 h-3.5 text-slate-400" />
                      <select
                        value={noteLanguage}
                        onChange={(e) => setNoteLanguage(e.target.value)}
                        className="text-xs py-1 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-medium focus:outline-none focus:ring-2 focus:ring-amber-500"
                      >
                        <option value="auto">Auto Detect</option>
                        <option value="plaintext">Plain Text</option>
                        <option value="javascript">JavaScript</option>
                        <option value="typescript">TypeScript</option>
                        <option value="python">Python</option>
                        <option value="bash">Bash / Shell</option>
                        <option value="json">JSON</option>
                        <option value="sql">SQL</option>
                        <option value="markdown">Markdown</option>
                        <option value="go">Go</option>
                        <option value="rust">Rust</option>
                      </select>
                    </div>
                  </div>

                  <div className="relative">
                    <textarea
                      id="note-input"
                      required
                      rows={7}
                      value={noteContent}
                      onChange={(e) => setNoteContent(e.target.value)}
                      placeholder="Paste passwords, private keys, confidential notes, or code snippets here..."
                      className="w-full p-4 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50/50 dark:bg-slate-950/60 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all text-sm font-mono resize-y"
                    />
                  </div>

                  <div className="mt-2 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                      <Lock className="w-3.5 h-3.5" />
                      <span>End-to-End Encrypted: Only your recipient can unlock this</span>
                    </div>
                    <span>
                      {noteContent.length} chars • {noteContent.split('\n').length} lines
                    </span>
                  </div>
                </div>
              )}

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
                          ? mode === 'paste'
                            ? 'bg-amber-600 text-white border-amber-600 shadow-sm shadow-amber-500/25'
                            : 'bg-indigo-600 text-white border-indigo-600 shadow-sm shadow-indigo-500/25'
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
                      Max lifetime: 7 days
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
                    <span>Security &amp; Privacy Options (Self-destruct, Password, Custom link)</span>
                  </div>
                  {showAdvanced ? (
                    <ChevronUp className="w-4 h-4 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  )}
                </button>

                {showAdvanced && (
                  <div className="space-y-4 pt-3 pb-1 animate-fade-in">
                    {/* View Limit / Self-Destruct Chips */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                          Self-Destruct After Opening
                        </label>
                        {viewLimit > 0 && (
                          <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1">
                            <Flame className="w-3 h-3" />
                            <span>{viewLimit === 1 ? '🔥 Self-destructs after 1 view' : `🔥 Self-destructs after ${viewLimit} views`}</span>
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {[
                          { value: 0, label: 'Keep until timer expires' },
                          { value: 1, label: '🔥 1 View (Self-destruct)' },
                          { value: 3, label: '3 Views' },
                          { value: 5, label: '5 Views' },
                        ].map((chip) => (
                          <button
                            type="button"
                            key={chip.value}
                            onClick={() => setViewLimit(chip.value)}
                            className={`py-2 px-2.5 rounded-xl text-xs font-semibold border transition-all ${
                              viewLimit === chip.value
                                ? chip.value > 0
                                  ? 'bg-rose-600 text-white border-rose-600 shadow-sm shadow-rose-500/20'
                                  : 'bg-indigo-600 text-white border-indigo-600 shadow-sm shadow-indigo-500/20'
                                : 'border-slate-200 dark:border-slate-700/80 bg-slate-50/70 dark:bg-slate-950/40 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'
                            }`}
                          >
                            {chip.label}
                          </button>
                        ))}
                      </div>
                      <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                        {viewLimit === 1
                          ? 'Single-use link — permanently disappears the moment someone opens and reads it.'
                          : viewLimit > 1
                          ? `Automatically disappears forever after ${viewLimit} opens.`
                          : 'Stays active until the countdown timer expires.'}
                      </p>
                    </div>

                    {/* E2EE Toggle (in Link mode only) */}
                    {mode === 'link' && (
                      <div className="p-3.5 rounded-xl border border-indigo-200/80 dark:border-indigo-900/60 bg-indigo-50/50 dark:bg-indigo-950/30 flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-950 dark:text-indigo-200 mb-0.5">
                            <Lock className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                            <span>End-to-End Encrypt Link</span>
                          </div>
                          <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                            Locks the link destination directly on your device before sending. The secret key stays in the link itself and is never sent to our servers.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsE2EE(!isE2EE)}
                          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                            isE2EE ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'
                          }`}
                          role="switch"
                          aria-checked={isE2EE}
                          aria-label="Toggle end-to-end encryption"
                        >
                          <span
                            aria-hidden="true"
                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                              isE2EE ? 'translate-x-5' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>
                    )}

                    {/* Custom Alias */}
                    <div>
                      <label htmlFor="alias-input" className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                        Custom Link Name
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
                        Optional custom name for your link. Leave blank for a secure, random link.
                      </p>
                    </div>

                    {/* Passcode Protection */}
                    <div>
                      <label htmlFor="passcode-input" className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                        Password Protection
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
                          placeholder="Enter a secret password"
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
                        Require recipients to enter this password before they can view the link or note.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting || (mode === 'link' ? !url.trim() : !noteContent.trim())}
                className={`w-full py-4 rounded-xl font-bold text-white shadow-lg active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 text-base ${
                  mode === 'paste'
                    ? 'bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 shadow-amber-500/25'
                    : 'bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 shadow-indigo-500/25'
                }`}
              >
                {isSubmitting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>{mode === 'paste' ? 'Locking & Creating Secret Note...' : 'Creating Disappearing Link...'}</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    <span>{mode === 'paste' ? 'Create Secret Note' : 'Create Disappearing Link'}</span>
                  </>
                )}
              </button>
            </form>
          </div>
        ) : (
          /* GhostDrop Mode */
          <div id="panel-ghost-drop" role="tabpanel" aria-labelledby="tab-ghost-drop" className="space-y-8 animate-fade-in">
            {/* Drop Zone */}
            <GhostDropZone selectedFile={selectedFile} onFileSelected={setSelectedFile} />

            {/* Radar / Peer Target Section */}
            <div className="border-t border-slate-200/80 dark:border-slate-800/80 pt-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Radio className="w-4 h-4 text-emerald-500" />
                    <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                      Nearby Radar Devices
                    </h2>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {selectedFile
                      ? `Click any device below to beam "${selectedFile.name}"`
                      : 'Select or drop a file above, then click a device to send'}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  {/* Radar Connection Status */}
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        wsStatus === 'connected'
                          ? 'bg-emerald-500'
                          : wsStatus === 'connecting'
                          ? 'bg-amber-400 animate-pulse'
                          : 'bg-rose-400'
                      }`}
                    />
                    <span>
                      {wsStatus === 'connected'
                        ? `${peers.length} peer${peers.length !== 1 ? 's' : ''} online`
                        : wsStatus === 'connecting'
                        ? 'Connecting...'
                        : 'Radar offline'}
                    </span>
                    {wsStatus !== 'connected' && wsStatus !== 'connecting' && (
                      <button
                        type="button"
                        onClick={reconnect}
                        className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline font-semibold"
                      >
                        (Retry)
                      </button>
                    )}
                  </div>

                  {/* Share Drop Link (Cross-network) */}
                  <button
                    type="button"
                    onClick={handleCopyDropLink}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                      dropLinkCopied
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200'
                    }`}
                    title="Share direct room link with a remote peer"
                  >
                    {dropLinkCopied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Link Copied!</span>
                      </>
                    ) : (
                      <>
                        <Share2 className="w-3.5 h-3.5 text-indigo-500" />
                        <span>{roomCode ? `Room #${roomCode}` : 'Share Drop Link'}</span>
                      </>
                    )}
                  </button>

                  {roomCode && (
                    <button
                      type="button"
                      onClick={handleLeaveRoom}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/50 transition-all"
                      title="Leave private room and return to local network radar"
                    >
                      <LogOut className="w-3 h-3" />
                      <span>Leave Room</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Peers Grid */}
              {peers.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {peers.map((peer) => {
                    const isTransferringThis =
                      outgoingProgress?.peerId === peer.id &&
                      outgoingProgress.direction === 'sending';
                    const progressVal = isTransferringThis
                      ? outgoingProgress.percentage
                      : null;

                    return (
                      <PeerAvatarWithProgress
                        key={peer.id}
                        peer={peer}
                        progress={progressVal}
                        isSent={!!sentToPeerId[peer.id]}
                        isSending={!!sendingToPeerId[peer.id]}
                        disabled={!selectedFile}
                        actionLabel={selectedFile ? 'Beam File' : 'Pick file'}
                        onClick={() => handleSendFileToPeer(peer)}
                      />
                    );
                  })}
                </div>
              ) : (
                <div className="p-8 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30 text-center">
                  <div className="w-12 h-12 mx-auto rounded-xl bg-slate-100 dark:bg-slate-800/80 flex items-center justify-center text-slate-400 mb-3">
                    <Radio className="w-6 h-6 animate-pulse text-indigo-500" />
                  </div>
                  <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">
                    Searching for nearby devices...
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-4">
                    Open GhostURL on another computer, tablet, or phone on the same Wi-Fi network to beam files instantly.
                  </p>
                  <button
                    type="button"
                    onClick={handleCopyDropLink}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/80 dark:border-indigo-800/80 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors shadow-sm"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>Copy Remote Room Invite Link</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Trust Highlights */}
      <section aria-labelledby="trust-guarantees-heading" className="mt-8">
        <h2 id="trust-guarantees-heading" className="sr-only">
          Privacy &amp; Security Guarantees
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center sm:text-left">
          {mode === 'link' ? (
            <>
              <div className="p-4 rounded-xl border border-slate-200/60 dark:border-slate-800/60 bg-white/40 dark:bg-slate-900/40">
                <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 mb-1">
                  Auto-Deletes On Time
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Your link disappears automatically when the timer runs out. No manual cleanup needed.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-slate-200/60 dark:border-slate-800/60 bg-white/40 dark:bg-slate-900/40">
                <h3 className="text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 mb-1">
                  Self-Destructs On Read
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Optionally configure links to vanish forever the very first time someone opens them.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-slate-200/60 dark:border-slate-800/60 bg-white/40 dark:bg-slate-900/40">
                <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-1">
                  No Account, No Trace
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  No sign-up, no cookies, no tracking. Completely private and anonymous by default.
                </p>
              </div>
            </>
          ) : mode === 'paste' ? (
            <>
              <div className="p-4 rounded-xl border border-slate-200/60 dark:border-slate-800/60 bg-white/40 dark:bg-slate-900/40">
                <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-1">
                  <Lock className="w-3.5 h-3.5" />
                  <span>Locked On Your Device</span>
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Encrypted right inside your browser. The secret key stays in the link and never touches our servers.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-slate-200/60 dark:border-slate-800/60 bg-white/40 dark:bg-slate-900/40">
                <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 mb-1">
                  <Flame className="w-3.5 h-3.5" />
                  <span>Burns After Reading</span>
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Set your note to self-destruct once opened. Wiped permanently with zero recovery possible.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-slate-200/60 dark:border-slate-800/60 bg-white/40 dark:bg-slate-900/40">
                <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 mb-1">
                  <Code2 className="w-3.5 h-3.5" />
                  <span>Code &amp; Text Formatted</span>
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Syntax highlighting for JavaScript, Python, Bash, JSON, SQL, and notes with one-click copy.
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="p-4 rounded-xl border border-slate-200/60 dark:border-slate-800/60 bg-white/40 dark:bg-slate-900/40">
                <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-1">
                  <Lock className="w-3.5 h-3.5" />
                  <span>Zero Server Storage</span>
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Data travels directly device-to-device. Never saved on servers or databases.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-slate-200/60 dark:border-slate-800/60 bg-white/40 dark:bg-slate-900/40">
                <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 mb-1">
                  <Zap className="w-3.5 h-3.5" />
                  <span>Local Wi-Fi Speed</span>
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Streams at maximum network speed directly between devices without waiting for cloud uploads.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-slate-200/60 dark:border-slate-800/60 bg-white/40 dark:bg-slate-900/40">
                <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-violet-600 dark:text-violet-400 mb-1">
                  <Globe2 className="w-3.5 h-3.5" />
                  <span>Cross-Platform</span>
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Works seamlessly across Mac, Windows, iPhone, Android, and Linux in any modern browser.
                </p>
              </div>
            </>
          )}
        </div>
      </section>

      {/* SEO & Educational FAQ Section */}
      <section aria-labelledby="faq-section-heading" className="mt-14 pt-10 border-t border-slate-200/70 dark:border-slate-800/70">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
            <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
            <span>Simple, Private &amp; Ephemeral</span>
          </div>
          <h2 id="faq-section-heading" className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
            Frequently Asked Questions
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-lg mx-auto">
            Everything you need to know about self-destructing links, encrypted notes, and private sharing on GhostURL.
          </p>
        </div>

        <div className="space-y-3 max-w-2xl mx-auto">
          <div className="p-4 rounded-2xl bg-white/60 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">
              What does "Self-Destruct on Read" (Burn on Read) mean?
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              A self-destructing link is a single-use link. As soon as the recipient opens and unlocks it, the link is permanently destroyed from our system. If anyone attempts to refresh or reopen the link, they will see that it has vanished forever.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-white/60 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">
              Can GhostURL or anyone else read my secret notes?
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              No. When you share a secret note, it is encrypted directly inside your web browser before it leaves your device. The secret decryption key is stored inside the link itself and is never sent across the internet to our servers. Only someone with the complete link can view the note.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-white/60 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">
              Do I or my recipient need to register an account?
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Never. GhostURL is 100% account-free and anonymous. We do not ask for emails, phone numbers, or passwords. Just paste your link or note, set your destruction rules, and share.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-white/60 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">
              How does GhostDrop send files without cloud storage?
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              GhostDrop connects devices directly over your local Wi-Fi network using WebRTC DataChannels. Files stream from one device's browser memory directly into another device's browser memory — completely bypassing cloud drives, servers, and databases.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};
export default CreatePage;
