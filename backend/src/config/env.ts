import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'file:./dev.db';
}

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  isProd: process.env.NODE_ENV === 'production',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  jwtSecret: process.env.JWT_SECRET || 'default_jwt_secret_must_be_changed_in_prod_min_32_chars',
  masterKeyHex: process.env.MASTER_KEY_HEX || '9f82c4bc938167b5450e1814e4b52c0199e4b37f4055272a8536f9038290fa8e',
  hmacSecret: process.env.HMAC_DOWNLOAD_SECRET || 'a781b2ef87c65342a964821f574d6199b0c8ef03681387d8bc29731ea6789fbc',
  storageDriver: process.env.STORAGE_DRIVER || 'local',
  storageLocalDir: path.resolve(process.env.STORAGE_LOCAL_DIR || './storage_vault'),
  maxFileSizeBytes: parseInt(process.env.MAX_FILE_SIZE_BYTES || '104857600', 10), // 100MB
  defaultUserQuotaBytes: parseInt(process.env.DEFAULT_USER_QUOTA_BYTES || '524288000', 10), // 500MB
  aws: {
    region: process.env.AWS_REGION || 'us-east-1',
    bucket: process.env.AWS_S3_BUCKET || 'secure-vault-storage',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    endpoint: process.env.AWS_ENDPOINT || undefined,
  },
};
