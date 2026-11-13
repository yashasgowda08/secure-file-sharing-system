import crypto from 'crypto';
import QRCode from 'qrcode';

export class MfaService {
  private static readonly B32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

  /**
   * Generates a Base32 encoded random secret (20 characters = 100 bits of entropy)
   */
  public static generateSecret(length = 20): string {
    const bytes = crypto.randomBytes(length);
    let result = '';
    for (let i = 0; i < bytes.length; i++) {
      result += this.B32_CHARS[bytes[i] % 32];
    }
    return result;
  }

  /**
   * Decodes a Base32 string to binary Buffer
   */
  private static decodeBase32(str: string): Buffer {
    const cleanStr = str.toUpperCase().replace(/=+$/, '');
    let bits = 0;
    let val = 0;
    const out: number[] = [];

    for (let i = 0; i < cleanStr.length; i++) {
      const idx = this.B32_CHARS.indexOf(cleanStr[i]);
      if (idx === -1) continue;
      val = (val << 5) | idx;
      bits += 5;
      if (bits >= 8) {
        out.push((val >> (bits - 8)) & 255);
        bits -= 8;
      }
    }
    return Buffer.from(out);
  }

  /**
   * Generates a 6-digit TOTP code for a secret at a given time offset
   */
  public static generateTOTP(secret: string, offset = 0, timeStepSeconds = 30): string {
    const counter = Math.floor(Date.now() / 1000 / timeStepSeconds) + offset;
    const buf = Buffer.alloc(8);
    buf.writeBigInt64BE(BigInt(counter));

    const key = this.decodeBase32(secret);
    const hmac = crypto.createHmac('sha1', key).update(buf).digest();

    const off = hmac[hmac.length - 1] & 0x0f;
    const code = (hmac.readUInt32BE(off) & 0x7fffffff) % 1000000;
    return code.toString().padStart(6, '0');
  }

  /**
   * Generates an OTP Auth URI and a QR Code data URL
   */
  public static async generateQrCode(userEmail: string, secret: string): Promise<{ otpauthUrl: string; qrCodeDataUrl: string }> {
    const issuer = 'SecureFileVault';
    const otpauthUrl = `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(userEmail)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);
    return { otpauthUrl, qrCodeDataUrl };
  }

  /**
   * Verifies a 6-digit TOTP token against the secret, allowing a +-1 step window (60s drift tolerance)
   */
  public static verifyToken(token: string, secret: string): boolean {
    const cleanToken = token.trim();
    if (!/^\d{6}$/.test(cleanToken)) return false;

    // Check window: previous interval, current interval, next interval
    for (const offset of [-1, 0, 1]) {
      const expected = this.generateTOTP(secret, offset);
      if (crypto.timingSafeEqual(Buffer.from(cleanToken), Buffer.from(expected))) {
        return true;
      }
    }
    return false;
  }

  /**
   * Generates 8 random single-use recovery backup codes
   */
  public static generateBackupCodes(): { plainCodes: string[]; hashedCodes: string[] } {
    const plainCodes: string[] = [];
    const hashedCodes: string[] = [];

    for (let i = 0; i < 8; i++) {
      const code = crypto.randomBytes(4).toString('hex').toUpperCase(); // 8 character code
      plainCodes.push(code);
      const hash = crypto.createHash('sha256').update(code).digest('hex');
      hashedCodes.push(hash);
    }

    return { plainCodes, hashedCodes };
  }

  /**
   * Validates a backup code against user's stored comma-separated hashes
   */
  public static verifyAndConsumeBackupCode(
    providedCode: string,
    storedHashedList: string
  ): { valid: boolean; remainingHashes: string } {
    const cleanCode = providedCode.trim().toUpperCase();
    const providedHash = crypto.createHash('sha256').update(cleanCode).digest('hex');
    const hashes = storedHashedList.split(',').filter(Boolean);

    const index = hashes.findIndex((h) => crypto.timingSafeEqual(Buffer.from(h), Buffer.from(providedHash)));
    if (index === -1) {
      return { valid: false, remainingHashes: storedHashedList };
    }

    hashes.splice(index, 1);
    return { valid: true, remainingHashes: hashes.join(',') };
  }
}
