export type UserRole = 'USER' | 'ADMIN' | 'AUDITOR';

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  isVerified: boolean;
  isMfaEnabled: boolean;
  storageUsed: number;
  storageLimit: number;
  failedLoginAttempts?: number;
  lockoutUntil?: string | null;
  createdAt?: string;
}

export interface FileItem {
  id: string;
  name: string;
  originalName: string;
  mimeType: string;
  size: number;
  isEncrypted: boolean;
  isE2EE: boolean;
  e2eeMetadata?: string | null;
  checksumSha256: string;
  folderId?: string | null;
  isQuarantined: boolean;
  quarantineReason?: string | null;
  isDeleted?: boolean;
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: {
    shares?: number;
    downloadEvents?: number;
  };
}

export interface FolderItem {
  id: string;
  name: string;
  parentId?: string | null;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: {
    files: number;
    subfolders: number;
  };
}

export interface FileShareItem {
  id: string;
  fileId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  fileIsDeleted?: boolean;
  shareToken: string;
  shareType: 'PUBLIC_LINK' | 'SPECIFIC_USER';
  permission: 'VIEW_ONLY' | 'DOWNLOAD';
  sharedWithEmail?: string | null;
  expiresAt?: string | null;
  maxDownloads?: number | null;
  currentDownloads: number;
  isRevoked: boolean;
  hasPassword?: boolean;
  createdAt: string;
}

export interface AuditLogItem {
  id: string;
  userId?: string | null;
  action: string;
  resourceType?: string | null;
  resourceId?: string | null;
  detailsJson?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  status: 'SUCCESS' | 'FAILURE' | 'WARNING';
  createdAt: string;
  user?: {
    email: string;
    fullName: string;
    role: string;
  };
}

export interface UserSession {
  id: string;
  userAgent?: string;
  ipAddress?: string;
  expiresAt: string;
  createdAt: string;
}

export interface AdminStats {
  totalUsers: number;
  totalFiles: number;
  totalShares: number;
  totalDownloads: number;
  quarantinedFiles: number;
  totalStorageBytes: number;
}
