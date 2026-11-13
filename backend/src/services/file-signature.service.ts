export interface FileSignatureValidation {
  isValid: boolean;
  detectedMime: string;
  isExecutable: boolean;
  reason?: string;
}

export class FileSignatureService {
  /**
   * Verifies magic bytes to validate genuine file type and reject disguised executables
   */
  public static validate(buffer: Buffer, declaredMime: string, filename: string): FileSignatureValidation {
    if (buffer.length === 0) {
      return { isValid: false, detectedMime: 'application/octet-stream', isExecutable: false, reason: 'Empty file' };
    }

    // 1. Check for dangerous executable signatures first
    if (this.isExecutableSignature(buffer)) {
      return {
        isValid: false,
        detectedMime: 'application/x-dosexec',
        isExecutable: true,
        reason: 'Executable binary signature detected (PE / ELF / Mach-O / Class)',
      };
    }

    // 2. Reject hazardous file extensions
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    const dangerousExtensions = [
      'exe', 'dll', 'bat', 'cmd', 'sh', 'vbs', 'vbe', 'js', 'jse', 'wsf', 'wsh',
      'ps1', 'psm1', 'scr', 'pif', 'com', 'hta', 'jar', 'msi', 'msp', 'reg'
    ];
    if (dangerousExtensions.includes(ext)) {
      return {
        isValid: false,
        detectedMime: 'application/octet-stream',
        isExecutable: true,
        reason: `Hazardous file extension .${ext} is forbidden`,
      };
    }

    // 3. Inspect magic bytes for known safe categories
    const detected = this.detectSignature(buffer);

    // If magic bytes were positively identified, ensure no gross mismatch with declared mime
    if (detected) {
      // E.g. If magic is image/png but declared is application/pdf, flag as suspicious
      if (declaredMime && !this.isCompatibleMime(detected, declaredMime)) {
        return {
          isValid: true, // We allow it but adopt the genuine detected MIME
          detectedMime: detected,
          isExecutable: false,
        };
      }
      return { isValid: true, detectedMime: detected, isExecutable: false };
    }

    // 4. If no specific binary magic number matched, check if it's safe text
    if (this.isSafeText(buffer)) {
      const textMimes = ['text/plain', 'text/markdown', 'text/csv', 'application/json', 'text/html'];
      const finalMime = textMimes.includes(declaredMime) ? declaredMime : 'text/plain';
      return { isValid: true, detectedMime: finalMime, isExecutable: false };
    }

    // Generic binary or unknown safe document
    return {
      isValid: true,
      detectedMime: declaredMime || 'application/octet-stream',
      isExecutable: false,
    };
  }

  private static isExecutableSignature(buffer: Buffer): boolean {
    if (buffer.length < 4) return false;

    // Windows PE / DOS Executable: "MZ" (0x4D, 0x5A)
    if (buffer[0] === 0x4d && buffer[1] === 0x5a) return true;

    // Linux ELF: 0x7F, 'E', 'L', 'F'
    if (buffer[0] === 0x7f && buffer[1] === 0x45 && buffer[2] === 0x4c && buffer[3] === 0x46) return true;

    // Mach-O: 0xFE 0xED 0xFA 0xCE or 0xCF 0xFA 0xED 0xFE
    if (
      (buffer[0] === 0xfe && buffer[1] === 0xed && buffer[2] === 0xfa && buffer[3] === 0xce) ||
      (buffer[0] === 0xcf && buffer[1] === 0xfa && buffer[2] === 0xed && buffer[3] === 0xfe)
    ) return true;

    // Java Bytecode: 0xCA 0xFE 0xBA 0xBE
    if (buffer[0] === 0xca && buffer[1] === 0xfe && buffer[2] === 0xba && buffer[3] === 0xbe) return true;

    return false;
  }

  private static detectSignature(buffer: Buffer): string | null {
    if (buffer.length < 4) return null;

    // PDF: %PDF- (0x25, 0x50, 0x44, 0x46)
    if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
      return 'application/pdf';
    }

    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (
      buffer.length >= 8 &&
      buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47 &&
      buffer[4] === 0x0d && buffer[5] === 0x0a && buffer[6] === 0x1a && buffer[7] === 0x0a
    ) {
      return 'image/png';
    }

    // JPEG: FF D8 FF
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return 'image/jpeg';
    }

    // GIF: GIF87a or GIF89a
    if (
      buffer.length >= 6 &&
      buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38 &&
      (buffer[4] === 0x37 || buffer[4] === 0x39) && buffer[5] === 0x61
    ) {
      return 'image/gif';
    }

    // WEBP: "RIFF" .... "WEBP"
    if (
      buffer.length >= 12 &&
      buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
      buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
    ) {
      return 'image/webp';
    }

    // ZIP (DOCX, XLSX, etc.): 50 4B 03 04
    if (buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04) {
      return 'application/zip';
    }

    // MP4: bytes 4-7 = "ftyp"
    if (
      buffer.length >= 8 &&
      buffer[4] === 0x66 && buffer[5] === 0x74 && buffer[6] === 0x79 && buffer[7] === 0x70
    ) {
      return 'video/mp4';
    }

    // MP3: ID3 header
    if (buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33) {
      return 'audio/mpeg';
    }

    return null;
  }

  private static isSafeText(buffer: Buffer): boolean {
    // Sample first 512 bytes: must not contain zero bytes (null characters)
    const sampleSize = Math.min(buffer.length, 512);
    for (let i = 0; i < sampleSize; i++) {
      if (buffer[i] === 0) return false;
    }
    return true;
  }

  private static isCompatibleMime(detected: string, declared: string): boolean {
    if (detected === declared) return true;
    if (detected === 'application/zip' && declared.startsWith('application/vnd.openxmlformats')) return true;
    return false;
  }
}
