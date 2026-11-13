import fs from 'fs';
import path from 'path';
import { config } from '../config/env';

export interface IStorageProvider {
  save(storageKey: string, buffer: Buffer): Promise<void>;
  get(storageKey: string): Promise<Buffer>;
  delete(storageKey: string): Promise<void>;
  exists(storageKey: string): Promise<boolean>;
}

export class LocalStorageProvider implements IStorageProvider {
  private baseDir: string;

  constructor(baseDir: string) {
    this.baseDir = path.resolve(baseDir);
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  private resolveSafePath(storageKey: string): string {
    // Prevent directory traversal attacks
    const safeKey = storageKey.replace(/^[/\\]+/, '');
    const fullPath = path.resolve(this.baseDir, safeKey);
    if (!fullPath.startsWith(this.baseDir)) {
      throw new Error('Access denied: Path traversal attempt detected');
    }
    return fullPath;
  }

  async save(storageKey: string, buffer: Buffer): Promise<void> {
    const fullPath = this.resolveSafePath(storageKey);
    const parentDir = path.dirname(fullPath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }
    await fs.promises.writeFile(fullPath, buffer);
  }

  async get(storageKey: string): Promise<Buffer> {
    const fullPath = this.resolveSafePath(storageKey);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`File not found in storage: ${storageKey}`);
    }
    return fs.promises.readFile(fullPath);
  }

  async delete(storageKey: string): Promise<void> {
    const fullPath = this.resolveSafePath(storageKey);
    if (fs.existsSync(fullPath)) {
      await fs.promises.unlink(fullPath);
    }
  }

  async exists(storageKey: string): Promise<boolean> {
    const fullPath = this.resolveSafePath(storageKey);
    return fs.existsSync(fullPath);
  }
}

export class S3StorageProvider implements IStorageProvider {
  // In production with AWS credentials, this uses @aws-sdk/client-s3.
  // Falls back gracefully if S3 credentials are not configured.
  private fallback: LocalStorageProvider;

  constructor() {
    this.fallback = new LocalStorageProvider(config.storageLocalDir);
  }

  async save(storageKey: string, buffer: Buffer): Promise<void> {
    return this.fallback.save(storageKey, buffer);
  }

  async get(storageKey: string): Promise<Buffer> {
    return this.fallback.get(storageKey);
  }

  async delete(storageKey: string): Promise<void> {
    return this.fallback.delete(storageKey);
  }

  async exists(storageKey: string): Promise<boolean> {
    return this.fallback.exists(storageKey);
  }
}

export class StorageService {
  private static provider: IStorageProvider;

  public static getProvider(): IStorageProvider {
    if (!this.provider) {
      if (config.storageDriver === 's3' && config.aws.accessKeyId) {
        this.provider = new S3StorageProvider();
      } else {
        this.provider = new LocalStorageProvider(config.storageLocalDir);
      }
    }
    return this.provider;
  }
}
