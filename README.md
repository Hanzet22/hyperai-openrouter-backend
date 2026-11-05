# ⚡ HyperAI

**Think. Search. Build. Repeat.**

HyperAI adalah web client AI bergaya cyberpunk yang mengakses model melalui **OpenRouter** dengan backend proxy berbasis **Vercel Serverless Functions**. Tujuannya adalah menyediakan antarmuka percakapan yang ringan dan mudah digunakan tanpa meminta setiap pengguna memasukkan API key OpenRouter mereka sendiri.

> **Status:** Active Development — fitur, model yang tersedia, dan konfigurasi provider dapat berubah.

[![Deploy with Vercel](https://img.shields.io/badge/Deploy%20with-Vercel-black?style=flat&logo=vercel)](https://vercel.com/new)
[![License: AGPL-3.0-or-later](https://img.shields.io/badge/License-AGPL--3.0--or--later-blue.svg)](LICENSE)
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

### HTTP security headers

Baseline response headers are configured in `vercel.json`: MIME sniffing protection, clickjacking protection, a strict referrer policy, HSTS, and a restrictive Permissions Policy. They must still be verified against the deployed site and API responses after deployment. A Content Security Policy is intentionally not enabled yet because the current frontend contains inline JavaScript and CSS; add one after a compatibility-tested migration.

### Public API access and rate limiting

The frontend remains anonymous/public; no user-account authentication or per-user identity is implemented. All six POST API routes now use a shared Upstash Redis limiter: per-route IP limits plus a global ceiling, applied atomically in a 60-second window. Production requests fail closed with HTTP 503 if Upstash or Vercel's trusted client-IP header is unavailable, and return HTTP 429 with `Retry-After` when a limit is reached.

This is **abuse throttling, not authentication**. It does not identify people, create per-user quotas, or guarantee a daily provider-spend cap. IP limits may affect multiple people behind the same school/mobile/office NAT. Configure `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` in Vercel before expecting production API routes to work. See the [Security 0.1 rate-limit setup guide](docs/security/0.1-rate-limit-setup.md).

### Cost protection

Security 0.2 adds a shared 256 KiB JSON request ceiling, server-enforced output caps (2,048 tokens for chat and 256 for moderation), and an emergency server-side kill switch. Set `HYPERAI_AI_ENABLED=false` in the Vercel environment and redeploy to block all AI API requests. Usage telemetry records model, route, generation ID, token counts, and provider-reported cost when returned; it deliberately does not log prompts or response text.

Application limits are defense in depth, not a substitute for a provider-side spend ceiling. Use a dedicated OpenRouter API key for HyperAI and configure a per-key credit limit in the OpenRouter dashboard. If the workspace supports budget controls, configure a workspace or guardrail budget too. Choose a cap appropriate to the project owner; do not assume that a model marked `:free` or disabled Web Search guarantees zero charges. See the [Security 0.2 cost-protection guide](docs/security/0.2-cost-protection.md) and the [OpenRouter spend controls](https://openrouter.ai/docs/guides/best-practices/spend-controls).

### Request concurrency and resource protection

Security 0.3 adds a shared Redis-backed concurrency guard around upstream AI work. It admits up to 24 in-flight requests globally, with route ceilings (chat 8, speech 3, decisions/embeddings/moderation 8 each, rerank 6). Saturated routes return HTTP 429 instead of queueing unlimited work. A permit is acquired and released atomically with Redis Lua; abandoned permits expire after 70 seconds.

Upstream deadlines are bounded below the configured Vercel function duration: chat 55 seconds, speech 50 seconds, and JSON endpoints 25 seconds. Client disconnects and request-abort events cancel the upstream fetch/stream where supported. Redis failures fail closed with HTTP 503. This is distributed backpressure, not a guarantee against all platform-level resource exhaustion or a substitute for authentication. See the [Security 0.3 concurrency and resource-protection guide](docs/security/0.3-concurrency-resource-protection.md).

### Upstream reliability and failure resilience

Security 0.4 adds a Redis-coordinated circuit breaker scoped to the selected model, with a 30-second cooldown and a single half-open recovery probe. Five transient failures in a 30-second window open that model's circuit; unrelated models remain independently available. JSON endpoints and chat may retry one HTTP 429 only when the provider supplies a valid `Retry-After` of at most one second. Arbitrary POST retries on network errors and 5xx responses are intentionally disabled to avoid duplicate generations and charges. Chat is never replayed after SSE output begins; speech uses circuit protection without automatic retry. The control uses the existing Upstash variables and fails closed in Production/Preview if Redis is unavailable. See the [Security 0.4 upstream reliability guide](docs/security/0.4-upstream-reliability.md).

### Security review record

See the [Security, Privacy, and Compliance Audit](docs/security/2026-11-05-security-privacy-audit.md) for the reviewed risks, limitations, and outstanding work. The report is a source/configuration review, not a penetration test or legal compliance certification.

### Upstream error boundaries (Security 0.9)

Security 0.9 maps transport exceptions to a small, trusted set of public errors and prevents raw Responses API stream errors from being reflected to clients. Unknown provider/network exceptions become generic 502 responses; known circuit/resilience states retain generic 503 responses; timeouts become generic 504 responses. This reduces accidental disclosure of internal URLs, headers, provider diagnostics, and secret-like strings. It does not replace provider-side controls or a penetration test. See [Security 0.9 — Upstream Error Boundaries](docs/security/0.9-upstream-error-boundaries.md).

### CORS dan `ALLOWED_ORIGIN`

`ALLOWED_ORIGIN` dapat membatasi origin browser yang diizinkan oleh kebijakan CORS backend. CORS **bukan autentikasi** dan tidak mencegah request non-browser atau request yang memalsukan header. Jangan menjadikan CORS sebagai satu-satunya perlindungan untuk endpoint yang memakai API key milik pemilik deployment.

### Model gratis dan routing

Model `openrouter/free` memilih rute model gratis yang tersedia dan sesuai dengan kemampuan request. Namun, “gratis” tidak berarti kapasitas, uptime, kecepatan, atau kuota tanpa batas. Model gratis dapat berubah, penuh, dibatasi, atau tidak mendukung parameter tertentu. Periksa [katalog model gratis OpenRouter](https://openrouter.ai/collections/free-models) untuk status terkini.

Backend sebaiknya hanya menerima model yang diizinkan allowlist di `api/chat.js`. Jangan mengandalkan validasi di browser karena request client dapat dimodifikasi.

### Penggunaan yang bertanggung jawab

- Jangan gunakan HyperAI untuk uji DDoS, spam request, atau membebani layanan.
- Jangan mengirim secret, kata sandi, atau informasi pribadi yang tidak perlu ke model AI.
- Jangan menganggap output AI selalu akurat; verifikasi informasi penting dari sumber tepercaya.
- Pertahankan rate limiting aktif dan tinjau kuota setelah mengamati traffic nyata; rate limiting IP bukan autentikasi atau jaminan batas biaya harian.
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
| `UPSTASH_REDIS_REST_URL` | **Ya, production** | REST URL database Upstash Redis untuk rate limiting bersama. |
| `UPSTASH_REDIS_REST_TOKEN` | **Ya, production** | Secret REST token Upstash; hanya digunakan server-side. |

Contoh `.env.example`:

```env
OPENROUTER_API_KEY=replace_with_your_own_key
OPENROUTER_APP_TITLE=HyperAI
PUBLIC_APP_URL=https://your-project.vercel.app
ALLOWED_ORIGIN=https://your-project.vercel.app
ENABLE_OPENROUTER_WEB_SEARCH=false
UPSTASH_REDIS_REST_URL=https://YOUR-DATABASE.upstash.io
UPSTASH_REDIS_REST_TOKEN=replace_with_your_upstash_rest_token
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
| HTTP 503 `RATE_LIMIT_UNAVAILABLE` | Pastikan `UPSTASH_REDIS_REST_URL` dan `UPSTASH_REDIS_REST_TOKEN` terpasang di environment Vercel yang benar, Redis tersedia, dan redeploy sudah selesai. |
| HTTP 429 `RATE_LIMITED` | Batas request per-IP atau global tercapai. Tunggu sesuai header `Retry-After`; jangan melakukan retry loop agresif. |
| Banyak request tak dikenal | Periksa Vercel/Upstash usage dan pertimbangkan firewall/WAF. Rate limiting IP mengurangi abuse tetapi bukan autentikasi atau jaminan batas biaya harian. |

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

Kode HyperAI dilisensikan di bawah **GNU Affero General Public License v3.0 or later (AGPL-3.0-or-later)**. Lihat file [`LICENSE`](LICENSE) untuk teks lisensi lengkap. SPDX-License-Identifier: `AGPL-3.0-or-later`. Lisensi kode project tidak otomatis mencakup merek dagang, layanan, model AI, atau asset pihak ketiga; ketentuan masing-masing tetap berlaku.

Karena HyperAI merupakan aplikasi web, setiap deployment yang menjalankan versi modifikasi harus menyediakan cara yang jelas dan mudah ditemukan bagi pengguna jaringan untuk memperoleh Corresponding Source sesuai Section 13 AGPLv3. Tautan sumber pada antarmuka deployment perlu diarahkan ke source code versi yang benar-benar dijalankan.

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

### Observability and operational monitoring

Security 0.5 adds privacy-conscious structured telemetry to API request lifecycles, rate-limit and concurrency rejections, upstream circuit-breaker outcomes, and provider-reported token/cost usage. Events are emitted to Vercel Runtime Logs; prompts, responses, raw IP addresses, and secrets are excluded by an explicit field allowlist. This does not add a metrics database, dashboard, or automated alerting. See [Security 0.5 — Observability & Operational Monitoring](docs/security/0.5-observability-monitoring.md) for event definitions, operational review guidance, and limitations.


### Deployment readiness verification (Security 0.6)

The non-billing deployment verifier checks the homepage security headers, OPTIONS preflight for all six API routes, request IDs, and an authenticated Upstash Redis REST PING. It does not submit AI prompts or trigger model generation.

Run it from a trusted shell with secrets supplied through environment variables:

```sh
HYPERAI_BASE_URL="https://your-production-domain" \
UPSTASH_REDIS_REST_URL="https://your-database.upstash.io" \
UPSTASH_REDIS_REST_TOKEN="your-token" \
npm run verify:deployment
```

See [Security 0.6 — Deployment Readiness](docs/security/0.6-deployment-readiness.md) for Production/Preview setup and completion criteria. Never commit or paste Redis credentials into source control, issues, logs, or chat.


### Application security hardening (Security 0.7)

Security 0.7 records the application security review, renders untrusted chat messages with DOM creation/text nodes instead of HTML string sinks, validates HTTP(S) links, avoids reflecting raw provider error bodies, and caps buffered speech responses at 8 MiB. Regression tests include inline-script syntax checks and streamed oversized-audio coverage. This does not constitute a penetration test or a real-browser XSS assessment. See [Security 0.7 — Application Security Hardening](docs/security/0.7-application-hardening.md).


### Live Redis runtime verification (Security 0.8)

Security 0.8 adds a credential-safe verifier for the actual Lua scripts used by the rate limiter, distributed concurrency guard, and circuit breaker. It tests atomic rate-limit rejection, concurrency lease acquire/release, circuit open/half-open/single-probe/reset behavior, and deletes its uniquely namespaced temporary keys afterward.

Run from a trusted shell with the Upstash REST credentials supplied through environment variables:

```sh
UPSTASH_REDIS_REST_URL="https://your-database.upstash.io" \
UPSTASH_REDIS_REST_TOKEN="your-token" \
npm run verify:redis
```

The command does not send AI prompts, call OpenRouter, change application keys, or run a load test. See [Security 0.8 — Runtime Verification & Redis Operational Hardening](docs/security/0.8-runtime-verification.md) for verified behavior and remaining deployment limitations.
