# ⚡ HyperAI — OpenRouter Vercel Backend

[![Deploy with Vercel](https://shields.io)](https://vercel.com)
[![License: MIT](https://shields.io)](https://opensource.org)

A secure, serverless backend proxy tailored for the **HyperAI** chat client. This middleware routes browser requests safely to OpenRouter, strictly locked to the **free tier model** to ensure zero cost and maximum security.

## 🛠️ System Architecture

```text
┌───────────┐             ┌───────────┐             ┌─────────────────────┐             ┌────────────┐
│  Browser  │  ────────>  │ /api/chat │  ────────>  │  Vercel Serverless  │  ────────>  │ OpenRouter │
│ (Client)  │  [Payload]  │  Endpoint │  [Headers]  │  [Hardcoded Free]   │  [API Key]  │ (Free API) │
└───────────┘             └───────────┘             └─────────────────────┘             └────────────┘
```

## 🔒 Security Design

* **Zero Key Leakage:** The frontend browser has **NO access** to the OpenRouter API Key. All authentications are handled server-side.
* **Bulletproof Free Tier:** The routing endpoint is strictly **hardcoded** to `openrouter/free`. Even if clients attempt payload tempering via Postman or custom headers to request premium models, the backend enforces the free tier—preventing unexpected token billing.
* **CORS Protection:** Supports `ALLOWED_ORIGIN` checks to ensure only your designated frontend domain can utilize this proxy handler.

## 🚀 Environment Variables

To run this backend securely, you must configure the following environment variables inside your Vercel Project Dashboard:

| Variable Name | Description | Required |
| :--- | :--- | :--- |
| `OPENROUTER_API_KEY` | Your official OpenRouter token credential. | **Yes** |
| `OPENROUTER_APP_TITLE` | Custom name displayed in OpenRouter analytics (e.g., `HyperAI`). | *Optional* |
| `ALLOWED_ORIGIN` | Restricts access to specific frontend domains (e.g., `https://vercel.app`). | *Recommended* |

> ⚠️ **CRITICAL SECURITY NOTE:** Never commit your actual `.env` file or raw API keys to GitHub. Keep them safely stored within Vercel's encrypted dashboard.

## 📦 Local Deployment

1. **Clone the repository:**
   ```bash
   git clone https://github.com
   cd hyperai-openrouter-backend
   ```

2. **Configure environment variables:**
   Create a `.env` file in the root directory based on `.env.example`:
   ```env
   OPENROUTER_API_KEY=your_secret_key_here
   OPENROUTER_APP_TITLE=HyperAI-Console
   ```

3. **Deploy via Vercel CLI:**
   ```bash
   npm i -g vercel
   vercel
   ```

---
*Built with passion by **Hanzet22**. Designed to keep the AI conversations flowing when commercial limits kick in.*