# Medha AI Web

Vercel-ready Next.js migration of Medha AI.

## Start

```powershell
npm install
npm run dev
```

Then open http://localhost:3000.

## Required secrets

Copy values into `.env.local`.

- `GROQ_API_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Optional:
- `TAVILY_API_KEY` for web search.

## Avatar

Place your selected Medha image at:

`public/medha-avatar.png`

The UI falls back to a gradient "M" if the file is not present.

## Supabase

This starter expects your existing `conversations` and `messages` tables. The server API uses the service role key, never the browser.

Document RAG endpoints are scaffolded but intentionally return 501 until the Python Chroma pipeline is migrated to a persistent Vercel-compatible vector backend such as Supabase pgvector.
