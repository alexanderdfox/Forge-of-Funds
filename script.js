/*
  Forge of Funds
  Backend expectations:
  - POST /api/create_link_token -> { link_token }
  - POST /api/exchange_public_token { public_token } -> { item_id }
  - GET /api/transactions/sync -> { added, modified, removed }
*/
const BANK_SYNC_ENDPOINT = "/api/transactions/sync";
const PLAID_LINK_ENDPOINT = "/api/create_link_token";
const PLAID_EXCHANGE_ENDPOINT = "/api/exchange_public_token";

const STORAGE_KEY = "forge-of-funds-v1";
const PARTS = ["blade", "guard", "grip", "pommel", "gem"];
const PART_COLORS = {
  blade: "--blade",
  guard: "--guard",
  grip: "--grip",
  pommel: "--pommel",
  gem: "--gem",
};

const LESSONS = [
  { id: "lesson-1", title: "Needs vs Wants", text: "Needs keep your forge running. Wants are optional upgrades.", level: 1 },
  { id: "lesson-2", title: "Pay Yourself", text: "Save a little first so your gem keeps growing.", level: 2 },
  { id: "lesson-3", title: "Emergency Gem", text: "A small buffer beats a big surprise.", level: 3 },
  { id: "lesson-4", title: "Goal Splitting", text: "Break big goals into mini quests to stay motivated.", level: 4 },
  { id: "lesson-5", title: "Spending Spikes", text: "Watch for one big purchase that can reset a streak.", level: 5 },
];

const COSMETICS = [
  { id: "skin-bronze", name: "Bronze Hilt", rule: "Reach level 2" },
  { id: "aura-azure", name: "Azure Aura", rule: "7-day check-in streak" },
  { id: "crest-guardian", name: "Guardian Crest", rule: "Enable guardian mode" },
  { id: "gemshine", name: "Gemshine", rule: "Save 10% in 30 days" },
  { id: "boss-slayer", name: "Boss Slayer", rule: "Defeat monthly boss" },
];

const DEFAULT_MAPPING = {
  income: "blade",
  housing: "guard",
  utilities: "guard",
  groceries: "grip",
  transport: "grip",
  dining: "pommel",
  entertainment: "pommel",
  health: "guard",
  shopping: "blade",
  savings: "gem",
  other: "gem",
};

const DEFAULT_DATA = {
  apiStatus: "Demo data active",
  mapping: DEFAULT_MAPPING,
  targets: {},
  streaks: { daily: 0, lastCheckIn: null },
  ceremonies: { lastWeekly: null, lastMonthly: null },
  cosmeticsUnlocked: [],
  lessonsUnlocked: [],
  guardian: {
    mode: false,
    match: false,
    approval: false,
    safeSharing: false,
  },
  transactions: [
    { id: "t1", date: "2026-03-02", name: "Brightforge Payroll", amount: 2600, type: "credit", category: "income" },
    { id: "t2", date: "2026-03-03", name: "Moonlight Rent", amount: 1200, type: "debit", category: "housing" },
    { id: "t3", date: "2026-03-04", name: "Crystal Utilities", amount: 180, type: "debit", category: "utilities" },
    { id: "t4", date: "2026-03-05", name: "Grove Groceries", amount: 240, type: "debit", category: "groceries" },
    { id: "t5", date: "2026-03-07", name: "Skyrail Pass", amount: 110, type: "debit", category: "transport" },
    { id: "t6", date: "2026-03-08", name: "Dragonscale Cinema", amount: 45, type: "debit", category: "entertainment" },
    { id: "t7", date: "2026-03-09", name: "Health Guild", amount: 95, type: "debit", category: "health" },
    { id: "t8", date: "2026-03-10", name: "Potion Cafe", amount: 32, type: "debit", category: "dining" },
    { id: "t9", date: "2026-03-12", name: "Forge Supplies", amount: 120, type: "debit", category: "shopping" },
    { id: "t10", date: "2026-03-14", name: "Savings Vault", amount: 260, type: "debit", category: "savings" },
  ],
};

const state = loadState();
const apiStatusEl = document.getElementById("api-status");
const inflowEl = document.getElementById("inflow");
const outflowEl = document.getElementById("outflow");
const swordLevelEl = document.getElementById("sword-level");
const forgeXpEl = document.getElementById("forge-xp");
const progressFillEl = document.getElementById("progress-fill");
const progressHintEl = document.getElementById("progress-hint");
const mapTableEl = document.getElementById("map-table");
const ledgerEl = document.getElementById("ledger");
const questLogEl = document.getElementById("quest-log");
const bossGridEl = document.getElementById("boss-grid");
const bossSummaryEl = document.getElementById("boss-summary");
const searchEl = document.getElementById("search");
const typeFilterEl = document.getElementById("type-filter");
const swordCanvas = document.getElementById("sword");
const particleCanvas = document.getElementById("particles");
const dailyCheckBtn = document.getElementById("daily-check");
const dailyStreakEl = document.getElementById("daily-streak");
const weeklyRecapBtn = document.getElementById("weekly-recap");
const weeklyLogEl = document.getElementById("weekly-log");
const monthlyCeremonyBtn = document.getElementById("monthly-ceremony");
const monthlyLogEl = document.getElementById("monthly-log");
const questlinesEl = document.getElementById("questlines");
const lessonsEl = document.getElementById("lessons");
const cosmeticsEl = document.getElementById("cosmetics");
const guardianModeEl = document.getElementById("guardian-mode");
const guardianMatchEl = document.getElementById("guardian-match");
const guardianApprovalEl = document.getElementById("guardian-approval");
const safeSharingEl = document.getElementById("safe-sharing");
const guardianLogEl = document.getElementById("guardian-log");

const connectBtn = document.getElementById("connect-bank");
const syncBtn = document.getElementById("sync-bank");
const importInput = document.getElementById("import-data");

let particleColor = getCss("--gem");
const particles = [];
let animationHandle = null;

connectBtn.addEventListener("click", async () => {
  if (!window.Plaid) {
    state.apiStatus = "Plaid Link not loaded";
    persist();
    render();
    return;
  }

  try {
    const response = await fetch(PLAID_LINK_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "forge-user" }),
    });
    const data = await response.json();
    if (!data.link_token) {
      state.apiStatus = "Failed to create link token";
      persist();
      render();
      return;
    }

    const handler = window.Plaid.create({
      token: data.link_token,
      onSuccess: async (public_token) => {
        await exchangePublicToken(public_token);
      },
      onExit: () => {
        state.apiStatus = "Plaid Link closed";
        persist();
        render();
      },
    });

    handler.open();
  } catch (error) {
    state.apiStatus = "Plaid Link failed";
    persist();
    render();
  }
});

syncBtn.addEventListener("click", async () => {
  await syncTransactions();
});

importInput.addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  const text = await file.text();
  if (file.name.endsWith(".json")) {
    try {
      const json = JSON.parse(text);
      state.transactions = normalizeTransactions(json);
    } catch (error) {
      state.apiStatus = "JSON import failed";
    }
  } else {
    state.transactions = parseCsv(text);
  }
  state.apiStatus = "Imported transactions";
  persist();
  render();
  importInput.value = "";
});

searchEl.addEventListener("input", render);
typeFilterEl.addEventListener("change", render);

if (dailyCheckBtn) {
  dailyCheckBtn.addEventListener("click", () => {
    const today = todayIso();
    if (state.streaks.lastCheckIn === today) {
      weeklyLogEl.textContent = "Already checked in today.";
      return;
    }

    if (isYesterday(state.streaks.lastCheckIn, today)) {
      state.streaks.daily += 1;
    } else {
      state.streaks.daily = 1;
    }
    state.streaks.lastCheckIn = today;
    persist();
    render();
  });
}

if (weeklyRecapBtn) {
  weeklyRecapBtn.addEventListener("click", () => {
    const recap = buildWeeklyRecap();
    state.ceremonies.lastWeekly = todayIso();
    weeklyLogEl.textContent = recap;
    persist();
    render();
  });
}

if (monthlyCeremonyBtn) {
  monthlyCeremonyBtn.addEventListener("click", () => {
    const summary = runMonthlyCeremony();
    monthlyLogEl.textContent = summary;
    persist();
    render();
  });
}

if (guardianModeEl) {
  guardianModeEl.addEventListener("change", () => {
    state.guardian.mode = guardianModeEl.checked;
    persist();
    render();
  });
  guardianMatchEl.addEventListener("change", () => {
    state.guardian.match = guardianMatchEl.checked;
    persist();
    render();
  });
  guardianApprovalEl.addEventListener("change", () => {
    state.guardian.approval = guardianApprovalEl.checked;
    persist();
    render();
  });
  safeSharingEl.addEventListener("change", () => {
    state.guardian.safeSharing = safeSharingEl.checked;
    persist();
    render();
  });
}

async function exchangePublicToken(publicToken) {
  try {
    const response = await fetch(PLAID_EXCHANGE_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ public_token: publicToken }),
    });
    if (!response.ok) throw new Error("exchange failed");
    state.apiStatus = "Bank linked";
    persist();
    render();
    await syncTransactions();
  } catch (error) {
    state.apiStatus = "Token exchange failed";
    persist();
    render();
  }
}

async function syncTransactions() {
  try {
    const response = await fetch(BANK_SYNC_ENDPOINT);
    if (!response.ok) throw new Error("sync failed");
    const payload = await response.json();
    const incoming = normalizePlaidTransactions([
      ...(payload.added || []),
      ...(payload.modified || []),
    ]);
    const removed = new Set((payload.removed || []).map((item) => item.transaction_id));
    state.transactions = mergeTransactions(state.transactions, incoming, removed);
    state.apiStatus = "Bank API synced";
    persist();
    render();
  } catch (error) {
    state.apiStatus = "Sync failed (check backend)";
    persist();
    render();
  }
}

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return structuredClone(DEFAULT_DATA);
  try {
    const parsed = JSON.parse(saved);
    return {
      apiStatus: parsed.apiStatus || DEFAULT_DATA.apiStatus,
      mapping: { ...DEFAULT_MAPPING, ...(parsed.mapping || {}) },
      targets: parsed.targets || {},
      streaks: { ...DEFAULT_DATA.streaks, ...(parsed.streaks || {}) },
      ceremonies: { ...DEFAULT_DATA.ceremonies, ...(parsed.ceremonies || {}) },
      cosmeticsUnlocked: parsed.cosmeticsUnlocked || [],
      lessonsUnlocked: parsed.lessonsUnlocked || [],
      guardian: { ...DEFAULT_DATA.guardian, ...(parsed.guardian || {}) },
      transactions: parsed.transactions?.length ? parsed.transactions : DEFAULT_DATA.transactions,
    };
  } catch (error) {
    return structuredClone(DEFAULT_DATA);
  }
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function isYesterday(isoDate, today) {
  if (!isoDate) return false;
  const current = new Date(today);
  const previous = new Date(current);
  previous.setDate(current.getDate() - 1);
  return isoDate === previous.toISOString().slice(0, 10);
}

function normalizeTransactions(data) {
  if (!Array.isArray(data)) return [];
  return data
    .map((item, index) => ({
      id: String(item.id || `t-${index}`),
      date: item.date || new Date().toISOString().slice(0, 10),
      name: item.name || "Unknown",
      amount: Math.abs(Number(item.amount || 0)),
      type: item.type === "credit" ? "credit" : "debit",
      category: (item.category || "other").toLowerCase(),
    }))
    .filter((item) => item.amount > 0);
}

function normalizePlaidTransactions(data) {
  if (!Array.isArray(data)) return [];
  return data.map((tx) => {
    const amount = Number(tx.amount || 0);
    const type = amount < 0 ? "credit" : "debit";
    return {
      id: tx.transaction_id || crypto.randomUUID(),
      date: tx.date || new Date().toISOString().slice(0, 10),
      name: tx.merchant_name || tx.name || "Unknown",
      amount: Math.abs(amount),
      type,
      category: mapPlaidCategory(tx) || "other",
    };
  });
}

function mapPlaidCategory(tx) {
  const pfc = tx.personal_finance_category?.primary?.toLowerCase() || "";
  if (pfc.includes("income")) return "income";
  if (pfc.includes("rent") || pfc.includes("mortgage")) return "housing";
  if (pfc.includes("utilities")) return "utilities";
  if (pfc.includes("food") || pfc.includes("restaurant")) return "dining";
  if (pfc.includes("transport")) return "transport";
  if (pfc.includes("entertainment") || pfc.includes("recreation")) return "entertainment";
  if (pfc.includes("medical") || pfc.includes("health")) return "health";
  if (pfc.includes("general_merchandise") || pfc.includes("shopping")) return "shopping";
  if (pfc.includes("loan") || pfc.includes("credit")) return "housing";
  if (pfc.includes("transfer_in")) return "income";
  if (pfc.includes("transfer_out")) return "savings";
  return (tx.category?.[0] || "other").toLowerCase();
}

function mergeTransactions(existing, incoming, removedSet) {
  const map = new Map();
  existing.forEach((tx) => {
    if (!removedSet || !removedSet.has(tx.id)) {
      map.set(tx.id, tx);
    }
  });
  incoming.forEach((tx) => map.set(tx.id, tx));
  return Array.from(map.values()).sort((a, b) => (a.date < b.date ? 1 : -1));
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  return lines.slice(1).map((line, index) => {
    const values = line.split(",");
    const row = {};
    headers.forEach((header, i) => {
      row[header] = values[i]?.trim();
    });
    return {
      id: `csv-${index}`,
      date: row.date || new Date().toISOString().slice(0, 10),
      name: row.name || "Unknown",
      amount: Math.abs(Number(row.amount || 0)),
      type: row.type === "credit" ? "credit" : "debit",
      category: (row.category || "other").toLowerCase(),
    };
  });
}

function formatMoney(value) {
  return `$${value.toFixed(2)}`;
}

function last30Days(transactions) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  return transactions.filter((tx) => new Date(tx.date) >= cutoff);
}

function last7Days(transactions) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);
  return transactions.filter((tx) => new Date(tx.date) >= cutoff);
}

function computeTotals(transactions) {
  return transactions.reduce(
    (acc, tx) => {
      if (tx.type === "credit") {
        acc.inflow += tx.amount;
      } else {
        acc.outflow += tx.amount;
      }
      return acc;
    },
    { inflow: 0, outflow: 0 }
  );
}

function computePartTotals(transactions, mapping) {
  return transactions.reduce((acc, tx) => {
    if (tx.type !== "debit") return acc;
    const part = mapping[tx.category] || "gem";
    acc[part] = (acc[part] || 0) + tx.amount;
    return acc;
  }, {});
}

function computeCategoryTotals(transactions) {
  return transactions.reduce((acc, tx) => {
    if (tx.type !== "debit") return acc;
    acc[tx.category] = (acc[tx.category] || 0) + tx.amount;
    return acc;
  }, {});
}

function computeLevel(outflow, bonusXp) {
  const totalXp = Math.max(0, outflow + bonusXp);
  const level = Math.max(1, Math.floor(totalXp / 500));
  const next = (level + 1) * 500;
  const progress = Math.min(1, totalXp / next);
  return { level, progress, xp: Math.floor(totalXp) };
}

function ensureTargets(categoryTotals) {
  let changed = false;
  Object.entries(categoryTotals).forEach(([category, amount]) => {
    if (state.targets[category] == null) {
      state.targets[category] = Math.round(amount);
      changed = true;
    }
  });
  return changed;
}

function renderMap(categoryTotals) {
  mapTableEl.innerHTML = "";
  const categories = Array.from(
    new Set(state.transactions.map((tx) => tx.category))
  ).sort();
  categories.forEach((category) => {
    const row = document.createElement("div");
    row.className = "map-row";

    const label = document.createElement("span");
    label.textContent = category;

    const select = document.createElement("select");
    PARTS.forEach((part) => {
      const option = document.createElement("option");
      option.value = part;
      option.textContent = part;
      if ((state.mapping[category] || "gem") === part) {
        option.selected = true;
      }
      select.appendChild(option);
    });
    select.addEventListener("change", () => {
      state.mapping[category] = select.value;
      persist();
      render();
    });

    const targetInput = document.createElement("input");
    targetInput.type = "number";
    targetInput.min = "0";
    targetInput.step = "1";
    targetInput.placeholder = "Target";
    targetInput.value = state.targets[category] ?? "";
    targetInput.addEventListener("change", () => {
      const value = Number(targetInput.value || 0);
      state.targets[category] = value;
      persist();
      render();
    });

    row.append(label, select, targetInput);
    mapTableEl.appendChild(row);
  });
}

function renderLedger() {
  const query = searchEl.value.trim().toLowerCase();
  const typeFilter = typeFilterEl.value;
  const filtered = state.transactions.filter((tx) => {
    const matchesQuery =
      !query ||
      tx.name.toLowerCase().includes(query) ||
      tx.category.toLowerCase().includes(query);
    const matchesType = typeFilter === "all" || tx.type === typeFilter;
    return matchesQuery && matchesType;
  });

  ledgerEl.innerHTML = "";
  const header = document.createElement("div");
  header.className = "row header";
  header.innerHTML = "<span>Date</span><span>Merchant</span><span>Category</span><span>Flow</span><span>Forge Part</span>";
  ledgerEl.appendChild(header);

  filtered.forEach((tx) => {
    const row = document.createElement("div");
    row.className = "row";
    const part = state.mapping[tx.category] || "gem";
    row.innerHTML = `
      <span>${tx.date}</span>
      <span>${tx.name}</span>
      <span>${tx.category}</span>
      <span class="tag ${tx.type}">${tx.type === "credit" ? "+" : "-"}${formatMoney(tx.amount)}</span>
      <span>${part}</span>
    `;
    ledgerEl.appendChild(row);
  });
}

function drawSword(partLevels) {
  const ctx = swordCanvas.getContext("2d");
  const scale = 6;
  const grid = [
    ".....g.....",
    ".....g.....",
    ".....b.....",
    ".....b.....",
    ".....b.....",
    ".....b.....",
    "....bbb....",
    "....bbb....",
    "....bbb....",
    "....bbb....",
    "....bbb....",
    "....bbb....",
    "....bbb....",
    "....bbb....",
    "....bbb....",
    "....bbb....",
    "....bbb....",
    "....bbb....",
    "...bbbbb...",
    "...bbbbb...",
    "....bbb....",
    "....bbb....",
    "....bbb....",
    "....bbb....",
    "....bbb....",
    "....bbb....",
    "....bbb....",
    "....bbb....",
    "....bbb....",
    "...ggggg...",
    "....ggg....",
    ".....g.....",
    ".....p.....",
    ".....p.....",
    ".....p.....",
    ".....p.....",
    ".....p.....",
    "....ppp....",
  ];

  const colors = {
    b: colorForLevel(getCss("--blade"), partLevels.blade || 0),
    g: colorForLevel(getCss("--guard"), partLevels.guard || 0),
    p: colorForLevel(getCss("--grip"), partLevels.grip || 0),
    m: colorForLevel(getCss("--pommel"), partLevels.pommel || 0),
    x: colorForLevel(getCss("--gem"), partLevels.gem || 0),
  };

  const pommelStart = grid.length - 6;
  ctx.clearRect(0, 0, swordCanvas.width, swordCanvas.height);
  ctx.fillStyle = "#120e14";
  ctx.fillRect(0, 0, swordCanvas.width, swordCanvas.height);

  grid.forEach((row, y) => {
    row.split("").forEach((cell, x) => {
      if (cell === ".") return;
      let key = cell;
      if (y >= pommelStart && cell === "p") {
        key = "m";
      }
      const color = colors[key] || getCss("--blade");
      ctx.fillStyle = color;
      ctx.fillRect(x * scale, y * scale, scale, scale);
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.fillRect(x * scale, y * scale, scale, 1);
    });
  });

  ctx.fillStyle = colorForLevel(getCss("--gem"), partLevels.gem || 0.2);
  ctx.fillRect(5 * scale, 0, scale, scale);
}

function updateParticles(strongestPart) {
  particleColor = getCss(PART_COLORS[strongestPart] || "--gem");
  if (!animationHandle) {
    animationHandle = requestAnimationFrame(stepParticles);
  }
}

function stepParticles() {
  const ctx = particleCanvas.getContext("2d");
  const width = particleCanvas.width;
  const height = particleCanvas.height;
  ctx.clearRect(0, 0, width, height);

  if (Math.random() < 0.4) {
    particles.push({
      x: width / 2 + (Math.random() - 0.5) * 40,
      y: height - 40,
      vx: (Math.random() - 0.5) * 0.6,
      vy: -1.2 - Math.random(),
      life: 90,
      size: 3 + Math.random() * 2,
      color: particleColor,
    });
  }

  for (let i = particles.length - 1; i >= 0; i -= 1) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.life -= 1;
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, p.size, p.size);
    if (p.life <= 0 || p.y < -10) {
      particles.splice(i, 1);
    }
  }

  animationHandle = requestAnimationFrame(stepParticles);
}

function colorForLevel(base, level) {
  const factor = 0.5 + Math.min(1, level) * 0.5;
  const rgb = hexToRgb(base);
  const shaded = rgb.map((c) => Math.min(255, Math.floor(c * factor + 20)));
  return `rgb(${shaded[0]}, ${shaded[1]}, ${shaded[2]})`;
}

function hexToRgb(hex) {
  const value = hex.replace("#", "");
  return [
    parseInt(value.slice(0, 2), 16),
    parseInt(value.slice(2, 4), 16),
    parseInt(value.slice(4, 6), 16),
  ];
}

function getCss(variable) {
  return getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
}

function renderQuestLog(totals, partTotals, bossOverage) {
  const strongest = Object.entries(partTotals).sort((a, b) => b[1] - a[1])[0];
  const weakest = Object.entries(partTotals).sort((a, b) => a[1] - b[1])[0];
  const lines = [];

  lines.push("Quest: Temper the Blade");
  lines.push(`Gold in: ${formatMoney(totals.inflow)} | Gold out: ${formatMoney(totals.outflow)}`);
  if (strongest) {
    lines.push(`Strongest forge part: ${strongest[0]} (${formatMoney(strongest[1])}).`);
  }
  if (weakest) {
    lines.push(`Weakest forge part: ${weakest[0]} (${formatMoney(weakest[1])}).`);
  }
  lines.push(`Boss HP remaining: ${formatMoney(bossOverage)}.`);
  lines.push("Advice: Balance your categories to craft a legendary sword.");
  questLogEl.textContent = lines.join("\n");
}

function renderBoss(categoryTotals) {
  bossGridEl.innerHTML = "";
  const sorted = Object.entries(categoryTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  let bossOverage = 0;
  sorted.forEach(([category, amount]) => {
    const target = Number(state.targets[category] || 0);
    const ratio = target > 0 ? Math.min(1, amount / target) : 0;
    const overage = Math.max(0, amount - target);
    bossOverage += overage;

    const row = document.createElement("div");
    row.className = "boss-row";

    const name = document.createElement("span");
    name.textContent = category;

    const bar = document.createElement("div");
    bar.className = "boss-bar";
    const fill = document.createElement("div");
    fill.className = "boss-fill";
    fill.style.width = `${Math.floor(ratio * 100)}%`;
    bar.appendChild(fill);

    const stateLabel = document.createElement("span");
    stateLabel.className = "boss-state";
    stateLabel.textContent = target === 0 ? "Set target" : amount <= target ? "Defeated" : `-${formatMoney(overage)}`;

    row.append(name, bar, stateLabel);
    bossGridEl.appendChild(row);
  });

  if (!sorted.length) {
    bossSummaryEl.textContent = "Add transactions to summon the boss.";
  } else if (bossOverage === 0) {
    bossSummaryEl.textContent = "Boss defeated! All tracked categories are within target.";
  } else {
    bossSummaryEl.textContent = `Boss HP remaining: ${formatMoney(bossOverage)}.`;
  }

  return bossOverage;
}

function buildWeeklyRecap() {
  const recent = last7Days(state.transactions);
  const totals = computeTotals(recent);
  const categoryTotals = computeCategoryTotals(recent);
  const topCategory = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0];
  const lines = [];
  lines.push("Weekly recap:");
  lines.push(`Gold out this week: ${formatMoney(totals.outflow)}.`);
  if (topCategory) {
    lines.push(`Top category: ${topCategory[0]} (${formatMoney(topCategory[1])}).`);
  }
  lines.push("Suggestion: Pick one category and set a target you can beat next week.");
  return lines.join("\n");
}

function runMonthlyCeremony() {
  const currentMonth = todayIso().slice(0, 7);
  if (state.ceremonies.lastMonthly === currentMonth) {
    return "Ceremony already held this month.";
  }
  state.ceremonies.lastMonthly = currentMonth;

  const unlocked = unlockNextCosmetic();
  const lesson = unlockNextLesson();
  const lines = ["Monthly ceremony complete!"];
  if (unlocked) lines.push(`Unlocked cosmetic: ${unlocked}.`);
  if (lesson) lines.push(`New lesson: ${lesson}.`);
  if (!unlocked && !lesson) lines.push("Keep forging to unlock more rewards.");
  return lines.join("\n");
}

function unlockNextCosmetic() {
  const locked = COSMETICS.find((item) => !state.cosmeticsUnlocked.includes(item.id));
  if (!locked) return null;
  state.cosmeticsUnlocked.push(locked.id);
  return locked.name;
}

function unlockNextLesson() {
  const locked = LESSONS.find((item) => !state.lessonsUnlocked.includes(item.id));
  if (!locked) return null;
  state.lessonsUnlocked.push(locked.id);
  return locked.title;
}

function renderQuestlines(metrics) {
  questlinesEl.innerHTML = "";
  metrics.forEach((quest) => {
    const card = document.createElement("div");
    card.className = "quest-card";
    const status = quest.complete ? "Complete" : "In progress";
    card.innerHTML = `
      <h3>${quest.title}</h3>
      <p class="quest-meta">${quest.description}</p>
      <p class="quest-meta">Progress: ${quest.progress}</p>
      <span class="badge">${status}</span>
    `;
    questlinesEl.appendChild(card);
  });
}

function renderLessons(level) {
  lessonsEl.innerHTML = "";
  const available = LESSONS.filter((lesson) => lesson.level <= level);
  available.forEach((lesson) => {
    const card = document.createElement("div");
    card.className = "lesson-card";
    card.innerHTML = `
      <h3>${lesson.title}</h3>
      <p class="quest-meta">${lesson.text}</p>
    `;
    lessonsEl.appendChild(card);
  });
  if (!available.length) {
    lessonsEl.innerHTML = "<div class=\"lesson-card\">Keep forging to unlock your first lesson.</div>";
  }
}

function renderCosmetics(unlockFlags) {
  cosmeticsEl.innerHTML = "";
  COSMETICS.forEach((item) => {
    const unlocked = unlockFlags.has(item.id);
    const card = document.createElement("div");
    card.className = `cosmetic-card${unlocked ? "" : " cosmetic-locked"}`;
    card.innerHTML = `
      <h3>${item.name}</h3>
      <p class="quest-meta">${item.rule}</p>
      <span class="badge">${unlocked ? "Unlocked" : "Locked"}</span>
    `;
    cosmeticsEl.appendChild(card);
  });
}

function renderGuardianLog(largeDebits, safeShareText) {
  const lines = [];
  lines.push(`Guardian mode: ${state.guardian.mode ? "on" : "off"}.`);
  if (state.guardian.match) {
    lines.push("Savings match active: extra XP on savings deposits.");
  }
  if (state.guardian.approval) {
    lines.push(`Large purchase approvals needed: ${largeDebits.length}.`);
  }
  if (state.guardian.safeSharing && safeShareText) {
    lines.push("Safe share:");
    lines.push(safeShareText);
  }
  guardianLogEl.textContent = lines.join("\n");
}

function buildQuestMetrics(categoryTotals, totals, bossOverage) {
  const totalOut = Math.max(1, totals.outflow);
  const entries = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]);
  const top = entries[0];
  const savings = categoryTotals.savings || 0;
  const savingsRatio = savings / totalOut;
  const topRatio = top ? top[1] / totalOut : 0;

  return [
    {
      title: "Balance the Blade",
      description: "Keep any single category under 35% of total spending.",
      progress: `${Math.round(topRatio * 100)}% (goal 35%)`,
      complete: topRatio <= 0.35,
    },
    {
      title: "Gem Reserve",
      description: "Save at least 5% of outflow this month.",
      progress: `${Math.round(savingsRatio * 100)}% (goal 5%)`,
      complete: savingsRatio >= 0.05,
    },
    {
      title: "Boss Slayer",
      description: "Defeat the monthly boss by staying under targets.",
      progress: bossOverage === 0 ? "Defeated" : `HP remaining ${formatMoney(bossOverage)}`,
      complete: bossOverage === 0,
    },
    {
      title: "Review Ritual",
      description: "Check in daily for 7 days.",
      progress: `${state.streaks.daily}/7 days`,
      complete: state.streaks.daily >= 7,
    },
  ];
}

function computeUnlocks(metrics, level, savingsRatio, bossOverage) {
  const unlocks = new Set(state.cosmeticsUnlocked);
  if (level >= 2) unlocks.add("skin-bronze");
  if (state.streaks.daily >= 7) unlocks.add("aura-azure");
  if (state.guardian.mode) unlocks.add("crest-guardian");
  if (savingsRatio >= 0.1) unlocks.add("gemshine");
  if (bossOverage === 0 && metrics.length) unlocks.add("boss-slayer");
  if (unlocks.size !== state.cosmeticsUnlocked.length) {
    state.cosmeticsUnlocked = Array.from(unlocks);
    persist();
  }
  return unlocks;
}

function render() {
  apiStatusEl.textContent = `Bank API: ${state.apiStatus}`;
  guardianModeEl.checked = state.guardian.mode;
  guardianMatchEl.checked = state.guardian.match;
  guardianApprovalEl.checked = state.guardian.approval;
  safeSharingEl.checked = state.guardian.safeSharing;

  const recent = last30Days(state.transactions);
  const totals = computeTotals(recent);
  const categoryTotals = computeCategoryTotals(recent);
  const partTotals = computePartTotals(recent, state.mapping);
  const strongestPart = Object.entries(partTotals).sort((a, b) => b[1] - a[1])[0]?.[0] || "gem";

  const savingsRatio = (categoryTotals.savings || 0) / Math.max(1, totals.outflow);
  const guardianBonus = state.guardian.match ? Math.round((categoryTotals.savings || 0) * 0.1) : 0;
  const streakBonus = Math.min(150, state.streaks.daily * 5);
  const levelInfo = computeLevel(totals.outflow, guardianBonus + streakBonus);

  inflowEl.textContent = formatMoney(totals.inflow);
  outflowEl.textContent = formatMoney(totals.outflow);
  swordLevelEl.textContent = levelInfo.level;
  forgeXpEl.textContent = levelInfo.xp;
  progressFillEl.style.width = `${Math.floor(levelInfo.progress * 100)}%`;
  progressHintEl.textContent = `Next level at ${formatMoney((levelInfo.level + 1) * 500)}.`;

  const maxPart = Math.max(1, ...Object.values(partTotals));
  const partLevels = PARTS.reduce((acc, part) => {
    acc[part] = (partTotals[part] || 0) / maxPart;
    return acc;
  }, {});

  updateParticles(strongestPart);

  if (ensureTargets(categoryTotals)) {
    persist();
  }

  drawSword(partLevels);
  renderMap(categoryTotals);
  renderLedger();
  const bossOverage = renderBoss(categoryTotals);
  renderQuestLog(totals, partTotals, bossOverage);

  const metrics = buildQuestMetrics(categoryTotals, totals, bossOverage);
  renderQuestlines(metrics);

  renderLessons(levelInfo.level);
  const unlocks = computeUnlocks(metrics, levelInfo.level, savingsRatio, bossOverage);
  renderCosmetics(unlocks);

  dailyStreakEl.textContent = `${state.streaks.daily} days`;

  const largeDebits = recent.filter((tx) => tx.type === "debit" && tx.amount >= 100);
  const safeShareText = state.guardian.safeSharing
    ? `I hit a ${state.streaks.daily}-day streak and completed ${metrics.filter((m) => m.complete).length} quests.`
    : "";
  renderGuardianLog(largeDebits, safeShareText);
}

render();
