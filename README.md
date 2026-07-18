# CFA Level II Helper

A React + Vite frontend for CFA Level II reference formulas and notes, with Supabase persistence and TikTok-style reel scrolling.

## Local setup
1. Copy `frontend/.env.example` to `frontend/.env.local`.
2. Fill in your Supabase values:
   ```text
   VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
   VITE_SUPABASE_ANON_KEY=sb_publishable_x_xxx
   ```
3. Install dependencies:
   ```bash
   cd frontend
   npm install
   ```
4. Run locally:
   ```bash
   npm run dev
   ```

## Deployment
This repo includes a GitHub Actions workflow to build `frontend/dist` and deploy to GitHub Pages.

## Environment variables
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Do not commit `frontend/.env.local`.
