import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Users,
  HardDrive,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  RefreshCw,
  Search,
  Sliders,
  ShieldCheck,
  Lock,
} from 'lucide-react';
import { api } from '../lib/api';
import { AdminStats, AuditLogItem, User } from '../types';
import { formatBytes, formatDate } from '../lib/utils';
import { useToast } from '../context/ToastContext';

export const AdminPage: React.FC = () => {
  const { success, error, warning } = useToast();

  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [quarantinedFiles, setQuarantinedFiles] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [activeTab, setActiveTab] = useState<'users' | 'quarantine' | 'logs'>('users');
  const [userSearch, setUserSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Storage Quota Edit state
  const [editingQuotaUser, setEditingQuotaUser] = useState<any | null>(null);
  const [newQuotaMB, setNewQuotaMB] = useState<number>(500);

  useEffect(() => {
    loadAdminData();
  }, [activeTab]);

  const loadAdminData = async () => {
    setIsLoading(true);
    try {
      const [statsRes, usersRes, quarantineRes, logsRes] = await Promise.all([
        api.admin.stats(),
        api.admin.users(),
        api.admin.quarantined(),
        api.admin.auditLogs({ limit: 50 }),
      ]);

      if (statsRes.success) setStats(statsRes.stats);
      if (usersRes.success) setUsers(usersRes.users || []);
      if (quarantineRes.success) setQuarantinedFiles(quarantineRes.files || []);
      if (logsRes.success) setAuditLogs(logsRes.logs || []);
    } catch (err: any) {
      console.error(err);
      error('Admin Access Error', err.message || 'Failed to fetch admin telemetry.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      const res = await api.admin.updateRole(userId, newRole);
      if (res.success) {
        success('Role Updated', `User role changed to ${newRole}`);
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
        );
      }
    } catch (err: any) {
      error('Failed to Update Role', err.message);
    }
  };

  const handleUpdateQuotaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingQuotaUser) return;

    try {
      const bytes = newQuotaMB * 1024 * 1024;
      const res = await api.admin.updateQuota(editingQuotaUser.id, bytes);
      if (res.success) {
        success('Quota Adjusted', `Storage quota set to ${newQuotaMB} MB.`);
        setUsers((prev) =>
          prev.map((u) => (u.id === editingQuotaUser.id ? { ...u, storageLimit: bytes } : u))
        );
        setEditingQuotaUser(null);
      }
    } catch (err: any) {
      error('Failed to Update Quota', err.message);
    }
  };

  const handleQuarantineDecision = async (fileId: string, decision: 'RELEASE' | 'PURGE') => {
    try {
      const res = await api.admin.quarantineAction(fileId, decision);
      if (res.success) {
        if (decision === 'RELEASE') {
          success('Released', 'File released from quarantine.');
        } else {
          warning('Purged', 'Threat file permanently purged.');
        }
        setQuarantinedFiles((prev) => prev.filter((f) => f.id !== fileId));
        // Refresh stats
        const statsRes = await api.admin.stats();
        if (statsRes.success) setStats(statsRes.stats);
      }
    } catch (err: any) {
      error('Action Failed', err.message);
    }
  };

  const filteredUsers = users.filter(
    (u) =>
      u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.fullName.toLowerCase().includes(userSearch.toLowerCase())
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900">
              Administrator Console
            </span>
          </div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white mt-1">
            System Security & User Telemetry
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            RBAC permission delegation, storage quotas, malware quarantine review, and global audit inspection
          </p>
        </div>

        <button
          onClick={loadAdminData}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold shadow-xs"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Metrics</span>
        </button>
      </div>

      {/* Admin KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Users */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Registered Users</span>
            <Users className="w-4 h-4 text-blue-500" />
          </div>
          <span className="text-2xl font-extrabold text-slate-900 dark:text-white">
            {stats?.totalUsers || 0}
          </span>
          <p className="text-[11px] text-slate-400">Multi-tenant accounts</p>
        </div>

        {/* Metric 2: Encrypted Files */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Encrypted Objects</span>
            <FileText className="w-4 h-4 text-indigo-500" />
          </div>
          <span className="text-2xl font-extrabold text-slate-900 dark:text-white">
            {stats?.totalFiles || 0}
          </span>
          <p className="text-[11px] text-slate-400">AES-256-GCM protected</p>
        </div>

        {/* Metric 3: Total Storage */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Total Vault Volume</span>
            <HardDrive className="w-4 h-4 text-purple-500" />
          </div>
          <span className="text-2xl font-extrabold text-slate-900 dark:text-white">
            {formatBytes(stats?.totalStorageBytes || 0)}
          </span>
          <p className="text-[11px] text-slate-400">Encrypted binary bytes</p>
        </div>

        {/* Metric 4: Quarantined */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Quarantine Alerts</span>
            <ShieldAlert className="w-4 h-4 text-rose-500" />
          </div>
          <span className="text-2xl font-extrabold text-rose-600 dark:text-rose-400">
            {stats?.quarantinedFiles || 0}
          </span>
          <p className="text-[11px] text-slate-400">Suspicious signatures</p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl text-xs font-semibold w-fit">
        <button
          onClick={() => setActiveTab('users')}
          className={`px-4 py-2 rounded-xl transition-all ${
            activeTab === 'users'
              ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          Users & RBAC ({users.length})
        </button>
        <button
          onClick={() => setActiveTab('quarantine')}
          className={`px-4 py-2 rounded-xl transition-all ${
            activeTab === 'quarantine'
              ? 'bg-white dark:bg-slate-700 text-rose-600 dark:text-rose-400 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          Quarantine Items ({quarantinedFiles.length})
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`px-4 py-2 rounded-xl transition-all ${
            activeTab === 'logs'
              ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          Global Audit Trail ({auditLogs.length})
        </button>
      </div>

      {/* TAB 1: USER MANAGEMENT */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="relative w-72">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Search user name or email..."
                className="w-full pl-8 pr-3 py-1.5 rounded-xl text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 uppercase text-[10px] font-semibold bg-slate-50/50 dark:bg-slate-800/40">
                    <th className="py-3.5 px-4">User</th>
                    <th className="py-3.5 px-4">Role (RBAC)</th>
                    <th className="py-3.5 px-4">MFA Status</th>
                    <th className="py-3.5 px-4">Storage Used</th>
                    <th className="py-3.5 px-4">Files</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {filteredUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                      <td className="py-3.5 px-4">
                        <p className="font-semibold text-slate-800 dark:text-slate-200">{u.fullName}</p>
                        <p className="text-[11px] text-slate-400">{u.email}</p>
                      </td>
                      <td className="py-3.5 px-4">
                        <select
                          value={u.role}
                          onChange={(e) => handleRoleChange(u.id, e.target.value)}
                          className="px-2 py-1 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                        >
                          <option value="USER">USER</option>
                          <option value="AUDITOR">AUDITOR</option>
                          <option value="ADMIN">ADMIN</option>
                        </select>
                      </td>
                      <td className="py-3.5 px-4">
                        {u.isMfaEnabled ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400">
                            Active
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-500">
                            Disabled
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">
                        {formatBytes(u.storageUsed)} of {formatBytes(u.storageLimit)}
                      </td>
                      <td className="py-3.5 px-4 text-slate-500">{u._count?.files || 0}</td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => {
                            setEditingQuotaUser(u);
                            setNewQuotaMB(Math.round(u.storageLimit / (1024 * 1024)));
                          }}
                          className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium"
                        >
                          Edit Quota
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: QUARANTINE ITEMS */}
      {activeTab === 'quarantine' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
          {quarantinedFiles.length === 0 ? (
            <div className="text-center py-16 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950 text-emerald-500 flex items-center justify-center mx-auto">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                Zero Quarantined Threats
              </p>
              <p className="text-xs text-slate-400">All uploaded files have passed signature and malware heuristics.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 uppercase text-[10px] font-semibold bg-slate-50/50 dark:bg-slate-800/40">
                    <th className="py-3.5 px-4">Filename</th>
                    <th className="py-3.5 px-4">Owner</th>
                    <th className="py-3.5 px-4">Quarantine Indicator / Threat</th>
                    <th className="py-3.5 px-4">Size</th>
                    <th className="py-3.5 px-4 text-right">Decision</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {quarantinedFiles.map((file) => (
                    <tr key={file.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                      <td className="py-3.5 px-4 font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                        <span>{file.name}</span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">
                        {file.owner?.fullName} ({file.owner?.email})
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[11px] text-rose-700 dark:text-rose-300">
                        {file.quarantineReason || 'Heuristic threat trigger'}
                      </td>
                      <td className="py-3.5 px-4 text-slate-500">{formatBytes(file.size)}</td>
                      <td className="py-3.5 px-4 text-right space-x-2">
                        <button
                          onClick={() => handleQuarantineDecision(file.id, 'RELEASE')}
                          className="px-2.5 py-1 text-xs font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                        >
                          Release
                        </button>
                        <button
                          onClick={() => handleQuarantineDecision(file.id, 'PURGE')}
                          className="px-2.5 py-1 text-xs font-semibold bg-rose-600 text-white rounded-lg hover:bg-rose-700"
                        >
                          Purge
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: GLOBAL AUDIT LOGS */}
      {activeTab === 'logs' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 uppercase text-[10px] font-semibold bg-slate-50/50 dark:bg-slate-800/40">
                  <th className="py-3.5 px-4">Event</th>
                  <th className="py-3.5 px-4">User</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">IP Address</th>
                  <th className="py-3.5 px-4">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-800 dark:text-slate-200">
                      {log.action}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">
                      {log.user ? `${log.user.fullName} (${log.user.email})` : 'System / Anonymous'}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          log.status === 'SUCCESS'
                            ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400'
                            : 'bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {log.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-500">{log.ipAddress || '—'}</td>
                    <td className="py-3.5 px-4 text-slate-400">{formatDate(log.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit Quota Dialog */}
      {editingQuotaUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-950/60" onClick={() => setEditingQuotaUser(null)} />
          <div className="relative z-10 w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">
              Adjust Storage Quota
            </h3>
            <p className="text-xs text-slate-500">
              Set maximum storage ceiling for {editingQuotaUser.fullName}
            </p>

            <form onSubmit={handleUpdateQuotaSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Quota in Megabytes (MB)
                </label>
                <input
                  type="number"
                  min={50}
                  max={100000}
                  value={newQuotaMB}
                  onChange={(e) => setNewQuotaMB(parseInt(e.target.value, 10) || 500)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingQuotaUser(null)}
                  className="px-3 py-1.5 text-xs text-slate-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-bold text-white bg-blue-600 rounded-xl"
                >
                  Save Quota
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
