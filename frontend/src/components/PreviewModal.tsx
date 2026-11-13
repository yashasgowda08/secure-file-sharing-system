import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  X,
  Download,
  Share2,
  Lock,
  ShieldCheck,
  FileText,
  AlertTriangle,
  Copy,
  Check,
  ExternalLink,
  Calendar,
  HardDrive,
  Hash,
} from 'lucide-react';
import { FileItem } from '../types';
import { api } from '../lib/api';
import { formatBytes, formatDate, getFileCategory, copyToClipboard } from '../lib/utils';
import { useToast } from '../context/ToastContext';

interface PreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  file: FileItem | null;
  onShareClick: (file: FileItem) => void;
}

export const PreviewModal: React.FC<PreviewModalProps> = ({
  isOpen,
  onClose,
  file,
  onShareClick,
}) => {
  const { success } = useToast();
  const [copiedHash, setCopiedHash] = useState(false);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [isLoadingText, setIsLoadingText] = useState(false);

  useEffect(() => {
    if (!isOpen || !file) {
      setTextContent(null);
      return;
    }

    const category = getFileCategory(file.mimeType, file.name);
    if ((category === 'code' || category === 'document') && file.size < 500000) {
      // Attempt to fetch text preview for reasonable size text files
      setIsLoadingText(true);
      fetch(api.files.getDownloadUrl(file.id, true), { credentials: 'include' })
        .then((res) => (res.ok ? res.text() : null))
        .then((txt) => {
          if (txt) setTextContent(txt);
        })
        .catch(() => setTextContent(null))
        .finally(() => setIsLoadingText(false));
    }
  }, [isOpen, file]);

  if (!isOpen || !file) return null;

  const category = getFileCategory(file.mimeType, file.name);
  const downloadUrl = api.files.getDownloadUrl(file.id, false);
  const inlinePreviewUrl = api.files.getDownloadUrl(file.id, true);

  const copyChecksum = async () => {
    const ok = await copyToClipboard(file.checksumSha256);
    if (ok) {
      setCopiedHash(true);
      success('Checksum Copied', 'SHA-256 integrity hash copied.');
      setTimeout(() => setCopiedHash(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs"
      />

      {/* Modal Dialog */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="relative z-10 w-full max-w-4xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5 min-w-0 mr-4">
            <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center flex-shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-slate-900 dark:text-white truncate">
                {file.name}
              </h2>
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span>{formatBytes(file.size)}</span>
                <span>•</span>
                <span>{file.mimeType}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onClose();
                onShareClick(file);
              }}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Share</span>
            </button>
            <a
              href={downloadUrl}
              download={file.name}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download</span>
            </a>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Preview & Security Inspector */}
        <div className="grid grid-cols-1 md:grid-cols-3 flex-1 overflow-hidden">
          {/* Main Visual Preview (2 cols) */}
          <div className="md:col-span-2 p-6 bg-slate-100/70 dark:bg-slate-950/60 flex items-center justify-center overflow-auto border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-800 min-h-[300px]">
            {file.isQuarantined ? (
              <div className="text-center p-6 bg-rose-50 dark:bg-rose-950/40 rounded-2xl border border-rose-200 dark:border-rose-900 max-w-md">
                <AlertTriangle className="w-10 h-10 text-rose-600 dark:text-rose-400 mx-auto mb-2" />
                <h3 className="font-bold text-sm text-rose-900 dark:text-rose-200">
                  File Quarantined
                </h3>
                <p className="text-xs text-rose-700 dark:text-rose-300 mt-1">
                  {file.quarantineReason || 'Suspicious executable or malware indicator detected.'}
                </p>
              </div>
            ) : category === 'image' ? (
              <img
                src={inlinePreviewUrl}
                alt={file.name}
                className="max-h-[60vh] max-w-full rounded-xl object-contain shadow-lg"
              />
            ) : category === 'pdf' ? (
              <iframe
                src={inlinePreviewUrl}
                title={file.name}
                className="w-full h-[60vh] rounded-xl border border-slate-200 dark:border-slate-700 bg-white"
              />
            ) : category === 'audio' ? (
              <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl shadow-md border border-slate-200 dark:border-slate-800 w-full max-w-sm text-center">
                <audio controls src={inlinePreviewUrl} className="w-full mt-2" />
              </div>
            ) : category === 'video' ? (
              <video controls src={inlinePreviewUrl} className="max-h-[60vh] max-w-full rounded-xl shadow-lg" />
            ) : textContent !== null ? (
              <div className="w-full h-[60vh] overflow-auto p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-mono text-xs text-slate-800 dark:text-slate-200 whitespace-pre-wrap select-text">
                {textContent}
              </div>
            ) : (
              <div className="text-center p-8 space-y-3">
                <div className="w-16 h-16 rounded-2xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto shadow-inner">
                  <FileText className="w-8 h-8" />
                </div>
                <div>
                  <p className="font-semibold text-sm text-slate-800 dark:text-slate-200">
                    No Direct Browser Preview
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Binary or archive payload encrypted with AES-256-GCM.
                  </p>
                </div>
                <a
                  href={downloadUrl}
                  download={file.name}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Decrypted File</span>
                </a>
              </div>
            )}
          </div>

          {/* Security & Metadata Inspector Sidebar (1 col) */}
          <div className="p-6 overflow-y-auto space-y-5 bg-white dark:bg-slate-900">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Cryptographic Details
              </h3>
              <div className="mt-3 space-y-3 text-xs">
                {/* Encryption type */}
                <div className="p-3 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-900/60 space-y-1">
                  <div className="flex items-center gap-1.5 text-blue-700 dark:text-blue-300 font-bold">
                    <ShieldCheck className="w-4 h-4" />
                    <span>
                      {file.isE2EE ? 'Client-Side E2EE (Zero-Knowledge)' : 'AES-256-GCM Envelope Encryption'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400">
                    {file.isE2EE
                      ? 'Encrypted in client browser prior to upload.'
                      : 'Authenticated payload with unique per-file Data Encryption Key (DEK).'}
                  </p>
                </div>

                {/* SHA-256 Checksum */}
                <div className="space-y-1">
                  <label className="text-slate-500 flex items-center gap-1 font-semibold text-[11px]">
                    <Hash className="w-3 h-3 text-slate-400" /> SHA-256 Integrity Checksum
                  </label>
                  <div className="flex items-center gap-1 p-2 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                    <span className="font-mono text-[10px] text-slate-700 dark:text-slate-300 truncate select-all">
                      {file.checksumSha256}
                    </span>
                    <button
                      onClick={copyChecksum}
                      title="Copy Checksum"
                      className="p-1 text-slate-400 hover:text-slate-600 rounded"
                    >
                      {copiedHash ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* File size & Uploaded */}
                <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 flex items-center gap-1">
                      <HardDrive className="w-3 h-3" /> Size
                    </span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {formatBytes(file.size)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> Uploaded
                    </span>
                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      {formatDate(file.createdAt)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
