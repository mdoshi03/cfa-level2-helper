# CFA Level II Helper

A Vite + React frontend for CFA Level II reference notes and formula reels, with Supabase persistence.

## Local setup
1. Copy `frontend/.env.example` to `frontend/.env.local`
2. Fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
3. Install frontend dependencies:
   ```bash
   cd frontend
   npm install
   ```
4. Run locally:
   ```bash
   npm run dev
   ```

## Deploy
This repository includes a GitHub Actions workflow that builds `frontend/dist` and deploys to GitHub Pages.

## Environment variables
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Do not commit `frontend/.env.local`.
