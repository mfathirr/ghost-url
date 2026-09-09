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
} from 'lucide-react';
import { createLink } from '../services/api';
import type { CreateLinkPayload } from '../types';
import { useP2PContext } from '../context/P2PContext';
import { GhostDropZone } from '../components/GhostDropZone';
import { PeerAvatarWithProgress } from '../components/PeerAvatarWithProgress';
import type { PeerInfo } from '../types/p2p';
import { copyToClipboard } from '../utils/clipboard';
import { SEO } from '../components/SEO';

const HOME_JSON_LD = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebSite',
      '@id': 'https://www.ghosturl.web.id/#website',
      url: 'https://www.ghosturl.web.id/',
      name: 'GhostURL',
      description: 'Share links and files that automatically disappear. No account needed.',
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
        'Links auto-delete after your chosen time — no cleanup needed',
        'No account or sign-up required',
        'Optional password protection for your shared link',
        'Send files directly to nearby devices — nothing is uploaded to the cloud',
        'No file size limits for device-to-device transfers',
      ],
    },
  ],
};

export const CreatePage: React.FC = () => {
  const navigate = useNavigate();

  // Mode switcher: GhostLink or GhostDrop (auto-switches to drop if ?room= is present)
  const [mode, setMode] = useState<'link' | 'drop'>(() => {
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
  const [alias, setAlias] = useState('');
  const [passcode, setPasscode] = useState('');
  const [showPasscode, setShowPasscode] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // TTL states
  const [expiryOption, setExpiryOption] = useState<string>('1h');
  const [customValue, setCustomValue] = useState<number>(12);
  const [customUnit, setCustomUnit] = useState<'m' | 'h' | 'd'>('h');

  // Link submission states
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
      <SEO
        title="Ephemeral Link Sharing & P2P File Beaming"
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
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
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
            id="tab-ghost-drop"
            aria-selected={mode === 'drop'}
            aria-controls="panel-ghost-drop"
            onClick={() => setMode('drop')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
              mode === 'drop'
                ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-md shadow-slate-200/50 dark:shadow-none'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Radio className="w-4 h-4 text-emerald-500" />
            <span>Ghost Drop</span>
            <span className="px-1.5 py-0.5 rounded text-[10px] uppercase font-extrabold bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60">
              P2P
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
              <span>Self-Destructing Link</span>
            </div>
            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Links that vanish{' '}
              <span className="bg-gradient-to-r from-indigo-500 to-violet-500 bg-clip-text text-transparent">
                into thin air.
              </span>
            </h1>
            <p className="mt-4 text-base sm:text-lg text-slate-600 dark:text-slate-400 max-w-xl mx-auto">
              Share sensitive or temporary links. No account needed — just paste, set a timer, and send.
            </p>
          </>
        ) : (
          <>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/80 dark:border-emerald-800/80 text-xs font-semibold text-emerald-600 dark:text-emerald-400 mb-4 shadow-sm">
              <Radio className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
              <span>Zero-Storage File Transfer</span>
            </div>
            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Files that beam{' '}
              <span className="bg-gradient-to-r from-emerald-500 via-teal-500 to-indigo-500 bg-clip-text text-transparent">
                into thin air.
              </span>
            </h1>
            <p className="mt-4 text-base sm:text-lg text-slate-600 dark:text-slate-400 max-w-xl mx-auto">
              Send files directly to nearby devices — nothing goes to the cloud.
            </p>
          </>
        )}
      </div>

      {/* Main Card */}
      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/90 dark:border-slate-800/90 rounded-2xl p-6 sm:p-8 shadow-xl shadow-slate-200/50 dark:shadow-none transition-all">
        {mode === 'link' ? (
          <div id="panel-ghost-link" role="tabpanel" aria-labelledby="tab-ghost-link">
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
                        If set, anyone opening your link will need to enter this before being redirected.
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
          Privacy &amp; Security Architecture Guarantees
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center sm:text-left">
          {mode === 'link' ? (
            <>
              <div className="p-4 rounded-xl border border-slate-200/60 dark:border-slate-800/60 bg-white/40 dark:bg-slate-900/40">
                <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 mb-1">
                  Auto-Deletes On Time
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Your link disappears automatically when the timer runs out. No action needed.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-slate-200/60 dark:border-slate-800/60 bg-white/40 dark:bg-slate-900/40">
                <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-1">
                  No Account, No Trace
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  No sign-up, no cookies, no tracking. Share privately by default.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-slate-200/60 dark:border-slate-800/60 bg-white/40 dark:bg-slate-900/40">
                <h3 className="text-xs font-bold uppercase tracking-wider text-violet-600 dark:text-violet-400 mb-1">
                  Password Lock
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Protect your link with a password. Only people who know it can open it.
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
                  Streams at maximum network throughput (up to 100+ MB/s) without cloud upload wait times.
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
    </div>
  );
};
export default CreatePage;
