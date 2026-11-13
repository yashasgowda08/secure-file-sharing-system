import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../server';
import { prisma } from '../db/prisma';

const app = createApp();

describe('Full Stack API & Access Control Integration Tests', () => {
  let user1Cookie: string;
  let user2Cookie: string;
  let user1FileId: string;

  before(async () => {
    // Clear test tables
    await prisma.downloadEvent.deleteMany({});
    await prisma.fileShare.deleteMany({});
    await prisma.file.deleteMany({});
    await prisma.folder.deleteMany({});
    await prisma.session.deleteMany({});
    await prisma.auditLog.deleteMany({});
    await prisma.user.deleteMany({});
  });

  after(async () => {
    await prisma.$disconnect();
  });

  it('1. should register User 1 (becomes ADMIN as first user)', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'alice@securevault.io',
        password: 'Password123!@Vault',
        fullName: 'Alice Cybersecurity',
      });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.user.role, 'ADMIN');

    const cookies = res.headers['set-cookie'];
    assert.ok(cookies, 'Set-Cookie should be returned');
    user1Cookie = cookies[0];
  });

  it('2. should register User 2 (becomes USER role)', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'bob@securevault.io',
        password: 'Password123!@Vault',
        fullName: 'Bob Developer',
      });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.user.role, 'USER');

    const cookies = res.headers['set-cookie'];
    assert.ok(cookies, 'Set-Cookie should be returned');
    user2Cookie = cookies[0];
  });

  it('3. should upload a file securely for User 1 with AES-256-GCM encryption', async () => {
    const fileContent = 'Sensitive financial statement content for User 1';

    const res = await request(app)
      .post('/api/files/upload')
      .set('Cookie', user1Cookie)
      .attach('files', Buffer.from(fileContent, 'utf-8'), 'statement.txt');

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.files.length, 1);
    user1FileId = res.body.files[0].id;

    const fileRecord = await prisma.file.findUnique({ where: { id: user1FileId } });
    assert.ok(fileRecord);
    assert.strictEqual(fileRecord?.isEncrypted, true);
    assert.ok(fileRecord?.encryptionIv);
    assert.ok(fileRecord?.encryptionAuthTag);
    assert.ok(fileRecord?.dekEncrypted);
  });

  it('4. should allow User 1 to download and decrypt their file', async () => {
    const res = await request(app)
      .get(`/api/files/${user1FileId}/download`)
      .set('Cookie', user1Cookie);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.text, 'Sensitive financial statement content for User 1');
  });

  it('5. SECURITY TEST (IDOR/BOLA): User 2 must be FORBIDDEN from downloading User 1 file', async () => {
    const res = await request(app)
      .get(`/api/files/${user1FileId}/download`)
      .set('Cookie', user2Cookie);

    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.success, false);
    assert.ok(res.body.message.includes('Access denied'));
  });

  it('6. should enforce one-time download link (maxDownloads: 1)', async () => {
    const shareRes = await request(app)
      .post('/api/shares')
      .set('Cookie', user1Cookie)
      .send({
        fileId: user1FileId,
        shareType: 'PUBLIC_LINK',
        maxDownloads: 1,
        permission: 'DOWNLOAD',
      });

    assert.strictEqual(shareRes.status, 201);
    const token = shareRes.body.share.shareToken;

    // First download -> 200 OK
    const dl1 = await request(app).get(`/api/shares/public/${token}/download`);
    assert.strictEqual(dl1.status, 200);
    assert.strictEqual(dl1.text, 'Sensitive financial statement content for User 1');

    // Second download -> 410 Limit Reached / Revoked
    const dl2 = await request(app).get(`/api/shares/public/${token}/download`);
    assert.strictEqual(dl2.status, 410);
  });

  it('7. should enforce link revocation', async () => {
    const shareRes = await request(app)
      .post('/api/shares')
      .set('Cookie', user1Cookie)
      .send({
        fileId: user1FileId,
        shareType: 'PUBLIC_LINK',
      });

    const shareId = shareRes.body.share.id;
    const token = shareRes.body.share.shareToken;

    const revokeRes = await request(app)
      .patch(`/api/shares/${shareId}/revoke`)
      .set('Cookie', user1Cookie);

    assert.strictEqual(revokeRes.status, 200);
    assert.strictEqual(revokeRes.body.share.isRevoked, true);

    const dlRes = await request(app).get(`/api/shares/public/${token}/download`);
    assert.strictEqual(dlRes.status, 410);
  });

  it('8. should enforce expired share links', async () => {
    const pastDate = new Date(Date.now() - 3600 * 1000).toISOString();

    const shareRes = await request(app)
      .post('/api/shares')
      .set('Cookie', user1Cookie)
      .send({
        fileId: user1FileId,
        shareType: 'PUBLIC_LINK',
        expiresAt: pastDate,
      });

    const token = shareRes.body.share.shareToken;

    const dlRes = await request(app).get(`/api/shares/public/${token}/download`);
    assert.strictEqual(dlRes.status, 410);
    assert.ok(dlRes.body.message.includes('expired'));
  });

  it('9. should enforce password protection on share links', async () => {
    const shareRes = await request(app)
      .post('/api/shares')
      .set('Cookie', user1Cookie)
      .send({
        fileId: user1FileId,
        shareType: 'PUBLIC_LINK',
        password: 'ShareSecretPassword99!',
      });

    const token = shareRes.body.share.shareToken;

    // Downloading without password -> 401
    const dlNoPw = await request(app).get(`/api/shares/public/${token}/download`);
    assert.strictEqual(dlNoPw.status, 401);

    // Verify wrong password -> 401
    const verifyWrong = await request(app)
      .post(`/api/shares/public/${token}/verify-password`)
      .send({ password: 'WrongPassword' });
    assert.strictEqual(verifyWrong.status, 401);

    // Verify correct password -> 200 + accessToken
    const verifyCorrect = await request(app)
      .post(`/api/shares/public/${token}/verify-password`)
      .send({ password: 'ShareSecretPassword99!' });
    assert.strictEqual(verifyCorrect.status, 200);
    assert.ok(verifyCorrect.body.accessToken);

    // Download with accessToken -> 200
    const dlWithToken = await request(app)
      .get(`/api/shares/public/${token}/download?accessToken=${verifyCorrect.body.accessToken}`);
    assert.strictEqual(dlWithToken.status, 200);
    assert.strictEqual(dlWithToken.text, 'Sensitive financial statement content for User 1');
  });

  it('10. should allow Admin to inspect system stats and audit logs', async () => {
    const statsRes = await request(app)
      .get('/api/admin/stats')
      .set('Cookie', user1Cookie);

    assert.strictEqual(statsRes.status, 200);
    assert.ok(statsRes.body.stats.totalUsers >= 2);
    assert.ok(statsRes.body.stats.totalFiles >= 1);

    // Non-admin user gets 403
    const unauthAdminRes = await request(app)
      .get('/api/admin/stats')
      .set('Cookie', user2Cookie);

    assert.strictEqual(unauthAdminRes.status, 403);
  });
});
