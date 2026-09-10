import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Link as LinkIcon,
  Clock,
  KeyRound,
  ChevronDown,
  AlertCircle,
  Eye,
  EyeOff,
  Flame,
  Radio,
  Share2,
  Check,
  Zap,
  Lock,
  LogOut,
  FileText,
  Code2,
  Cpu,
  ArrowUpRight,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
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
      applicationCategory: 'UtilitiesApplication',
      operatingSystem: 'All',
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
      },
      featureList: [
        'Self-destructing short links with automatic expiration timers',
        'Burn-on-Read single-view links and secret notes that disappear after 1 open',
        'End-to-end encrypted secret notes for passwords and sensitive code snippets',
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

  // Global P2P Context
  const {
    wsStatus,
    peers,
    roomCode,
    setRoomCode,
    sendFileToPeer,
    outgoingProgress,
    reconnect,
  } = useP2PContext();

  const handleFileSelect = (file: File | null) => {
    setSelectedFile(file);
  };

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
    let dropUrl = window.location.origin;
    if (roomCode) {
      dropUrl += `/?room=${roomCode}#drop`;
    } else {
      const generatedRoom = Math.floor(100000 + Math.random() * 900000).toString();
      setRoomCode(generatedRoom);
      dropUrl += `/?room=${generatedRoom}#drop`;
    }
    const success = await copyToClipboard(dropUrl);
    if (success) {
      setDropLinkCopied(true);
      setTimeout(() => setDropLinkCopied(false), 2500);
    }
  };

  const handleLeaveRoom = () => {
    setRoomCode('');
    const urlObj = new URL(window.location.href);
    urlObj.searchParams.delete('room');
    window.history.replaceState({}, '', urlObj.pathname);
  };

  const calculateTtlSeconds = (): number => {
    switch (expiryOption) {
      case '5m':
        return 5 * 60;
      case '30m':
        return 30 * 60;
      case '1h':
        return 60 * 60;
      case '24h':
        return 24 * 60 * 60;
      case 'custom': {
        const val = customValue > 0 ? customValue : 1;
        if (customUnit === 'm') return val * 60;
        if (customUnit === 'h') return val * 3600;
        if (customUnit === 'd') return Math.min(val, 7) * 86400;
        return 3600;
      }
      default:
        return 3600;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedUrl = url.trim();
    if (mode === 'link' && !trimmedUrl) {
      setErrorMessage('Please enter a destination URL');
      return;
    }
    if (mode === 'paste' && !noteContent.trim()) {
      setErrorMessage('Please enter your secret note content');
      return;
    }

    try {
      setIsSubmitting(true);
      const ttl = calculateTtlSeconds();

      let finalUrlToSave = trimmedUrl;
      let fragmentKey = '';

      if (mode === 'paste') {
        const key = await generateKey();
        fragmentKey = await exportKeyToBase64(key);
        finalUrlToSave = await encrypt(key, noteContent);
      } else if (mode === 'link' && isE2EE) {
        const key = await generateKey();
        fragmentKey = await exportKeyToBase64(key);
        finalUrlToSave = await encrypt(key, trimmedUrl);
      }

      const payload: CreateLinkPayload = {
        url: finalUrlToSave,
        ttl_seconds: ttl,
        alias: alias.trim() ? alias.trim() : undefined,
        passcode: passcode.trim() ? passcode.trim() : undefined,
        max_views: viewLimit > 0 ? viewLimit : undefined,
      };

      const result = await createLink(payload);

      navigate('/created', {
        state: {
          slug: result.slug,
          short_url: result.short_url,
          expires_at: result.expires_at,
          ttl_seconds: result.ttl_seconds,
          has_passcode: result.has_passcode,
          max_views: result.max_views,
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
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <SEO
        title={
          mode === 'paste'
            ? 'End-to-End Encrypted Secret Notes & Burn Pastes'
            : mode === 'drop'
            ? 'Direct Device-to-Device P2P File Beaming'
            : 'Ephemeral Links & Self-Destructing URL Shortener'
        }
        description={
          mode === 'paste'
            ? 'Share encrypted passwords, private notes, and code snippets that self-destruct after reading. End-to-end encrypted directly in your browser.'
            : mode === 'drop'
            ? 'Send files directly between nearby devices at local Wi-Fi speeds. Zero cloud storage, lightning-fast browser-to-browser WebRTC streaming.'
            : 'Create private, expiring short links that auto-delete on your schedule or self-destruct after 1 view. No account required, zero logs, nothing stored.'
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

      {/* ASYMMETRIC SPLIT HERO (Above the fold) */}
      <section aria-labelledby="hero-heading" className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start mb-16 sm:mb-20">
        {/* Left Column: Technical Readout & Mode Switcher */}
        <div className="lg:col-span-5 pt-2">
          {/* Telemetry Status Pill */}
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-slate-900/90 dark:bg-black border border-slate-800 dark:border-zinc-800 text-[11px] font-mono text-slate-300 dark:text-zinc-300 mb-5 shadow-sm">
            <span className="relative flex h-2 w-2">
              <span className="animate-radar-sweep absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="font-semibold text-emerald-400">P2P RADAR:</span>
            <span>
              {wsStatus === 'connected'
                ? `${peers.length} PEER${peers.length !== 1 ? 'S' : ''} ONLINE`
                : wsStatus === 'connecting'
                ? 'INITIALIZING...'
                : 'STANDBY'}
            </span>
          </div>

          <h1 id="hero-heading" className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-[1.08] mb-4">
            Zero-knowledge ephemeral bridge.
          </h1>

          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 leading-relaxed mb-6 max-w-md">
            Burn-on-read short links, browser-encrypted secret notes, and direct device-to-device transfers. Zero persistent disk storage.
          </p>

          {/* Mode Selector (Tactile Hardware Tabs) */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Select Protocol Mode:
            </span>
            <div
              role="tablist"
              aria-label="Transmission Mode Selection"
              className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-zinc-900/80 border border-slate-200 dark:border-zinc-800"
            >
              {[
                { id: 'link', label: 'Ghost Link', icon: LinkIcon, badge: 'Short Link' },
                { id: 'paste', label: 'Ghost Paste', icon: FileText, badge: 'Secret Note' },
                { id: 'drop', label: 'Ghost Drop', icon: Radio, badge: 'Beam File' },
              ].map((tab) => {
                const isActive = mode === tab.id;
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    id={`tab-${tab.id}`}
                    aria-selected={isActive}
                    aria-controls={`panel-${tab.id}`}
                    onClick={() => setMode(tab.id as 'link' | 'paste' | 'drop')}
                    className={`relative flex flex-col items-center justify-center py-2.5 px-2 rounded-lg text-xs font-semibold transition-all ${
                      isActive
                        ? 'text-slate-900 dark:text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="activeModeHighlight"
                        transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                        className="absolute inset-0 bg-white dark:bg-zinc-800 rounded-lg border border-slate-200/80 dark:border-zinc-700/80"
                      />
                    )}
                    <div className="relative z-10 flex items-center gap-1.5">
                      <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-emerald-500' : 'text-slate-400'}`} />
                      <span>{tab.label}</span>
                    </div>
                    <span className={`relative z-10 mt-0.5 text-[9px] font-mono uppercase tracking-wider ${
                      isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'
                    }`}>
                      {tab.badge}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick Security Metrics */}
          <div className="mt-8 pt-6 border-t border-slate-200/80 dark:border-white/5 grid grid-cols-3 gap-3 font-mono text-[11px]">
            <div>
              <span className="block text-slate-400 dark:text-slate-500 text-[10px]">STORAGE</span>
              <span className="text-slate-800 dark:text-slate-200 font-semibold">RAM TTL ONLY</span>
            </div>
            <div>
              <span className="block text-slate-400 dark:text-slate-500 text-[10px]">CIPHER</span>
              <span className="text-slate-800 dark:text-slate-200 font-semibold">AES-256-GCM</span>
            </div>
            <div>
              <span className="block text-slate-400 dark:text-slate-500 text-[10px]">ACCOUNTS</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">ZERO REQUIRED</span>
            </div>
          </div>
        </div>

        {/* Right Column: Tactical Vault Console */}
        <div className="lg:col-span-7">
          <div className="stealth-card rounded-2xl p-5 sm:p-7 border border-slate-200/90 dark:border-white/10">
            {mode === 'link' || mode === 'paste' ? (
              <div id={`panel-${mode}`} role="tabpanel" aria-labelledby={`tab-${mode}`}>
                {errorMessage && (
                  <div className="mb-5 p-3.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 flex items-start gap-2.5 text-rose-700 dark:text-rose-300 text-xs">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">{errorMessage}</div>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                  {/* Mode Content Input */}
                  {mode === 'link' ? (
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label htmlFor="url-input" className="block text-xs font-mono uppercase tracking-wider text-slate-700 dark:text-slate-300 font-semibold">
                          Target Destination URL <span className="text-emerald-500">*</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => setIsE2EE(!isE2EE)}
                          className={`inline-flex items-center gap-1.5 text-xs font-mono px-2 py-0.5 rounded border transition-colors ${
                            isE2EE
                              ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 font-semibold'
                              : 'border-slate-200 dark:border-zinc-800 text-slate-500 dark:text-slate-400 hover:border-slate-300'
                          }`}
                          title="Encrypt destination URL directly inside your browser so backend servers never see the link"
                        >
                          <Lock className="w-3 h-3" />
                          <span>E2EE: {isE2EE ? 'ENABLED' : 'OFF'}</span>
                        </button>
                      </div>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                          <LinkIcon className="w-4 h-4" />
                        </div>
                        <input
                          id="url-input"
                          type="url"
                          required
                          value={url}
                          onChange={(e) => setUrl(e.target.value)}
                          placeholder="https://example.com/confidential-document"
                          className="w-full pl-9 pr-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-black/50 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 text-sm font-mono transition-all"
                        />
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label htmlFor="note-input" className="block text-xs font-mono uppercase tracking-wider text-slate-700 dark:text-slate-300 font-semibold">
                          Confidential Note or Snippet <span className="text-emerald-500">*</span>
                        </label>
                        <div className="flex items-center gap-1.5">
                          <Code2 className="w-3.5 h-3.5 text-slate-400" />
                          <select
                            value={noteLanguage}
                            onChange={(e) => setNoteLanguage(e.target.value)}
                            className="text-xs py-1 px-2 rounded border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-800 dark:text-slate-200 font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
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
                          rows={6}
                          value={noteContent}
                          onChange={(e) => setNoteContent(e.target.value)}
                          placeholder="Paste passwords, private keys, API secrets, or confidential notes..."
                          className="w-full p-3.5 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-black/50 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 text-xs sm:text-sm font-mono resize-y transition-all"
                        />
                      </div>

                      <div className="mt-1.5 flex items-center justify-between text-[11px] font-mono text-slate-500 dark:text-slate-400">
                        <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                          <Lock className="w-3 h-3" />
                          <span>Client Encrypted: Key stays in URL fragment</span>
                        </div>
                        <span>
                          {noteContent.length} chars • {noteContent.split('\n').length} lines
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Expiration Presets */}
                  <div>
                    <label className="block text-xs font-mono uppercase tracking-wider text-slate-700 dark:text-slate-300 font-semibold mb-1.5">
                      Auto-Eviction Lifetime
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                      {[
                        { id: '5m', label: '5 Mins' },
                        { id: '30m', label: '30 Mins' },
                        { id: '1h', label: '1 Hour' },
                        { id: '24h', label: '24 Hours' },
                        { id: 'custom', label: 'Custom' },
                      ].map((opt) => (
                        <button
                          type="button"
                          key={opt.id}
                          onClick={() => setExpiryOption(opt.id)}
                          className={`py-2 px-2.5 rounded-lg text-xs font-mono transition-all flex items-center justify-center gap-1.5 border ${
                            expiryOption === opt.id
                              ? 'bg-emerald-500 text-black font-bold border-emerald-500 shadow-sm'
                              : 'border-slate-200 dark:border-zinc-800 bg-slate-50/60 dark:bg-zinc-900/60 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-zinc-700'
                          }`}
                        >
                          <Clock className="w-3 h-3" />
                          <span>{opt.label}</span>
                        </button>
                      ))}
                    </div>

                    {/* Custom TTL row */}
                    {expiryOption === 'custom' && (
                      <div className="mt-2.5 p-3 rounded-lg bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-zinc-800 flex flex-wrap items-center gap-2 text-xs font-mono">
                        <span className="text-slate-500 dark:text-slate-400">Lifetime:</span>
                        <input
                          type="number"
                          min={1}
                          max={customUnit === 'd' ? 7 : customUnit === 'h' ? 168 : 10080}
                          value={customValue}
                          onChange={(e) => setCustomValue(parseInt(e.target.value) || 1)}
                          className="w-20 px-2.5 py-1 rounded border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-900 dark:text-white text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                        <select
                          value={customUnit}
                          onChange={(e) => setCustomUnit(e.target.value as 'm' | 'h' | 'd')}
                          className="px-2.5 py-1 rounded border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-900 dark:text-white text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        >
                          <option value="m">Minutes</option>
                          <option value="h">Hours</option>
                          <option value="d">Days (max 7)</option>
                        </select>
                      </div>
                    )}
                  </div>

                  {/* Collapsible Security & Burn Settings */}
                  <div className="pt-2 border-t border-slate-200/70 dark:border-zinc-800/80">
                    <button
                      type="button"
                      onClick={() => setShowAdvanced(!showAdvanced)}
                      className="flex items-center justify-between w-full text-left text-xs font-mono text-slate-600 dark:text-slate-400 hover:text-emerald-500 dark:hover:text-emerald-400 transition-colors py-1"
                    >
                      <span className="flex items-center gap-1.5 font-semibold">
                        <Flame className="w-3.5 h-3.5 text-amber-500" />
                        <span>Burn-on-Read &amp; Passcode Protections</span>
                      </span>
                      <motion.div
                        animate={{ rotate: showAdvanced ? 180 : 0 }}
                        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </motion.div>
                    </button>

                    <AnimatePresence initial={false}>
                      {showAdvanced && (
                        <motion.div
                          key="burn-advanced-settings"
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                          className="overflow-hidden"
                        >
                          <div className="mt-3 space-y-4 pt-2 border-t border-dashed border-slate-200 dark:border-zinc-800 pb-1">
                            {/* Burn on Read option */}
                            <div>
                              <label className="block text-xs font-mono uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                                Burn Limit
                              </label>
                              <div className="grid grid-cols-4 gap-1.5 font-mono text-xs">
                                {[
                                  { val: 0, label: 'Standard TTL' },
                                  { val: 1, label: '1 View (Burn)' },
                                  { val: 3, label: '3 Views' },
                                  { val: 5, label: '5 Views' },
                                ].map((item) => (
                                  <button
                                    key={item.val}
                                    type="button"
                                    onClick={() => setViewLimit(item.val)}
                                    className={`py-1.5 px-2 rounded border text-center transition-colors ${
                                      viewLimit === item.val
                                        ? 'bg-emerald-500/15 border-emerald-500 text-emerald-600 dark:text-emerald-400 font-bold'
                                        : 'border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 text-slate-600 dark:text-slate-400'
                                    }`}
                                  >
                                    {item.label}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Passcode Protection */}
                            <div>
                              <label htmlFor="passcode-input" className="block text-xs font-mono uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                                Optional Access Passcode (Bcrypt Hashed)
                              </label>
                              <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                                  <KeyRound className="w-3.5 h-3.5" />
                                </div>
                                <input
                                  id="passcode-input"
                                  type={showPasscode ? 'text' : 'password'}
                                  value={passcode}
                                  onChange={(e) => setPasscode(e.target.value)}
                                  placeholder="Leave blank for open access"
                                  className="w-full pl-9 pr-10 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-black/50 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs font-mono"
                                />
                                <button
                                  type="button"
                                  onClick={() => setShowPasscode(!showPasscode)}
                                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                                >
                                  {showPasscode ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                </button>
                              </div>
                            </div>

                            {/* Custom Alias */}
                            <div>
                              <label htmlFor="alias-input" className="block text-xs font-mono uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                                Custom Slug Alias (Optional)
                              </label>
                              <div className="flex items-center rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-black/50 px-3 py-1.5 text-xs font-mono">
                                <span className="text-slate-400 select-none">ghosturl.web.id/r/</span>
                                <input
                                  id="alias-input"
                                  type="text"
                                  value={alias}
                                  onChange={(e) => setAlias(e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, ''))}
                                  placeholder="my-secret"
                                  maxLength={32}
                                  className="w-full bg-transparent text-slate-900 dark:text-white focus:outline-none ml-1 font-mono"
                                />
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Primary Submit CTA */}
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-3 px-4 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-mono font-bold text-sm tracking-wider uppercase transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed active:-translate-y-[1px] active:scale-[0.99] shadow-sm"
                  >
                    {isSubmitting ? (
                      <span>TRANSMITTING...</span>
                    ) : (
                      <>
                        <span>{mode === 'paste' ? 'CREATE ENCRYPTED NOTE' : 'CREATE EPHEMERAL LINK'}</span>
                        <ArrowUpRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              </div>
            ) : (
              /* GhostDrop UI */
              <div id="panel-ghost-drop" role="tabpanel" aria-labelledby="tab-ghost-drop" className="space-y-6">
                <GhostDropZone onFileSelected={handleFileSelect} selectedFile={selectedFile} />

                {/* Radar Action Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-200/80 dark:border-zinc-800">
                  <div className="flex items-center gap-2 font-mono text-xs text-slate-600 dark:text-slate-400">
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
                        ? `${peers.length} peer${peers.length !== 1 ? 's' : ''} in radar range`
                        : wsStatus === 'connecting'
                        ? 'Connecting to radar mesh...'
                        : 'Radar offline'}
                    </span>
                    {wsStatus !== 'connected' && wsStatus !== 'connecting' && (
                      <button
                        type="button"
                        onClick={reconnect}
                        className="text-emerald-500 hover:underline font-semibold ml-1"
                      >
                        (Retry)
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCopyDropLink}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold border transition-colors ${
                        dropLinkCopied
                          ? 'border-emerald-500 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                          : 'border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-700 dark:text-slate-200 hover:border-emerald-500/40'
                      }`}
                      title="Share remote room invite link with peers outside local network"
                    >
                      {dropLinkCopied ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                          <span>Link Copied</span>
                        </>
                      ) : (
                        <>
                          <Share2 className="w-3.5 h-3.5 text-emerald-500" />
                          <span>{roomCode ? `Room #${roomCode}` : 'Share Room Invite'}</span>
                        </>
                      )}
                    </button>

                    {roomCode && (
                      <button
                        type="button"
                        onClick={handleLeaveRoom}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-mono font-semibold border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/50 transition-colors"
                      >
                        <LogOut className="w-3 h-3" />
                        <span>Leave</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Peers List */}
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
                          actionLabel={selectedFile ? 'Beam File' : 'Pick File'}
                          onClick={() => handleSendFileToPeer(peer)}
                        />
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-8 rounded-xl border border-dashed border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-black/30 text-center">
                    <div className="w-10 h-10 mx-auto rounded-lg bg-slate-100 dark:bg-zinc-800/80 flex items-center justify-center text-slate-400 mb-2.5">
                      <Radio className="w-5 h-5 text-emerald-500" />
                    </div>
                    <h3 className="text-xs font-mono uppercase font-bold text-slate-800 dark:text-slate-200 mb-1">
                      Searching for nearby peers...
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mb-3">
                      Open GhostURL on another computer or phone on the same Wi-Fi network to beam files without cloud storage.
                    </p>
                    <button
                      type="button"
                      onClick={handleCopyDropLink}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 transition-colors"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span>Copy Remote Room Code</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ASYMMETRIC 3-CELL TECHNICAL BENTO GRID */}
      <section aria-labelledby="architecture-guarantees-heading" className="mb-20">
        <div className="mb-8">
          <span className="font-mono text-xs uppercase tracking-widest text-emerald-500 font-semibold block mb-1.5">
            Cryptographic Architecture
          </span>
          <h2 id="architecture-guarantees-heading" className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Engineered for zero data retention.
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-2xl">
            Every layer in the system is intentionally architected to eliminate persistence attack vectors.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
          {/* Cell 1: Wide Featured Cell with Authentic Hardware Image */}
          <div className="md:col-span-12 lg:col-span-7 stealth-card rounded-2xl overflow-hidden border border-slate-200/90 dark:border-white/10 flex flex-col group">
            <div className="relative flex-1 min-h-[220px] sm:min-h-[260px] overflow-hidden bg-slate-950">
              <img
                src="/images/ram-eviction.jpg"
                alt="Hardware circuit memory vaporizing into digital particles"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 opacity-90"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent" />
              <div className="absolute bottom-3 left-4 inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-black/75 border border-emerald-500/30 text-[10px] font-mono text-emerald-400 backdrop-blur-md">
                <Cpu className="w-3.5 h-3.5 text-emerald-400" />
                <span>REDIS MEMORY AUTO-EVICTION</span>
              </div>
            </div>
            <div className="p-6 shrink-0 flex flex-col justify-between border-t border-slate-200/80 dark:border-white/5 bg-slate-50/40 dark:bg-black/20">
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Hardware RAM Eviction
                  </h3>
                  <span className="font-mono text-[10px] uppercase text-emerald-600 dark:text-emerald-400 font-semibold px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                    Zero Disk Journaling
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  Ephemeral links live strictly within high-performance in-memory Redis buffers. Once your configured lifetime expires or a Burn-on-Read GETDEL signal triggers, the memory chunk is instantly cleared with zero disk journaling.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-200/80 dark:border-white/5 font-mono text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center justify-between">
                <span>POSIX In-Memory Auto-Purge</span>
                <span className="text-slate-500 dark:text-slate-500">Atomic O(1) Eviction</span>
              </div>
            </div>
          </div>

          {/* Cell 2 & 3 Stacked */}
          <div className="md:col-span-12 lg:col-span-5 grid grid-cols-1 gap-5">
            {/* Cell 2: Client-side AES-GCM */}
            <div className="stealth-card rounded-2xl p-6 border border-slate-200/90 dark:border-white/10 flex flex-col justify-between">
              <div>
                <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-500 mb-4">
                  <Lock className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">
                  Zero-Server Key Exposure
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  Secret notes and encrypted links are sealed with AES-GCM-256 directly in your browser. The decryption key resides exclusively inside the URL hash fragment (#k=), which web browsers never transmit to web servers.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-200/80 dark:border-white/5 font-mono text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                RFC-7518 WebCrypto Standards
              </div>
            </div>

            {/* Cell 3: WebRTC P2P DataChannels */}
            <div className="stealth-card rounded-2xl p-6 border border-slate-200/90 dark:border-white/10 flex flex-col justify-between">
              <div>
                <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-500 mb-4">
                  <Zap className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">
                  Browser-to-Browser Mesh
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  GhostDrop streams files directly between peer browser memories using raw binary WebRTC DataChannels. Files never touch cloud drives or servers, maximizing local network throughput with zero storage footprints.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-200/80 dark:border-white/5 font-mono text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                P2P RTCDataChannel Flow Control
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* HAIRLINE-DIVIDED TECHNICAL FAQ */}
      <section aria-labelledby="faq-section-heading" className="pt-12 border-t border-slate-200/80 dark:border-white/10">
        <div className="mb-8">
          <h2 id="faq-section-heading" className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
            Frequently Asked Questions
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Technical guarantees, encryption workflows, and zero-retention policies.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8 divide-y md:divide-y-0 divide-slate-200/80 dark:divide-white/5">
          <div className="pt-4 md:pt-0">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1.5">
              What does "Burn on Read" mean?
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              A Burn-on-Read link is a single-use link. As soon as the recipient opens and unlocks it, the link is permanently destroyed via an atomic memory purge. If anyone refreshes or revisits the link, the server confirms that it has vanished forever.
            </p>
          </div>

          <div className="pt-4 md:pt-0">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1.5">
              Can GhostURL or anyone else read my secret notes?
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              No. When you share a secret note, it is encrypted directly inside your browser before leaving your device. The secret decryption key is stored inside the link fragment and is never sent across the internet to our servers.
            </p>
          </div>

          <div className="pt-4 md:pt-0">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1.5">
              Do I or my recipient need an account?
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Never. GhostURL is 100% account-free and anonymous. We do not ask for emails, phone numbers, or passwords. Paste your link or note, set your destruction rules, and share.
            </p>
          </div>

          <div className="pt-4 md:pt-0">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1.5">
              How does GhostDrop beam files without cloud storage?
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              GhostDrop connects devices directly over your local Wi-Fi network using WebRTC DataChannels. Files stream from one device's browser memory directly into another device's browser memory, completely bypassing cloud drives, servers, and databases.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default CreatePage;
