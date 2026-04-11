# Fast Food POS Web App

Production-ready POS web app for a fast food shop with:

- JWT authentication with `admin` and `staff` roles
- Dynamic product management with image upload
- Real-time inventory deduction on order placement
- Low-stock and out-of-stock handling
- POS checkout, receipt printing, and order history
- Admin sales dashboard with top-selling and low-stock reports

## Tech Stack

- Frontend: React + Vite + Tailwind CSS
- Backend: Node.js + Express
- Database: MySQL
- Uploads: Multer local storage in `server/src/uploads/products`
- Auth: JWT

## Project Structure

```text
server/
  src/
    config/
    controllers/
    lib/
    middleware/
    routes/
    seeds/
    uploads/

client/
  src/
    components/
    context/
    pages/
    services/
    utils/
```

## Setup

### 1. Backend

```bash
cd server
copy .env.example .env
npm install
npm run seed
npm run dev
```

Backend now boots against MySQL using the `DB_*` variables in `server/.env`.

### 2. Frontend

```bash
cd client
copy .env.example .env
npm install
npm run dev
```

### 3. Open the app

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:5000`

## Environment Variables

### `server/.env`

```env
PORT=5000
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=fast_food_pos
DB_USER=root
DB_PASSWORD=
JWT_SECRET=change-this-secret
JWT_EXPIRES_IN=7d
CLIENT_URL=http://localhost:5173
SHOP_NAME=Fast Bites POS
```

### `client/.env`

```env
VITE_API_URL=http://localhost:5000/api
VITE_SERVER_URL=http://localhost:5000
VITE_SHOP_NAME=Fast Bites POS
```

## Seeded Demo Accounts

- Master Admin: `master@fastbites.com` / `master123`
- Admin: `admin@fastbites.com` / `admin123`
- Checker: `checker@fastbites.com` / `checker123`
- Staff: `staff@fastbites.com` / `staff123`

## Sample Products

Seed data is defined in [data.js](/D:/Codex/POS/server/src/seeds/data.js) and includes:

- Classic Burger
- Cheese Burger
- Chicken Burger
- Nugget
- Tinders
- Pepsi Can

## API Endpoints

### Auth

- `POST /api/auth/login`
- `GET /api/auth/me`

### Products

- `POST /api/products`
- `GET /api/products`
- `GET /api/products/admin/all`
- `PUT /api/products/:id`
- `DELETE /api/products/:id`

### Orders

- `POST /api/orders`
- `GET /api/orders`

### Reports

- `GET /api/reports/sales`
- `GET /api/reports/low-stock`
- `GET /api/reports/dashboard`

## Feature Notes

- Products with stock `<= 5` are flagged as low stock in backend data and UI.
- Products with stock `0` become inactive automatically and cannot be sold.
- Images are uploaded with Multer and stored locally.
- The backend uses MySQL and auto-creates the core tables on startup if they do not exist.
- POS product data is cached in `localStorage` for a simple offline fallback.
- Receipt printing uses the browser print flow after checkout.
