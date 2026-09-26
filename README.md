# HyperAI — OpenRouter Vercel Backend

Architecture:

Browser
  -> /api/chat
  -> Vercel Serverless Function
  -> OpenRouter
  -> selected model

## Secret handling

The browser contains NO OpenRouter API key.

Configure this Vercel environment variable:

OPENROUTER_API_KEY

Never commit the real key to Git.

## Deploy

1. Push this folder/repository to GitHub.
2. Import it into Vercel.
3. In Vercel Project Settings -> Environment Variables, add:
   - OPENROUTER_API_KEY
   - OPENROUTER_APP_TITLE (optional)
   - PUBLIC_APP_URL (recommended)
   - ALLOWED_ORIGIN (optional)
4. Redeploy.

The frontend calls `/api/chat`, not OpenRouter directly.
