import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  UploadCloud,
  X,
  FileText,
  Lock,
  ShieldAlert,
  Folder,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { api } from '../lib/api';
import { ClientCrypto } from '../lib/crypto-client';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { formatBytes } from '../lib/utils';
import { FolderItem } from '../types';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadComplete: () => void;
  folders: FolderItem[];
  currentFolderId?: string | null;
}

interface QueuedFile {
  id: string;
  file: File;
  status: 'pending' | 'encrypting' | 'uploading' | 'completed' | 'error';
  progress: number;
  errorMessage?: string;
}

export const UploadModal: React.FC<UploadModalProps> = ({
  isOpen,
  onClose,
  onUploadComplete,
  folders,
  currentFolderId,
}) => {
  const { toast, success, error } = useToast();
  const { refreshUser } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [queue, setQueue] = useState<QueuedFile[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string>(currentFolderId || '');
  const [isDragging, setIsDragging] = useState(false);
  const [isE2EE, setIsE2EE] = useState(false);
  const [passphrase, setPassphrase] = useState('');
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen) return null;

  const handleFilesSelected = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const newItems: QueuedFile[] = Array.from(files).map((f) => ({
      id: Math.random().toString(36).substring(2, 9),
      file: f,
      status: 'pending',
      progress: 0,
    }));

    setQueue((prev) => [...prev, ...newItems]);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFilesSelected(e.dataTransfer.files);
  };

  const removeQueuedFile = (id: string) => {
    setQueue((prev) => prev.filter((item) => item.id !== id));
  };

  const handleUploadAll = async () => {
    if (queue.length === 0) return;

    if (isE2EE && (!passphrase || passphrase.length < 8)) {
      error('Passphrase Required', 'End-to-End Encryption requires a strong passphrase (minimum 8 characters).');
      return;
    }

    setIsProcessing(true);

    try {
      const formData = new FormData();
      if (selectedFolderId) {
        formData.append('folderId', selectedFolderId);
      }

      if (isE2EE) {
        formData.append('isE2EE', 'true');
        // Encrypt files client-side before sending
        for (const item of queue) {
          setQueue((prev) =>
            prev.map((q) => (q.id === item.id ? { ...q, status: 'encrypting', progress: 30 } : q))
          );

          const { encryptedBlob, metadata } = await ClientCrypto.encryptFile(item.file, passphrase);
          formData.append('files', encryptedBlob, item.file.name);
          formData.append('e2eeMetadata', JSON.stringify(metadata));
        }
      } else {
        // Standard Server Envelope Encryption mode
        for (const item of queue) {
          formData.append('files', item.file, item.file.name);
        }
      }

      setQueue((prev) =>
        prev.map((q) => ({ ...q, status: 'uploading', progress: 75 }))
      );

      const res = await api.files.upload(formData);

      if (res.success) {
        setQueue((prev) =>
          prev.map((q) => ({ ...q, status: 'completed', progress: 100 }))
        );

        confetti({
          particleCount: 60,
          spread: 70,
          origin: { y: 0.6 },
        });

        success('Upload Successful', `Safely encrypted and stored ${queue.length} file(s).`);
        await refreshUser();
        onUploadComplete();
        setTimeout(() => {
          onClose();
          setQueue([]);
          setIsProcessing(false);
        }, 800);
      }
    } catch (err: any) {
      console.error(err);
      error('Upload Failed', err.message || 'File upload failed. Ensure files are valid and within limits.');
      setQueue((prev) =>
        prev.map((q) => ({ ...q, status: 'error', errorMessage: err.message }))
      );
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={!isProcessing ? onClose : undefined}
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs"
      />

      {/* Modal Dialog */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="relative z-10 w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <UploadCloud className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Upload & Encrypt Files
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Automatic AES-256-GCM encryption with file signature verification
              </p>
            </div>
          </div>
          <button
            disabled={isProcessing}
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Destination Folder Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Folder className="w-3.5 h-3.5 text-blue-500" /> Destination Folder
            </label>
            <select
              value={selectedFolderId}
              onChange={(e) => setSelectedFolderId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Root / Main Directory</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  📁 {f.name}
                </option>
              ))}
            </select>
          </div>

          {/* Drag & Drop Box */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all duration-200 ${
              isDragging
                ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30'
                : 'border-slate-300 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-600 bg-slate-50/50 dark:bg-slate-850/50'
            }`}
          >
            <input
              type="file"
              multiple
              ref={fileInputRef}
              onChange={(e) => handleFilesSelected(e.target.files)}
              className="hidden"
            />
            <div className="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto mb-3 shadow-inner">
              <UploadCloud className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              Drag and drop files here, or <span className="text-blue-600 dark:text-blue-400 hover:underline">browse</span>
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Supports documents, images, media, archives up to 100MB per file
            </p>
          </div>

          {/* End-to-End Encryption (E2EE) Mode Card */}
          <div className="p-4 rounded-xl border border-indigo-200/80 dark:border-indigo-900/60 bg-indigo-50/60 dark:bg-indigo-950/30 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  Client-Side End-to-End Encryption (Zero-Knowledge)
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={isE2EE}
                  onChange={(e) => setIsE2EE(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>

            <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
              When enabled, files are encrypted in your browser using AES-GCM-256 before being sent to the server. The server never sees the plaintext or the key.
            </p>

            {isE2EE && (
              <div className="space-y-1.5 pt-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Secret Encryption Passphrase
                </label>
                <div className="relative">
                  <input
                    type={showPassphrase ? 'text' : 'password'}
                    value={passphrase}
                    onChange={(e) => setPassphrase(e.target.value)}
                    placeholder="Enter at least 8 characters..."
                    className="w-full pl-3 pr-10 py-1.5 rounded-xl text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassphrase(!showPassphrase)}
                    className="absolute right-3 top-2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassphrase ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <p className="text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <ShieldAlert className="w-3 h-3" /> Save this passphrase! It cannot be recovered by administrators.
                </p>
              </div>
            )}
          </div>

          {/* Queued Files List */}
          {queue.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                <span>Selected Files ({queue.length})</span>
                <span>{formatBytes(queue.reduce((acc, q) => acc + q.file.size, 0))}</span>
              </div>
              <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                {queue.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 text-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-3">
                      <FileText className="w-4 h-4 text-blue-500 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                          {item.file.name}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          {formatBytes(item.file.size)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      {item.status === 'completed' && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                      {item.status === 'error' && <AlertCircle className="w-4 h-4 text-rose-500" />}
                      {(item.status === 'encrypting' || item.status === 'uploading') && (
                        <div className="flex items-center gap-1.5 text-blue-600">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span className="text-[11px]">{item.status === 'encrypting' ? 'Encrypting...' : `${item.progress}%`}</span>
                        </div>
                      )}
                      {!isProcessing && (
                        <button
                          onClick={() => removeQueuedFile(item.id)}
                          className="p-1 rounded-md text-slate-400 hover:text-rose-500 hover:bg-slate-200 dark:hover:bg-slate-700"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <button
            disabled={isProcessing}
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            disabled={queue.length === 0 || isProcessing}
            onClick={handleUploadAll}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-md shadow-blue-500/20 disabled:opacity-50 transition-all active:scale-95"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              <>
                <Lock className="w-3.5 h-3.5" />
                <span>Encrypt & Upload ({queue.length})</span>
              </>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
};
