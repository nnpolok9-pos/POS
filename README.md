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
- Database: MongoDB + Mongoose
- Uploads: Multer local storage in `server/src/uploads/products`
- Auth: JWT

## Project Structure

```text
server/
  src/
    config/
    controllers/
    middleware/
    models/
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
MONGO_URI=mongodb://127.0.0.1:27017/fast-food-pos
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

- Admin: `admin@fastbites.com` / `admin123`
- Staff: `staff@fastbites.com` / `staff123`

## Sample Products

Seed data is defined in [server/src/seeds/seed.js](/D:/Codex/POS/server/src/seeds/seed.js) and includes:

- Classic Burger
- Cheese Fries
- Cola
- Chicken Wrap
- Vanilla Shake

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
- POS product data is cached in `localStorage` for a simple offline fallback.
- Receipt printing uses the browser print flow after checkout.
