import { initializeApp } from "https://www.gstatic.com/firebasejs/13.3.0/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/13.3.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  increment,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/13.3.0/firebase-firestore.js";

import { initQATestSuite } from "./qa-tests.js?v=1";

const firebaseConfig = {
  apiKey: "AIzaSyBvnVne_IN4LTlFu3ACTeOsbHy1NoPZoZI",
  authDomain: "yertal-abcart.firebaseapp.com",
  projectId: "yertal-abcart",
  storageBucket: "yertal-abcart.firebasestorage.app",
  messagingSenderId: "718412836992",
  appId: "1:718412836992:web:dd02a98edb68df330f3665"
};

const GEMINI_PROXY_URL = "https://script.google.com/macros/s/AKfycbyL-7ToYTJE9hdq9JgIt1GFurVXMYYYuKa77thRp6C5ZYxJtF1n_Po6NIS3Q8uCR_XC/exec";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

const TOP_10_PLATFORMS = [
  { id: "blinkit", name: "Blinkit", prefix: "BLK", searchUrl: "https://blinkit.com/s/?q=", tier: "free" },
  { id: "zepto", name: "Zepto", prefix: "ZPT", searchUrl: "https://www.zeptonow.com/search?query=", tier: "free" },
  { id: "bigbasket", name: "BigBasket", prefix: "BBK", searchUrl: "https://www.bigbasket.com/ps/?q=", tier: "free" },
  { id: "instamart", name: "Swiggy Instamart", prefix: "SWG", searchUrl: "https://www.swiggy.com/instamart/search?custom_back=true&query=", tier: "plus" },
  { id: "amazon", name: "Amazon Fresh", prefix: "AMZ", searchUrl: "https://www.amazon.in/s?k=", tier: "plus" },
  { id: "flipkart", name: "Flipkart Minutes", prefix: "FLP", searchUrl: "https://www.flipkart.com/search?q=", tier: "plus" },
  { id: "jiomart", name: "JioMart", prefix: "JIO", searchUrl: "https://www.jiomart.com/search/", tier: "plus" },
  { id: "dmart", name: "DMart Ready", prefix: "DMR", searchUrl: "https://www.dmart.in/search?searchTerm=", tier: "plus" },
  { id: "pharmeasy", name: "PharmEasy", prefix: "PHM", searchUrl: "https://pharmeasy.in/search/all?name=", tier: "plus" },
  { id: "1mg", name: "Tata 1mg", prefix: "1MG", searchUrl: "https://www.1mg.com/search/all?name=", tier: "plus" }
];

const PREBUILT_ITEMS = [
  { name: "Toned Milk", qty: "1 L" },
  { name: "Whole Wheat Atta", qty: "5 kg" },
  { name: "Toor Dal", qty: "1 kg" },
  { name: "Cold-Pressed Groundnut Oil", qty: "1 L" },
  { name: "Fresh Coriander & Curry Leaves", qty: "1 pack" },
  { name: "Dolo 650 Tablets", qty: "1 strip" },
  { name: "Dishwash Liquid", qty: "750 ml" },
  { name: "Filter Coffee Powder", qty: "250 g" }
];

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const TIER_RULES = {
  free: { label: "FREE", maxLists: 2, maxMembers: 1, allowAutoBuy: false, allowCustomGrid: false, allPlatforms: false },
  plus: { label: "PLUS", maxLists: 10, maxMembers: 5, allowAutoBuy: true, allowCustomGrid: false, allPlatforms: true },
  pro:  { label: "PRO",  maxLists: Infinity, maxMembers: Infinity, allowAutoBuy: true, allowCustomGrid: true, allPlatforms: true }
};

const MODEL_CANDIDATE_CATALOG = [
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-2.5-pro",
  "gemini-2.0-flash-lite",
  "gemini-1.5-flash",
  "gemini-1.5-pro"
];

let currentUser = null;
let workspaceId = null;
let workspaceData = { tier: "free", name: "My Workspace", walletBalance: 0 };
let activeRole = "approver";
let draftItems = [];
let selectedWeekdays = new Set(["Mon", "Thu"]);
let selectedMonths = new Set(["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]);
let allLists = [];
let allMembers = [];
let walletLedger = [];
let allTransactions = [];

let scrollerSpan = "weekly";
let scrollerOffset = 0;

let modelPoolState = {
  default_model: "gemini-2.5-flash",
  backup_model: "gemini-2.0-flash",
  models: [
    { name: "gemini-2.5-flash", role: "default", attempts: 0, successes: 0, successRate: 100 },
    { name: "gemini-2.0-flash", role: "backup",  attempts: 0, successes: 0, successRate: 100 }
  ]
};

export const $ = (id) => document.getElementById(id);

export function showToast(msg) {
  const bar = $("toast-bar");
  bar.textContent = msg;
  bar.classList.remove("hidden");
  clearTimeout(bar._timer);
  bar._timer = setTimeout(() => bar.classList.add("hidden"), 4000);
}

function formatINR(val) {
  return `₹${Number(val || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ============================================================================
// SELF-HEALING FIRESTORE MODEL_POOL ENGINE
// ============================================================================
export async function ensureModelPool(wsId) {
  const poolRef = doc(db, "workspaces", wsId, "settings", "modelPool");
  const snap = await getDoc(poolRef);
  if (!snap.exists()) {
    await setDoc(poolRef, {
      ...modelPoolState,
      candidateCatalog: MODEL_CANDIDATE_CATALOG,
      updatedAt: serverTimestamp()
    });
  } else {
    modelPoolState = snap.data();
  }
  renderModelPool();
  return poolRef;
}

async function sendSingleModelRequest(prompt, targetModel) {
  const idToken = currentUser ? await currentUser.getIdToken() : "";
  const res = await fetch(GEMINI_PROXY_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ prompt, model: targetModel, idToken, token: idToken })
  });
  const raw = await res.text();
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    if (raw && raw.trim()) return raw.trim();
    throw new Error("Empty non-JSON proxy response");
  }
  if (typeof parsed === "string" && parsed.trim()) return parsed.trim();
  if (parsed.error) {
    const errMsg = typeof parsed.error === "string" ? parsed.error : (parsed.error.message || JSON.stringify(parsed.error));
    throw new Error(errMsg);
  }
  const extracted =
    parsed.response ||
    parsed.text ||
    parsed.reply ||
    parsed.output ||
    parsed.result ||
    parsed.answer ||
    parsed.data ||
    parsed?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (extracted && String(extracted).trim()) return String(extracted).trim();
  throw new Error(`Empty response from ${targetModel} (keys: ${Object.keys(parsed).join(", ") || "none"})`);
}

function getNextUntriedModel(currentModels) {
  const activeNames = new Set(currentModels.map(m => m.name));
  return MODEL_CANDIDATE_CATALOG.find(name => !activeNames.has(name)) || null;
}

export function reconcileModelPool(pool) {
  let updated = (pool.models || []).map(m => {
    const rate = m.attempts > 0 ? Math.round((m.successes / m.attempts) * 100) : 100;
    return { ...m, successRate: rate };
  });

  const beforeLen = updated.length;
  // Evict any model with > 75% failure rate (successRate < 25% after at least 4 attempts)
  updated = updated.filter(m => !(m.attempts >= 4 && m.successRate < 25));

  while (updated.length < Math.max(2, beforeLen)) {
    const replacement = getNextUntriedModel(updated);
    if (!replacement) break;
    updated.push({
      name: replacement,
      role: updated.length === 0 ? "default" : "backup",
      attempts: 0,
      successes: 0,
      successRate: 100
    });
  }

  if (updated[0]) updated[0].role = "default";
  if (updated[1]) updated[1].role = "backup";

  return {
    ...pool,
    default_model: updated[0]?.name || "gemini-2.0-flash",
    backup_model: updated[1]?.name || updated[0]?.name || "gemini-2.0-flash",
    models: updated
  };
}

export async function callGeminiProxy(prompt, overrideWsId = workspaceId) {
  const poolRef = overrideWsId ? doc(db, "workspaces", overrideWsId, "settings", "modelPool") : null;
  if (poolRef) {
    const snap = await getDoc(poolRef);
    if (snap.exists()) modelPoolState = snap.data();
  }

  const orderedNames = [
    modelPoolState.default_model,
    modelPoolState.backup_model,
    ...(modelPoolState.models || []).map(m => m.name)
  ].filter((v, idx, arr) => v && arr.indexOf(v) === idx);

  let lastError = null;

  for (const modelName of orderedNames) {
    let entry = modelPoolState.models.find(m => m.name === modelName);
    if (!entry) {
      entry = { name: modelName, role: "backup", attempts: 0, successes: 0, successRate: 100 };
      modelPoolState.models.push(entry);
    }
    entry.attempts += 1;

    try {
      const reply = await sendSingleModelRequest(prompt, modelName);
      entry.successes += 1;
      modelPoolState = reconcileModelPool(modelPoolState);
      if (poolRef) {
        await setDoc(poolRef, { ...modelPoolState, updatedAt: serverTimestamp() }, { merge: true });
      }
      renderModelPool();
      return reply;
    } catch (err) {
      lastError = err;
      modelPoolState = reconcileModelPool(modelPoolState);
    }
  }

  // All active models failed -> retrieve & append an additional model from catalog
  const newCandidate = getNextUntriedModel(modelPoolState.models);
  if (newCandidate) {
    const newEntry = { name: newCandidate, role: "backup", attempts: 1, successes: 0, successRate: 0 };
    modelPoolState.models.push(newEntry);
    try {
      const reply = await sendSingleModelRequest(prompt, newCandidate);
      newEntry.successes = 1;
      modelPoolState = reconcileModelPool(modelPoolState);
      if (poolRef) {
        await setDoc(poolRef, { ...modelPoolState, updatedAt: serverTimestamp() }, { merge: true });
      }
      renderModelPool();
      return reply;
    } catch (err) {
      lastError = err;
      modelPoolState = reconcileModelPool(modelPoolState);
    }
  }

  if (poolRef) {
    await setDoc(poolRef, { ...modelPoolState, updatedAt: serverTimestamp() }, { merge: true });
  }
  renderModelPool();
  throw lastError || new Error("All models in Model_Pool failed.");
}

function renderModelPool() {
  const feed = $("model-pool-feed");
  if (!feed) return;
  const models = modelPoolState.models || [];
  feed.innerHTML = models.map(m => {
    const rate = m.attempts > 0 ? Math.round((m.successes / m.attempts) * 100) : 100;
    const badgeColor = rate >= 75 ? "bg-emerald-100 text-emerald-800" : rate >= 25 ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800";
    return `
      <div class="py-2.5 flex items-center justify-between">
        <div>
          <p class="font-semibold text-slate-800">${m.name}</p>
          <p class="text-[10px] uppercase tracking-wider text-slate-400">${m.role} &bull; ${m.successes}/${m.attempts} calls</p>
        </div>
        <span class="text-[11px] font-bold px-2.5 py-0.5 rounded-full ${badgeColor}">${rate}% Success</span>
      </div>
    `;
  }).join("");
}

// ============================================================================
// BUILDER CONTROLS & TIER / ROLE GATING
// ============================================================================
function initBuilderControls() {
  const pillsWrap = $("prebuilt-pills");
  pillsWrap.innerHTML = PREBUILT_ITEMS.map((item, idx) => `
    <button type="button" data-preset="${idx}"
      class="text-[11px] px-2.5 py-1 rounded-full bg-white border border-slate-300 hover:border-indigo-500 hover:text-indigo-700 transition">
      + ${item.name} (${item.qty})
    </button>
  `).join("");
  pillsWrap.querySelectorAll("button").forEach(btn => {
    btn.addEventListener("click", () => {
      const preset = PREBUILT_ITEMS[Number(btn.dataset.preset)];
      draftItems.push({ ...preset });
      renderDraftItems();
    });
  });

  $("grid-weekdays").innerHTML = WEEKDAYS.map(d => `
    <button type="button" data-day="${d}"
      class="day-btn py-1.5 rounded-md font-semibold border ${selectedWeekdays.has(d) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-300'}">
      ${d}
    </button>
  `).join("");
  $("grid-weekdays").querySelectorAll(".day-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const d = btn.dataset.day;
      if (selectedWeekdays.has(d)) selectedWeekdays.delete(d);
      else selectedWeekdays.add(d);
      btn.className = `day-btn py-1.5 rounded-md font-semibold border ${selectedWeekdays.has(d) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-300'}`;
    });
  });

  $("grid-months").innerHTML = MONTHS.map(m => `
    <button type="button" data-month="${m}"
      class="month-btn py-1 rounded-md font-semibold border ${selectedMonths.has(m) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-300'}">
      ${m}
    </button>
  `).join("");
  $("grid-months").querySelectorAll(".month-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const m = btn.dataset.month;
      if (selectedMonths.has(m)) selectedMonths.delete(m);
      else selectedMonths.add(m);
      btn.className = `month-btn py-1 rounded-md font-semibold border ${selectedMonths.has(m) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-300'}`;
    });
  });
}

function renderDraftItems() {
  const container = $("draft-items-container");
  if (!draftItems.length) {
    container.innerHTML = `<p class="text-xs text-slate-400 italic">No items added yet. Speak, pick a preset, or type above.</p>`;
    return;
  }
  container.innerHTML = draftItems.map((item, i) => `
    <div class="flex items-center justify-between bg-white px-3 py-1.5 rounded-lg border border-slate-200 text-xs">
      <div>
        <span class="font-semibold text-slate-800">${item.name}</span>
        <span class="text-slate-500 ml-1.5">&bull; ${item.qty}</span>
      </div>
      <button type="button" data-remove="${i}" class="text-red-500 hover:text-red-700 font-bold px-1.5">&times;</button>
    </div>
  `).join("");
  container.querySelectorAll("button[data-remove]").forEach(btn => {
    btn.addEventListener("click", () => {
      draftItems.splice(Number(btn.dataset.remove), 1);
      renderDraftItems();
    });
  });
}

function applyTierAndRoleGates() {
  const tier = workspaceData.tier || "free";
  const rules = TIER_RULES[tier];

  $("badge-tier").textContent = rules.label;
  $("select-tier").value = tier;
  $("header-wallet-balance").textContent = formatINR(workspaceData.walletBalance);
  $("wallet-card-balance").textContent = formatINR(workspaceData.walletBalance);

  $("tier-quota-hint").textContent = rules.maxLists === Infinity
    ? "Pro tier: Unlimited recurring lists & custom grids"
    : `${rules.label} tier: up to ${rules.maxLists} active lists`;

  const modeSelect = $("input-mode");
  const autoBuyOpt = modeSelect.querySelector('option[value="auto_buy"]');
  if (!rules.allowAutoBuy) {
    autoBuyOpt.disabled = true;
    if (modeSelect.value === "auto_buy") modeSelect.value = "auto_build";
    $("mode-tier-note").classList.remove("hidden");
  } else {
    autoBuyOpt.disabled = false;
    $("mode-tier-note").classList.add("hidden");
  }

  const freqSelect = $("input-frequency");
  const customOpt = freqSelect.querySelector('option[value="custom"]');
  customOpt.disabled = !rules.allowCustomGrid;
  customOpt.textContent = rules.allowCustomGrid
    ? "Custom Grid (Days, Months, Year, Time)"
    : "Custom Grid (Pro Plan Only)";
  if (!rules.allowCustomGrid && freqSelect.value === "custom") {
    freqSelect.value = "weekly";
  }
  $("custom-schedule-grid").classList.toggle("hidden", freqSelect.value !== "custom");

  $("platform-tier-hint").textContent = rules.allPlatforms ? "All Top 10 unlocked" : "Free: Top 3 unlocked (Upgrade for Top 10)";
  $("platform-checkboxes").innerHTML = TOP_10_PLATFORMS.map(p => {
    const locked = !rules.allPlatforms && p.tier !== "free";
    return `
      <label class="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border ${locked ? 'bg-slate-100 border-slate-200 opacity-55 cursor-not-allowed' : 'bg-white border-slate-200 hover:border-indigo-400 cursor-pointer'}">
        <input type="checkbox" name="platform" value="${p.name}" ${p.id === "blinkit" ? "checked" : ""} ${locked ? "disabled" : ""} class="rounded text-indigo-600" />
        <span class="truncate">${p.name}</span>
      </label>
    `;
  }).join("");

  const isViewer = activeRole === "viewer";
  const isApprover = activeRole === "approver";

  $("viewer-lock-banner").classList.toggle("hidden", !isViewer);
  $("btn-save-list").disabled = isViewer;
  $("btn-save-list").classList.toggle("opacity-50", isViewer);
  $("btn-save-list").textContent = isApprover ? "Save & Schedule List" : "Submit List for Approval";

  $("btn-topup-submit").disabled = !isApprover;
  $("btn-topup-submit").classList.toggle("opacity-50", !isApprover);
  $("wallet-role-note").classList.toggle("hidden", isApprover);

  $("role-creation-badge").textContent = isApprover
    ? "Direct Publish (Approver)"
    : isViewer
      ? "Read-Only (Viewer)"
      : "Requires Approval (Requester)";
  $("role-creation-badge").className = `text-[11px] font-semibold px-2.5 py-1 rounded-full ${
    isApprover ? "bg-emerald-50 text-emerald-700" : isViewer ? "bg-slate-100 text-slate-600" : "bg-amber-50 text-amber-800"
  }`;

  renderLists();
  renderOrdersAndHistory();
}

// ============================================================================
// AI CART EXECUTION ENGINE (AUTO-BUILD & AUTO-BUY)
// ============================================================================
async function executeListCart(list) {
  showToast(`Building AI cart for "${list.title}" via Model_Pool (${modelPoolState.default_model})...`);
  const chosenPlatformName = (list.platforms && list.platforms[0]) || "Blinkit";
  const platformMeta = TOP_10_PLATFORMS.find(p => p.name === chosenPlatformName) || TOP_10_PLATFORMS[0];

  let matchedItems = [];
  try {
    const prompt = `You are an Indian quick-commerce pricing assistant for ${chosenPlatformName}. Optimization criteria: "${list.criteria}". For these items: ${JSON.stringify(list.items)}, return ONLY a pure JSON array (no markdown) of objects with keys: "name", "qty", "matchedSku", "priceInr" (number).`;
    const rawReply = await callGeminiProxy(prompt);
    const clean = rawReply.replace(/```json|```/g, "").trim();
    matchedItems = JSON.parse(clean);
  } catch (e) {
    matchedItems = (list.items || []).map((it, idx) => ({
      name: it.name,
      qty: it.qty,
      matchedSku: `${it.name} (${it.qty})`,
      priceInr: 65 + (idx * 35)
    }));
  }

  const totalAmount = matchedItems.reduce((sum, it) => sum + Number(it.priceInr || 0), 0);
  const txnId = `${platformMeta.prefix}-${Math.floor(100000 + Math.random() * 900000)}`;
  const todayStr = new Date().toISOString().split("T")[0];

  let executedAsAutoBuy = false;
  let fallbackReason = "";

  if (list.mode === "auto_buy") {
    if (Number(workspaceData.walletBalance || 0) >= totalAmount) {
      executedAsAutoBuy = true;
      await updateDoc(doc(db, "workspaces", workspaceId), {
        walletBalance: increment(-totalAmount)
      });
      await addDoc(collection(db, "workspaces", workspaceId, "walletLedger"), {
        type: "autobuy_debit",
        label: `Auto-Buy: ${list.title} (${chosenPlatformName})`,
        amount: -totalAmount,
        refId: txnId,
        createdAt: serverTimestamp()
      });
    } else {
      fallbackReason = `Insufficient wallet balance (${formatINR(workspaceData.walletBalance)} < ${formatINR(totalAmount)}). Switched to Auto-Build manual checkout.`;
    }
  }

  await addDoc(collection(db, "workspaces", workspaceId, "transactions"), {
    listId: list.id,
    listTitle: list.title,
    date: todayStr,
    platform: chosenPlatformName,
    platformTxnId: txnId,
    mode: executedAsAutoBuy ? "auto_buy" : "auto_build",
    totalAmount,
    verified: false,
    items: matchedItems.map(it => ({ ...it, status: executedAsAutoBuy ? "Ordered" : "Cart Built", verified: false })),
    createdAt: serverTimestamp()
  });

  $("modal-mode-badge").textContent = executedAsAutoBuy ? "AUTO-BUY COMPLETED" : "AUTO-BUILD CART READY";
  $("modal-mode-badge").className = `text-[10px] font-bold uppercase px-2 py-0.5 rounded ${executedAsAutoBuy ? "bg-emerald-500 text-white" : "bg-indigo-500 text-white"}`;
  $("modal-cart-title").textContent = `${list.title} • ${chosenPlatformName}`;

  $("modal-cart-body").innerHTML = `
    ${fallbackReason ? `<div class="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800">${fallbackReason}</div>` : ""}
    <div class="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200">
      <div>
        <p class="text-slate-500">Platform Transaction / Cart ID</p>
        <p class="font-bold text-slate-900 text-sm">${txnId}</p>
      </div>
      <div class="text-right">
        <p class="text-slate-500">Cart Total</p>
        <p class="font-bold text-emerald-700 text-base">${formatINR(totalAmount)}</p>
      </div>
    </div>
    <div class="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
      ${matchedItems.map(it => `
        <div class="p-3 flex items-center justify-between bg-white">
          <div>
            <p class="font-semibold text-slate-800">${it.matchedSku || it.name}</p>
            <p class="text-[11px] text-slate-500">Qty: ${it.qty}</p>
          </div>
          <div class="flex items-center gap-3">
            <span class="font-bold text-slate-900">${formatINR(it.priceInr)}</span>
            <a href="${platformMeta.searchUrl}${encodeURIComponent(it.name)}" target="_blank" rel="noopener"
              class="text-[11px] font-semibold text-indigo-600 hover:underline">Open &nearr;</a>
          </div>
        </div>
      `).join("")}
    </div>
    <p class="text-[11px] text-slate-500">Logged to Orders &amp; History as <strong>Unverified</strong> until bill upload or Bank/UPI SMS verification.</p>
  `;
  $("cart-modal").classList.remove("hidden");
}

// ============================================================================
// INCREMENT 3: DATE-RANGE SCROLLER, UPCOMING RUNS & TRANSACTIONS VIEW
// ============================================================================
export function getScrollerWindowBounds(span = scrollerSpan, offset = scrollerOffset, baseDate = new Date()) {
  const ref = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());
  let start, end, label;

  if (span === "daily") {
    start = new Date(ref);
    start.setDate(ref.getDate() + offset);
    end = new Date(start);
    label = start.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  } else if (span === "monthly") {
    start = new Date(ref.getFullYear(), ref.getMonth() + offset, 1);
    end = new Date(ref.getFullYear(), ref.getMonth() + offset + 1, 0);
    label = start.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  } else {
    const dayIdx = (ref.getDay() + 6) % 7;
    start = new Date(ref);
    start.setDate(ref.getDate() - dayIdx + (offset * 7));
    end = new Date(start);
    end.setDate(start.getDate() + 6);
    const fmt = (d) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
    label = `${fmt(start)} – ${fmt(end)} ${end.getFullYear()}`;
  }

  const toISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { startStr: toISO(start), endStr: toISO(end), start, end, label };
}

export function filterTransactionsByWindow(txns, startStr, endStr) {
  return txns.filter(t => t.date && t.date >= startStr && t.date <= endStr);
}

function renderOrdersAndHistory() {
  const bounds = getScrollerWindowBounds();
  $("scroller-range-label").textContent = bounds.label;
  $("scroller-period-hint").textContent = `${scrollerSpan.toUpperCase()} WINDOW`;

  const activeLists = allLists.filter(l => l.status === "active");
  const schedFeed = $("scheduled-window-feed");
  if (!activeLists.length) {
    schedFeed.innerHTML = `<p class="text-slate-400 italic py-4">No active recurring lists scheduled.</p>`;
  } else {
    schedFeed.innerHTML = activeLists.map(list => `
      <div class="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2">
        <div class="flex items-start justify-between gap-2">
          <div>
            <p class="font-bold text-slate-900">${list.title}</p>
            <p class="text-[11px] text-slate-500">${formatSchedule(list.schedule)} &bull; ${(list.platforms || [])[0] || "Blinkit"}</p>
          </div>
          <span class="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-indigo-100 text-indigo-800">
            ${list.mode === "auto_buy" ? "AUTO-BUY" : "AUTO-BUILD"}
          </span>
        </div>
        <div class="flex flex-wrap gap-1">
          ${(list.items || []).map((it, idx) => `
            <span class="inline-flex items-center gap-1 text-[11px] bg-white border border-slate-200 px-2 py-0.5 rounded">
              ${it.name} (${it.qty})
              ${activeRole !== "viewer" ? `<button type="button" data-drop-item="${list.id}:${idx}" class="text-red-500 font-bold ml-1">&times;</button>` : ""}
            </span>
          `).join("")}
        </div>
        ${activeRole !== "viewer" ? `
          <div class="flex gap-1.5 pt-1">
            <input type="text" id="quick-add-${list.id}" placeholder="Add mid-cycle item..." class="flex-1 text-[11px] px-2 py-1 rounded border border-slate-300 bg-white" />
            <button type="button" data-quick-append="${list.id}" class="px-2.5 py-1 rounded bg-slate-800 text-white text-[11px] font-semibold">+ Item</button>
          </div>
        ` : ""}
      </div>
    `).join("");

    schedFeed.querySelectorAll("button[data-drop-item]").forEach(btn => {
      btn.addEventListener("click", async () => {
        const [lId, idxStr] = btn.dataset.dropItem.split(":");
        const target = activeLists.find(l => l.id === lId);
        if (!target) return;
        const nextItems = [...(target.items || [])];
        nextItems.splice(Number(idxStr), 1);
        await updateDoc(doc(db, "workspaces", workspaceId, "lists", lId), { items: nextItems });
        showToast("Updated upcoming order items.");
      });
    });

    schedFeed.querySelectorAll("button[data-quick-append]").forEach(btn => {
      btn.addEventListener("click", async () => {
        const lId = btn.dataset.quickAppend;
        const inp = $(`quick-add-${lId}`);
        const val = inp?.value.trim();
        if (!val) return;
        const target = activeLists.find(l => l.id === lId);
        const nextItems = [...(target.items || []), { name: val, qty: "1 unit" }];
        await updateDoc(doc(db, "workspaces", workspaceId, "lists", lId), { items: nextItems });
        inp.value = "";
        showToast(`Added "${val}" to upcoming scheduled run.`);
      });
    });
  }

  const windowTxns = filterTransactionsByWindow(allTransactions, bounds.startStr, bounds.endStr);
  $("badge-txn-count").textContent = allTransactions.length;
  const totalSpent = windowTxns.reduce((s, t) => s + Number(t.totalAmount || 0), 0);
  $("window-spend-total").textContent = formatINR(totalSpent);

  const txnFeed = $("transactions-window-feed");
  if (!windowTxns.length) {
    txnFeed.innerHTML = `<div class="p-8 text-center border border-dashed border-slate-200 rounded-xl text-slate-400">No transactions recorded in ${bounds.label}.</div>`;
  } else {
    txnFeed.innerHTML = windowTxns.map(t => `
      <div class="p-3.5 rounded-xl border border-slate-200 bg-white space-y-2">
        <div class="flex items-start justify-between gap-2">
          <div>
            <div class="flex items-center gap-2 flex-wrap">
              <span class="font-bold text-slate-900">${t.listTitle || "Order"}</span>
              <span class="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">${t.platform}</span>
              <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${t.verified ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}">
                ${t.verified ? "VERIFIED" : "UNVERIFIED"}
              </span>
            </div>
            <p class="text-[11px] text-slate-500 mt-0.5">Date: ${t.date} &bull; Txn ID: <span class="font-mono">${t.platformTxnId || "MANUAL"}</span></p>
          </div>
          <span class="font-bold text-sm text-slate-900">${formatINR(t.totalAmount)}</span>
        </div>
        <div class="flex flex-wrap gap-1 pt-1 border-t border-slate-100">
          ${(t.items || []).map(it => `
            <span class="text-[11px] bg-slate-50 border border-slate-200 px-2 py-0.5 rounded text-slate-700">
              ${it.matchedSku || it.name} &bull; ${formatINR(it.priceInr || 0)}
            </span>
          `).join("")}
        </div>
      </div>
    `).join("");
  }
}

function openManualTransactionModal() {
  if (activeRole === "viewer") return showToast("Viewers cannot add manual transactions.");
  const todayStr = new Date().toISOString().split("T")[0];
  $("modal-mode-badge").textContent = "MANUAL ENTRY";
  $("modal-mode-badge").className = "text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-slate-700 text-white";
  $("modal-cart-title").textContent = "Log Manual Order / Expense";
  $("modal-cart-body").innerHTML = `
    <form id="form-manual-txn" class="space-y-3">
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block font-semibold text-slate-700 mb-1">Order Title *</label>
          <input id="man-txn-title" type="text" required placeholder="e.g., Local Organic Store" class="w-full px-3 py-2 rounded-lg border border-slate-300" />
        </div>
        <div>
          <label class="block font-semibold text-slate-700 mb-1">Date *</label>
          <input id="man-txn-date" type="date" required value="${todayStr}" class="w-full px-3 py-2 rounded-lg border border-slate-300" />
        </div>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block font-semibold text-slate-700 mb-1">Platform / Store</label>
          <input id="man-txn-platform" type="text" value="Blinkit" class="w-full px-3 py-2 rounded-lg border border-slate-300" />
        </div>
        <div>
          <label class="block font-semibold text-slate-700 mb-1">Total Amount (₹) *</label>
          <input id="man-txn-amount" type="number" min="1" step="0.01" required placeholder="450" class="w-full px-3 py-2 rounded-lg border border-slate-300" />
        </div>
      </div>
      <div>
        <label class="block font-semibold text-slate-700 mb-1">Items Summary</label>
        <input id="man-txn-items" type="text" placeholder="e.g., Ragi Flour 1kg, Tomatoes 1kg" class="w-full px-3 py-2 rounded-lg border border-slate-300" />
      </div>
      <button type="submit" class="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold">
        Save Manual Transaction
      </button>
    </form>
  `;
  $("cart-modal").classList.remove("hidden");

  $("form-manual-txn").addEventListener("submit", async (e) => {
    e.preventDefault();
    const amt = Number($("man-txn-amount").value);
    const itemSummary = $("man-txn-items").value.trim() || $("man-txn-title").value.trim();
    await addDoc(collection(db, "workspaces", workspaceId, "transactions"), {
      listId: "manual",
      listTitle: $("man-txn-title").value.trim(),
      date: $("man-txn-date").value,
      platform: $("man-txn-platform").value.trim() || "Manual",
      platformTxnId: `MAN-${Math.floor(100000 + Math.random() * 900000)}`,
      mode: "manual",
      totalAmount: amt,
      verified: false,
      items: [{ name: itemSummary, matchedSku: itemSummary, priceInr: amt, verified: false }],
      createdAt: serverTimestamp()
    });
    $("cart-modal").classList.add("hidden");
    showToast("Manual transaction added.");
  });
}

// ============================================================================
// VOICE PARSER & LIST / LEDGER RENDERERS
// ============================================================================
function initSpeechParser() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const btnVoice = $("btn-voice-input");
  const statusEl = $("voice-status");

  if (!SpeechRecognition) {
    btnVoice.addEventListener("click", () => showToast("Speech recognition not supported in this browser. Please type items."));
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.lang = "en-IN";
  recognition.interimResults = false;

  btnVoice.addEventListener("click", () => {
    try {
      recognition.start();
      $("mic-dot").classList.add("bg-red-400", "pulse-mic");
      $("mic-label").textContent = "Listening...";
      statusEl.textContent = "Speak your shopping list (e.g., 'Add 2 kg Toor Dal, 1 liter Nandini milk, and Dolo 650')...";
      statusEl.classList.remove("hidden");
    } catch (e) {
      recognition.stop();
    }
  });

  recognition.onresult = async (event) => {
    const transcript = event.results[0][0].transcript;
    statusEl.textContent = `Heard: "${transcript}" — Parsing via Model_Pool...`;
    try {
      const prompt = `Extract grocery/shopping items from this spoken request into a pure JSON array of objects with keys "name" and "qty". No markdown, only JSON. Text: "${transcript}"`;
      const rawReply = await callGeminiProxy(prompt);
      const rawText = rawReply.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(rawText);
      if (Array.isArray(parsed) && parsed.length) {
        parsed.forEach(p => draftItems.push({ name: p.name || "Item", qty: p.qty || "1 unit" }));
        renderDraftItems();
        statusEl.textContent = `Added ${parsed.length} item(s) via Gemini Voice Parser.`;
      } else {
        throw new Error("Fallback");
      }
    } catch (err) {
      const chunks = transcript.split(/,| and /i).map(s => s.trim()).filter(Boolean);
      chunks.forEach(c => draftItems.push({ name: c, qty: "1 unit" }));
      renderDraftItems();
      statusEl.textContent = `Added ${chunks.length} item(s) from speech.`;
    }
  };

  recognition.onend = () => {
    $("mic-dot").classList.remove("bg-red-400", "pulse-mic");
    $("mic-label").textContent = "Speak Items";
  };
}

function formatSchedule(s) {
  if (!s) return "Weekly";
  if (s.frequency === "custom") {
    return `Custom: ${(s.weekdays || []).join(", ")} | ${(s.months || []).length} mos (${s.year}) @ ${s.time}`;
  }
  return `${s.frequency.charAt(0).toUpperCase() + s.frequency.slice(1)} @ ${s.time || "08:30"}`;
}

function renderLists() {
  const active = allLists.filter(l => l.status === "active");
  const pending = allLists.filter(l => l.status === "pending_approval");

  $("count-active-lists").textContent = active.length;
  $("badge-pending-count").textContent = pending.length;

  const activeFeed = $("active-lists-feed");
  if (!active.length) {
    activeFeed.innerHTML = `<div class="bg-white rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">No active recurring lists yet. Create your first list on the left!</div>`;
  } else {
    activeFeed.innerHTML = active.map(list => `
      <div class="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm hover:border-indigo-200 transition">
        <div class="flex items-start justify-between gap-3">
          <div>
            <div class="flex items-center gap-2 flex-wrap">
              <h3 class="font-bold text-slate-900 text-sm">${list.title}</h3>
              <span class="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700">${list.category}</span>
              <span class="text-[10px] font-semibold px-2 py-0.5 rounded-full ${list.mode === 'auto_buy' ? 'bg-purple-100 text-purple-800' : 'bg-slate-100 text-slate-700'}">
                ${list.mode === 'auto_buy' ? 'AUTO-BUY' : 'AUTO-BUILD'}
              </span>
            </div>
            <p class="text-xs text-slate-500 mt-1">
              <strong>Schedule:</strong> ${formatSchedule(list.schedule)} &bull; <strong>Criteria:</strong> ${list.criteria}
            </p>
            <p class="text-xs text-slate-500 mt-0.5">
              <strong>Platforms:</strong> ${(list.platforms || []).join(", ")}
            </p>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            ${activeRole !== "viewer" ? `
              <button data-run-list="${list.id}" class="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs">
                Run Now
              </button>
            ` : ""}
            ${activeRole === "approver" ? `
              <button data-delete-list="${list.id}" class="text-xs text-slate-400 hover:text-red-600 font-medium px-1">Delete</button>
            ` : ""}
          </div>
        </div>
        <div class="mt-3 pt-3 border-t border-slate-100 flex flex-wrap gap-1.5">
          ${(list.items || []).map(it => `
            <span class="text-[11px] bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-lg text-slate-700">
              ${it.name} <span class="text-slate-400">(${it.qty})</span>
            </span>
          `).join("")}
        </div>
      </div>
    `).join("");

    activeFeed.querySelectorAll("button[data-run-list]").forEach(btn => {
      btn.addEventListener("click", () => {
        const targetList = active.find(l => l.id === btn.dataset.runList);
        if (targetList) executeListCart(targetList);
      });
    });

    activeFeed.querySelectorAll("button[data-delete-list]").forEach(btn => {
      btn.addEventListener("click", async () => {
        await deleteDoc(doc(db, "workspaces", workspaceId, "lists", btn.dataset.deleteList));
        showToast("List deleted.");
      });
    });
  }

  const pendingFeed = $("pending-approvals-feed");
  if (!pending.length) {
    pendingFeed.innerHTML = `<p class="text-xs text-slate-400 italic py-4">No lists awaiting approval right now.</p>`;
  } else {
    pendingFeed.innerHTML = pending.map(list => `
      <div class="p-4 rounded-xl border border-amber-200 bg-amber-50/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div class="flex items-center gap-2">
            <span class="font-bold text-sm text-slate-900">${list.title}</span>
            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">PENDING APPROVAL</span>
          </div>
          <p class="text-xs text-slate-600 mt-1">Submitted by ${list.createdByName || "Requester"} &bull; ${(list.items || []).length} items &bull; ${formatSchedule(list.schedule)}</p>
        </div>
        ${activeRole === "approver" ? `
          <div class="flex items-center gap-2">
            <button data-approve="${list.id}" class="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold">Approve &amp; Activate</button>
            <button data-reject="${list.id}" class="px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-red-50 text-red-600 text-xs font-semibold">Reject</button>
          </div>
        ` : `<span class="text-xs text-slate-500 italic">Waiting for Approver sign-off</span>`}
      </div>
    `).join("");

    pendingFeed.querySelectorAll("button[data-approve]").forEach(btn => {
      btn.addEventListener("click", async () => {
        await updateDoc(doc(db, "workspaces", workspaceId, "lists", btn.dataset.approve), { status: "active" });
        showToast("List approved and scheduled!");
      });
    });
    pendingFeed.querySelectorAll("button[data-reject]").forEach(btn => {
      btn.addEventListener("click", async () => {
        await deleteDoc(doc(db, "workspaces", workspaceId, "lists", btn.dataset.reject));
        showToast("Pending list rejected.");
      });
    });
  }
}

function renderWalletLedger() {
  const feed = $("wallet-ledger-feed");
  if (!walletLedger.length) {
    feed.innerHTML = `<p class="text-slate-400 italic py-4">No wallet transactions yet. Add funds on the left to test Auto-Buy.</p>`;
    return;
  }
  feed.innerHTML = walletLedger.map(entry => {
    const isCredit = Number(entry.amount) >= 0;
    return `
      <div class="py-3 flex items-center justify-between">
        <div>
          <p class="font-semibold text-slate-800">${entry.label}</p>
          <p class="text-[11px] text-slate-400">Ref: ${entry.refId || "WALLET"}</p>
        </div>
        <span class="font-bold ${isCredit ? "text-emerald-700" : "text-red-600"}">
          ${isCredit ? "+" : ""}${formatINR(entry.amount)}
        </span>
      </div>
    `;
  }).join("");
}

function renderMembers() {
  const feed = $("members-list-feed");
  feed.innerHTML = allMembers.map(m => `
    <div class="py-3 flex items-center justify-between">
      <div>
        <p class="text-sm font-semibold text-slate-800">${m.name}</p>
        <p class="text-xs text-slate-500">${m.email}</p>
      </div>
      <span class="text-xs font-bold uppercase px-2.5 py-1 rounded-full ${
        m.role === 'approver' ? 'bg-indigo-100 text-indigo-800' : m.role === 'requester' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'
      }">${m.role}</span>
    </div>
  `).join("");
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================
$("btn-add-item").addEventListener("click", () => {
  const name = $("input-item-name").value.trim();
  const qty = $("input-item-qty").value.trim() || "1 unit";
  if (!name) return;
  draftItems.push({ name, qty });
  $("input-item-name").value = "";
  renderDraftItems();
});

$("input-frequency").addEventListener("change", (e) => {
  $("custom-schedule-grid").classList.toggle("hidden", e.target.value !== "custom");
});

$("select-tier").addEventListener("change", async (e) => {
  const newTier = e.target.value;
  workspaceData.tier = newTier;
  applyTierAndRoleGates();
  if (workspaceId) {
    await updateDoc(doc(db, "workspaces", workspaceId), { tier: newTier });
  }
  showToast(`Switched workspace plan to ${newTier.toUpperCase()}.`);
});

$("select-active-role").addEventListener("change", (e) => {
  activeRole = e.target.value;
  applyTierAndRoleGates();
  showToast(`Viewing interface as ${activeRole.toUpperCase()}.`);
});

$("btn-close-cart-modal").addEventListener("click", () => $("cart-modal").classList.add("hidden"));
$("btn-header-wallet").addEventListener("click", () => {
  document.querySelector('.nav-tab[data-tab="wallet"]').click();
});

$("btn-range-prev").addEventListener("click", () => { scrollerOffset -= 1; renderOrdersAndHistory(); });
$("btn-range-next").addEventListener("click", () => { scrollerOffset += 1; renderOrdersAndHistory(); });
$("btn-range-today").addEventListener("click", () => { scrollerOffset = 0; renderOrdersAndHistory(); });
$("btn-open-manual-txn").addEventListener("click", openManualTransactionModal);

document.querySelectorAll(".span-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    scrollerSpan = btn.dataset.span;
    scrollerOffset = 0;
    document.querySelectorAll(".span-btn").forEach(b => {
      b.className = b.dataset.span === scrollerSpan
        ? "span-btn px-2.5 py-1 rounded-md font-semibold bg-white text-indigo-700 shadow-xs"
        : "span-btn px-2.5 py-1 rounded-md font-medium text-slate-600";
    });
    renderOrdersAndHistory();
  });
});

document.querySelectorAll(".quick-topup").forEach(btn => {
  btn.addEventListener("click", () => {
    $("input-topup-amount").value = btn.dataset.quickAmt;
  });
});

$("form-topup-wallet").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (activeRole !== "approver") return showToast("Only Approvers can add wallet funds.");
  const amt = Number($("input-topup-amount").value);
  if (!amt || amt <= 0) return;

  const refId = `UPI-${Math.floor(10000000 + Math.random() * 90000000)}`;
  await updateDoc(doc(db, "workspaces", workspaceId), {
    walletBalance: increment(amt)
  });
  await addDoc(collection(db, "workspaces", workspaceId, "walletLedger"), {
    type: "topup",
    label: "Wallet Top-Up (UPI / Instant)",
    amount: amt,
    refId,
    createdAt: serverTimestamp()
  });
  $("input-topup-amount").value = "";
  showToast(`Added ${formatINR(amt)} to ABCart Wallet!`);
});

$("list-builder-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (activeRole === "viewer") return showToast("Viewers cannot create lists.");
  if (!draftItems.length) return showToast("Please add at least one product to the list.");

  const tier = workspaceData.tier || "free";
  const maxLists = TIER_RULES[tier].maxLists;
  const activeCount = allLists.filter(l => l.status === "active").length;
  if (activeCount >= maxLists) {
    return showToast(`Your ${tier.toUpperCase()} plan allows up to ${maxLists} active lists. Upgrade plan in the header to add more.`);
  }

  const selectedPlatforms = Array.from(document.querySelectorAll('input[name="platform"]:checked')).map(cb => cb.value);
  if (!selectedPlatforms.length) return showToast("Select at least one approved platform.");

  const freq = $("input-frequency").value;
  const schedule = {
    frequency: freq,
    time: $("input-schedule-time").value || "08:30",
    weekdays: freq === "custom" ? Array.from(selectedWeekdays) : [],
    months: freq === "custom" ? Array.from(selectedMonths) : [],
    year: freq === "custom" ? $("grid-year").value : ""
  };

  const status = activeRole === "approver" ? "active" : "pending_approval";

  await addDoc(collection(db, "workspaces", workspaceId, "lists"), {
    title: $("input-list-title").value.trim(),
    category: $("input-list-category").value,
    criteria: $("input-criteria").value,
    mode: $("input-mode").value,
    platforms: selectedPlatforms,
    schedule,
    items: [...draftItems],
    status,
    createdBy: currentUser.uid,
    createdByName: currentUser.displayName || currentUser.email,
    createdAt: serverTimestamp()
  });

  $("input-list-title").value = "";
  draftItems = [];
  renderDraftItems();
  showToast(status === "active" ? "List scheduled and active!" : "List submitted to Approver queue!");
});

$("form-add-member").addEventListener("submit", async (e) => {
  e.preventDefault();
  const tier = workspaceData.tier || "free";
  const maxMembers = TIER_RULES[tier].maxMembers;
  if (allMembers.length >= maxMembers) {
    return showToast(`${tier.toUpperCase()} plan supports up to ${maxMembers} member(s). Switch to Plus or Pro in the header.`);
  }
  await addDoc(collection(db, "workspaces", workspaceId, "members"), {
    name: $("input-member-name").value.trim(),
    email: $("input-member-email").value.trim().toLowerCase(),
    role: $("input-member-role").value,
    addedAt: serverTimestamp()
  });
  $("input-member-name").value = "";
  $("input-member-email").value = "";
  showToast("Member added to workspace!");
});

document.querySelectorAll(".nav-tab").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".nav-tab").forEach(b => {
      b.classList.remove("text-indigo-600", "border-indigo-600", "font-semibold");
      b.classList.add("text-slate-500", "border-transparent", "font-medium");
    });
    btn.classList.add("text-indigo-600", "border-indigo-600", "font-semibold");
    btn.classList.remove("text-slate-500", "border-transparent", "font-medium");

    ["lists", "orders", "wallet", "approvals", "members"].forEach(t => {
      $(`tab-${t}`).classList.toggle("hidden", t !== btn.dataset.tab);
    });
  });
});

$("btn-google-signin").addEventListener("click", async () => {
  try {
    await signInWithPopup(auth, provider);
  } catch (err) {
    $("auth-error").textContent = err.message;
    $("auth-error").classList.remove("hidden");
  }
});

$("btn-signout").addEventListener("click", () => signOut(auth));

// ============================================================================
// WIRE QA TEST SUITE MODULE & BOOT APP
// ============================================================================
const qaController = initQATestSuite({
  db,
  firestoreOps: { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, addDoc, increment, serverTimestamp },
  getContext: () => ({ currentUser, workspaceId, workspaceData, modelPoolState }),
  appHelpers: {
    $,
    showToast,
    TIER_RULES,
    ensureModelPool,
    callGeminiProxy,
    reconcileModelPool,
    getScrollerWindowBounds,
    filterTransactionsByWindow
  }
});

initBuilderControls();
initSpeechParser();

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    currentUser = null;
    $("auth-screen").classList.remove("hidden");
    $("app-shell").classList.add("hidden");
    return;
  }

  currentUser = user;
  $("auth-screen").classList.add("hidden");
  $("app-shell").classList.remove("hidden");
  $("user-display-name").textContent = user.displayName || user.email;
  if (user.photoURL) {
    $("user-avatar").src = user.photoURL;
    $("user-avatar").classList.remove("hidden");
  }

  applyTierAndRoleGates();

  workspaceId = `ws_${user.uid}`;
  const wsRef = doc(db, "workspaces", workspaceId);

  try {
    const wsSnap = await getDoc(wsRef);
    if (!wsSnap.exists()) {
      workspaceData = {
        name: `${(user.displayName || "My").split(" ")[0]}'s Workspace`,
        tier: "free",
        walletBalance: 0,
        ownerUid: user.uid,
        createdAt: serverTimestamp()
      };
      await setDoc(wsRef, workspaceData);
      await setDoc(doc(db, "workspaces", workspaceId, "members", user.uid), {
        name: user.displayName || "Workspace Owner",
        email: user.email,
        role: "approver"
      });
    } else {
      workspaceData = wsSnap.data();
    }
    await ensureModelPool(workspaceId);
  } catch (err) {
    console.error("Workspace init error:", err);
  }

  onSnapshot(wsRef, (snap) => {
    if (snap.exists()) {
      workspaceData = snap.data();
      $("workspace-name-label").textContent = workspaceData.name;
      applyTierAndRoleGates();
    }
  });

  onSnapshot(query(collection(db, "workspaces", workspaceId, "lists"), orderBy("createdAt", "desc")), (snap) => {
    allLists = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderLists();
    renderOrdersAndHistory();
  });

  onSnapshot(query(collection(db, "workspaces", workspaceId, "transactions"), orderBy("createdAt", "desc")), (snap) => {
    allTransactions = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderOrdersAndHistory();
  });

  onSnapshot(collection(db, "workspaces", workspaceId, "members"), (snap) => {
    allMembers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderMembers();
  });

  onSnapshot(query(collection(db, "workspaces", workspaceId, "walletLedger"), orderBy("createdAt", "desc")), (snap) => {
    walletLedger = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderWalletLedger();
  });

  if (new URLSearchParams(window.location.search).get("test") === "1") {
    qaController.unlockAdminTestTrigger();
    qaController.runAutomatedSelfTests();
  }
});
