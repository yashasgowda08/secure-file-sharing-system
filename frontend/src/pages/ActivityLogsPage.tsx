import React, { useState, useEffect } from 'react';
import {
  Activity,
  Filter,
  Download,
  Clock,
  Shield,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Search,
} from 'lucide-react';
import { api } from '../lib/api';
import { AuditLogItem } from '../types';
import { formatDate } from '../lib/utils';
import { useToast } from '../context/ToastContext';

export const ActivityLogsPage: React.FC = () => {
  const { error } = useToast();

  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [selectedAction, setSelectedAction] = useState<string>('');
  const [searchFilter, setSearchFilter] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadLogs();
  }, [selectedAction]);

  const loadLogs = async () => {
    setIsLoading(true);
    try {
      const res = await api.audit.list({
        action: selectedAction || undefined,
        limit: 100,
      });
      if (res.success) setLogs(res.logs || []);
    } catch (err: any) {
      error('Failed to Load Logs', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(logs, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `security_audit_logs_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const filteredLogs = logs.filter((log) => {
    if (!searchFilter) return true;
    const term = searchFilter.toLowerCase();
    return (
      log.action.toLowerCase().includes(term) ||
      (log.detailsJson && log.detailsJson.toLowerCase().includes(term)) ||
      (log.ipAddress && log.ipAddress.toLowerCase().includes(term))
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Security Activity Audit Logs
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Immutable tracking of logins, cryptographic uploads, share access, and authorization checks
          </p>
        </div>

        <button
          onClick={handleExportJson}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold shadow-xs"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export Audit Trail</span>
        </button>
      </div>

      {/* Filter Row */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        {/* Search Input */}
        <div className="relative flex-1 max-w-sm">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
          <input
            type="text"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder="Search by action, IP, or details..."
            className="w-full pl-8 pr-3 py-1.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Action Dropdown Filter */}
        <select
          value={selectedAction}
          onChange={(e) => setSelectedAction(e.target.value)}
          className="px-3 py-1.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-medium focus:outline-none"
        >
          <option value="">All Security Events</option>
          <option value="AUTH_LOGIN_SUCCESS">AUTH_LOGIN_SUCCESS</option>
          <option value="AUTH_LOGIN_FAILED">AUTH_LOGIN_FAILED</option>
          <option value="AUTH_MFA_ENABLED">AUTH_MFA_ENABLED</option>
          <option value="FILE_UPLOAD">FILE_UPLOAD</option>
          <option value="FILE_DOWNLOAD">FILE_DOWNLOAD</option>
          <option value="SHARE_CREATED">SHARE_CREATED</option>
          <option value="SHARE_REVOKED">SHARE_REVOKED</option>
          <option value="IDOR_ACCESS_DENIED">IDOR_ACCESS_DENIED</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        {filteredLogs.length === 0 ? (
          <div className="text-center py-16 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
              <Activity className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              No matching activity records
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 uppercase text-[10px] font-semibold bg-slate-50/50 dark:bg-slate-800/40">
                  <th className="py-3.5 px-4">Event / Action</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">IP Address</th>
                  <th className="py-3.5 px-4">Details</th>
                  <th className="py-3.5 px-4">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {filteredLogs.map((log) => (
                  <tr
                    key={log.id}
                    className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-3.5 px-4 font-bold text-slate-800 dark:text-slate-200">
                      <span className="font-mono text-[11px]">{log.action}</span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          log.status === 'SUCCESS'
                            ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                            : log.status === 'WARNING'
                            ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400'
                            : 'bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {log.status === 'SUCCESS' && <CheckCircle2 className="w-3 h-3" />}
                        {log.status === 'WARNING' && <AlertTriangle className="w-3 h-3" />}
                        {log.status === 'FAILURE' && <AlertCircle className="w-3 h-3" />}
                        <span>{log.status}</span>
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-500">
                      {log.ipAddress || 'unknown'}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300 font-mono text-[11px] truncate max-w-xs">
                      {log.detailsJson || '—'}
                    </td>
                    <td className="py-3.5 px-4 text-slate-400">
                      {formatDate(log.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
