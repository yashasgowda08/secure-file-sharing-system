import React from 'react';
import {
  FileText,
  FileImage,
  FileAudio,
  FileVideo,
  FileCode,
  FileArchive,
  FileSpreadsheet,
  File as GenericFile,
} from 'lucide-react';
import { getFileCategory } from '../lib/utils';

interface FileIconProps {
  mimeType: string;
  filename: string;
  className?: string;
  iconClassName?: string;
}

export const FileIcon: React.FC<FileIconProps> = ({
  mimeType,
  filename,
  className = 'w-10 h-10',
  iconClassName = 'w-5 h-5',
}) => {
  const category = getFileCategory(mimeType, filename);

  switch (category) {
    case 'image':
      return (
        <div className={`rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center flex-shrink-0 shadow-sm ${className}`}>
          <FileImage className={iconClassName} />
        </div>
      );
    case 'pdf':
      return (
        <div className={`rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center flex-shrink-0 shadow-sm ${className}`}>
          <FileText className={iconClassName} />
        </div>
      );
    case 'video':
      return (
        <div className={`rounded-xl bg-sky-100 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 flex items-center justify-center flex-shrink-0 shadow-sm ${className}`}>
          <FileVideo className={iconClassName} />
        </div>
      );
    case 'audio':
      return (
        <div className={`rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0 shadow-sm ${className}`}>
          <FileAudio className={iconClassName} />
        </div>
      );
    case 'code':
      return (
        <div className={`rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0 shadow-sm ${className}`}>
          <FileCode className={iconClassName} />
        </div>
      );
    case 'archive':
      return (
        <div className={`rounded-xl bg-orange-100 dark:bg-orange-950/60 text-orange-600 dark:text-orange-400 flex items-center justify-center flex-shrink-0 shadow-sm ${className}`}>
          <FileArchive className={iconClassName} />
        </div>
      );
    case 'document':
      if (filename.endsWith('.xlsx') || filename.endsWith('.csv') || filename.endsWith('.xls')) {
        return (
          <div className={`rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0 shadow-sm ${className}`}>
            <FileSpreadsheet className={iconClassName} />
          </div>
        );
      }
      return (
        <div className={`rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center flex-shrink-0 shadow-sm ${className}`}>
          <FileText className={iconClassName} />
        </div>
      );
    default:
      return (
        <div className={`rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 flex items-center justify-center flex-shrink-0 shadow-sm ${className}`}>
          <GenericFile className={iconClassName} />
        </div>
      );
  }
};
