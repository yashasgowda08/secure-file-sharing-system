import React, { useState, useEffect } from 'react';
import {
  Share2,
  Lock,
  Clock,
  Download,
  Eye,
  Copy,
  Check,
  Ban,
  Trash2,
  UserCheck,
  ShieldCheck,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { api } from '../lib/api';
import { FileShareItem } from '../types';
import { formatBytes, formatDate, copyToClipboard } from '../lib/utils';
import { useToast } from '../context/ToastContext';

export const SharedFilesPage: React.FC = () => {
  const { success, error } = useToast();

  const [activeTab, setActiveTab] = useState<'by_me' | 'with_me'>('by_me');
  const [myShares, setMyShares] = useState<FileShareItem[]>([]);
  const [sharedWithMe, setSharedWithMe] = useState<any[]>([]);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadShares();
  }, [activeTab]);

  const loadShares = async () => {
    setIsLoading(true);
    try {
      if (activeTab === 'by_me') {
        const res = await api.shares.myShares();
        if (res.success) setMyShares(res.shares || []);
      } else {
        const res = await api.shares.sharedWithMe();
        if (res.success) setSharedWithMe(res.shares || []);
      }
    } catch (err: any) {
      console.error(err);
      error('Failed to Load Shares', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async (token: string) => {
    const fullUrl = `${window.location.origin}/#share/${token}`;
    const ok = await copyToClipboard(fullUrl);
    if (ok) {
      setCopiedToken(token);
      success('Link Copied', 'Protected share link copied to clipboard.');
      setTimeout(() => setCopiedToken(null), 2000);
    }
  };

  const handleRevoke = async (id: string) => {
    if (!window.confirm('Are you sure you want to revoke this link? Anyone with the URL will no longer be able to download the file.')) return;
    try {
      const res = await api.shares.revoke(id);
      if (res.success) {
        success('Share Revoked', 'Sharing link has been deactivated.');
        setMyShares((prev) =>
          prev.map((s) => (s.id === id ? { ...s, isRevoked: true } : s))
        );
      }
    } catch (err: any) {
      error('Failed to Revoke', err.message);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await api.shares.delete(id);
      if (res.success) {
        success('Removed', 'Share record removed.');
        setMyShares((prev) => prev.filter((s) => s.id !== id));
      }
    } catch (err: any) {
      error('Failed to Delete', err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Shared Files Management
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Monitor protected public links, access limits, and files shared directly with you
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl text-xs font-semibold">
          <button
            onClick={() => setActiveTab('by_me')}
            className={`px-4 py-2 rounded-xl transition-all ${
              activeTab === 'by_me'
                ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            Shared By Me ({myShares.length})
          </button>
          <button
            onClick={() => setActiveTab('with_me')}
            className={`px-4 py-2 rounded-xl transition-all ${
              activeTab === 'with_me'
                ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            Shared With Me ({sharedWithMe.length})
          </button>
        </div>
      </div>

      {/* Tab 1: Shared By Me */}
      {activeTab === 'by_me' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
          {myShares.length === 0 ? (
            <div className="text-center py-16 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-500 flex items-center justify-center mx-auto">
                <Share2 className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                No active shared links
              </p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Generate secure sharing links with password protection and download limits from your files.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 uppercase text-[10px] font-semibold bg-slate-50/50 dark:bg-slate-800/40">
                    <th className="py-3.5 px-4">File Name</th>
                    <th className="py-3.5 px-4">Access Type</th>
                    <th className="py-3.5 px-4">Protection</th>
                    <th className="py-3.5 px-4">Downloads</th>
                    <th className="py-3.5 px-4">Expires</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {myShares.map((share) => {
                    const isExpired = share.expiresAt ? new Date() > new Date(share.expiresAt) : false;
                    const isLimitReached = share.maxDownloads ? share.currentDownloads >= share.maxDownloads : false;

                    return (
                      <tr
                        key={share.id}
                        className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        {/* File Name */}
                        <td className="py-3.5 px-4 font-semibold text-slate-800 dark:text-slate-200">
                          <p className="truncate max-w-[180px]">{share.fileName}</p>
                          <span className="text-[10px] text-slate-400">{formatBytes(share.fileSize)}</span>
                        </td>

                        {/* Type */}
                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-700 dark:text-slate-300">
                            {share.shareType === 'SPECIFIC_USER' ? (
                              <>
                                <UserCheck className="w-3.5 h-3.5 text-blue-500" />
                                <span className="truncate max-w-[120px]">{share.sharedWithEmail}</span>
                              </>
                            ) : (
                              <>
                                <Share2 className="w-3.5 h-3.5 text-indigo-500" />
                                <span>Public Link</span>
                              </>
                            )}
                          </span>
                        </td>

                        {/* Protection */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5">
                            {share.hasPassword ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900 flex items-center gap-1">
                                <Lock className="w-3 h-3" /> Password
                              </span>
                            ) : (
                              <span className="text-slate-400 text-[11px]">Direct</span>
                            )}
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                              {share.permission}
                            </span>
                          </div>
                        </td>

                        {/* Downloads */}
                        <td className="py-3.5 px-4">
                          <div className="space-y-1">
                            <span className="font-semibold text-slate-700 dark:text-slate-300">
                              {share.currentDownloads} {share.maxDownloads ? `/ ${share.maxDownloads}` : 'downloads'}
                            </span>
                            {share.maxDownloads && (
                              <div className="w-20 bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                <div
                                  className={`h-full ${
                                    isLimitReached ? 'bg-rose-500' : 'bg-blue-600'
                                  }`}
                                  style={{
                                    width: `${Math.min(100, (share.currentDownloads / share.maxDownloads) * 100)}%`,
                                  }}
                                />
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Expires */}
                        <td className="py-3.5 px-4 text-slate-500">
                          {share.expiresAt ? (
                            <span className={isExpired ? 'text-rose-500 font-semibold' : ''}>
                              {formatDate(share.expiresAt)}
                            </span>
                          ) : (
                            <span className="text-slate-400">Never</span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4">
                          {share.isRevoked ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400">
                              Revoked
                            </span>
                          ) : isExpired ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400">
                              Expired
                            </span>
                          ) : isLimitReached ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-500">
                              Limit Reached
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400">
                              Active
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleCopy(share.shareToken)}
                              title="Copy Public Link"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                              {copiedToken === share.shareToken ? (
                                <Check className="w-4 h-4 text-emerald-500" />
                              ) : (
                                <Copy className="w-4 h-4" />
                              )}
                            </button>
                            {!share.isRevoked && (
                              <button
                                onClick={() => handleRevoke(share.id)}
                                title="Revoke Link"
                                className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                              >
                                <Ban className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              onClick={() => handleDelete(share.id)}
                              title="Delete Share Record"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Shared With Me */}
      {activeTab === 'with_me' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
          {sharedWithMe.length === 0 ? (
            <div className="text-center py-16 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-500 flex items-center justify-center mx-auto">
                <UserCheck className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                No files shared directly with you
              </p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                When other users share files to your email, they will appear securely here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 uppercase text-[10px] font-semibold bg-slate-50/50 dark:bg-slate-800/40">
                    <th className="py-3.5 px-4">File Name</th>
                    <th className="py-3.5 px-4">Shared By</th>
                    <th className="py-3.5 px-4">Size</th>
                    <th className="py-3.5 px-4">Shared Date</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {sharedWithMe.map((item) => (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3.5 px-4 font-semibold text-slate-800 dark:text-slate-200">
                        {item.file?.name}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">
                        {item.createdBy?.fullName} ({item.createdBy?.email})
                      </td>
                      <td className="py-3.5 px-4 text-slate-500">
                        {formatBytes(item.file?.size || 0)}
                      </td>
                      <td className="py-3.5 px-4 text-slate-400">
                        {formatDate(item.createdAt)}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <a
                          href={api.files.getDownloadUrl(item.file?.id, false)}
                          download={item.file?.name}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-xs"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Download</span>
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
