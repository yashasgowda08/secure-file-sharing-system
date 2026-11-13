import React, { useState, useEffect } from 'react';
import {
  Lock,
  Download,
  Eye,
  ShieldCheck,
  AlertCircle,
  Clock,
  HardDrive,
  User,
  CheckCircle2,
  KeyRound,
  FileText,
  AlertTriangle,
} from 'lucide-react';
import { api } from '../lib/api';
import { formatBytes, formatDate } from '../lib/utils';
import { FileIcon } from '../components/FileIcon';
import { useToast } from '../context/ToastContext';

interface PublicSharePageProps {
  token: string;
}

export const PublicSharePage: React.FC<PublicSharePageProps> = ({ token }) => {
  const { success, error } = useToast();

  const [shareInfo, setShareInfo] = useState<any | null>(null);
  const [password, setPassword] = useState('');
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadShareMetadata();
  }, [token]);

  const loadShareMetadata = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await api.shares.getPublic(token);
      if (res.success && res.share) {
        setShareInfo(res.share);
        if (!res.share.requiresPassword) {
          setIsUnlocked(true);
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Unable to access shared file.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;

    setIsVerifying(true);
    try {
      const res = await api.shares.verifyPassword(token, password);
      if (res.success && res.accessToken) {
        setAccessToken(res.accessToken);
        setIsUnlocked(true);
        success('Access Granted', 'Password confirmed. File is ready for secure download.');
      }
    } catch (err: any) {
      error('Access Denied', err.message || 'Incorrect password.');
    } finally {
      setIsVerifying(false);
    }
  };

  const downloadUrl = api.shares.getPublicDownloadUrl(token, accessToken || undefined, false);
  const viewUrl = api.shares.getPublicDownloadUrl(token, accessToken || undefined, true);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6 text-slate-500">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-semibold">Verifying cryptographic share token...</p>
        </div>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6">
        <div className="max-w-md w-full p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto shadow-inner">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Link Inaccessible
            </h2>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              {errorMessage}
            </p>
          </div>
          <p className="text-[11px] text-slate-400">
            For security, share links may expire, self-destruct after reaching download limits, or be revoked at any time by the owner.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-center items-center p-4 sm:p-6 font-sans">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-1">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white mx-auto shadow-md">
            <Lock className="w-5 h-5" />
          </div>
          <span className="font-bold text-sm tracking-tight text-slate-900 dark:text-white">
            SecureVault Link
          </span>
          <p className="text-[11px] text-slate-400">
            Protected with AES-256-GCM Envelope Encryption
          </p>
        </div>

        {/* Card */}
        <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl space-y-6">
          {/* File Card Info */}
          <div className="flex items-center gap-3.5 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80">
            <FileIcon mimeType={shareInfo?.mimeType} filename={shareInfo?.fileName} className="w-12 h-12" />
            <div className="min-w-0 flex-1">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                {shareInfo?.fileName}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {formatBytes(shareInfo?.fileSize || 0)}
              </p>
            </div>
          </div>

          {/* Metadata pill list */}
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
              <span className="flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-blue-500" /> Shared By
              </span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {shareInfo?.ownerName || 'Verified User'}
              </span>
            </div>

            <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> Security
              </span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                AES-256-GCM Verified
              </span>
            </div>

            {shareInfo?.expiresAt && (
              <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-500" /> Expiration
                </span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {formatDate(shareInfo.expiresAt)}
                </span>
              </div>
            )}
          </div>

          {/* Password Prompt if locked */}
          {!isUnlocked && shareInfo?.requiresPassword ? (
            <form onSubmit={handleVerifyPassword} className="space-y-4 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-blue-500" /> Enter Passcode to Unlock
                </label>
                <input
                  type="password"
                  required
                  autoFocus
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password provided by sender"
                  className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <button
                type="submit"
                disabled={isVerifying || !password}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-500/20 disabled:opacity-50 transition-all active:scale-95"
              >
                {isVerifying ? 'Decrypting Access...' : 'Unlock File'}
              </button>
            </form>
          ) : (
            /* Download & View Actions */
            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <a
                href={downloadUrl}
                download={shareInfo?.fileName}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-500/25 transition-all active:scale-95"
              >
                <Download className="w-4 h-4" />
                <span>Download Secure File</span>
              </a>

              <a
                href={viewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-xs rounded-xl transition-all"
              >
                <Eye className="w-4 h-4" />
                <span>View in Safe Sandbox</span>
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
