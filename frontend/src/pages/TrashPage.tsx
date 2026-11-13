import React, { useState, useEffect } from 'react';
import {
  Trash2,
  RotateCcw,
  AlertTriangle,
  FileText,
  HardDrive,
} from 'lucide-react';
import { api } from '../lib/api';
import { FileItem } from '../types';
import { formatBytes, formatDate } from '../lib/utils';
import { FileIcon } from '../components/FileIcon';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';

export const TrashPage: React.FC = () => {
  const { success, error } = useToast();
  const { refreshUser } = useAuth();

  const [trashedFiles, setTrashedFiles] = useState<FileItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadTrash();
  }, []);

  const loadTrash = async () => {
    setIsLoading(true);
    try {
      const res = await api.files.listTrash();
      if (res.success) setTrashedFiles(res.files || []);
    } catch (err: any) {
      error('Failed to Load Trash', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestore = async (id: string) => {
    try {
      const res = await api.files.restore(id);
      if (res.success) {
        success('File Restored', 'File returned to active vault.');
        setTrashedFiles((prev) => prev.filter((f) => f.id !== id));
      }
    } catch (err: any) {
      error('Failed to Restore', err.message);
    }
  };

  const handleEmptyTrash = async () => {
    if (!window.confirm('Are you sure you want to permanently delete all files in Trash? This action cannot be undone and encrypted bytes will be destroyed.')) return;

    try {
      const res = await api.files.emptyTrash();
      if (res.success) {
        success('Trash Emptied', res.message || 'All trashed files permanently deleted.');
        setTrashedFiles([]);
        await refreshUser();
      }
    } catch (err: any) {
      error('Failed to Empty Trash', err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Trash Bin
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Recover deleted files or permanently purge them to reclaim storage quota
          </p>
        </div>

        {trashedFiles.length > 0 && (
          <button
            onClick={handleEmptyTrash}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs shadow-xs transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Empty Trash ({trashedFiles.length})</span>
          </button>
        )}
      </div>

      {/* List */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        {trashedFiles.length === 0 ? (
          <div className="text-center py-16 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              Trash is empty
            </p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Deleted files will appear here until you permanently purge them.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 uppercase text-[10px] font-semibold bg-slate-50/50 dark:bg-slate-800/40">
                  <th className="py-3.5 px-4">Name</th>
                  <th className="py-3.5 px-4">Size</th>
                  <th className="py-3.5 px-4">Deleted At</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {trashedFiles.map((file) => (
                  <tr
                    key={file.id}
                    className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <FileIcon mimeType={file.mimeType} filename={file.name} className="w-8 h-8" />
                        <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-xs">
                          {file.name}
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-500">{formatBytes(file.size)}</td>
                    <td className="py-3.5 px-4 text-slate-400">{formatDate(file.deletedAt)}</td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => handleRestore(file.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-blue-500" />
                        <span>Restore</span>
                      </button>
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
