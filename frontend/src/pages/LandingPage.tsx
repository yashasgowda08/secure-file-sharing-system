import React from 'react';
import { motion } from 'framer-motion';
import {
  Lock,
  Shield,
  Key,
  Clock,
  HardDrive,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  FileCheck,
  Zap,
  Sparkles,
  Users,
} from 'lucide-react';

interface LandingPageProps {
  onNavigate: (path: string) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onNavigate }) => {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans selection:bg-blue-500 selection:text-white">
      {/* Top Navbar */}
      <header className="h-20 max-w-7xl mx-auto px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/25">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <span className="font-extrabold text-lg tracking-tight">SecureVault</span>
            <span className="block text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest">
              Zero-Knowledge Architecture
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate('/login')}
            className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-blue-600 rounded-xl transition-colors"
          >
            Sign In
          </button>
          <button
            onClick={() => onNavigate('/register')}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-md shadow-blue-500/25 transition-all active:scale-95"
          >
            <span>Get Started</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-12 pb-20 px-6 max-w-5xl mx-auto text-center space-y-8">
        {/* Security Badge Pill */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 shadow-xs"
        >
          <ShieldCheck className="w-4 h-4 text-blue-600" />
          <span>OWASP Hardened • AES-256-GCM Envelope Encryption • Argon2id Hashing</span>
        </motion.div>

        {/* Hero Title */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-4xl sm:text-6xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-[1.15]"
        >
          The Secure File Vault with{' '}
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-500">
            Cryptographic Access Control
          </span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="max-w-2xl mx-auto text-base sm:text-lg text-slate-600 dark:text-slate-400 font-normal leading-relaxed"
        >
          Upload, manage, and share confidential files with confidence. Features authenticated envelope encryption at rest, one-time self-destructing links, file signature inspection, and mandatory multi-factor authentication.
        </motion.p>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex flex-wrap items-center justify-center gap-4 pt-2"
        >
          <button
            onClick={() => onNavigate('/register')}
            className="flex items-center gap-2.5 px-7 py-3.5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-sm shadow-xl shadow-blue-500/25 transition-all active:scale-95"
          >
            <span>Create Free Secure Vault</span>
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => onNavigate('/login')}
            className="px-6 py-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 font-semibold text-sm hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-all shadow-xs"
          >
            Explore Live Demo
          </button>
        </motion.div>
      </section>

      {/* Feature Grid */}
      <section className="py-16 px-6 max-w-7xl mx-auto border-t border-slate-200/80 dark:border-slate-800/80">
        <div className="text-center max-w-2xl mx-auto mb-12 space-y-2">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Built from the Ground Up for Zero-Trust Security
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Every layer from file ingestion to link dispatch implements industry-standard cryptographic principles.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1 */}
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Key className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-slate-900 dark:text-white">
              AES-256-GCM Envelope Encryption
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Files are encrypted with unique per-object Data Encryption Keys (DEKs) wrapped by a managed Master Key (KEK). Built-in GCM authentication tags detect any ciphertext tampering.
            </p>
          </div>

          {/* Card 2 */}
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-slate-900 dark:text-white">
              Expiring & One-Time Links
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Create temporary sharing links with optional password protection, custom expiry dates, and download thresholds that automatically self-revoke once the limit is reached.
            </p>
          </div>

          {/* Card 3 */}
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <FileCheck className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-slate-900 dark:text-white">
              Signature Validation & Quarantine
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Inspects magic bytes to detect disguised executables and scan payloads for malicious signatures. Threat-flagged items are automatically quarantined before reaching any user.
            </p>
          </div>
        </div>
      </section>

      {/* Security Comparison Table */}
      <section className="py-16 px-6 max-w-5xl mx-auto">
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-sm space-y-6">
          <div className="text-center space-y-1">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">
              Traditional Cloud Storage vs. SecureVault
            </h3>
            <p className="text-xs text-slate-500">Security architecture comparison matrix</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase font-semibold text-[10px]">
                  <th className="py-3 px-4">Feature</th>
                  <th className="py-3 px-4">Standard Cloud Drives</th>
                  <th className="py-3 px-4 text-blue-600 dark:text-blue-400">SecureVault Platform</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                <tr>
                  <td className="py-3 px-4 font-semibold">Encryption at Rest</td>
                  <td className="py-3 px-4 text-slate-500">Single shared key</td>
                  <td className="py-3 px-4 font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" /> AES-256-GCM Envelope Encryption (Per-File DEK)
                  </td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-semibold">Password Hashing</td>
                  <td className="py-3 px-4 text-slate-500">Legacy SHA / BCrypt</td>
                  <td className="py-3 px-4 font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Argon2id (OWASP Recommended)
                  </td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-semibold">One-Time Download Links</td>
                  <td className="py-3 px-4 text-slate-500">Rare or paid add-on</td>
                  <td className="py-3 px-4 font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Built-in atomic download count limits
                  </td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-semibold">File Type Spoofing Defense</td>
                  <td className="py-3 px-4 text-slate-500">MIME header only</td>
                  <td className="py-3 px-4 font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Magic number signature byte inspection
                  </td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-semibold">End-to-End Encryption</td>
                  <td className="py-3 px-4 text-slate-500">Not supported</td>
                  <td className="py-3 px-4 font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Client-side Web Crypto API (Optional E2EE)
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 px-6 border-t border-slate-200 dark:border-slate-800 text-center text-xs text-slate-500 dark:text-slate-400">
        <p>© 2026 SecureVault Platform. Engineered with React, Express, Prisma, and Cryptographic Safeguards.</p>
      </footer>
    </div>
  );
};
