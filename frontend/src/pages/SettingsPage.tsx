import React, { useState, useEffect } from 'react';
import {
  Shield,
  KeyRound,
  QrCode,
  Check,
  Copy,
  Smartphone,
  LogOut,
  AlertTriangle,
  Lock,
  User,
  HardDrive,
  RefreshCw,
  Clock,
  Laptop,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { UserSession } from '../types';
import { formatBytes, formatDate, copyToClipboard } from '../lib/utils';
import { useToast } from '../context/ToastContext';

export const SettingsPage: React.FC = () => {
  const { user, refreshUser, logoutAll } = useAuth();
  const { success, error, warning } = useToast();

  // Active Sessions
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  // MFA Setup Wizard State
  const [isSettingUpMfa, setIsSettingUpMfa] = useState(false);
  const [mfaSecret, setMfaSecret] = useState('');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [copiedCodes, setCopiedCodes] = useState(false);
  const [isSubmittingMfa, setIsSubmittingMfa] = useState(false);

  // Disable MFA state
  const [showDisableMfa, setShowDisableMfa] = useState(false);
  const [disablePassword, setDisablePassword] = useState('');

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    try {
      const res = await api.auth.getSessions();
      if (res.success) {
        setSessions(res.sessions || []);
        setCurrentSessionId(res.currentSessionId || null);
      }
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleStartMfaSetup = async () => {
    setIsSettingUpMfa(true);
    setBackupCodes(null);
    try {
      const res = await api.auth.setupMfa();
      if (res.success) {
        setMfaSecret(res.secret);
        setQrCodeUrl(res.qrCodeDataUrl);
      }
    } catch (err: any) {
      error('Failed to Initialize MFA', err.message);
      setIsSettingUpMfa(false);
    }
  };

  const handleConfirmEnableMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyCode.trim()) return;

    setIsSubmittingMfa(true);
    try {
      const res = await api.auth.enableMfa({
        secret: mfaSecret,
        code: verifyCode.trim(),
      });

      if (res.success) {
        confetti({
          particleCount: 70,
          spread: 80,
          origin: { y: 0.6 },
        });
        success('MFA Activated', 'Two-Factor Authentication is now actively protecting your account.');
        setBackupCodes(res.backupCodes || []);
        await refreshUser();
      }
    } catch (err: any) {
      error('Verification Failed', err.message || 'Incorrect verification code.');
    } finally {
      setIsSubmittingMfa(false);
    }
  };

  const handleDisableMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.auth.disableMfa({ password: disablePassword });
      if (res.success) {
        warning('MFA Deactivated', 'Two-factor authentication has been disabled.');
        setShowDisableMfa(false);
        setDisablePassword('');
        await refreshUser();
      }
    } catch (err: any) {
      error('Failed to Disable MFA', err.message);
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    try {
      const res = await api.auth.revokeSession(sessionId);
      if (res.success) {
        success('Session Revoked', 'Device session terminated.');
        setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      }
    } catch (err: any) {
      error('Action Failed', err.message);
    }
  };

  const handleLogoutAll = async () => {
    if (!window.confirm('Log out from all devices? All active web sessions will be invalidated immediately.')) return;
    try {
      await logoutAll();
      success('Logged Out Everywhere', 'All sessions revoked.');
    } catch (err: any) {
      error('Failed to Logout All', err.message);
    }
  };

  const copyAllBackupCodes = async () => {
    if (!backupCodes) return;
    const ok = await copyToClipboard(backupCodes.join('\n'));
    if (ok) {
      setCopiedCodes(true);
      success('Codes Copied', 'Store these backup recovery codes in a secure password manager.');
      setTimeout(() => setCopiedCodes(false), 2000);
    }
  };

  const storageUsed = user?.storageUsed || 0;
  const storageLimit = user?.storageLimit || 524288000;
  const usagePercent = Math.min(100, Math.round((storageUsed / storageLimit) * 100));

  return (
    <div className="max-w-4xl space-y-8">
      {/* Page Title */}
      <div>
        <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
          Account & Security Settings
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Manage your identity, cryptographic multi-factor authentication, and active sessions
        </p>
      </div>

      {/* Profile Overview Card */}
      <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <User className="w-4 h-4 text-blue-500" /> Identity Details
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl space-y-1">
            <span className="text-slate-400">Full Name</span>
            <p className="font-semibold text-slate-800 dark:text-slate-200">{user?.fullName}</p>
          </div>
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl space-y-1">
            <span className="text-slate-400">Email Address</span>
            <p className="font-semibold text-slate-800 dark:text-slate-200">{user?.email}</p>
          </div>
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl space-y-1">
            <span className="text-slate-400">Access Role</span>
            <p className="font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">{user?.role}</p>
          </div>
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl space-y-1">
            <span className="text-slate-400">Storage Allocation</span>
            <p className="font-semibold text-slate-800 dark:text-slate-200">
              {formatBytes(storageUsed)} / {formatBytes(storageLimit)} ({usagePercent}%)
            </p>
          </div>
        </div>
      </div>

      {/* Multi-Factor Authentication (MFA) Section */}
      <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-indigo-500" /> Multi-Factor Authentication (TOTP)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Standard RFC 6238 time-based one-time password compatible with Google Authenticator and 1Password.
            </p>
          </div>

          <div>
            {user?.isMfaEnabled ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                <Check className="w-3.5 h-3.5" /> Activated
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                <AlertTriangle className="w-3.5 h-3.5" /> Disabled
              </span>
            )}
          </div>
        </div>

        {/* Action Toggle */}
        {!user?.isMfaEnabled && !isSettingUpMfa && (
          <button
            onClick={handleStartMfaSetup}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-xs"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Configure Authenticator App</span>
          </button>
        )}

        {/* Wizard Step 1: Scan QR */}
        {isSettingUpMfa && !backupCodes && (
          <div className="p-5 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200/80 dark:border-indigo-900 space-y-4">
            <h4 className="font-bold text-xs text-indigo-900 dark:text-indigo-200 uppercase tracking-wider">
              Step 1: Scan QR Code with Authenticator
            </h4>
            <div className="flex flex-col sm:flex-row items-center gap-6">
              {qrCodeUrl && (
                <div className="p-3 bg-white rounded-2xl shadow-md border border-slate-200">
                  <img src={qrCodeUrl} alt="TOTP QR Code" className="w-36 h-36" />
                </div>
              )}
              <div className="space-y-2 text-xs flex-1">
                <p className="text-slate-600 dark:text-slate-400">
                  Scan the QR code using Google Authenticator, Microsoft Authenticator, or Authy.
                </p>
                <div className="p-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-[11px] font-mono text-slate-700 dark:text-slate-300 select-all break-all">
                  Secret Key: {mfaSecret}
                </div>
              </div>
            </div>

            {/* Step 2: Verification Input */}
            <form onSubmit={handleConfirmEnableMfa} className="pt-2 space-y-3">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Step 2: Enter 6-digit confirmation code
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value)}
                  placeholder="000000"
                  className="w-36 text-center py-2 text-base font-mono font-bold tracking-widest rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  type="submit"
                  disabled={isSubmittingMfa || verifyCode.trim().length !== 6}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs disabled:opacity-50"
                >
                  {isSubmittingMfa ? 'Verifying...' : 'Confirm & Activate'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsSettingUpMfa(false)}
                  className="px-3 py-2 text-xs text-slate-500 hover:text-slate-700"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Step 3: Emergency Backup Codes Display */}
        {backupCodes && (
          <div className="p-5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold text-sm text-emerald-900 dark:text-emerald-200">
                  Save Your Emergency Backup Codes
                </h4>
                <p className="text-xs text-emerald-700 dark:text-emerald-300">
                  If you lose access to your authenticator device, each code can be used once to log in.
                </p>
              </div>
              <button
                onClick={copyAllBackupCodes}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded-xl shadow-xs"
              >
                {copiedCodes ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedCodes ? 'Copied' : 'Copy All'}</span>
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-xs font-bold text-emerald-900 dark:text-emerald-100 bg-white/80 dark:bg-slate-900/80 p-3 rounded-xl border border-emerald-200 dark:border-emerald-800">
              {backupCodes.map((code, idx) => (
                <div key={idx} className="p-1.5 text-center bg-slate-50 dark:bg-slate-800 rounded-lg">
                  {code}
                </div>
              ))}
            </div>

            <button
              onClick={() => {
                setBackupCodes(null);
                setIsSettingUpMfa(false);
              }}
              className="px-4 py-2 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-bold text-xs rounded-xl"
            >
              I Have Safely Saved These Codes
            </button>
          </div>
        )}

        {/* Disable MFA Option */}
        {user?.isMfaEnabled && (
          <div className="pt-2">
            {!showDisableMfa ? (
              <button
                onClick={() => setShowDisableMfa(true)}
                className="text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline"
              >
                Disable Multi-Factor Authentication
              </button>
            ) : (
              <form onSubmit={handleDisableMfa} className="p-4 rounded-xl bg-rose-50/50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 space-y-3 text-xs">
                <p className="font-semibold text-rose-900 dark:text-rose-200">
                  Confirm your password to disable 2FA
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="password"
                    required
                    value={disablePassword}
                    onChange={(e) => setDisablePassword(e.target.value)}
                    placeholder="Current Password"
                    className="w-56 px-3 py-1.5 rounded-xl text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1.5 bg-rose-600 text-white font-bold rounded-xl"
                  >
                    Confirm Disable
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowDisableMfa(false)}
                    className="px-2 text-slate-500"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>

      {/* Active Device Sessions Manager */}
      <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Laptop className="w-4 h-4 text-blue-500" /> Active Device Sessions
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Devices currently authenticated to your encrypted vault
            </p>
          </div>

          <button
            onClick={handleLogoutAll}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-semibold"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Logout From All Devices</span>
          </button>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
          {sessions.map((session) => (
            <div key={session.id} className="py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-sm">
                    {session.userAgent || 'Web Browser'}
                  </span>
                  {session.id === currentSessionId && (
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400">
                      This Device
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  IP: {session.ipAddress || 'unknown'} • Logged in: {formatDate(session.createdAt)}
                </p>
              </div>

              {session.id !== currentSessionId && (
                <button
                  onClick={() => handleRevokeSession(session.id)}
                  className="px-2.5 py-1 text-xs text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950 rounded-lg font-medium"
                >
                  Revoke
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
