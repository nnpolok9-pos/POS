# Deployment Notes

This repository has been prepared so source code can be pushed safely while keeping server-specific runtime data on the VPS.

## What Git Should Ignore

The repository now ignores:

- Environment files: `.env`, `.env.*`
- Dependency folders: `node_modules/`
- Runtime uploads and images: `uploads/`, `images/`, `product-images/`, `server/src/uploads/`
- Logs: `logs/`, `*.log`
- Temporary and generated output: `tmp/`, `cache/`, `dist/`, `build/`, `.mysql-test/`, `server/.mongo-data/`, `server/node_modules/.cache/`
- Database dumps and backups: `*.sql`, `*.bak`

## Files That Must Exist On The Server

Keep these server-side files and folders in place:

- `server/.env`
- `client/.env` if your production frontend build or local admin workflow uses it
- `server/src/uploads/products/`
- `server/src/uploads/settings/`
- Any PM2 process configuration that exists on the server outside this repo
- Nginx site configuration and SSL files outside this repo

## Local Setup

Server:

```bash
cd server
cp .env.example .env
```

Client:

```bash
cd client
cp .env.example .env
```

Then install dependencies and run your normal development workflow.

## Local Verification Before Push

Start the local server and client first, then run:

```bash
npm run verify:local
```

For a faster repository-only safety check that does not require the app to be running:

```bash
npm run verify:repo
```

This verification checks:

- Required repository safety files exist
- `.gitignore` includes the critical ignore rules
- The client builds successfully
- The local client URL responds
- The API health route responds
- Public shop settings and menu endpoints respond
- A real login works
- Authenticated dashboard, products, and orders endpoints respond

If your local admin password is different, run with:

```bash
VERIFY_EMAIL=your-admin@email.com VERIFY_PASSWORD=your-password npm run verify:local
```

## Push Guard

You can install a local pre-push hook so Git blocks unsafe pushes:

```bash
npm run setup:push-guard
```

What it does:

- Always runs `npm run verify:repo` before `git push`
- Optionally runs `node scripts/verify-local.js` too when `VERIFY_PUSH_LOCAL=1`

Example with full local smoke verification:

```bash
VERIFY_PUSH_LOCAL=1 git push
```

There is also a GitHub Actions workflow in [.github/workflows/deploy-safety.yml](/D:/Codex/POS/.github/workflows/deploy-safety.yml) that runs the repository verification on push and pull request.

## Deployment Workflow

Recommended flow:

1. Develop locally.
2. Commit only source-code changes.
3. Push to GitHub.
4. On the VPS, pull the latest code.
5. Install dependencies only if `package.json` or `package-lock.json` changed.
6. Rebuild the frontend if needed.
7. Restart or reload the existing PM2 process.

For a Hostinger VPS command sheet and PM2 example file, see [HOSTINGER-VPS-DEPLOY.md](/D:/Codex/POS/HOSTINGER-VPS-DEPLOY.md) and [ecosystem.config.example.cjs](/D:/Codex/POS/deploy/ecosystem.config.example.cjs).

Recommended deploy sequence on the VPS:

```bash
cd /path/to/app
git rev-parse HEAD
cp server/.env server/.env.backup
npm --prefix server install
npm --prefix client install
npm --prefix client run build
pm2 reload <your-process-name>
```

After reload, smoke-check:

```bash
curl http://127.0.0.1:5000/api/health
```

Then open the live site and verify:

- Login works
- Product images load
- POS opens
- Orders page opens
- Reports page opens
- Customer menu opens

If your deploy process uses a separate server and client directory layout, keep the same order: pull, install only what changed, build client, then reload PM2.

## Rollback Preparation

Before every live deployment:

- Record the current commit hash
- Back up `server/.env`
- Back up `server/src/uploads/`
- Take a MySQL backup using your normal database backup process

If the new deploy fails, return to the last known-good commit, restore the environment file and uploads if needed, rebuild the client, and reload PM2.

## Important Warnings

- Do not commit real secrets.
- Do not overwrite `server/.env` on the VPS.
- Do not delete or replace `server/src/uploads/`; it contains live product and settings images.
- Do not edit production server code directly unless it is an emergency hotfix and you also backport that change to Git.
- Do not store database dumps, ad-hoc backups, or server logs in Git.

## Notes For This Project

- The backend currently reads MySQL settings from `server/.env`.
- The Express server serves live images from `server/src/uploads/` through the `/uploads` route.
- The frontend builds image URLs from `VITE_SERVER_URL`, so upload paths must remain stable.
- No PM2 ecosystem file was found in this repository during inspection, so PM2 should continue to be managed by the server's existing process setup.
