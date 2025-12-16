# TTE Lab PKI (Simulasi Tanda Tangan Elektronik)

Proyek ini adalah simulasi Laboratorium Infrastruktur Kunci Publik (PKI) untuk Tanda Tangan Elektronik (TTE).
Terdiri dari Root CA (Regulator), Intermediate CA (VendorSign), dan platform aplikasi untuk registrasi (KYC), penerbitan sertifikat digital, dan penandatanganan dokumen PDF.

---

## 🏗️ Arsitektur

```mermaid
graph TD
    User[User/Browser] -->|https| Traefik[Traefik Proxy]
    Traefik -->|pki-lab.local| UI[Vendor UI Next.js]
    Traefik -->|api.pki-lab.local| API[Vendor API Fastify]
    
    API --> DB[(Postgres)]
    API --> Redis[(Redis)]
    API --> MinIO[(MinIO Storage)]
    
    API -->|Issue Cert| VendorCA[StepCA VendorSign]
    VendorCA -->|Chain| RootCA[StepCA RegulatorCA]
    
    Worker[Vendor Worker] --> Redis
    Worker --> DB
    Worker --> MinIO
    Worker -->|Get Key| DB
    Worker -->|Sign PDF| MinIO
```

## 🚀 Cara Menjalankan

### Prasyarat
- **Docker** & **Docker Compose**
- **Git**
- **Unix Shell** (Bash/Zsh) atau **PowerShell** (Windows)

### 1. Persiapan & Bootstrap (Wajib Berurutan)
Lakukan langkah ini untuk inisialisasi sertifikat CA dan konfigurasi awal.

**Linux / Mac:**
```bash
# Clone repo & masuk direktori
git clone https://github.com/tte-lab-pki/tte-lab-pki.git
cd tte-lab-pki

# Setup Environment
cp .env.example .env

# Masuk folder scripts dan jalankan urut
cd scripts

# 1. Cek lingkungan
./00_check.sh

# 2. Init Root CA (Regulator)
./10_bootstrap_root.sh

# 3. Init Vendor CA (VendorSign) dan Sign dengan Root
./20_bootstrap_vendor_intermediate.sh
```

**Windows (PowerShell):**
```powershell
# Clone repo & masuk direktori
git clone https://github.com/tte-lab-pki/tte-lab-pki.git
cd tte-lab-pki

# Setup Environment
Copy-Item .env.example .env

# Masuk folder scripts
cd scripts

# 1. Init Root CA (Regulator)
powershell -ExecutionPolicy Bypass -File .\10_bootstrap_root.ps1

# 2. Init Vendor CA (VendorSign)
powershell -ExecutionPolicy Bypass -File .\20_bootstrap_vendor_intermediate.ps1
```

### 2. Jalankan Service
Setelah bootstrap CA selesai, nyalakan seluruh service aplikasi.

```bash
cd .. # Kembali ke root folder
docker compose up -d --build
```
*Tunggu 1-2 menit hingga semua container (terutama `postgres` dan `api`) siap.*

### 3. Seed User & Data Awal
Script ini akan membuat user demo (`admin`, `clienta`, `clientb`) dan melakukan verifikasi awal.

**Linux / Mac:**
```bash
cd scripts
./30_seed_demo_users.sh
```

**Windows:**
```powershell
cd scripts
powershell -ExecutionPolicy Bypass -File .\30_seed_demo_users.ps1
```

### 4. Setup Host Lokal
Agar domain lokal terbaca, tambahkan entri berikut ke file hosts komputer Anda:

**Linux / Mac (`/etc/hosts`):**
```
127.0.0.1 pki-lab.local api.pki-lab.local
```

**Windows (`C:\Windows\System32\drivers\etc\hosts`):**
*(Buka Notepad sebagai Administrator)*
```
127.0.0.1 pki-lab.local api.pki-lab.local
```

---

## 🧪 Cara Penggunaan (Demo)

Buka **http://pki-lab.local** di browser.

### Akun Demo
- **Admin**: `admin@vendorsign.local` / `password123`
- **User A**: `clienta@lab.local` / `password`
- **User B**: `clientb@lab.local` / `password`

### Skenario Demo: Tanda Tangan & Sharing

1.  **Login sebagai User A** (`clienta@lab.local`).
2.  **Setup Tanda Tangan**:
    - Klik **"Manage Signature"**.
    - Gambar tanda tangan atau upload gambar.
    - Klik **"Save Signature"**.
    - *Sistem otomatis menerbitkan sertifikat digital untuk User A.*.
3.  **Upload Dokumen**:
    - Klik **"Upload Document"** dan pilih file PDF.
4.  **Tanda Tangan Dokumen**:
    - Klik tombol **"Sign"** pada dokumen.
    - Tentukan posisi tanda tangan (Halaman, X, Y, dll) di backend atau gunakan default (Visual Sign).
    - Status berubah menjadi **SIGNED**.
5.  **Share ke User B**:
    - Klik **"Share"**, masukkan email `clientb@lab.local`.
6.  **Login sebagai User B** (Gunakan Incognito atau logout User A).
7.  **Setup Tanda Tangan User B**:
    - **PENTING**: User B juga harus melakukan **"Manage Signature"** -> **"Save"** agar memiliki sertifikat. **Jika tidak, signing akan gagal.**
8.  **Sign Dokumen Shared**:
    - User B akan melihat dokumen yang dishare oleh User A.
    - Klik **"Sign"**. Dokumen akan memiliki dua tanda tangan.
9.  **Download**:
    - Klik **"Download"** untuk mengunduh PDF akhir.
    - Buka di Adobe Reader untuk melihat validitas signature.

---

## ⚠️ Troubleshooting

**1. "Failed to queue signing: No active certificate found"**
- **Sebab**: User belum memiliki sertifikat digital.
- **Solusi**: Buka menu **"Manage Signature"**, lalu klik **"Save Signature"**. Pastikan muncul notifikasi "Certificate issued". Meskipun gambar tanda tangan sudah ada, anda perlu klik Save lagi untuk memicu pembuatan sertifikat jika sebelumnya gagal/belum ada.

**2. "Download failed: Unauthorized"**
- **Sebab**: Token sesi tidak valid atau refresh halaman diperlukan. (Sudah diperbaiki di versi terbaru dengan secure fetch).
- **Solusi**: Reload halaman dan login ulang.

**3. Error saat Bootstrap (Windows)**
- **Sebab**: Execution Policy PowerShell memblokir script.
- **Solusi**: Gunakan `powershell -ExecutionPolicy Bypass -File <nama_file>`.

**4. API 404 / Cannot connect**
- **Sebab**: `vendor-api` belum ready atau masalah jaringan docker.
- **Solusi**: Cek logs `docker logs vendor-api`. Pastikan `vendor-api` running dan terhubung ke DB.

## 🛠️ Tech Stack
- **CA**: Smallstep `step-ca` (Regulator & Vendor Intermediate)
- **Backend Service**: Node.js 20, Fastify, Prisma ORM, TypeScript
- **Frontend**: Next.js 14, React
- **Storage**: MinIO (S3 Compatible), PostgreSQL 16, Redis 7
- **Infra**: Docker Compose, Traefik Reverse Proxy

