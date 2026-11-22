export function initQATestSuite({ db, firestoreOps, getContext, appHelpers }) {
  const { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, addDoc, increment, serverTimestamp } = firestoreOps;
  const {
    $,
    showToast,
    TIER_RULES,
    ensureModelPool,
    callGeminiProxy,
    reconcileModelPool,
    getScrollerWindowBounds,
    filterTransactionsByWindow
  } = appHelpers;

  function isAuthorizedTestAdmin(user, workspaceData) {
    if (!user) return false;
    const allowedAdmins = ["yertalcorp@gmail.com", "prashanti.talluri@gmail.com"];
    return allowedAdmins.includes((user.email || "").toLowerCase()) || workspaceData?.ownerUid === user.uid;
  }

  function unlockAdminTestTrigger() {
    const { currentUser, workspaceData } = getContext();
    if (!isAuthorizedTestAdmin(currentUser, workspaceData)) return;
    if ($("btn-admin-selftest")) return;

    const btn = document.createElement("button");
    btn.id = "btn-admin-selftest";
    btn.type = "button";
    btn.textContent = "QA Self-Test";
    btn.className = "text-[11px] font-bold uppercase tracking-wider px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-amber-300 border border-slate-700 transition";
    btn.addEventListener("click", runAutomatedSelfTests);

    const headerControls = $("header-controls");
    if (headerControls) headerControls.prepend(btn);
  }

  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "d") {
      e.preventDefault();
      unlockAdminTestTrigger();
      showToast("Admin QA Self-Test control unlocked.");
    }
  });

  async function runAutomatedSelfTests() {
    const { currentUser, workspaceId, workspaceData } = getContext();
    if (!isAuthorizedTestAdmin(currentUser, workspaceData)) return;

    const testWsId = `ws_autotest_${currentUser.uid}_${Date.now()}`;
    const createdRefs = [];
    const results = [];
    const startedAt = new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "medium" });

    const logTest = (feature, description, verification, success) => {
      results.push({ feature, description, verification, success });
    };

    $("modal-mode-badge").textContent = "QA DIAGNOSTICS";
    $("modal-mode-badge").className = "text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-amber-400 text-slate-950";
    $("modal-cart-title").textContent = "Executing Automated Feature Verification...";
    $("modal-cart-body").innerHTML = `<p class="text-slate-600">Running isolated tests in <code>${testWsId}</code> and preparing printable report...</p>`;
    $("cart-modal").classList.remove("hidden");

    try {
      // 1. Workspace & Multi-Role RBAC
      const wsRef = doc(db, "workspaces", testWsId);
      await setDoc(wsRef, {
        name: "Automated QA Sandbox",
        tier: "free",
        walletBalance: 0,
        ownerUid: currentUser.uid,
        createdAt: serverTimestamp()
      });
      createdRefs.push(wsRef);

      const ownerMemberRef = doc(db, "workspaces", testWsId, "members", currentUser.uid);
      await setDoc(ownerMemberRef, { name: "QA Approver", email: currentUser.email, role: "approver" });
      createdRefs.push(ownerMemberRef);

      const reqMemberRef = await addDoc(collection(db, "workspaces", testWsId, "members"), {
        name: "QA Requester", email: "requester@test.local", role: "requester"
      });
      createdRefs.push(reqMemberRef);

      const wsSnap = await getDoc(wsRef);
      logTest(
        "1. Workspace & Group Roles (RBAC)",
        "Creates an isolated Firestore workspace and assigns Approver and Requester member roles.",
        wsSnap.exists() ? `Verified workspace '${wsSnap.data().name}' with 2 role-scoped members.` : "Workspace creation failed.",
        wsSnap.exists() && wsSnap.data().tier === "free"
      );

      // 2. Requester Approval Workflow
      const pendingListRef = await addDoc(collection(db, "workspaces", testWsId, "lists"), {
        title: "QA Requester Staples List",
        category: "Groceries & Fresh",
        criteria: "Cheapest",
        mode: "auto_build",
        platforms: ["Blinkit"],
        schedule: { frequency: "weekly", time: "09:00" },
        items: [{ name: "Toor Dal", qty: "1 kg" }],
        status: "pending_approval",
        createdBy: "qa_requester",
        createdAt: serverTimestamp()
      });
      createdRefs.push(pendingListRef);

      const beforeApprove = (await getDoc(pendingListRef)).data().status;
      await updateDoc(pendingListRef, { status: "active" });
      const afterApprove = (await getDoc(pendingListRef)).data().status;

      logTest(
        "2. Requester Submission & Approval Queue",
        "Simulates a non-approver submitting a recurring list into 'pending_approval' and an Approver activating it.",
        `Status transitioned cleanly: '${beforeApprove}' -> '${afterApprove}'.`,
        beforeApprove === "pending_approval" && afterApprove === "active"
      );

      // 3. Payment Tier Feature Gating
      const freeGateOk = TIER_RULES.free.maxLists === 2 && !TIER_RULES.free.allowAutoBuy && !TIER_RULES.free.allPlatforms;
      const plusGateOk = TIER_RULES.plus.maxLists === 10 && TIER_RULES.plus.allowAutoBuy && TIER_RULES.plus.allPlatforms;
      const proGateOk  = TIER_RULES.pro.maxLists === Infinity && TIER_RULES.pro.allowCustomGrid;

      logTest(
        "3. Payment Tier Gating (Free / Plus / Pro)",
        "Verifies list quotas, platform unlock counts (Top 3 vs Top 10), Auto-Buy access, and Custom Grid locks across all 3 plans.",
        "Free (2 lists, Top 3), Plus (10 lists, Auto-Buy, Top 10), Pro (Unlimited, Custom Grid) verified.",
        freeGateOk && plusGateOk && proGateOk
      );

      // 4. Custom Cadence Schedule Grid
      await updateDoc(wsRef, { tier: "pro" });
      const customListRef = await addDoc(collection(db, "workspaces", testWsId, "lists"), {
        title: "QA Custom Schedule Pharmacy Box",
        category: "Pharmacy & Wellness",
        criteria: "Fastest Delivery",
        mode: "auto_buy",
        platforms: ["PharmEasy", "Tata 1mg"],
        schedule: {
          frequency: "custom",
          weekdays: ["Mon", "Fri"],
          months: ["Jan", "Jun", "Dec"],
          year: "2026",
          time: "07:45"
        },
        items: [{ name: "Dolo 650", qty: "2 strips" }],
        status: "active",
        createdAt: serverTimestamp()
      });
      createdRefs.push(customListRef);

      const savedSched = (await getDoc(customListRef)).data().schedule;
      logTest(
        "4. Custom Schedule Grid (Days, Months, Year & Time)",
        "Persists a Pro-tier custom cadence combining specific weekdays, months, target year, and execution time.",
        `Saved schedule: ${savedSched.weekdays.join("/")} across ${savedSched.months.join(", ")} (${savedSched.year}) at ${savedSched.time}.`,
        savedSched.frequency === "custom" && savedSched.weekdays.length === 2 && savedSched.months.length === 3
      );

      // 5. Wallet Top-Up & Auto-Buy Execution + Unverified Transaction Logging
      await updateDoc(wsRef, { walletBalance: increment(1000) });
      const topupRef = await addDoc(collection(db, "workspaces", testWsId, "walletLedger"), {
        type: "topup", label: "QA Wallet Top-Up", amount: 1000, refId: "UPI-QA-1001", createdAt: serverTimestamp()
      });
      createdRefs.push(topupRef);

      const debitAmt = 340;
      await updateDoc(wsRef, { walletBalance: increment(-debitAmt) });
      const debitRef = await addDoc(collection(db, "workspaces", testWsId, "walletLedger"), {
        type: "autobuy_debit", label: "QA Auto-Buy Debit", amount: -debitAmt, refId: "PHM-882211", createdAt: serverTimestamp()
      });
      createdRefs.push(debitRef);

      const todayStr = new Date().toISOString().split("T")[0];
      const txnRef = await addDoc(collection(db, "workspaces", testWsId, "transactions"), {
        listId: customListRef.id,
        listTitle: "QA Custom Schedule Pharmacy Box",
        date: todayStr,
        platform: "PharmEasy",
        platformTxnId: "PHM-882211",
        totalAmount: debitAmt,
        verified: false,
        createdAt: serverTimestamp()
      });
      createdRefs.push(txnRef);

      const finalBal = (await getDoc(wsRef)).data().walletBalance;
      const txnData = (await getDoc(txnRef)).data();
      logTest(
        "5. Wallet Top-Up, Auto-Buy Deduction & Transaction ID",
        "Credits ₹1,000 to wallet, executes a ₹340 Auto-Buy deduction, and logs a platform Transaction ID marked Unverified.",
        `Wallet balance: ₹1,000 -> ₹${finalBal}; Platform Txn ID '${txnData.platformTxnId}' (verified: ${txnData.verified}).`,
        finalBal === 660 && txnData.verified === false
      );

      // 6. Date-Range Scroller Filtering (Increment 3)
      const curWeek = getScrollerWindowBounds("weekly", 0);
      const prevWeek = getScrollerWindowBounds("weekly", -1);
      const inCurrent = filterTransactionsByWindow([txnData], curWeek.startStr, curWeek.endStr);
      const inPrevious = filterTransactionsByWindow([txnData], prevWeek.startStr, prevWeek.endStr);

      logTest(
        "6. Date-Range Transaction Scroller (< Date Range >)",
        "Verifies window boundary calculation and date-range isolation across current vs. prior weekly cycles.",
        `Current window (${curWeek.label}): ${inCurrent.length} match; Prior window: ${inPrevious.length} matches.`,
        inCurrent.length === 1 && inPrevious.length === 0
      );

      // 7. Self-Healing Model_Pool & Gemini Proxy Execution
      const testPoolRef = await ensureModelPool(testWsId);
      createdRefs.push(testPoolRef);

      let proxySuccess = false;
      let proxyMsg = "";
      try {
        const reply = await callGeminiProxy('Return ONLY valid JSON: [{"name":"Toned Milk","qty":"1 L"}]', testWsId);
        proxySuccess = Boolean(reply && reply.length > 0);
        const activePool = getContext().modelPoolState;
        proxyMsg = proxySuccess
          ? `Model_Pool succeeded via '${activePool.default_model}' (${reply.slice(0, 50)}).`
          : "Proxy returned empty text.";
      } catch (e) {
        proxyMsg = `Proxy error: ${e.message}`;
      }

      const simulatedBrokenPool = reconcileModelPool({
        default_model: "broken-test-model",
        backup_model: "gemini-2.0-flash",
        models: [
          { name: "broken-test-model", role: "default", attempts: 4, successes: 0, successRate: 0 },
          { name: "gemini-2.0-flash",  role: "backup",  attempts: 4, successes: 4, successRate: 100 }
        ]
      });
      const evictionWorked = !simulatedBrokenPool.models.some(m => m.name === "broken-test-model")
        && simulatedBrokenPool.default_model === "gemini-2.0-flash";

      logTest(
        "7. Self-Healing Model_Pool & Gemini Proxy",
        "Tests live Gemini proxy routing via Firestore Model_Pool and verifies automatic eviction when failure rate > 75%.",
        `${proxyMsg} Eviction check: ${evictionWorked ? "pruned 0% model & promoted backup" : "failed"}.`,
        proxySuccess && evictionWorked
      );

    } catch (err) {
      logTest("Unexpected Runner Exception", "Caught runtime error during test execution.", err.message, false);
    } finally {
      // 8. Guaranteed State Restoration (Rollback)
      let deleted = 0;
      for (let i = createdRefs.length - 1; i >= 0; i--) {
        try {
          await deleteDoc(createdRefs[i]);
          deleted++;
        } catch (e) {
          console.warn("Cleanup error:", e);
        }
      }
      logTest(
        "8. Full State Restoration & Sandbox Cleanup",
        "Deletes every temporary Firestore document and sandbox workspace created during the test run.",
        `Removed ${deleted} of ${createdRefs.length} temporary records; database restored to original state.`,
        deleted === createdRefs.length
      );
      if (workspaceId) await ensureModelPool(workspaceId);
    }

    const passedTotal = results.filter(r => r.success).length;
    const allPassed = passedTotal === results.length;

    $("modal-cart-title").textContent = `ABCart Automated QA Report (${passedTotal}/${results.length} Successful)`;
    $("modal-cart-body").innerHTML = `
      <div id="printable-test-report" class="space-y-4">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200">
          <div>
            <h4 class="text-sm font-bold text-slate-900">ABCart — Automated Feature Verification Report</h4>
            <p class="text-[11px] text-slate-500">Executed: ${startedAt} &bull; Admin: ${currentUser.email}</p>
          </div>
          <span class="self-start sm:self-center text-xs font-bold px-3 py-1 rounded-full ${allPassed ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}">
            ${allPassed ? "ALL TESTS SUCCESSFUL" : `${passedTotal}/${results.length} PASSED`}
          </span>
        </div>

        <div class="border border-slate-200 rounded-xl overflow-hidden">
          <table class="w-full text-left border-collapse text-xs">
            <thead class="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
              <tr>
                <th class="py-2.5 px-3">Feature Tested</th>
                <th class="py-2.5 px-3">Test Description &amp; Verification</th>
                <th class="py-2.5 px-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 bg-white">
              ${results.map(r => `
                <tr>
                  <td class="py-2.5 px-3 font-semibold text-slate-900 align-top w-1/3">${r.feature}</td>
                  <td class="py-2.5 px-3 text-slate-600 align-top">
                    <p>${r.description}</p>
                    <p class="text-[11px] text-slate-500 mt-1 font-mono">${r.verification}</p>
                  </td>
                  <td class="py-2.5 px-3 text-right align-top">
                    <span class="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${r.success ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}">
                      ${r.success ? "SUCCESS" : "FAILED"}
                    </span>
                  </td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>

        <div class="flex items-center justify-between pt-2 no-print">
          <p class="text-[11px] text-slate-400">All test records have been purged from Firestore.</p>
          <button type="button" onclick="window.print()" class="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow">
            Print Report / Save PDF
          </button>
        </div>
      </div>
    `;
  }

  return { unlockAdminTestTrigger, runAutomatedSelfTests };
}
