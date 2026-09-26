# ⚡ HyperAI — OpenRouter Vercel Backend & Client

[![Deploy with Vercel](https://img.shields.io/badge/Deploy%20with-Vercel-black?style=flat&logo=vercel)](https://vercel.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

**HyperAI** adalah web client AI mandiri bergaya cyberpunk yang terintegrasi dengan backend proxy OpenRouter melalui Vercel Serverless Functions. Project ini dirancang agar ringan, mulus, ramah pengguna awam, dan menyediakan berbagai fitur AI dalam satu interface tanpa mengharuskan pengguna memasukkan API key sendiri.

---

## 🛠️ System Architecture

```text
┌───────────┐             ┌─────────────┐             ┌─────────────────────┐             ┌────────────┐
│  Browser  │  ────────>  │  /api/chat  │  ────────>  │  Vercel Serverless  │  ────────>  │ OpenRouter │
│  (Client) │   Payload   │  Endpoint   │    Proxy     │      Backend       │   API Key    │    API     │
└───────────┘             └─────────────┘             └─────────────────────┘             └────────────┘
```

### 🔐 Request Flow

```text
User
 │
 ▼
HyperAI Web Client
 │
 │ Prompt / Settings
 ▼
/api/chat
 │
 │ Server-side API Request
 ▼
Vercel Serverless Function
 │
 │ OPENROUTER_API_KEY
 ▼
OpenRouter
 │
 ▼
AI Model / Free Route
 │
 ▼
Response
 │
 ▼
HyperAI Client
```

API key OpenRouter tidak perlu ditanam di frontend karena request ke OpenRouter dilakukan melalui backend server-side.

---

# 🚀 Fitur Utama HyperAI

## 🧠 5 Level Mode Berpikir (Thinking)

HyperAI menyediakan **5 level Thinking** untuk menyesuaikan intensitas reasoning yang diminta pengguna.

| Mode | Intensitas | Cocok Untuk |
|---|---|---|
| ⚡ **Kilat** | Minimum | Pertanyaan sederhana dan respons cepat |
| 🌙 **Santai** | Rendah | Percakapan umum dan tugas ringan |
| ⚙️ **Standar** | Normal | Penggunaan sehari-hari, coding, analisis umum |
| 🔍 **Teliti** | Tinggi | Debugging, analisis kompleks, dan problem solving |
| 🧠 **Jenius** | Maksimal | Reasoning mendalam dan tugas multi-step |

### 🔧 Tingkatan Thinking

```text
⚡ KILAT
   │
   ▼
🌙 SANTAI
   │
   ▼
⚙️ STANDAR
   │
   ▼
🔍 TELITI
   │
   ▼
🧠 JENIUS
```

Semakin tinggi level Thinking yang dipilih, semakin besar tingkat reasoning yang diminta dari model, **selama model/provider yang digunakan mendukung parameter reasoning tersebut**.

### 📌 Catatan Thinking

Mode Thinking bukan berarti setiap level menggunakan model AI yang berbeda.

Hasil akhir tetap bergantung pada:

- Model yang sedang digunakan
- Kemampuan reasoning model
- Parameter reasoning yang didukung
- Provider/model route yang tersedia
- Kompleksitas prompt pengguna

Jadi:

```text
Thinking Level
      +
Model Capability
      +
Prompt Complexity
      =
Final Response
```

Gunakan mode **Kilat/Santai** untuk pekerjaan ringan dan mode **Teliti/Jenius** ketika prompt membutuhkan analisis lebih panjang atau beberapa tahap penyelesaian.

---

## 🌐 Web Search

HyperAI menyediakan **Web Search** sebagai fitur opsional yang dapat digunakan ketika prompt membutuhkan informasi dari internet.

Contoh penggunaan:

- Informasi terbaru
- Data yang berubah dari waktu ke waktu
- Referensi dari website
- Pencarian informasi eksternal
- Pertanyaan yang membutuhkan sumber online

### 🔘 Web Search Toggle

```text
┌─────────────────────────┐
│ 🌐 Web Search    [ ON ] │
└─────────────────────────┘
```

Pengguna dapat mengaktifkan atau menonaktifkan fitur pencarian sesuai kebutuhan.

> ⚠️ Ketersediaan dan hasil Web Search bergantung pada konfigurasi backend, provider, model, serta layanan eksternal yang digunakan.

---

## 🛡️ Security

### 🔑 Zero Key Leakage

API key OpenRouter disimpan sebagai **environment variable server-side** dan tidak ditampilkan langsung pada client.

```text
❌ Browser
   └── OPENROUTER_API_KEY

✅ Vercel Serverless
   └── OPENROUTER_API_KEY
```

Frontend hanya mengirim request ke endpoint backend HyperAI.

### 🧱 Server-Side Proxy

```text
Browser
   │
   ▼
HyperAI /api/chat
   │
   ▼
Vercel Serverless
   │
   ▼
OpenRouter
```

Dengan arsitektur ini, client tidak perlu mengetahui secret API key milik backend.

### 🆓 Free Model Routing

Backend HyperAI dapat diarahkan ke route/model gratis sesuai konfigurasi project.

Tujuannya adalah mengurangi risiko frontend secara tidak sengaja memilih model berbayar ketika project memang dimaksudkan untuk menggunakan jalur gratis.

> ⚠️ **Catatan:** Status gratis, ketersediaan model, limit, serta routing provider tetap bergantung pada kebijakan dan kondisi layanan OpenRouter. Jangan menganggap layanan gratis sebagai resource tanpa batas.

### 🌍 Origin Protection

Variable `ALLOWED_ORIGIN` dapat digunakan untuk membatasi origin frontend yang diperbolehkan mengakses endpoint backend.

Contoh:

```env
ALLOWED_ORIGIN=https://your-domain.vercel.app
```

---

## 🎬 Custom Error Pages

HyperAI menyediakan halaman error custom untuk beberapa kondisi HTTP.

| Status | Page |
|---|---|
| `404` | Not Found |
| `403` | Forbidden |
| `503` | Service Unavailable |

Halaman error dapat dilengkapi dengan multimedia interaktif seperti:

- 🎥 Background video
- 🔊 Audio trigger
- 🌐 Media dari Catbox atau YouTube
- ✨ Animasi cyberpunk
- 🖥️ Custom interface

Contoh konsep:

```text
404
┌────────────────────────────────────┐
│                                    │
│         PAGE NOT FOUND             │
│                                    │
│        [ BACK TO HYPERAI ]         │
│                                    │
│        🎬 Multimedia BG            │
│        🔊 Audio Trigger             │
│                                    │
└────────────────────────────────────┘
```

---

## 📋 Welcome Modal Overlay

Ketika website pertama kali dibuka, HyperAI dapat menampilkan **Welcome Modal** berisi informasi penting mengenai project.

Informasi yang dapat ditampilkan meliputi:

- 📜 Ketentuan penggunaan
- 🛠️ Informasi project
- 🤝 Kontak kolaborasi
- 🌐 Sosial media
- 💖 Informasi dukungan/donasi
- ⚠️ Peringatan penggunaan layanan

Tujuannya agar pengguna memahami cara penggunaan HyperAI sebelum mulai melakukan chat.

---

# 🔒 Aturan Penggunaan (Rules)

- Share project ini apabila HyperAI dirasa berguna untuk orang lain.
- Berikan feedback dengan baik apabila menemukan bug atau kekurangan.
- **DILARANG KERAS menggunakan HyperAI sebagai alat pengujian DDoS.**
- Jangan melakukan spam request atau aktivitas yang sengaja membebani backend.
- Gunakan resource backend secara wajar agar layanan tetap dapat digunakan.

> 💀 DDoS test di endpoint sendiri memang kedengarannya "eksperimen", tapi jangan bikin serverless function berubah jadi korban perang saudara.

---

# 📦 Environment Variables

Environment variable berikut dapat dikonfigurasi melalui **Vercel Project Dashboard**.

| Variable Name | Description | Required |
|---|---|---|
| `OPENROUTER_API_KEY` | API key resmi akun OpenRouter. | **Yes** |
| `OPENROUTER_APP_TITLE` | Nama aplikasi untuk metadata/identitas aplikasi pada OpenRouter. | Optional |
| `ALLOWED_ORIGIN` | Origin frontend yang diizinkan mengakses backend. | Recommended |

### Example

```env
OPENROUTER_API_KEY=your_secret_key_here
OPENROUTER_APP_TITLE=HyperAI
ALLOWED_ORIGIN=https://your-domain.vercel.app
```

### ⚠️ Security Warning

**Jangan pernah commit API key asli ke GitHub.**

Pastikan file berikut masuk ke `.gitignore`:

```gitignore
.env
.env.*
!.env.example
node_modules/
.vercel/
```

Gunakan `.env.example` untuk membagikan template configuration tanpa membocorkan secret.

Contoh:

```env
OPENROUTER_API_KEY=your_secret_key_here
OPENROUTER_APP_TITLE=HyperAI
ALLOWED_ORIGIN=https://your-domain.vercel.app
```

---

# 💻 Local Deployment & Development

## 1. Clone Repository

```bash
git clone https://github.com/Hanzet22/hyperai-openrouter-backend.git
cd hyperai-openrouter-backend
```

---

## 2. Install Dependencies

```bash
npm install
```

---

## 3. Configure Environment

Buat file `.env` di root project:

```env
OPENROUTER_API_KEY=your_secret_key_here
OPENROUTER_APP_TITLE=HyperAI-Console
ALLOWED_ORIGIN=http://localhost:3000
```

Jangan gunakan API key asli di source code frontend.

---

## 4. Run Local Development

```bash
npm run dev
```

Atau gunakan Vercel CLI:

```bash
vercel dev
```

---

# 🚀 Deploy ke Vercel

### Install Vercel CLI

```bash
npm i -g vercel
```

### Login

```bash
vercel login
```

### Deploy

```bash
vercel
```

Untuk production deployment:

```bash
vercel --prod
```

Pastikan environment variables sudah tersedia pada project Vercel sebelum deployment production.

---

# 📁 Project Structure

Struktur project dapat berkembang sesuai implementasi frontend/backend, tetapi secara umum pola HyperAI menggunakan arsitektur seperti:

```text
hyperai-openrouter-backend/
│
├── api/
│   └── chat.*
│
├── public/
│   └── assets/
│
├── .env.example
├── .gitignore
├── package.json
├── vercel.json
└── README.md
```

> Struktur aktual dapat berbeda tergantung framework dan implementasi frontend yang digunakan.

---

# 🧪 Development Notes

HyperAI dirancang dengan prinsip:

```text
Lightweight
    +
Serverless
    +
Secure API Handling
    +
Free Model Routing
    +
Interactive UI
    =
HyperAI
```

Fokus utama project:

- ⚡ Respons cepat
- 🧩 Arsitektur sederhana
- 🔐 Secret tetap server-side
- 🧠 Adjustable Thinking
- 🌐 Optional Web Search
- 🎬 Interactive Error Pages
- 📱 User-friendly interface

---

# 🌐 Sosial Media & Kontak Pengembang

**Dibuat Oleh:** HyperGaruda (Hanzet22)

- **Instagram:** `@muhamad_farhannn_`
- **Douyin:** Profil Douyin
- **GitHub:** `Hanzet22`
- **Behance:** `farhanzet_22`
- **Discord Private DM:** `hgi.id`
- **Discord Collaboration:** `hgi_official`
- **Telegram:** `@Hypergaruda`
- **WhatsApp:** `wa.me/6285272995674`
- **Email Collaboration:** `hypergarudatkj@gmail.com`

---

# 💖 Donasi

Jika HyperAI membantu atau mendukung project Anda dan ingin ikut mendukung pengembangannya:

### DANA / GOPAY

```text
085272995674
```

Donasi dapat digunakan untuk membantu maintenance, eksperimen fitur, infrastructure, dan pengembangan HyperAI.

---

# ⚠️ Disclaimer

HyperAI adalah project independen yang menggunakan OpenRouter sebagai gateway/provider API.

HyperAI tidak menjamin:

- Ketersediaan model tertentu
- Uptime provider eksternal
- Limit penggunaan gratis
- Hasil reasoning tertentu
- Ketersediaan Web Search
- Routing provider tertentu

Semua layanan eksternal mengikuti kebijakan, limit, dan perubahan yang diberlakukan oleh masing-masing provider.

---

# 📜 License

This project is licensed under the **MIT License**.

See the `LICENSE` file for more information.

---

# ⚡ HyperAI

```text
╔══════════════════════════════════════╗
║              HYPERAI                 ║
║                                      ║
║   Think. Search. Build. Repeat.      ║
║                                      ║
║      Powered through OpenRouter      ║
║          Deployed on Vercel          ║
╚══════════════════════════════════════╝
```

**Built with passion by HyperGaruda.**

Keeping AI conversations flowing through a lightweight, accessible, and independently built interface.

---

## 🚧 Project Status

**Active Development**

HyperAI masih terus dikembangkan. Fitur, model routing, UI, backend logic, dan integrasi tambahan dapat berubah seiring perkembangan project.

> **Push the Limitation. Push the Creativity. Make The New Era.** ⚡