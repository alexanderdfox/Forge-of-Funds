# Forge of Funds

Forge of Funds is a teen-friendly, RPG-style banking companion. It turns real transactions into a pixel-art sword, adds quests and streaks, and encourages healthy money habits without shaming or surveillance.

## Features

- Plaid Link + Transactions Sync backend (Express)
- Pixel-art sword renderer with forge particles
- Category-to-forge mapping + targets
- Monthly boss fight based on spending targets
- Daily check-ins, weekly recaps, monthly ceremonies
- Questlines, micro-lessons, cosmetic unlocks
- Guardian Circle toggles with safe-sharing summaries

## Project Structure

- `index.html` — UI layout
- `styles.css` — styling
- `script.js` — frontend logic
- `server/server.js` — Plaid backend
- `server/package.json` — backend deps

## Server Setup (Plaid)

1. Copy `server/.env.example` to `server/.env` and fill in Plaid credentials.
2. Install dependencies and start the server:

```bash
cd server
npm install
npm start
```

3. Open `http://localhost:4242` and click **Connect Bank**.

## Notes

- The Plaid access token is stored in memory in `server/server.js` for demo use. Replace this with a database for production.
- Targets are auto-seeded from the last 30 days of spending and can be edited in the Category-to-Forge map.
- Safe sharing avoids dollar amounts by default.
