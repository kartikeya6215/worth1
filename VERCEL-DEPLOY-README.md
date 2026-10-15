# Simple Vercel deployment

This project has been simplified for deployment:
- Build command is `npm run build` (`vite build`).
- Database migrations are no longer run automatically during the Vercel build. The supplied app environment says `deploy.database` is false.
- Vercel should install both dependencies and devDependencies, so do not use `npm install --omit=dev`.

## Deploy from GitHub
1. Unzip this project on your computer.
2. Copy/replace the project files in the root of the GitHub repository. Keep the `src`, `scripts`, `public` (if present), `migrations` (if present), `package.json`, and `vite.config.ts` paths intact.
3. Commit and push the changes to the branch connected to Vercel.
4. In Vercel → Project → Settings → Build & Deployment:
   - Root Directory: `.` (repository root)
   - Build Command: `npm run build`
   - Install Command: leave default, or use `npm install`
   - Output Directory: leave empty/default for TanStack Start/Nitro.
5. Redeploy the latest commit without using the old build cache.

## Important
If the app uses a database in production, configure the required database environment variables and run migrations as a separate deployment step. This simplified build intentionally does not run `npm run db:migrate` automatically.
