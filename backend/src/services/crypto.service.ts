import crypto from 'crypto';
import { argon2id } from 'hash-wasm';
import { config } from '../config/env';

export class CryptoService {
  private static masterKey: Buffer;

  public static getMasterKey(): Buffer {
    if (!this.masterKey) {
      const hex = config.masterKeyHex;
      if (!hex || hex.length !== 64) {
        throw new Error('MASTER_KEY_HEX must be a 64-character (32 bytes) hex string');
      }
      this.masterKey = Buffer.from(hex, 'hex');
    }
    return this.masterKey;
  }

  /**
   * Hashes a password using Argon2id with 32MB memory, 2 iterations, 1 parallelism
   */
  public static async hashPassword(password: string): Promise<string> {
    const salt = crypto.randomBytes(16);
    return argon2id({
      password,
      salt,
      parallelism: 1,
      iterations: 2,
      memorySize: 32 * 1024, // 32MB
      hashLength: 32,
      outputType: 'encoded',
    });
  }

  /**
   * Verifies a password against an Argon2id encoded hash
   */
  public static async verifyPassword(password: string, encodedHash: string): Promise<boolean> {
    try {
      const parts = encodedHash.split('$');
      // Format: $argon2id$v=19$m=32768,t=2,p=1$<saltBase64>$<hashBase64>
      if (parts.length < 6) return false;

      const paramsPart = parts[3]; // m=32768,t=2,p=1
      const saltBase64 = parts[4];
      const expectedHashBase64 = parts[5];

      const salt = Buffer.from(saltBase64, 'base64');
      const params = new URLSearchParams(paramsPart.replace(/,/g, '&'));
      const memorySize = parseInt(params.get('m') || '32768', 10);
      const iterations = parseInt(params.get('t') || '2', 10);
      const parallelism = parseInt(params.get('p') || '1', 10);

      const computedHash = await argon2id({
        password,
        salt,
        parallelism,
        iterations,
        memorySize,
        hashLength: 32,
        outputType: 'encoded',
      });

      const computedParts = computedHash.split('$');
      const actualHashBase64 = computedParts[5];

      return crypto.timingSafeEqual(
        Buffer.from(actualHashBase64, 'base64'),
        Buffer.from(expectedHashBase64, 'base64')
      );
    } catch {
      return false;
    }
  }

  /**
   * Generates a cryptographically secure random token
   */
  public static generateRandomToken(bytes = 32): string {
    return crypto.randomBytes(bytes).toString('hex');
  }

  /**
   * Computes SHA-256 hash of a string (useful for storing hashed session tokens)
   */
  public static hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Computes SHA-256 checksum of a buffer
   */
  public static computeChecksum(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  /**
   * Encrypts a file buffer using AES-256-GCM envelope encryption
   * Master Key (KEK) wraps a freshly generated per-file Data Encryption Key (DEK).
   */
  public static encryptFileBuffer(fileBuffer: Buffer): {
    encryptedBuffer: Buffer;
    iv: string;
    authTag: string;
    dekEncrypted: string;
    checksumSha256: string;
  } {
    const checksumSha256 = this.computeChecksum(fileBuffer);
    const kek = this.getMasterKey();

    // 1. Generate unique 32-byte DEK and 12-byte IV for the file
    const dek = crypto.randomBytes(32);
    const fileIv = crypto.randomBytes(12);

    // 2. Encrypt file with DEK using AES-256-GCM
    const fileCipher = crypto.createCipheriv('aes-256-gcm', dek, fileIv);
    const encryptedFile = Buffer.concat([fileCipher.update(fileBuffer), fileCipher.final()]);
    const fileAuthTag = fileCipher.getAuthTag();

    // 3. Wrap DEK with Master Key (KEK) using AES-256-GCM
    const dekIv = crypto.randomBytes(12);
    const dekCipher = crypto.createCipheriv('aes-256-gcm', kek, dekIv);
    const wrappedDek = Buffer.concat([dekCipher.update(dek), dekCipher.final()]);
    const dekAuthTag = dekCipher.getAuthTag();

    // Pack wrapped DEK package: [dekIv (12b)] + [dekAuthTag (16b)] + [wrappedDek (32b)]
    const dekPackage = Buffer.concat([dekIv, dekAuthTag, wrappedDek]).toString('base64');

    return {
      encryptedBuffer: encryptedFile,
      iv: fileIv.toString('base64'),
      authTag: fileAuthTag.toString('base64'),
      dekEncrypted: dekPackage,
      checksumSha256,
    };
  }

  /**
   * Decrypts an encrypted file buffer using AES-256-GCM envelope decryption
   */
  public static decryptFileBuffer(
    encryptedBuffer: Buffer,
    ivBase64: string,
    authTagBase64: string,
    dekEncryptedBase64: string
  ): Buffer {
    const kek = this.getMasterKey();

    // 1. Unpack wrapped DEK
    const dekPackage = Buffer.from(dekEncryptedBase64, 'base64');
    if (dekPackage.length < 12 + 16 + 32) {
      throw new Error('Invalid wrapped DEK payload structure');
    }
    const dekIv = dekPackage.subarray(0, 12);
    const dekAuthTag = dekPackage.subarray(12, 28);
    const wrappedDek = dekPackage.subarray(28);

    // 2. Decrypt DEK with Master Key
    const dekDecipher = crypto.createDecipheriv('aes-256-gcm', kek, dekIv);
    dekDecipher.setAuthTag(dekAuthTag);
    const dek = Buffer.concat([dekDecipher.update(wrappedDek), dekDecipher.final()]);

    // 3. Decrypt file with recovered DEK
    const fileIv = Buffer.from(ivBase64, 'base64');
    const fileAuthTag = Buffer.from(authTagBase64, 'base64');
    const fileDecipher = crypto.createDecipheriv('aes-256-gcm', dek, fileIv);
    fileDecipher.setAuthTag(fileAuthTag);

    return Buffer.concat([fileDecipher.update(encryptedBuffer), fileDecipher.final()]);
  }

  /**
   * Creates an HMAC-SHA256 signature for expiring download URLs
   */
  public static createHmacSignature(payload: string): string {
    return crypto.createHmac('sha256', config.hmacSecret).update(payload).digest('hex');
  }

  /**
   * Verifies an HMAC-SHA256 signature in constant time
   */
  public static verifyHmacSignature(payload: string, signature: string): boolean {
    const expected = this.createHmacSignature(payload);
    if (signature.length !== expected.length) return false;
    return crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'));
  }
}
