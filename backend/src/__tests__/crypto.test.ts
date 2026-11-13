import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CryptoService } from '../services/crypto.service';
import { MfaService } from '../services/mfa.service';

describe('Cryptographic Operations & Security Tests', () => {
  it('should hash and verify passwords using Argon2id', async () => {
    const password = 'StrongPassword!2026#Vault';
    const hash = await CryptoService.hashPassword(password);

    assert.ok(hash.includes('$argon2id$'), 'Hash should be encoded Argon2id format');
    const isValid = await CryptoService.verifyPassword(password, hash);
    assert.strictEqual(isValid, true, 'Valid password must verify');

    const isWrongValid = await CryptoService.verifyPassword('WrongPassword123!', hash);
    assert.strictEqual(isWrongValid, false, 'Invalid password must not verify');
  });

  it('should encrypt and decrypt files using AES-256-GCM envelope encryption', () => {
    const originalText = 'CONFIDENTIAL_TOP_SECRET_SECURITY_PAYLOAD_2026';
    const originalBuffer = Buffer.from(originalText, 'utf-8');

    const encrypted = CryptoService.encryptFileBuffer(originalBuffer);
    assert.notDeepStrictEqual(encrypted.encryptedBuffer, originalBuffer);
    assert.ok(encrypted.iv, 'IV should exist');
    assert.ok(encrypted.authTag, 'AuthTag should exist');
    assert.ok(encrypted.dekEncrypted, 'Wrapped DEK should exist');
    assert.strictEqual(encrypted.checksumSha256, CryptoService.computeChecksum(originalBuffer));

    // Decrypt
    const decryptedBuffer = CryptoService.decryptFileBuffer(
      encrypted.encryptedBuffer,
      encrypted.iv,
      encrypted.authTag,
      encrypted.dekEncrypted
    );

    assert.strictEqual(decryptedBuffer.toString('utf-8'), originalText);
  });

  it('should detect tampering in ciphertext via AES-256-GCM auth tag and reject it', () => {
    const originalBuffer = Buffer.from('Financial Report Q4 2026 - Do Not Alter', 'utf-8');
    const encrypted = CryptoService.encryptFileBuffer(originalBuffer);

    // Tamper with a single byte in ciphertext
    const tamperedCiphertext = Buffer.from(encrypted.encryptedBuffer);
    tamperedCiphertext[0] ^= 0x01; // flip 1 bit

    assert.throws(() => {
      CryptoService.decryptFileBuffer(
        tamperedCiphertext,
        encrypted.iv,
        encrypted.authTag,
        encrypted.dekEncrypted
      );
    });
  });

  it('should create and verify HMAC-SHA256 signatures for expiring URLs', () => {
    const payload = 'file-uuid-1234:user-5678:1799999999';
    const sig = CryptoService.createHmacSignature(payload);

    assert.strictEqual(CryptoService.verifyHmacSignature(payload, sig), true);
    assert.strictEqual(CryptoService.verifyHmacSignature('tampered-payload', sig), false);
  });

  it('should generate and verify RFC 6238 TOTP tokens and backup codes', () => {
    const secret = MfaService.generateSecret();
    assert.ok(secret.length >= 16);

    const code = MfaService.generateTOTP(secret);
    assert.match(code, /^\d{6}$/);

    const isValid = MfaService.verifyToken(code, secret);
    assert.strictEqual(isValid, true);

    assert.strictEqual(MfaService.verifyToken('12345', secret), false);

    // Backup codes
    const { plainCodes, hashedCodes } = MfaService.generateBackupCodes();
    assert.strictEqual(plainCodes.length, 8);
    assert.strictEqual(hashedCodes.length, 8);

    const codeToTest = plainCodes[0];
    const storedHashed = hashedCodes.join(',');

    const consumeResult = MfaService.verifyAndConsumeBackupCode(codeToTest, storedHashed);
    assert.strictEqual(consumeResult.valid, true);
    assert.strictEqual(consumeResult.remainingHashes.split(',').length, 7);

    // Replay attack: consuming the same backup code a second time must fail
    const replayResult = MfaService.verifyAndConsumeBackupCode(codeToTest, consumeResult.remainingHashes);
    assert.strictEqual(replayResult.valid, false);
  });
});
