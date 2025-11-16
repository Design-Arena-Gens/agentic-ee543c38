## PrivaT — Chatting Pribadi Aman

PrivaT adalah aplikasi chatting modern berbasis web dengan autentikasi ID unik, chat personal dan grup, notifikasi realtime, serta panggilan suara & video peer-to-peer.

### ✨ Fitur Utama
- **Autentikasi**: Registrasi dengan ID unik otomatis, login via ID & password, sesi tersimpan dalam cookie HTTP-only.
- **Profil**: Ubah nama, status, foto profil (base64), dan pengaturan privasi (publik, privat, hanya teman).
- **Chat 1-on-1 & Grup**: Kirim teks, gambar, dan dokumen; buat grup baru, gabung lewat ID, dan pantau anggota.
- **Realtime**: Push notifikasi & sinkronisasi pesan menggunakan Socket.IO.
- **Panggilan P2P**: Voice/video call berbasis WebRTC dengan SimplePeer dan kanal signaling Socket.IO.
- **Sosial**: Tambah teman via ID, lihat status teman, dan laporan konten.
- **Admin Panel**: Kelola user, grup, dan laporan (hapus akun/grup, ubah status laporan).

### 🧱 Teknologi
- **Frontend**: Next.js 16 (App Router) + Tailwind CSS v4
- **Backend**: Next.js Route Handlers, Prisma ORM (SQLite), Socket.IO, SimplePeer WebRTC
- **Keamanan**: JWT + cookie HTTP-only, bcrypt hashing

### 🚀 Menjalankan secara lokal
1. Instal dependensi:
   ```bash
   npm install
   ```
2. Setel variabel lingkungan di `.env` (contoh otomatis tersedia):
   ```env
   DATABASE_URL="file:./dev.db"
   AUTH_SECRET="privat-super-secret"
   ```
3. Jalankan migrasi database & generate Prisma Client:
   ```bash
   npx prisma migrate dev
   ```
4. Mulai server pengembangan:
   ```bash
   npm run dev
   ```
5. Akses aplikasi di [http://localhost:3000](http://localhost:3000).

### 🧪 Build produksi
```bash
npm run build
npm start
```

### 📦 Struktur Penting
- `src/app` — Halaman Next.js (auth, dashboard, API routes)
- `src/components` — Komponen UI (auth forms, dashboard client)
- `src/lib` — Utilitas Prisma, autentikasi, realtime helper
- `prisma` — Skema ORM & migrasi database

### ⚠️ Catatan Deploy
- Untuk Vercel, set environment variable:
  - `DATABASE_URL` (contoh: `file:/tmp/privat.db` untuk penyimpanan sementara)
  - `AUTH_SECRET`
- Jalankan migrasi otomatis via script build (`prisma migrate deploy`).
- Pastikan `vercel.json` tidak diperlukan karena konfigurasi default mencukupi.

Selamat menggunakan PrivaT! 🎉
