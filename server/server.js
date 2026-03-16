const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const { Configuration, PlaidApi, PlaidEnvironments } = require("plaid");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 4242;
const PLAID_ENV = process.env.PLAID_ENV || "sandbox";
const PLAID_CLIENT_ID = process.env.PLAID_CLIENT_ID || "";
const PLAID_SECRET = process.env.PLAID_SECRET || "";
const PLAID_PRODUCTS = (process.env.PLAID_PRODUCTS || "transactions")
  .split(",")
  .map((p) => p.trim())
  .filter(Boolean);
const PLAID_COUNTRY_CODES = (process.env.PLAID_COUNTRY_CODES || "US")
  .split(",")
  .map((c) => c.trim())
  .filter(Boolean);

if (!PLAID_CLIENT_ID || !PLAID_SECRET) {
  console.warn("Missing PLAID_CLIENT_ID or PLAID_SECRET in environment.");
}

const config = new Configuration({
  basePath: PlaidEnvironments[PLAID_ENV],
  baseOptions: {
    headers: {
      "PLAID-CLIENT-ID": PLAID_CLIENT_ID,
      "PLAID-SECRET": PLAID_SECRET,
    },
  },
});

const plaidClient = new PlaidApi(config);

// Demo in-memory token store. Replace with a database for production.
const store = {
  accessToken: null,
  itemId: null,
  cursor: null,
};

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", plaidEnv: PLAID_ENV });
});

app.post("/api/create_link_token", async (req, res) => {
  try {
    const userId = req.body?.userId || "forge-user";
    const request = {
      user: { client_user_id: userId },
      client_name: "Forge of Funds",
      products: PLAID_PRODUCTS,
      country_codes: PLAID_COUNTRY_CODES,
      language: "en",
    };

    const response = await plaidClient.linkTokenCreate(request);
    res.json({ link_token: response.data.link_token });
  } catch (error) {
    res.status(500).json({ error: "link_token_create_failed" });
  }
});

app.post("/api/exchange_public_token", async (req, res) => {
  try {
    const publicToken = req.body?.public_token;
    if (!publicToken) {
      res.status(400).json({ error: "missing_public_token" });
      return;
    }
    const response = await plaidClient.itemPublicTokenExchange({
      public_token: publicToken,
    });
    store.accessToken = response.data.access_token;
    store.itemId = response.data.item_id;
    store.cursor = null;
    res.json({ item_id: store.itemId });
  } catch (error) {
    res.status(500).json({ error: "public_token_exchange_failed" });
  }
});

app.get("/api/transactions/sync", async (req, res) => {
  if (!store.accessToken) {
    res.status(400).json({ error: "missing_access_token" });
    return;
  }

  try {
    let hasMore = true;
    let cursor = store.cursor;
    const added = [];
    const modified = [];
    const removed = [];

    while (hasMore) {
      const response = await plaidClient.transactionsSync({
        access_token: store.accessToken,
        cursor,
        count: 100,
      });

      added.push(...response.data.added);
      modified.push(...response.data.modified);
      removed.push(...response.data.removed);

      hasMore = response.data.has_more;
      cursor = response.data.next_cursor;
    }

    store.cursor = cursor;

    res.json({
      added,
      modified,
      removed,
      cursor,
    });
  } catch (error) {
    res.status(500).json({ error: "transactions_sync_failed" });
  }
});

app.use(express.static(path.join(__dirname, ".."), { dotfiles: "ignore" }));

app.listen(PORT, () => {
  console.log(`Forge of Funds server running on http://localhost:${PORT}`);
});
