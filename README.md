# Ahaalo PMS - Frontend

React + Vite frontend. All hotel data lives in the backend (Node + MongoDB).

- **No localStorage, no mock/seed data.** `src/services/dataStore.js` keeps data in memory only; it is
  downloaded from the backend at start and every save is written back (`src/services/backendSync.js`).
  Only the login session (token/user) is kept in `sessionStorage` so a refresh does not log you out.
- Backend URL: `VITE_API_URL` in `.env` (default `http://localhost:5000/api`).
- API used: `/session/login`, `/store*`, `/public/snapshot`, `/public/bookings`,
  `/public/bookings/:id/self-checkin`, `/notify/event`, `/misc-transactions`, `/ai/chat`, `/ocr/google-vision`.
- `/impersonate` lets the Super Admin panel open a hotel.

```
npm install
npm run dev      # http://localhost:5173
npm test
npm run build
```
