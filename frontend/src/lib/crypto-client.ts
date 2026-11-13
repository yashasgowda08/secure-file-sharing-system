/**
 * Client-Side End-to-End Encryption (E2EE) Module
 * Utilizes W3C standard Web Crypto API (AES-GCM-256 + PBKDF2)
 */

export interface E2EEMetadata {
  saltBase64: string;
  ivBase64: string;
  iterations: number;
}

export class ClientCrypto {
  private static bufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

  private static base64ToBuffer(base64: string): ArrayBuffer {
    const binary = window.atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  /**
   * Derives an AES-GCM 256-bit key from a user passphrase using PBKDF2-SHA256
   */
  private static async deriveKey(passphrase: string, salt: Uint8Array, iterations = 100000): Promise<CryptoKey> {
    const enc = new TextEncoder();
    const keyMaterial = await window.crypto.subtle.importKey(
      'raw',
      enc.encode(passphrase),
      'PBKDF2',
      false,
      ['deriveKey']
    );

    return window.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt as any,
        iterations,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Encrypts a File or Blob client-side using AES-GCM-256
   */
  public static async encryptFile(
    file: File,
    passphrase: string
  ): Promise<{ encryptedBlob: Blob; metadata: E2EEMetadata }> {
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const iterations = 100000;

    const key = await this.deriveKey(passphrase, salt, iterations);
    const fileData = await file.arrayBuffer();

    const encryptedData = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      fileData
    );

    return {
      encryptedBlob: new Blob([encryptedData], { type: 'application/octet-stream' }),
      metadata: {
        saltBase64: this.bufferToBase64(salt.buffer),
        ivBase64: this.bufferToBase64(iv.buffer),
        iterations,
      },
    };
  }

  /**
   * Decrypts an encrypted ArrayBuffer client-side using passphrase and stored metadata
   */
  public static async decryptBuffer(
    encryptedBuffer: ArrayBuffer,
    passphrase: string,
    metadata: E2EEMetadata
  ): Promise<ArrayBuffer> {
    const salt = new Uint8Array(this.base64ToBuffer(metadata.saltBase64));
    const iv = new Uint8Array(this.base64ToBuffer(metadata.ivBase64));

    const key = await this.deriveKey(passphrase, salt, metadata.iterations || 100000);

    return window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      encryptedBuffer
    );
  }
}
