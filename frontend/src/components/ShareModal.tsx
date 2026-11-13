import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Share2,
  X,
  Lock,
  Calendar,
  Download,
  Eye,
  Copy,
  Check,
  UserCheck,
  ShieldCheck,
  Clock,
  Sparkles,
} from 'lucide-react';
import { api } from '../lib/api';
import { useToast } from '../context/ToastContext';
import { copyToClipboard } from '../lib/utils';
import { FileItem } from '../types';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  file: FileItem | null;
  onShareCreated?: () => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  file,
  onShareCreated,
}) => {
  const { success, error } = useToast();

  const [shareType, setShareType] = useState<'PUBLIC_LINK' | 'SPECIFIC_USER'>('PUBLIC_LINK');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [hasPassword, setHasPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [expirationOption, setExpirationOption] = useState<string>('7d');
  const [maxDownloadsOption, setMaxDownloadsOption] = useState<string>('unlimited');
  const [permission, setPermission] = useState<'VIEW_ONLY' | 'DOWNLOAD'>('DOWNLOAD');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (!isOpen || !file) return null;

  const handleCreateShare = async () => {
    setIsSubmitting(true);
    try {
      let expiresAt: string | null = null;
      if (expirationOption === '1h') {
        expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      } else if (expirationOption === '24h') {
        expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      } else if (expirationOption === '7d') {
        expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      } else if (expirationOption === '30d') {
        expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      }

      let maxDownloads: number | null = null;
      if (maxDownloadsOption === '1') maxDownloads = 1;
      else if (maxDownloadsOption === '5') maxDownloads = 5;
      else if (maxDownloadsOption === '10') maxDownloads = 10;

      const payload: any = {
        fileId: file.id,
        shareType,
        sharedWithEmail: shareType === 'SPECIFIC_USER' ? recipientEmail : null,
        password: hasPassword ? password : null,
        expiresAt,
        maxDownloads,
        permission,
      };

      const res = await api.shares.create(payload);

      if (res.success && res.share) {
        const fullUrl = `${window.location.origin}/#share/${res.share.shareToken}`;
        setGeneratedLink(fullUrl);
        success('Share Link Created', 'Protected link generated with cryptographic controls.');
        if (onShareCreated) onShareCreated();
      }
    } catch (err: any) {
      console.error(err);
      error('Failed to Create Share', err.message || 'Error configuring sharing link.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopy = async () => {
    if (!generatedLink) return;
    const ok = await copyToClipboard(generatedLink);
    if (ok) {
      setCopied(true);
      success('Link Copied', 'Share link copied to clipboard.');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleReset = () => {
    setGeneratedLink(null);
    setHasPassword(false);
    setPassword('');
    setRecipientEmail('');
    setCopied(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs"
      />

      {/* Modal Dialog */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="relative z-10 w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Share2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Share Protected File
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-xs">
                {file.name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {generatedLink ? (
            <div className="space-y-4 py-2 text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-inner">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  Secure Sharing Link Ready
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Protected with real-time server authorization and download controls.
                </p>
              </div>

              <div className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700">
                <input
                  type="text"
                  readOnly
                  value={generatedLink}
                  className="w-full bg-transparent text-xs text-slate-800 dark:text-slate-200 outline-none px-2 select-all font-mono"
                />
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors flex-shrink-0"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>

              <div className="pt-2 flex justify-center gap-3">
                <button
                  onClick={handleReset}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                >
                  Create Another Link
                </button>
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-xl hover:opacity-90"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Share Type Tabs */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setShareType('PUBLIC_LINK')}
                  className={`py-2 rounded-lg transition-all ${
                    shareType === 'PUBLIC_LINK'
                      ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  Public Secure Link
                </button>
                <button
                  type="button"
                  onClick={() => setShareType('SPECIFIC_USER')}
                  className={`py-2 rounded-lg transition-all ${
                    shareType === 'SPECIFIC_USER'
                      ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  Specific User Only
                </button>
              </div>

              {/* Specific User Email Input */}
              {shareType === 'SPECIFIC_USER' && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-blue-500" /> Authorized User Email
                  </label>
                  <input
                    type="email"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    placeholder="colleague@company.com"
                    className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}

              {/* Password Protection */}
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50/50 dark:bg-slate-800/40 space-y-2.5">
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <Lock className="w-3.5 h-3.5 text-blue-500" /> Password Protect Link
                  </span>
                  <input
                    type="checkbox"
                    checked={hasPassword}
                    onChange={(e) => setHasPassword(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                </label>
                {hasPassword && (
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter link password..."
                    className="w-full px-3 py-1.5 rounded-lg text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                )}
              </div>

              {/* Expiration and Limits Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Expiration */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-blue-500" /> Link Expiry
                  </label>
                  <select
                    value={expirationOption}
                    onChange={(e) => setExpirationOption(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="1h">1 Hour</option>
                    <option value="24h">24 Hours</option>
                    <option value="7d">7 Days (Default)</option>
                    <option value="30d">30 Days</option>
                    <option value="never">Never Expire</option>
                  </select>
                </div>

                {/* Max Downloads */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Download className="w-3.5 h-3.5 text-blue-500" /> Download Limit
                  </label>
                  <select
                    value={maxDownloadsOption}
                    onChange={(e) => setMaxDownloadsOption(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="unlimited">Unlimited</option>
                    <option value="1">1 Download (One-Time Link)</option>
                    <option value="5">5 Downloads</option>
                    <option value="10">10 Downloads</option>
                  </select>
                </div>
              </div>

              {/* Permission Mode */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Recipient Permission
                </label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <label
                    onClick={() => setPermission('DOWNLOAD')}
                    className={`p-2.5 rounded-xl border flex items-center gap-2 cursor-pointer transition-all ${
                      permission === 'DOWNLOAD'
                        ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <Download className="w-3.5 h-3.5" />
                    <div>
                      <p className="font-semibold">Allow Download</p>
                      <p className="text-[10px] opacity-75">View & save file</p>
                    </div>
                  </label>
                  <label
                    onClick={() => setPermission('VIEW_ONLY')}
                    className={`p-2.5 rounded-xl border flex items-center gap-2 cursor-pointer transition-all ${
                      permission === 'VIEW_ONLY'
                        ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <div>
                      <p className="font-semibold">View Only</p>
                      <p className="text-[10px] opacity-75">Inline sandbox only</p>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {!generatedLink && (
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              disabled={isSubmitting || (shareType === 'SPECIFIC_USER' && !recipientEmail)}
              onClick={handleCreateShare}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-md shadow-blue-500/20 disabled:opacity-50 transition-all active:scale-95"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Generating...' : 'Generate Share Link'}</span>
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
};
