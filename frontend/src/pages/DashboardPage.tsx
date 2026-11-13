import React, { useState, useEffect } from 'react';
import {
  FileText,
  HardDrive,
  Share2,
  Download,
  UploadCloud,
  FolderPlus,
  ShieldCheck,
  Clock,
  ArrowUpRight,
  MoreVertical,
  Activity,
  AlertTriangle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { FileItem, AuditLogItem } from '../types';
import { formatBytes, formatDate } from '../lib/utils';
import { FileIcon } from '../components/FileIcon';

interface DashboardPageProps {
  onNavigate: (path: string) => void;
  onOpenUpload: () => void;
  onOpenCreateFolder: () => void;
  onPreviewFile: (file: FileItem) => void;
  onShareFile: (file: FileItem) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  onNavigate,
  onOpenUpload,
  onOpenCreateFolder,
  onPreviewFile,
  onShareFile,
}) => {
  const { user } = useAuth();
  const [recentFiles, setRecentFiles] = useState<FileItem[]>([]);
  const [recentLogs, setRecentLogs] = useState<AuditLogItem[]>([]);
  const [activeSharesCount, setActiveSharesCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setIsLoading(true);
    try {
      const [filesRes, sharesRes, logsRes] = await Promise.all([
        api.files.list({ sortBy: 'createdAt', sortOrder: 'desc' }),
        api.shares.myShares(),
        api.audit.list({ limit: 5 }),
      ]);

      if (filesRes.success) {
        setRecentFiles((filesRes.files || []).slice(0, 6));
      }
      if (sharesRes.success) {
        setActiveSharesCount((sharesRes.shares || []).filter((s: any) => !s.isRevoked).length);
      }
      if (logsRes.success) {
        setRecentLogs(logsRes.logs || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const storageUsed = user?.storageUsed || 0;
  const storageLimit = user?.storageLimit || 524288000;
  const usagePercent = Math.min(100, Math.round((storageUsed / storageLimit) * 100));

  return (
    <div className="space-y-8">
      {/* Welcome & Quick Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white shadow-xl relative overflow-hidden">
        {/* Subtle decorative circles */}
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-64 h-64 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="relative z-10 space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-400">
              Personal Security Vault
            </span>
            {user?.isMfaEnabled ? (
              <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                <ShieldCheck className="w-3 h-3" /> MFA Active
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                <AlertTriangle className="w-3 h-3" /> MFA Disabled
              </span>
            )}
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Welcome back, {user?.fullName}
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 max-w-lg font-normal">
            Your encrypted files are protected at rest with AES-256-GCM and strict authenticated permissions.
          </p>
        </div>

        {/* Quick action buttons */}
        <div className="relative z-10 flex flex-wrap items-center gap-2.5">
          <button
            onClick={onOpenCreateFolder}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold text-xs backdrop-blur-sm border border-white/10 transition-all active:scale-95"
          >
            <FolderPlus className="w-4 h-4 text-blue-300" />
            <span>New Folder</span>
          </button>
          <button
            onClick={onOpenUpload}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-lg shadow-blue-500/30 transition-all active:scale-95"
          >
            <UploadCloud className="w-4 h-4" />
            <span>Upload Files</span>
          </button>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Files */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total Files</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div>
            <span className="text-2xl font-extrabold text-slate-900 dark:text-white">
              {recentFiles.length > 0 ? recentFiles.length : 0}
            </span>
            <p className="text-[11px] text-slate-400 mt-0.5">Stored with individual DEKs</p>
          </div>
        </div>

        {/* Card 2: Storage Quota */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Storage Usage</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <HardDrive className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-extrabold text-slate-900 dark:text-white">
                {formatBytes(storageUsed)}
              </span>
              <span className="text-xs font-semibold text-slate-500">{usagePercent}%</span>
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden mt-2">
              <div
                className={`h-full ${
                  usagePercent > 80 ? 'bg-rose-500' : 'bg-blue-600'
                } rounded-full transition-all duration-300`}
                style={{ width: `${usagePercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Card 3: Active Shares */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Active Shares</span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <Share2 className="w-4 h-4" />
            </div>
          </div>
          <div>
            <span className="text-2xl font-extrabold text-slate-900 dark:text-white">
              {activeSharesCount}
            </span>
            <p className="text-[11px] text-slate-400 mt-0.5">Password & limit controlled</p>
          </div>
        </div>

        {/* Card 4: Security Shield */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Security Posture</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div>
            <span className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
              Optimal
            </span>
            <p className="text-[11px] text-slate-400 mt-0.5">Tamper protection verified</p>
          </div>
        </div>
      </div>

      {/* Main Grid: Recently Uploaded Files & Security Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Files Table (2 cols) */}
        <div className="lg:col-span-2 p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white">
                Recently Uploaded Files
              </h3>
              <p className="text-xs text-slate-400">Your latest encrypted documents and assets</p>
            </div>
            <button
              onClick={() => onNavigate('/files')}
              className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
            >
              <span>View All Files</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {recentFiles.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                <FileText className="w-6 h-6" />
              </div>
              <p className="text-xs text-slate-500 font-medium">No files uploaded yet.</p>
              <button
                onClick={onOpenUpload}
                className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold shadow-xs"
              >
                Upload Your First File
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {recentFiles.map((file) => (
                <div
                  key={file.id}
                  className="py-3 flex items-center justify-between hover:bg-slate-50/60 dark:hover:bg-slate-800/30 px-2 rounded-xl transition-colors"
                >
                  <div
                    onClick={() => onPreviewFile(file)}
                    className="flex items-center gap-3 min-w-0 flex-1 mr-4 cursor-pointer"
                  >
                    <FileIcon mimeType={file.mimeType} filename={file.name} />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate hover:text-blue-600">
                        {file.name}
                      </p>
                      <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                        <span>{formatBytes(file.size)}</span>
                        <span>•</span>
                        <span>{formatDate(file.createdAt)}</span>
                        {file.isE2EE && (
                          <span className="px-1.5 py-0.2 rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold">
                            E2EE
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onShareFile(file)}
                      title="Share File"
                      className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <Share2 className="w-4 h-4" />
                    </button>
                    <a
                      href={api.files.getDownloadUrl(file.id, false)}
                      download={file.name}
                      title="Download File"
                      className="p-1.5 text-slate-400 hover:text-emerald-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <Download className="w-4 h-4" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Security Activity Feed (1 col) */}
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white">
                Recent Activity
              </h3>
              <p className="text-xs text-slate-400">Security audit event trail</p>
            </div>
            <button
              onClick={() => onNavigate('/activity')}
              className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
            >
              Full Log
            </button>
          </div>

          <div className="space-y-3">
            {recentLogs.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">No recent security events.</p>
            ) : (
              recentLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200/60 dark:border-slate-800/60 text-xs space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {log.action.replace(/_/g, ' ')}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                        log.status === 'SUCCESS'
                          ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                          : log.status === 'WARNING'
                          ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400'
                          : 'bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {log.status}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>{formatDate(log.createdAt)}</span>
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
