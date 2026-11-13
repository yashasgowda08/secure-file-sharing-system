import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { FileSignatureService } from '../services/file-signature.service';
import { MalwareService } from '../services/malware.service';
import { LocalStorageProvider } from '../services/storage.service';
import path from 'path';

describe('File Security & Defensive Inspection Tests', () => {
  it('should validate genuine PDF signatures', () => {
    const pdfBuffer = Buffer.from('%PDF-1.7\nSample PDF stream content', 'utf-8');
    const result = FileSignatureService.validate(pdfBuffer, 'application/pdf', 'document.pdf');
    assert.strictEqual(result.isValid, true);
    assert.strictEqual(result.detectedMime, 'application/pdf');
    assert.strictEqual(result.isExecutable, false);
  });

  it('should reject disguised Windows PE executables named as safe images', () => {
    const fakeImgBuffer = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]);
    const result = FileSignatureService.validate(fakeImgBuffer, 'image/png', 'cute_cat.png');
    assert.strictEqual(result.isValid, false);
    assert.strictEqual(result.isExecutable, true);
    assert.ok(result.reason?.includes('Executable binary signature detected'));
  });

  it('should reject hazardous executable file extensions', () => {
    const textBuffer = Buffer.from('echo "Malicious script running"', 'utf-8');
    const result = FileSignatureService.validate(textBuffer, 'text/plain', 'trojan.bat');
    assert.strictEqual(result.isValid, false);
    assert.strictEqual(result.isExecutable, true);
    assert.ok(result.reason?.includes('Hazardous file extension'));
  });

  it('should detect EICAR antivirus test signatures and flag for quarantine', () => {
    const eicarString = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';
    const eicarBuffer = Buffer.from(eicarString, 'utf-8');
    const scan = MalwareService.scan(eicarBuffer, 'test_sample.txt');
    assert.strictEqual(scan.isMalicious, true);
    assert.strictEqual(scan.threatName, 'EICAR.TestFile.Virus');
  });

  it('should detect deceptive double extensions in file names', () => {
    const harmlessBuffer = Buffer.from('Harmless byte sequence', 'utf-8');
    const scan = MalwareService.scan(harmlessBuffer, 'salary_sheet.xlsx.exe');
    assert.strictEqual(scan.isMalicious, true);
    assert.strictEqual(scan.threatName, 'Trojan.SuspiciousExtensionObfuscation');
  });

  it('should detect embedded XSS / script tags in SVG files', () => {
    const svgExploit = '<svg><script>alert("XSS")</script></svg>';
    const scan = MalwareService.scan(Buffer.from(svgExploit, 'utf-8'), 'vector_logo.svg');
    assert.strictEqual(scan.isMalicious, true);
    assert.strictEqual(scan.threatName, 'Exploit.XSS.EmbeddedScript');
  });

  it('should prevent directory and path traversal attacks in storage provider', async () => {
    const testDir = path.resolve('./storage_test');
    const provider = new LocalStorageProvider(testDir);

    await assert.rejects(async () => {
      await provider.get('../../Windows/System32/drivers/etc/hosts');
    }, /Path traversal/);

    await assert.rejects(async () => {
      await provider.save('../../../etc/passwd', Buffer.from('test'));
    }, /Path traversal/);
  });
});
