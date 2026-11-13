# 🛡️ Secure File Vault — Modern Full-Stack Secure File Sharing System

A production-ready, security-hardened Secure File Sharing System engineered with **React 19, TypeScript, Tailwind CSS v4, Node.js, Express, Prisma ORM, and PostgreSQL**. 

Designed strictly in accordance with **OWASP Top 10** cybersecurity principles, the system implements **AES-256-GCM Envelope Encryption at rest**, client-side **End-to-End Encryption (E2EE)** via the Web Crypto API, **Argon2id password hashing**, **RFC 6238 TOTP Multi-Factor Authentication (MFA)** with emergency backup codes, binary **magic byte file signature inspection**, **anti-malware quarantine**, and atomic **one-time expiring share links**.

---

## 📑 Table of Contents
1. [Core Features](#-core-features)
2. [Technology Stack](#-technology-stack)
3. [System Architecture & Cryptographic Design](#-system-architecture--cryptographic-design)
4. [OWASP Top 10 Defense & Threat Model](#-owasp-top-10-defense--threat-model)
5. [Frontend Application Pages](#-frontend-application-pages)
6. [Database Schema & Models](#-database-schema--models)
7. [Comprehensive REST API Reference](#-comprehensive-rest-api-reference)
8. [Automated Test Suite](#-automated-test-suite)
9. [Local Quickstart (Zero-Config)](#-local-quickstart-zero-config)
10. [Production Docker & PostgreSQL / MinIO Deployment](#-production-docker--postgresql--minio-deployment)
11. [Backup & Key Rotation Guidance](#-backup--key-rotation-guidance)

---

## 🌟 Core Features

- **Envelope Encryption at Rest (AES-256-GCM)**: Each file is encrypted with a unique 256-bit Data Encryption Key (DEK). The DEK is encrypted with a master Key Encryption Key (KEK) and stored alongside the file. A 16-byte authentication tag guarantees tamper detection.
- **Client-Side End-to-End Encryption (E2EE)**: Optional zero-knowledge browser mode using PBKDF2-SHA256 (100,000 iterations) and AES-GCM-256. Raw plaintext never leaves the client.
- **Enterprise Authentication & MFA**:
  - Argon2id password hashing with custom salt generation.
  - RFC 6238 TOTP Multi-Factor Authentication compatible with Google Authenticator and 1Password.
  - 8 cryptographically secure single-use emergency backup recovery codes (hashed at rest).
  - Sliding session management with HTTP-only, `SameSite=Lax`, and `Secure` cookies.
  - Session revocation ("Logout from all devices").
  - Account lockout rate limiter (5 failed attempts locks for 15 minutes).
- **Defensive File Security**:
  - File signature validation checking true magic bytes (detects and blocks `.exe` or ELF binaries disguised as `.pdf` or `.png`).
  - Malware scanner detecting EICAR test signatures, double extensions (`invoice.pdf.exe`), and embedded scripts in SVG vectors.
  - Automatic isolation of infected files into an administrative quarantine queue.
- **Granular File Sharing Controls**:
  - Password-protected public sharing links (Argon2id hashed verification).
  - Expiration timestamps with automatic link invalidation.
  - Atomic download count limits (e.g. self-destructing one-time download links).
  - Instant link revocation.
  - Internal user-to-user sharing with View-Only or Download permissions.
- **Role-Based Access Control (RBAC) & Admin Dashboard**:
  - Distinct `USER` and `ADMIN` roles.
  - Admin inspection of all registered users, active sessions, and per-user storage quotas.
  - Threat monitoring queue with instant quarantine purging.
  - System-wide security statistics and file distribution metrics.
- **Tamper-Evident Audit Logging**:
  - Automatic tracking of security events (logins, uploads, downloads, link creations, revocations, and threat detections).
  - Redaction of sensitive keys, passwords, and tokens.
  - Filterable activity table with single-click JSON export.

---

## 💻 Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend SPA** | React 19, TypeScript, Vite, Tailwind CSS v4, Framer Motion, Lucide React Icons |
| **Backend API** | Node.js (v20+), Express.js, TypeScript, Helmet, CookieParser, RateLimiter |
| **Database & ORM** | PostgreSQL 16 (Production) / SQLite (Zero-config local development), Prisma ORM |
| **Cryptography** | AES-256-GCM, Argon2id (`hash-wasm`), RFC 6238 TOTP, Web Crypto API, HMAC-SHA256 |
| **Storage Providers** | AWS S3 / MinIO Private Object Storage & Local Encrypted Disk with Path Traversal Guards |
| **Containerization** | Docker (Multi-stage build), Docker Compose, GitHub Actions CI/CD |

---

## 🔒 System Architecture & Cryptographic Design

### 1. Envelope Encryption Pipeline (AES-256-GCM)
The system employs an envelope encryption model:

```
[Uploaded File] ──► [Malware & Magic Byte Scan] ──► PASS
                            │
                            ▼
              Generate random 32-byte DEK
                            │
    ┌───────────────────────┴───────────────────────┐
    ▼                                               ▼
[AES-256-GCM]                                 [AES-256-GCM]
Encrypt File with DEK                         Encrypt DEK with Master KEK
Produces: Ciphertext + IV (12B) + Tag (16B)   Produces: Encrypted DEK + IV + Tag
    │                                               │
    ▼                                               ▼
[Private Storage: S3 / Disk]                  [PostgreSQL Database]
Stored under random UUID key                  Metadata record
```

### 2. Client-Side End-to-End Encryption (E2EE) Mode
When the user toggles **End-to-End Encryption (E2EE)** in the upload modal:
1. The browser requests an encryption passphrase.
2. Web Crypto API derives a 256-bit AES key using `PBKDF2-SHA256` with 100,000 iterations and a random 16-byte salt.
3. The raw file buffer is encrypted in-browser using `AES-GCM-256` with a random 12-byte IV.
4. The encrypted buffer is transmitted to the server with `isE2EE: true` and the PBKDF2 salt.
5. The server stores the already-encrypted payload. Neither the server nor any administrator possesses the decryption passphrase.

---

## 🛡️ OWASP Top 10 Defense & Threat Model

| OWASP Vulnerability | Risk | Implemented Countermeasure | Verified in Test Suite |
| :--- | :--- | :--- | :--- |
| **A01: Broken Access Control (BOLA / IDOR)** | User B accessing User A's private file | Every database query checks `ownerId: req.user.id` or explicit `FileShare` permissions. Direct URL tampering returns `403 Forbidden`. | ✅ `api.test.ts` (Test #5) |
| **A02: Cryptographic Failures** | Plaintext leaks or tampering | AES-256-GCM authenticated encryption; any 1-bit alteration of ciphertext causes authentication tag mismatch and decryption failure. Argon2id for all passwords. | ✅ `crypto.test.ts` (Test #3) |
| **A03: Injection (SQLi / XSS)** | SQL injection or stored XSS | Prisma parameterized queries prevent SQLi. Strict Content Security Policy (CSP) and SVG vector script stripping neutralize XSS. | ✅ `security.test.ts` (Test #6) |
| **A04: Insecure Design (Malware)** | Uploading disguised `.exe` files | Magic byte validation reads file binary headers (`%PDF-`, `\xFF\xD8\xFF`, `PNG`). PE (`MZ`) and ELF executables are rejected immediately regardless of extension. | ✅ `security.test.ts` (Test #2) |
| **A05: Security Misconfiguration** | Directory traversal | Storage engine enforces path canonicalization (`path.resolve`) and verifies that destination paths reside within the configured vault directory. | ✅ `security.test.ts` (Test #7) |
| **A07: Identification & Auth Failures** | Brute force or session replay | Rate limiter blocks IP after 5 failed login attempts. Session tokens are 32-byte cryptographically random hex strings hashed with SHA-256 in the database. | ✅ `api.test.ts` (Test #1) |
| **A08: Software & Data Integrity** | Compromised share links | One-time links are decremented atomically; when `downloadCount >= maxDownloads`, status transitions to `REVOKED` and subsequent requests return `410 Gone`. | ✅ `api.test.ts` (Test #6) |

---

## 🖥️ Frontend Application Pages

The frontend is a single-page application built with modern dark and light mode styling:

1. **Landing Page (`/#/`)**: High-converting hero showcase, live security architecture breakdown, feature matrix, and one-click demo login.
2. **Login Page (`/#login`)**: Secure email/password entry, rate-limiting lockout feedback, and interactive TOTP 6-digit MFA modal challenge.
3. **Registration Page (`/#register`)**: Live interactive 5-point password strength analyzer (length, uppercase, lowercase, numbers, special characters).
4. **Dashboard (`/#dashboard`)**: Storage usage gauge, metric cards (total files, shared files, received files), recent uploads, and audit feed.
5. **My Files (`/#files`)**:
   - Drag-and-drop file uploader with multi-file queue and E2EE toggle.
   - Folder creation and hierarchical breadcrumb navigation.
   - Grid and table list views.
   - Real-time search and filter by category (Documents, Images, Archives, Media).
   - In-app preview modal for safe document and image formats.
6. **Shared Files (`/#shared`)**:
   - **Shared By Me**: Track active share links, view download limits and counts, copy links to clipboard, or instantly revoke access.
   - **Shared With Me**: Access files shared directly to your email address by other users.
7. **Trash (`/#trash`)**: Soft-delete file recovery, file restoration, and permanent empty trash.
8. **Activity Logs (`/#activity`)**: Security audit trail with IP address tracking, action types, timestamps, and JSON download.
9. **Settings (`/#settings`)**: Profile details, RFC 6238 TOTP MFA activation wizard with QR code generation, 8 emergency backup codes, and "Logout from all devices" session manager.
10. **Admin Dashboard (`/#admin`)**: User management table, role delegation (Admin/User), storage quota adjuster, and quarantined malware inspection/purge queue.
11. **Public Share Recipient (`/#share/:token`)**: Clean recipient download interface featuring Argon2id password unlocks, expiration counters, and one-time download handling.

---

## 🗄️ Database Schema & Models

The Prisma schema supports both **PostgreSQL** (production) and **SQLite** (local development/tests):

- `User`: Primary account record with role (`USER`, `ADMIN`), Argon2id password hash, TOTP secret, enabled flag, and backup codes.
- `Session`: Active login sessions tracking session token hashes, client user-agent, IP address, and expiration timestamps.
- `File`: Encrypted file records with random storage key, MIME type, size, SHA-256 checksum, encrypted DEK, IV, auth tag, trash status, and quarantine flag.
- `Folder`: Hierarchical organization containers with nested parent-child references.
- `FileShare`: Granular sharing configurations supporting public tokens, Argon2id passwords, max download limits, download counts, expiration dates, and revocation flags.
- `SharePermission`: Specific user-to-user share permissions (`VIEW` or `DOWNLOAD`).
- `DownloadEvent`: Download history tracking IP addresses, user agents, and timestamps.
- `AuditLog`: Security audit log recording actor, action, target, IP address, and metadata.
- `StorageQuota`: Per-user storage limits and usage calculations.

---

## 🔌 Comprehensive REST API Reference

All protected endpoints require the HTTP-only `session_token` cookie.

### Authentication Endpoints
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Register new user. First registered user automatically receives `ADMIN` role. |
| `POST` | `/api/auth/login` | Authenticate with email and password. Returns `{ mfaRequired: true }` if TOTP is active. |
| `POST` | `/api/auth/mfa/verify-login` | Complete login challenge using 6-digit TOTP code or backup code. |
| `POST` | `/api/auth/logout` | Invalidate current session and clear session cookie. |
| `GET` | `/api/auth/me` | Retrieve profile of currently authenticated user. |
| `POST` | `/api/auth/mfa/setup` | Generate TOTP secret and QR code URI for authenticator app. |
| `POST` | `/api/auth/mfa/enable` | Verify 6-digit TOTP code and enable MFA; generates 8 emergency recovery codes. |
| `POST` | `/api/auth/mfa/disable` | Disable MFA using current password and TOTP code. |
| `POST` | `/api/auth/revoke-sessions` | Revoke all active sessions across all devices for current user. |

### File Operations
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/files/upload` | Upload file via `multipart/form-data`. Scans magic bytes & malware, generates DEK, encrypts with AES-256-GCM. |
| `GET` | `/api/files/list` | List non-trashed files and folders for authenticated user (supports `folderId` and `search` query params). |
| `GET` | `/api/files/download/:id` | Decrypt and stream file to owner with tamper detection. |
| `GET` | `/api/files/preview/:id` | Decrypt and stream file for inline browser preview. |
| `PATCH`| `/api/files/rename/:id` | Rename an existing file. |
| `POST` | `/api/files/trash/:id` | Move file to trash (soft-delete). |
| `POST` | `/api/files/restore/:id` | Restore file from trash. |
| `DELETE`| `/api/files/delete/:id` | Permanently delete file from storage and database. |

### Folder Operations
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/folders/create` | Create a new folder (supports nested `parentId`). |
| `GET` | `/api/folders/list` | List folders in current directory. |
| `DELETE`| `/api/folders/delete/:id` | Delete folder and move contained items to root. |

### Sharing & Access Control
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/shares/create` | Generate public share link or user invite with optional password, expiration date, and max downloads. |
| `GET` | `/api/shares/shared-by-me`| Retrieve all share links created by the current user. |
| `GET` | `/api/shares/shared-with-me`| Retrieve files shared directly with the current user. |
| `GET` | `/api/shares/public/:token`| Fetch public file metadata (verifies expiration and download limits). |
| `POST` | `/api/shares/public/:token/download` | Decrypt and download shared file (requires password in body if protected). |
| `DELETE`| `/api/shares/revoke/:id`| Immediately revoke an active share link. |

### Audit Logs & Admin
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/audit-logs/my` | Retrieve security activity logs for current user. |
| `GET` | `/api/audit-logs/export` | Export audit trail as formatted JSON. |
| `GET` | `/api/admin/stats` | Admin only: Get system storage usage, total files, and user metrics. |
| `GET` | `/api/admin/users` | Admin only: List all users, roles, and storage consumption. |
| `PATCH`| `/api/admin/users/:id/role`| Admin only: Update user role (`USER` or `ADMIN`). |
| `PATCH`| `/api/admin/users/:id/quota`| Admin only: Adjust user storage quota in bytes. |
| `GET` | `/api/admin/threats` | Admin only: View quarantined malware detections. |
| `DELETE`| `/api/admin/threats/:id/purge`| Admin only: Permanently purge quarantined threat. |

---

## 🧪 Automated Test Suite

The test suite runs with Node.js's native test runner via `tsx`:

```bash
npm test
```

### Test Coverage Highlights (22/22 Passing)
- **`crypto.test.ts`**:
  - Verifies Argon2id password hashing and validation against `$argon2id$v=19$...` standards.
  - Verifies AES-256-GCM envelope encryption and decryption with 12-byte IV and 16-byte tag.
  - Verifies **tamper detection**: 1-bit alteration of ciphertext throws an authentication failure.
  - Verifies HMAC-SHA256 signature creation and expiring URL verification.
  - Verifies RFC 6238 TOTP token generation and emergency backup code hashing.
- **`security.test.ts`**:
  - Validates genuine PDF signatures (`%PDF-`).
  - Rejects disguised Windows PE executables (`MZ` magic bytes) renamed as `.pdf` or `.png`.
  - Rejects hazardous extensions (`.exe`, `.bat`, `.sh`, `.vbs`, `.js`).
  - Detects EICAR antivirus test signatures and isolates files to quarantine.
  - Flags deceptive double extensions (`invoice.pdf.exe`).
  - Detects and strips embedded XSS scripts in SVG vectors.
  - Proves directory traversal attacks (`../../etc/passwd`) are blocked by path resolution checks.
- **`api.test.ts`**:
  - Full registration and login lifecycle with HTTP-only session cookies.
  - AES-256-GCM file upload, metadata verification, and decrypted download.
  - **BOLA/IDOR Defense**: Asserts that User 2 attempting to access User 1's file receives `403 Forbidden`.
  - Enforces one-time download link limits (first download succeeds; second attempt returns `410 Gone`).
  - Enforces instant share link revocation.
  - Enforces expired share link rejection.
  - Enforces Argon2id password protection on shared links.
  - Verifies Admin-only role enforcement for system stats and audit logs.

---

## 🚀 Local Quickstart (Zero-Config)

### Prerequisites
- Node.js 20+ installed
- npm 10+ installed

### 1. Clone & Install
```bash
git clone https://github.com/your-username/secure-file-vault.git
cd secure-file-vault

# Run unified setup (installs root, backend, frontend, and generates Prisma client)
npm run setup
```

### 2. Start Development Servers
```bash
npm run dev
```
- **Backend API**: Running at `http://localhost:5000`
- **Frontend SPA**: Running at `http://localhost:5173` with Vite HMR

### 3. Open in Browser
Visit `http://localhost:5173`. The first user you register automatically becomes an **Administrator**.

---

## 🐳 Production Docker & PostgreSQL / MinIO Deployment

The repository includes a production-ready `Dockerfile` and `docker-compose.yml` configuring PostgreSQL 16 and MinIO private S3 object storage.

### 1. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Generate secure 256-bit cryptographic keys using OpenSSL:
```bash
# Generate 256-bit Session Secret
openssl rand -hex 32

# Generate 256-bit AES Master Key (KEK)
openssl rand -hex 32

# Generate HMAC URL Signing Secret
openssl rand -hex 32
```
Update `.env` with your generated values.

### 2. Launch with Docker Compose
```bash
docker compose up -d --build
```
This starts:
1. `postgres`: PostgreSQL 16 Alpine container with persistent database volume.
2. `minio`: S3-compatible private object storage service.
3. `minio-init`: Automatically provisions the private `secure-vault-storage` bucket.
4. `vault-app`: Multi-stage production container running the API and serving the compiled React frontend.

### 3. Access Services
- **Web Application**: `http://localhost:5000`
- **MinIO Console**: `http://localhost:9001` (User: `minioadmin`, Password: `minioadminpassword2026!`)
- **Health Check**: `curl -f http://localhost:5000/api/health`

---

## 🔐 Backup & Key Rotation Guidance

### 1. Database & Vault Backups
- **PostgreSQL Database**:
  ```bash
  docker exec -t secure_vault_postgres pg_dump -U vault_admin secure_file_vault > vault_backup_$(date +%Y%m%d).sql
  ```
- **Encrypted Files**: Back up the S3 bucket or `/app/storage` volume. Because all files are encrypted with AES-256-GCM, the stored blobs remain secure even at rest in secondary cold storage.

### 2. Master Key Rotation Strategy
The master key (`MASTER_KEY_HEX`) is used exclusively to wrap individual file Data Encryption Keys (DEKs). To rotate the master key:
1. Generate `NEW_MASTER_KEY_HEX`.
2. Run a migration script that queries all file records in the database.
3. For each record:
   - Decrypt `encryptedDek` using `OLD_MASTER_KEY_HEX`.
   - Re-encrypt `dek` using `NEW_MASTER_KEY_HEX` with a fresh 12-byte IV.
   - Update `encryptedDek`, `dekIv`, and `dekTag` in the database.
4. **Notice**: The underlying file ciphertexts in storage never need to be re-encrypted or moved during a master key rotation.

---

## 📄 License
This project is licensed under the MIT License.
