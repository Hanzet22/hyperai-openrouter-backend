# ATTRIBUTIONS — HyperAI

Dokumen ini mencatat layanan, merek, dan sumber pihak ketiga yang secara eksplisit dirujuk oleh dokumentasi HyperAI. Atribusi ini bukan pernyataan bahwa pihak-pihak tersebut menjadi sponsor, mitra resmi, atau endorser HyperAI.

> **Penting:** daftar ini disusun dari dokumentasi project yang tersedia, bukan audit menyeluruh terhadap semua file repository. Sebelum rilis publik, periksa source code dan folder asset yang benar-benar di-commit, lalu tambahkan setiap library, ikon, font, gambar, video, audio, dan potongan kode eksternal yang digunakan.

## 1. Layanan dan platform

| Nama | Penggunaan | Referensi resmi | Catatan |
|---|---|---|---|
| OpenRouter | Gateway/API untuk mengakses model AI | https://openrouter.ai/ · https://openrouter.ai/docs | OpenRouter adalah layanan pihak ketiga. API, pricing, model, dan ketentuannya dikelola oleh OpenRouter serta penyedia model terkait. |
| Vercel | Hosting dan serverless functions | https://vercel.com/docs | Vercel adalah layanan pihak ketiga. Limit dan fitur deployment mengikuti konfigurasi project serta plan yang berlaku. |
| GitHub | Hosting repository dan issue/kontribusi | https://docs.github.com/ | Nama dan merek GitHub tetap milik GitHub. Penyebutan ini tidak berarti endorsement. |
| Shields.io | Membuat badge status yang digunakan pada README | https://shields.io/ | Badge menghasilkan gambar status; logo dan merek di dalamnya tetap milik masing-masing pemilik. |

## 2. Model AI dan penyedia inference

HyperAI dapat mengirim request ke model yang tersedia melalui OpenRouter. Nama model, ID model, bobot, output, dan merek yang terkait tetap mengikuti ketentuan masing-masing penerbit dan provider. Daftar model yang tersedia dapat berubah sewaktu-waktu.

Sebelum mendistribusikan bobot model, dataset, output yang dibatasi, atau materi yang disediakan provider, periksa lisensi dan terms dari penerbit model serta provider yang digunakan. Penggunaan OpenRouter sebagai gateway tidak otomatis memberikan hak untuk mendistribusikan ulang seluruh materi model.

Referensi:

- OpenRouter Models: https://openrouter.ai/models
- OpenRouter Free Models: https://openrouter.ai/collections/free-models
- OpenRouter Pricing: https://openrouter.ai/pricing/

## 3. Kode project dan lisensi

Kode HyperAI di repository ini dinyatakan menggunakan **MIT License**, sebagaimana dijelaskan di file [`LICENSE`](LICENSE). Pastikan file `LICENSE` benar-benar tersedia dan nama pemegang hak cipta serta tahunnya sesuai sebelum rilis.

Lisensi MIT untuk kode project tidak memberikan lisensi atas merek dagang, layanan eksternal, model AI, atau asset yang dimiliki pihak lain.

## 4. Asset visual, audio, video, font, dan ikon

README yang tersedia menyebut kemungkinan penggunaan background video, audio trigger, ikon, dan media eksternal. Namun, nama file, kreator, URL asal, dan lisensi setiap asset tidak dapat dipastikan hanya dari README. Karena itu, asset yang belum diverifikasi **tidak dicantumkan sebagai sudah mendapat izin**.

Untuk setiap asset pihak ketiga yang benar-benar digunakan, tambahkan satu entri dengan format berikut:

```text
Asset/file:
Jenis: (gambar / video / audio / font / ikon / kode / lainnya)
Kreator atau pemilik hak:
Sumber asli URL:
Lisensi atau izin penggunaan:
Perubahan yang dilakukan:
Tanggal diperiksa:
```

Panduan:

- Gunakan asset buatan sendiri, berlisensi kompatibel, atau asset yang izin penggunaannya jelas.
- Simpan salinan teks lisensi atau catatan izin bila diperlukan.
- Jangan menganggap asset yang dapat diakses publik otomatis bebas digunakan ulang.
- Untuk media embed, catat sumber media dan ketentuan platformnya.
- Jika asset diganti atau dihapus, perbarui dokumen ini.

## 5. Kontribusi dari pihak lain

Jika menerima pull request yang menambahkan dependency, source code, desain, atau asset eksternal, periksa lisensi dan kebutuhan atribusinya sebelum menggabungkan perubahan. Cantumkan copyright notice dan teks lisensi yang diwajibkan oleh pemilik aslinya.

## 6. Tidak ada afiliasi resmi

HyperAI adalah project independen. Kecuali dinyatakan secara tertulis dan dapat diverifikasi, penggunaan nama atau tautan OpenRouter, Vercel, GitHub, Shields.io, penerbit model, dan provider lainnya **bukan** klaim kemitraan, sponsor, atau endorsement.

---

**Maintainer:** HyperGaruda (`Hanzet22`)  
**Project:** HyperAI  
**Last reviewed:** 2026-10-19