# ⚡ HyperAI

**Think. Search. Build. Repeat.**

HyperAI adalah web client AI bergaya cyberpunk yang mengakses model melalui **OpenRouter** dengan backend proxy berbasis **Vercel Serverless Functions**. Tujuannya adalah menyediakan antarmuka percakapan yang ringan dan mudah digunakan tanpa meminta setiap pengguna memasukkan API key OpenRouter mereka sendiri.

> **Status:** Active Development — fitur, model yang tersedia, dan konfigurasi provider dapat berubah.

[![Deploy with Vercel](https://img.shields.io/badge/Deploy%20with-Vercel-black?style=flat&logo=vercel)](https://vercel.com/new)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Powered by OpenRouter](https://img.shields.io/badge/AI%20Gateway-OpenRouter-6c5ce7?style=flat)](https://openrouter.ai/)

---

## Daftar Isi

- [Fitur](#-fitur)
- [Arsitektur](#-arsitektur)
- [Thinking Modes](#-thinking-modes)
- [Web Search](#-web-search)
- [Keamanan dan Batasan](#-keamanan-dan-batasan)
- [Konfigurasi](#-konfigurasi-environment-variables)
- [Menjalankan secara lokal](#-menjalankan-secara-lokal)
- [Deployment ke Vercel](#-deployment-ke-vercel)
- [Struktur Project](#-struktur-project)
- [Troubleshooting](#-troubleshooting)
- [Kontribusi dan Pelaporan Bug](#-kontribusi-dan-pelaporan-bug)
- [Attribution](#-attribution)
- [Kontak](#-kontak)
- [Lisensi](#-lisensi)

## ✨ Fitur

- **Chat UI cyberpunk** — antarmuka percakapan dengan fokus pada penggunaan yang sederhana.
- **Backend proxy** — request ke OpenRouter dilakukan oleh server, bukan dengan menaruh secret API key di HTML atau JavaScript browser.
- **Streaming response** — jawaban dapat ditampilkan secara bertahap ketika endpoint dan provider mendukung aliran respons.
- **Thinking modes** — pilihan intensitas reasoning dari mode cepat sampai mode yang meminta reasoning lebih tinggi, jika didukung model/provider.
- **Web Search opsional** — dapat diaktifkan melalui UI dan konfigurasi backend. Fitur ini bergantung pada dukungan serta biaya tool/provider yang digunakan.
- **Validasi model di server** — backend dapat membatasi model yang diterima menggunakan allowlist.
- **Custom interface** — welcome modal, quick prompts, kontrol chat, dan halaman error dapat disesuaikan sesuai aset serta implementasi yang ada di repository.

> Ketersediaan setiap fitur mengikuti kode yang sedang di-deploy, konfigurasi environment, serta kemampuan model/provider. README ini bukan jaminan bahwa setiap fitur aktif pada semua deployment.

## 🏗️ Arsitektur

```text
┌──────────────────────┐
│ Browser / HyperAI UI │
└──────────┬───────────┘
           │ POST /api/chat
           ▼
┌──────────────────────┐
│ Vercel Function      │
│ api/chat.js          │
│ - validate request   │
│ - apply server rules │
│ - keep API key secret│
└──────────┬───────────┘
           │ HTTPS + server-side key
           ▼
┌──────────────────────┐
│ OpenRouter API        │
│ selected model/route  │
└──────────┬───────────┘
           │ response / stream
           ▼
┌──────────────────────┐
│ HyperAI UI            │
└──────────────────────┘
```

Secara umum, client mengirim pesan dan pengaturan yang diperlukan ke endpoint `/api/chat`. Function backend memvalidasi input, menerapkan konfigurasi server, lalu meneruskan request ke OpenRouter. Responsnya dikirim kembali ke client.

API key disimpan sebagai environment variable di Vercel, bukan sebagai nilai yang ditanam di source frontend. **Jangan menganggap proxy publik otomatis aman dari penyalahgunaan**: siapa pun yang dapat menjangkau endpoint mungkin dapat mencoba menggunakannya. Tambahkan autentikasi, rate limiting, kuota, atau perlindungan lain jika deployment dibuka untuk publik.

## 🧠 Thinking Modes

UI HyperAI menyediakan lima pilihan mode. Nama yang terlihat di UI dapat berbeda dari nilai teknis yang diteruskan backend.

| Mode UI | Tujuan penggunaan | Catatan |
|---|---|---|
| ⚡ **Kilat** | Respons cepat untuk prompt sederhana | Reasoning eksplisit dapat dinonaktifkan atau tidak diminta. |
| 🌙 **Santai** | Percakapan umum dan tugas ringan | Biasanya meminta reasoning rendah jika didukung. |
| ⚙️ **Standar** | Pemakaian sehari-hari, coding, dan analisis umum | Menggunakan pengaturan normal sesuai pemetaan backend. |
| 🔍 **Teliti** | Debugging dan problem solving bertahap | Meminta reasoning lebih tinggi jika tersedia. |
| 🧠 **Jenius** | Tugas kompleks atau multi-step | Meminta tingkat reasoning tertinggi yang dipetakan backend; bukan jaminan hasil lebih baik. |

Thinking mode **tidak otomatis mengganti model**. Efeknya bergantung pada pemetaan di backend, dukungan parameter oleh model/provider, serta kompleksitas prompt. Provider dapat mengabaikan atau menolak parameter yang tidak didukung.

## 🌐 Web Search

Web Search bersifat opsional dan harus diizinkan oleh konfigurasi backend. Pada implementasi yang menggunakan OpenRouter server tool `openrouter:web_search`, model dapat meminta pencarian selama proses menjawab.

Untuk mengaktifkannya:

1. Atur `ENABLE_OPENROUTER_WEB_SEARCH=true` pada environment deployment.
2. Pastikan UI mengirim pilihan Web Search yang sesuai.
3. Deploy ulang jika diperlukan, lalu uji menggunakan prompt yang memang membutuhkan informasi web.

**Perhatikan biaya:** jangan menganggap Web Search gratis hanya karena model chat yang dipilih bertanda `:free` atau menggunakan `openrouter/free`. Biaya tool pencarian, provider, dan pemakaian model dapat berbeda. Periksa [dokumentasi Web Search OpenRouter](https://openrouter.ai/tool/web-search/) dan [halaman pricing OpenRouter](https://openrouter.ai/pricing/) sebelum mengaktifkannya untuk pengguna lain.

Hasil pencarian juga dapat tidak tersedia, tidak lengkap, atau berubah. Pengguna sebaiknya memeriksa sumber asli untuk informasi penting.

## 🛡️ Keamanan dan Batasan

### Secret management

- Simpan `OPENROUTER_API_KEY` hanya di environment server-side.
- Jangan commit `.env`, `.env.local`, token, atau secret lain.
- Jangan menaruh API key server di `index.html`, file JavaScript frontend, screenshot, log publik, atau issue GitHub.
- Jika key terlanjur dipublikasikan, cabut/rotasi key melalui akun OpenRouter.

### CORS dan `ALLOWED_ORIGIN`

`ALLOWED_ORIGIN` dapat membatasi origin browser yang diizinkan oleh kebijakan CORS backend. CORS **bukan autentikasi** dan tidak mencegah request non-browser atau request yang memalsukan header. Jangan menjadikan CORS sebagai satu-satunya perlindungan untuk endpoint yang memakai API key milik pemilik deployment.

### Model gratis dan routing

Model `openrouter/free` memilih rute model gratis yang tersedia dan sesuai dengan kemampuan request. Namun, “gratis” tidak berarti kapasitas, uptime, kecepatan, atau kuota tanpa batas. Model gratis dapat berubah, penuh, dibatasi, atau tidak mendukung parameter tertentu. Periksa [katalog model gratis OpenRouter](https://openrouter.ai/collections/free-models) untuk status terkini.

Backend sebaiknya hanya menerima model yang diizinkan allowlist di `api/chat.js`. Jangan mengandalkan validasi di browser karena request client dapat dimodifikasi.

### Penggunaan yang bertanggung jawab

- Jangan gunakan HyperAI untuk uji DDoS, spam request, atau membebani layanan.
- Jangan mengirim secret, kata sandi, atau informasi pribadi yang tidak perlu ke model AI.
- Jangan menganggap output AI selalu akurat; verifikasi informasi penting dari sumber tepercaya.
- Terapkan autentikasi dan rate limiting sebelum memberi akses publik berskala besar.
- Pantau penggunaan, error, serta limit dari Vercel dan OpenRouter.

## ⚙️ Konfigurasi Environment Variables

Atur variable berikut melalui **Vercel Dashboard → Project → Settings → Environment Variables**. Untuk pengembangan lokal, simpan variable pada file environment lokal yang tidak di-commit.

| Variable | Wajib? | Kegunaan |
|---|---:|---|
| `OPENROUTER_API_KEY` | Ya | Secret API key untuk request server-side ke OpenRouter. |
| `OPENROUTER_APP_TITLE` | Tidak | Nama aplikasi untuk metadata/identitas aplikasi pada request OpenRouter. |
| `PUBLIC_APP_URL` | Tidak | URL publik aplikasi yang dapat dipakai sebagai metadata request. Gunakan URL deployment yang benar. |
| `ALLOWED_ORIGIN` | Tidak | Origin frontend yang diizinkan oleh kebijakan CORS. Contoh: `https://hyperai.example.com`. |
| `ENABLE_OPENROUTER_WEB_SEARCH` | Tidak | Aktifkan tool Web Search hanya dengan nilai `true`; default sebaiknya tetap nonaktif. |

Contoh `.env.example`:

```env
OPENROUTER_API_KEY=replace_with_your_own_key
OPENROUTER_APP_TITLE=HyperAI
PUBLIC_APP_URL=https://your-project.vercel.app
ALLOWED_ORIGIN=https://your-project.vercel.app
ENABLE_OPENROUTER_WEB_SEARCH=false
```

`OPENROUTER_API_KEY` pada contoh di atas adalah placeholder, **bukan key yang valid**. Jangan isi file contoh ini dengan secret asli.

### `.gitignore`

Pastikan file rahasia dan hasil build lokal tidak ikut ter-commit. Contoh aturan yang umum:

```gitignore
.env
.env.*
!.env.example
.vercel/
node_modules/
```

Sesuaikan dengan kebutuhan repository. Jika secret pernah masuk ke riwayat Git, menghapusnya dari commit terbaru saja tidak cukup—rotasi secret tetap diperlukan.

## 💻 Menjalankan secara Lokal

### Prasyarat

- Git
- Node.js versi yang kompatibel dengan project
- Akun OpenRouter dan API key
- Vercel CLI untuk menjalankan Vercel Functions secara lokal

### 1. Clone repository

```bash
git clone https://github.com/Hanzet22/hyperai-openrouter-backend.git
cd hyperai-openrouter-backend
```

### 2. Siapkan konfigurasi environment

Buat file environment lokal (misalnya `.env.local`) dan isi variable yang diperlukan. Jangan commit file tersebut. Jika project sudah terhubung ke Vercel, variable development juga dapat ditarik melalui CLI:

```bash
vercel link
vercel env pull .env.local
```

Periksa isi file hasil pull secara lokal dan pastikan file tersebut di-ignore Git.

### 3. Jalankan Vercel development server

Instal Vercel CLI jika belum tersedia:

```bash
npm install --global vercel
```

Kemudian jalankan:

```bash
vercel dev
```

Ikuti instruksi CLI untuk menghubungkan repository dengan project Vercel. Jika `package.json` menyediakan script `dev` yang sesuai, `npm run dev` juga dapat digunakan; bila tidak, gunakan `vercel dev` untuk menguji routing function Vercel.

## 🚀 Deployment ke Vercel

1. Push repository ke GitHub.
2. Import repository melalui [Vercel](https://vercel.com/new).
3. Tambahkan environment variables yang diperlukan di Project Settings.
4. Pastikan `OPENROUTER_API_KEY` terisi dan tidak pernah berada di source frontend.
5. Deploy, lalu uji chat, streaming, model yang diizinkan, serta perilaku error.
6. Aktifkan Web Search hanya jika diperlukan dan setelah mengecek biayanya.

Project dapat menggunakan `vercel.json` untuk mengatur function, termasuk `maxDuration`. Nilai seperti `60` detik adalah batas maksimum invocation yang diminta konfigurasi, bukan jaminan setiap request selesai dalam waktu itu. Batas aktual mengikuti runtime dan plan Vercel. Lihat [dokumentasi konfigurasi function](https://vercel.com/docs/functions/configuring-functions) dan [maximum duration](https://vercel.com/docs/functions/configuring-functions/duration).

## 📁 Struktur Project

Struktur berikut adalah gambaran umum. Sesuaikan dengan isi repository yang benar-benar ada:

```text
hyperai-openrouter-backend/
├── api/
│   └── chat.js           # Serverless chat endpoint
├── public/               # Static assets, jika digunakan
├── index.html            # Web client, jika disimpan di root
├── .env.example          # Template tanpa secret
├── .gitignore
├── vercel.json           # Konfigurasi Vercel, jika digunakan
├── package.json          # Scripts/dependencies, jika diperlukan
├── README.md
├── ATTRIBUTIONS.md
└── LICENSE
```

Beberapa file mungkin tidak ada atau berada di direktori lain. Dokumentasi ini tidak mengharuskan struktur di atas jika implementasi repository berbeda.

## 🧪 Troubleshooting

| Gejala | Hal yang diperiksa |
|---|---|
| `OPENROUTER_API_KEY` missing/invalid | Pastikan secret terpasang pada environment Vercel yang benar lalu redeploy. Jangan menaruh key di frontend. |
| `401` atau `403` dari OpenRouter | Periksa key, akses model/provider, dan detail error dari server log. Jangan publikasikan log yang berisi secret. |
| Model tidak tersedia | Pastikan ID model ada dalam allowlist backend dan masih tersedia di OpenRouter. |
| Thinking mode tidak berpengaruh | Model/provider mungkin tidak mendukung parameter reasoning yang dikirim. |
| Web Search tidak berjalan | Periksa `ENABLE_OPENROUTER_WEB_SEARCH`, pilihan UI, dukungan endpoint, serta log error dan biaya tool. |
| Browser menampilkan CORS error | Periksa nilai `ALLOWED_ORIGIN`, protokol `https://`/`http://`, port lokal, dan origin yang benar-benar digunakan. |
| Respons berhenti saat streaming | Periksa `maxDuration`, log function, status provider, koneksi client, dan batas layanan. |
| Banyak request tak dikenal | CORS bukan proteksi penyalahgunaan. Batasi akses dan tambahkan rate limiting/autentikasi yang sesuai. |

## 🤝 Kontribusi dan Pelaporan Bug

Saran, laporan bug, dokumentasi, dan kontribusi kode sangat dihargai.

Sebelum membuka issue:

1. Jelaskan langkah reproduksi dan perilaku yang diharapkan.
2. Sertakan pesan error yang sudah disamarkan jika relevan.
3. Jangan sertakan API key, token, cookie, nomor telepon, atau data pribadi.
4. Untuk perubahan kode, jelaskan alasan dan dampak perubahan.

Pull request sebaiknya tetap fokus, dapat diuji, dan tidak memasukkan secret atau asset yang lisensinya tidak jelas.

## 🧾 Attribution

Layanan dan proyek pihak ketiga yang dirujuk oleh HyperAI tetap menjadi milik pemilik masing-masing. Rincian kredit, lisensi, serta panduan pencatatan asset tersedia di [`ATTRIBUTIONS.md`](ATTRIBUTIONS.md).

## 🌐 Kontak

**Project:** HyperAI  
**Developer:** HyperGaruda (`Hanzet22`)

- GitHub: [Hanzet22](https://github.com/Hanzet22)
- Instagram: [@muhamad_farhannn_](https://www.instagram.com/muhamad_farhannn_/)
- Douyin: [Profile link](https://v.douyin.com/P0Qx2tl0KSA/)
- Behance: [farhanzet_22](https://www.behance.net/farhanzet_22)
- Telegram: [@Hypergaruda](https://t.me/Hypergaruda)
- Email kolaborasi: `hypergarudatkj@gmail.com`

Untuk keselamatan dan privasi, hindari memublikasikan nomor telepon pribadi, nomor pembayaran, atau alamat rumah di dokumentasi repository. Gunakan kanal kontak proyek yang memang siap menerima pesan publik.

## 📜 Lisensi

Kode project ini dinyatakan menggunakan **MIT License**. Lihat file [`LICENSE`](LICENSE). Lisensi project tidak otomatis mencakup merek dagang, layanan, model AI, atau asset pihak ketiga; ketentuan masing-masing tetap berlaku.

---

<div align="center">

```text
╔══════════════════════════════════════╗
║               HYPERAI                ║
║                                      ║
║      Think. Search. Build. Repeat.   ║
║                                      ║
║    OpenRouter-powered · Vercel-hosted║
╚══════════════════════════════════════╝
```

**Push the Limitation. Push the Creativity. Make The New Era.** ⚡

</div>