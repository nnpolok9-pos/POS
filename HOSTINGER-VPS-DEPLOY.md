# Hostinger VPS Deploy Guide

This guide is designed for this repository's current structure:

- Backend: Node.js + Express + MySQL in `server/`
- Frontend: React + Vite build in `client/`
- Process manager: PM2
- Web server / reverse proxy: Nginx

It does not change your live server automatically. It gives you a safe command sheet and rollout process.

## Assumptions

- Project path on VPS: `/var/www/pos`
- Backend path: `/var/www/pos/server`
- Frontend path: `/var/www/pos/client`
- Backend listens on `127.0.0.1:5000`
- Nginx serves the built frontend and proxies API requests to the backend
- MySQL is already installed and configured on the VPS

Adjust the paths and PM2 process name if your server uses different values.

## First-Time Server Preparation

### 1. Install required packages

```bash
sudo apt update
sudo apt install -y nginx mysql-server
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2
```

### 2. Place the project on the server

```bash
sudo mkdir -p /var/www/pos
sudo chown -R $USER:$USER /var/www/pos
cd /var/www/pos
git clone <your-github-repo-url> .
```

### 3. Create production environment files

Backend:

```bash
cd /var/www/pos/server
cp .env.example .env
nano .env
```

Client:

```bash
cd /var/www/pos/client
cp .env.example .env
nano .env
```

Minimum backend values to confirm:

```env
NODE_ENV=production
PORT=5000
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=fast_food_pos
DB_USER=your_mysql_user
DB_PASSWORD=your_mysql_password
JWT_SECRET=your-long-random-secret
CLIENT_URL=https://your-domain.com
SHOP_NAME=Your Shop Name
SHOP_ADDRESS=Your Shop Address
```

Minimum client values to confirm:

```env
VITE_API_URL=https://your-domain.com/api
VITE_SERVER_URL=https://your-domain.com
VITE_SHOP_NAME=Your Shop Name
```

### 4. Install dependencies and build

```bash
cd /var/www/pos/server
npm install

cd /var/www/pos/client
npm install
npm run build
```

### 5. Start backend with PM2

Option A: direct command

```bash
cd /var/www/pos/server
pm2 start src/server.js --name fast-food-pos-api
pm2 save
pm2 startup
```

Option B: PM2 ecosystem example from this repo

```bash
cd /var/www/pos
cp deploy/ecosystem.config.example.cjs ecosystem.config.cjs
nano ecosystem.config.cjs
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

## Recurring Deployment Workflow

Run this when you push updates from local to GitHub.

### 1. Back up the critical runtime data

```bash
cd /var/www/pos
git rev-parse HEAD
cp server/.env server/.env.backup
tar -czf uploads-backup-$(date +%F-%H%M%S).tar.gz server/src/uploads
```

Take a MySQL backup too:

```bash
mysqldump -u your_mysql_user -p fast_food_pos > pos-backup-$(date +%F-%H%M%S).sql
```

### 2. Pull latest code

```bash
cd /var/www/pos
git pull origin main
```

If your production branch is different, replace `main` with that branch name.

### 3. Install only what the app needs

```bash
cd /var/www/pos/server
npm install

cd /var/www/pos/client
npm install
npm run build
```

### 4. Reload PM2 safely

```bash
pm2 reload fast-food-pos-api
pm2 status
pm2 logs fast-food-pos-api --lines 50
```

If your PM2 process has another name, use that exact name.

## Post-Deploy Smoke Test

### 1. Check backend health from the VPS

```bash
curl http://127.0.0.1:5000/api/health
```

You should get:

```json
{"status":"ok"}
```

### 2. Run the repo smoke test against live URLs

From your local machine or the VPS:

```bash
cd /var/www/pos
VERIFY_CLIENT_URL=https://your-domain.com \
VERIFY_API_URL=https://your-domain.com/api \
VERIFY_EMAIL=admin@yourdomain.com \
VERIFY_PASSWORD=your-password \
npm run verify:remote
```

On Windows PowerShell:

```powershell
$env:VERIFY_CLIENT_URL="https://your-domain.com"
$env:VERIFY_API_URL="https://your-domain.com/api"
$env:VERIFY_EMAIL="admin@yourdomain.com"
$env:VERIFY_PASSWORD="your-password"
npm.cmd run verify:remote
```

### 3. Manual browser checks

Confirm these pages and workflows:

- Login page loads
- Admin login works
- POS page opens
- Orders page opens
- Reports page opens
- Customer menu page opens
- Product images load
- Shop logo loads

## Rollback Procedure

If deployment causes issues:

```bash
cd /var/www/pos
git log --oneline -n 5
git checkout <last-known-good-commit>
cd /var/www/pos/server
cp .env.backup .env
cd /var/www/pos/client
npm install
npm run build
cd /var/www/pos/server
npm install
pm2 reload fast-food-pos-api
```

After the emergency rollback is stable, move the server back to the normal branch-based workflow before the next deployment.

If needed, restore uploads and MySQL from the backups you created before deploy.

## Nginx Notes

This repository does not include a live Nginx config, and I did not modify Nginx settings.

Your Nginx setup should do two things:

- Serve the frontend build from `client/dist`
- Reverse proxy `/api` and `/uploads` to `http://127.0.0.1:5000`

Do not deploy until `/uploads` is proxied correctly, because the app depends on server-stored images.

## Safety Rules For Production

- Never overwrite `server/.env` during deploy
- Never delete `server/src/uploads/`
- Never run destructive Git commands unless you are rolling back intentionally
- Never edit production code directly unless it is an emergency and you also commit the same fix to Git
- Always verify health, login, images, POS, reports, and customer menu after reload
