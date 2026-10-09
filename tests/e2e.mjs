/**
 * End-to-end verification against a RUNNING production server.
 *
 * Covers the integrity-critical paths called out in the requirements:
 *   - authentication + session cookies
 *   - unauthorized API access is rejected (401/403)
 *   - role-based authorization boundaries
 *   - order creation and recipe-driven stock deduction (Ghanaian Dishes & Ingredients)
 *   - duplicate/idempotent submission does NOT double-deduct
 *   - concurrent order submission does NOT double-deduct
 *   - payment processing, MoMo integration, and change calculation
 *   - refund requires a manager PIN and restores stock
 *   - goods receipt increases stock
 *
 * Usage: node tests/e2e.mjs [baseUrl]
 */

const BASE = process.argv[2] || "http://127.0.0.1:3000";

let passed = 0;
let failed = 0;
const failures = [];

function check(name, condition, detail = "") {
  if (condition) {
    passed++;
    console.log(`  \x1b[32mPASS\x1b[0m  ${name}`);
  } else {
    failed++;
    failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
    console.log(`  \x1b[31mFAIL\x1b[0m  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function section(title) {
  console.log(`\n\x1b[1m\x1b[36m${title}\x1b[0m`);
}

/** Minimal cookie jar so we can hold a real signed session. */
function makeSession() {
  let cookie = "";
  return {
    get cookie() {
      return cookie;
    },
    async fetch(path, options = {}) {
      const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
      if (cookie) headers.Cookie = cookie;
      const res = await fetch(`${BASE}${path}`, { ...options, headers });
      const setCookie = res.headers.get("set-cookie");
      if (setCookie) {
        const match = setCookie.match(/pos_session=([^;]*)/);
        if (match) cookie = `pos_session=${match[1]}`;
      }
      let body = null;
      try {
        body = await res.json();
      } catch {
        body = null;
      }
      return { status: res.status, body };
    },
  };
}

async function login(session, pin) {
  return session.fetch("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ pin }),
  });
}

async function getIngredientByName(session, name) {
  const { body } = await session.fetch("/api/inventory");
  return (body.ingredients || []).find((i) => i.name === name);
}

async function run() {
  console.log(`\n\x1b[1mGhanaian Restaurant POS — End-to-End Integrity Tests\x1b[0m`);
  console.log(`Target: ${BASE}`);

  // ---------------------------------------------------------------- health
  section("1. Service health");
  {
    const res = await fetch(`${BASE}/api/health`);
    const body = await res.json();
    check("GET /api/health returns ok", res.status === 200 && body.ok === true);
  }

  // ------------------------------------------------------ unauthenticated
  section("2. Unauthenticated access is rejected");
  {
    const anon = makeSession();

    const me = await anon.fetch("/api/auth/me");
    check("GET /api/auth/me reports unauthenticated", me.body?.authenticated === false);

    const order = await anon.fetch("/api/orders", {
      method: "POST",
      body: JSON.stringify({ items: [{ menuItemId: 1, itemName: "X", quantity: 1, unitPrice: "1", totalPrice: "1" }] }),
    });
    check("POST /api/orders without session is blocked", order.status === 401, `got ${order.status}`);

    const staff = await anon.fetch("/api/staff");
    check("GET /api/staff without session is blocked", staff.status === 401, `got ${staff.status}`);

    const inv = await anon.fetch("/api/inventory", {
      method: "POST",
      body: JSON.stringify({ action: "adjust_stock", ingredientId: 1, delta: 999 }),
    });
    check("POST /api/inventory without session is blocked", inv.status === 401, `got ${inv.status}`);
  }

  // --------------------------------------------------------------- authn
  section("3. Authentication");
  const cashier = makeSession();
  {
    const bad = await cashier.fetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "manager@asankaroyal.com", password: "wrong-password" }),
    });
    check("Login with wrong password is rejected", bad.status === 401, `got ${bad.status}`);

    const good = await cashier.fetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "cashier@asankaroyal.com", password: "Admin123!" }),
    });
    check("Login with correct password succeeds", good.status === 200 && good.body?.success === true);
    check("Session cookie issued", cashier.cookie.startsWith("pos_session="));

    const me = await cashier.fetch("/api/auth/me");
    check("Session resolves to the cashier role", me.body?.user?.role === "cashier", `got ${me.body?.user?.role}`);

    const pinSession = makeSession();
    const byPin = await login(pinSession, "1111");
    check("PIN login succeeds for Ghanaian restaurant owner (Nana Kwame)", byPin.status === 200 && byPin.body?.user?.role === "super_admin");

    const badPin = await makeSession().fetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ pin: "0000" }),
    });
    check("Unknown PIN is rejected", badPin.status === 401, `got ${badPin.status}`);
  }

  // ------------------------------------------- kitchen has no app access
  section("3b. Kitchen staff cannot sign in (paper docket workflow)");
  {
    const kitchen = makeSession();
    const attempt = await login(kitchen, "4444");
    check("Kitchen PIN is refused at login", attempt.status === 403, `got ${attempt.status}`);
    check(
      "Refusal explains the printed-docket workflow",
      /printed|docket/i.test(attempt.body?.error || ""),
      attempt.body?.error
    );
    check("No session cookie issued to kitchen", !kitchen.cookie, kitchen.cookie);

    // Confirm the refusal is server-side, not just a hidden UI option.
    const directOrder = await kitchen.fetch("/api/orders", {
      method: "POST",
      body: JSON.stringify({ items: [{ menuItemId: 1, itemName: "X", quantity: 1, unitPrice: "1", totalPrice: "1" }] }),
    });
    check("Kitchen session cannot create orders", directOrder.status === 401, `got ${directOrder.status}`);

    const pinSwitch = await makeSession().fetch("/api/auth/switch-pin", {
      method: "POST",
      body: JSON.stringify({ pin: "4444" }),
    });
    check("Kitchen PIN cannot hijack an existing session", pinSwitch.status === 403, `got ${pinSwitch.status}`);

    // Front-of-house must still be able to reprint dockets for the kitchen.
    const { body: menuBody } = await cashier.fetch("/api/menu");
    const anyItem = (menuBody.items || [])[0];
    const ord = await cashier.fetch("/api/orders", {
      method: "POST",
      body: JSON.stringify({
        branchId: 1,
        orderType: "dine_in",
        tableId: 2,
        customerName: "E2E Docket Print",
        subtotal: anyItem.price,
        taxAmount: "0.00",
        totalAmount: anyItem.price,
        items: [
          {
            menuItemId: anyItem.id,
            itemName: anyItem.name,
            quantity: 1,
            unitPrice: anyItem.price,
            totalPrice: anyItem.price,
            costPrice: anyItem.costPrice,
            station: anyItem.station || "kitchen",
            specialInstructions: "Extra hot shito",
          },
        ],
      }),
    });
    check("Order created for docket printing", ord.status === 200 && ord.body?.success === true);
    check(
      "Order response carries the docket number",
      !!ord.body?.order?.orderNumber,
      ord.body?.order?.orderNumber
    );
    const createdItems = ord.body?.order?.items || [];
    check(
      "Order response carries printable line items with station routing",
      createdItems.length > 0 && !!createdItems[0].station && !!createdItems[0].itemName,
      JSON.stringify(createdItems[0] || {}).slice(0, 90)
    );
  }

  // ------------------------------------------------------------- authz
  section("4. Role-based authorization boundaries");
  {
    // Cashier must NOT manage staff, change settings, or alter stock.
    const staffAttempt = await cashier.fetch("/api/staff");
    check("Cashier cannot read staff roster (403)", staffAttempt.status === 403, `got ${staffAttempt.status}`);

    const settingsAttempt = await cashier.fetch("/api/settings", {
      method: "POST",
      body: JSON.stringify({ restaurantData: { name: "Hacked" } }),
    });
    check("Cashier cannot change settings (403)", settingsAttempt.status === 403, `got ${settingsAttempt.status}`);

    const stockAttempt = await cashier.fetch("/api/inventory", {
      method: "POST",
      body: JSON.stringify({ action: "adjust_stock", ingredientId: 1, delta: 500, reason: "unauthorized" }),
    });
    check("Cashier cannot adjust stock (403)", stockAttempt.status === 403, `got ${stockAttempt.status}`);

    const auditAttempt = await cashier.fetch("/api/audit-logs");
    check("Cashier cannot read audit logs (403)", auditAttempt.status === 403, `got ${auditAttempt.status}`);

    // Owner MUST be able to do all of the above.
    const owner = makeSession();
    await login(owner, "1111");
    const ownerStaff = await owner.fetch("/api/staff");
    check("Owner can read staff roster (200)", ownerStaff.status === 200, `got ${ownerStaff.status}`);
    const ownerAudit = await owner.fetch("/api/audit-logs");
    check("Owner can read audit logs (200)", ownerAudit.status === 200, `got ${ownerAudit.status}`);
  }

  // ------------------------------------------- order -> recipe deduction (Tilapia with Banku)
  section("5. Order creation deducts recipe ingredients (Volta Tilapia)");
  const inventoryOfficer = makeSession();
  await login(inventoryOfficer, "5555");

  // The Charcoal-Grilled Volta Lake Whole Tilapia recipe consumes 1 whole tilapia per order.
  const tilapiaBefore = await getIngredientByName(inventoryOfficer, "Fresh Whole Volta Tilapia (Large)");
  check("Baseline Volta Tilapia located", !!tilapiaBefore, "Fresh Whole Volta Tilapia (Large) missing");

  const { body: menu } = await cashier.fetch("/api/menu");
  const tilapiaDish = (menu.items || []).find((i) => i.sku === "GHA-TIL-01");
  check("Ghanaian Grilled Tilapia menu item located", !!tilapiaDish);

  let createdOrderId = null;
  let createdOrderNumber = null;
  if (tilapiaDish && tilapiaBefore) {
    const qty = 2;
    const res = await cashier.fetch("/api/orders", {
      method: "POST",
      body: JSON.stringify({
        branchId: 1,
        orderType: "takeaway",
        customerName: "Kwame Asante",
        subtotal: (Number(tilapiaDish.price) * qty).toFixed(2),
        taxAmount: "0.00",
        totalAmount: (Number(tilapiaDish.price) * qty).toFixed(2),
        items: [
          {
            menuItemId: tilapiaDish.id,
            itemName: tilapiaDish.name,
            quantity: qty,
            unitPrice: tilapiaDish.price,
            totalPrice: (Number(tilapiaDish.price) * qty).toFixed(2),
            costPrice: tilapiaDish.costPrice,
            station: "grill",
          },
        ],
      }),
    });
    check("Order created successfully", res.status === 200 && res.body?.success === true);
    createdOrderId = res.body?.order?.id;
    createdOrderNumber = res.body?.order?.orderNumber;

    const tilapiaAfter = await getIngredientByName(inventoryOfficer, "Fresh Whole Volta Tilapia (Large)");
    const consumed = Number(tilapiaBefore.currentStock) - Number(tilapiaAfter.currentStock);
    check(
      `Selling ${qty} grilled tilapias consumed exactly ${qty} whole fish`,
      Math.abs(consumed - qty) < 0.001,
      `consumed ${consumed}`
    );
  }

  // ------------------------------------------ Room Service billing rules
  section("5b. Room-service charge, room-number docket & comp breakfast");
  {
    const unitPrice = Number(tilapiaDish.price);
    const makePayload = (extra = {}) => ({
      branchId: 1,
      orderType: "room_service",
      roomNumber: "204",
      customerName: "Room Guest",
      // Deliberately forge the client totals and unit price. The server must
      // resolve the menu's GH₵120 price and add the configurable room fee.
      subtotal: "0.01",
      taxAmount: "0.00",
      totalAmount: "0.01",
      items: [{
        menuItemId: tilapiaDish.id,
        itemName: "Forged menu name",
        quantity: 1,
        unitPrice: "0.01",
        totalPrice: "0.01",
        station: "grill",
      }],
      ...extra,
    });

    const roomOrder = await cashier.fetch("/api/orders", {
      method: "POST",
      body: JSON.stringify(makePayload()),
    });
    check("Room-service order created", roomOrder.status === 200 && roomOrder.body?.success === true);
    check("Room number is saved on the order", roomOrder.body?.order?.roomNumber === "204", `${roomOrder.body?.order?.roomNumber}`);
    check("Server ignores forged subtotal and uses menu price", Number(roomOrder.body?.order?.subtotal) === unitPrice, `${roomOrder.body?.order?.subtotal}`);
    check("Room-service charge defaults to GH₵30", Number(roomOrder.body?.order?.roomCharge) === 30, `${roomOrder.body?.order?.roomCharge}`);
    check("VAT includes food plus room-service charge", Number(roomOrder.body?.order?.taxAmount) === Number(((unitPrice + 30) * 0.15).toFixed(2)), `${roomOrder.body?.order?.taxAmount}`);
    check("Room-service total includes GH₵30 + VAT", Number(roomOrder.body?.order?.totalAmount) === Number((unitPrice + 30 + (unitPrice + 30) * 0.15).toFixed(2)), `${roomOrder.body?.order?.totalAmount}`);
    check("Room-service ticket item uses database menu name and price", roomOrder.body?.order?.items?.[0]?.itemName === tilapiaDish.name && Number(roomOrder.body?.order?.items?.[0]?.unitPrice) === unitPrice);

    const missingRoom = await cashier.fetch("/api/orders", {
      method: "POST",
      body: JSON.stringify({ ...makePayload(), roomNumber: "" }),
    });
    check("Room-service order without room number is rejected", missingRoom.status === 400, `got ${missingRoom.status}`);

    const dineIn = await cashier.fetch("/api/orders", {
      method: "POST",
      body: JSON.stringify({ ...makePayload(), orderType: "dine_in", roomNumber: null }),
    });
    check("Restaurant table dining has no room-service fee", Number(dineIn.body?.order?.roomCharge) === 0, `${dineIn.body?.order?.roomCharge}`);

    const takeaway = await cashier.fetch("/api/orders", {
      method: "POST",
      body: JSON.stringify({ ...makePayload(), orderType: "takeaway", roomNumber: null }),
    });
    check("Takeaway has no room-service fee", Number(takeaway.body?.order?.roomCharge) === 0, `${takeaway.body?.order?.roomCharge}`);

    const comp = await cashier.fetch("/api/orders", {
      method: "POST",
      body: JSON.stringify(makePayload({ isComplimentary: true, complimentaryReason: "Complimentary breakfast — room guest" })),
    });
    check("Complimentary breakfast order created", comp.status === 200 && comp.body?.success === true);
    check("Complimentary bill is GH₵0, with no tax or room fee", Number(comp.body?.order?.totalAmount) === 0 && Number(comp.body?.order?.taxAmount) === 0 && Number(comp.body?.order?.roomCharge) === 0);
    check("Complimentary order retains retail value for audit", Number(comp.body?.order?.compValue) === unitPrice, `${comp.body?.order?.compValue}`);
    check("Complimentary order is marked settled without payment", comp.body?.order?.paymentStatus === "paid" && Number(comp.body?.order?.paidAmount) === 0);

    const compOutsideRoom = await cashier.fetch("/api/orders", {
      method: "POST",
      body: JSON.stringify({ ...makePayload({ isComplimentary: true }), orderType: "takeaway", roomNumber: null }),
    });
    check("Complimentary breakfast cannot be used for takeaway", compOutsideRoom.status === 400, `got ${compOutsideRoom.status}`);
  }

  // --------------------------------------------------- idempotency guard
  section("6. Duplicate submission does not double-deduct");
  {
    const key = `e2e-idem-${Date.now()}`;
    const before = await getIngredientByName(inventoryOfficer, "Fresh Whole Volta Tilapia (Large)");

    const payload = {
      branchId: 1,
      orderType: "takeaway",
      customerName: "E2E Idempotency Ghana",
      idempotencyKey: key,
      subtotal: tilapiaDish.price,
      taxAmount: "0.00",
      totalAmount: tilapiaDish.price,
      items: [
        {
          menuItemId: tilapiaDish.id,
          itemName: tilapiaDish.name,
          quantity: 1,
          unitPrice: tilapiaDish.price,
          totalPrice: tilapiaDish.price,
          costPrice: tilapiaDish.costPrice,
          station: "grill",
        },
      ],
    };

    const first = await cashier.fetch("/api/orders", { method: "POST", body: JSON.stringify(payload) });
    const second = await cashier.fetch("/api/orders", { method: "POST", body: JSON.stringify(payload) });

    check("Replayed request is flagged as duplicate", second.body?.duplicate === true);
    check(
      "Replay returns the same order number",
      first.body?.order?.orderNumber === second.body?.order?.orderNumber,
      `${first.body?.order?.orderNumber} vs ${second.body?.order?.orderNumber}`
    );

    const after = await getIngredientByName(inventoryOfficer, "Fresh Whole Volta Tilapia (Large)");
    const consumed = Number(before.currentStock) - Number(after.currentStock);
    check(
      "Two identical submissions consumed stock only once",
      Math.abs(consumed - 1) < 0.001,
      `consumed ${consumed}, expected 1`
    );
  }

  // ------------------------------------------------- concurrency safety
  section("7. Concurrent orders deduct stock exactly once each");
  {
    const before = await getIngredientByName(inventoryOfficer, "Fresh Whole Volta Tilapia (Large)");
    const CONCURRENT = 5;

    const build = (n) => ({
      branchId: 1,
      orderType: "takeaway",
      customerName: `E2E Concurrent ${n}`,
      idempotencyKey: `e2e-conc-${Date.now()}-${n}`,
      subtotal: tilapiaDish.price,
      taxAmount: "0.00",
      totalAmount: tilapiaDish.price,
      items: [
        {
          menuItemId: tilapiaDish.id,
          itemName: tilapiaDish.name,
          quantity: 1,
          unitPrice: tilapiaDish.price,
          totalPrice: tilapiaDish.price,
          costPrice: tilapiaDish.costPrice,
          station: "grill",
        },
      ],
    });

    const results = await Promise.all(
      Array.from({ length: CONCURRENT }, (_, n) =>
        cashier.fetch("/api/orders", { method: "POST", body: JSON.stringify(build(n)) })
      )
    );

    const okCount = results.filter((r) => r.status === 200 && r.body?.success).length;
    check(`All ${CONCURRENT} concurrent orders succeeded`, okCount === CONCURRENT, `got ${okCount}`);

    const after = await getIngredientByName(inventoryOfficer, "Fresh Whole Volta Tilapia (Large)");
    const consumed = Number(before.currentStock) - Number(after.currentStock);
    check(
      `${CONCURRENT} parallel orders consumed exactly ${CONCURRENT} units (no lost updates)`,
      Math.abs(consumed - CONCURRENT) < 0.001,
      `consumed ${consumed}, expected ${CONCURRENT}`
    );
  }

  // ------------------------------------------------------------ payment (MoMo / Cash)
  section("8. Payment processing, MoMo tender & change calculation");
  let paidOrderId = null;
  {
    const res = await cashier.fetch("/api/orders", {
      method: "POST",
      body: JSON.stringify({
        branchId: 1,
        orderType: "takeaway",
        customerName: "E2E MoMo Customer",
        subtotal: "120.00",
        taxAmount: "0.00",
        totalAmount: "120.00",
        items: [
          {
            menuItemId: tilapiaDish.id,
            itemName: tilapiaDish.name,
            quantity: 1,
            unitPrice: "120.00",
            totalPrice: "120.00",
            costPrice: tilapiaDish.costPrice,
            station: "grill",
          },
        ],
      }),
    });
    paidOrderId = res.body?.order?.id;
    const paidOrderTotal = Number(res.body?.order?.totalAmount || 0);

    const pay = await cashier.fetch(`/api/orders/${paidOrderId}/pay`, {
      method: "POST",
      body: JSON.stringify({
        amount: res.body?.order?.totalAmount,
        paymentMethod: "momo",
        referenceNumber: "MOMO-RECORDED-BY-STAFF",
      }),
    });
    check("Mobile Money payment accepted", pay.status === 200 && pay.body?.success === true);
    check("Order marked fully paid", pay.body?.isFullyPaid === true);
    check("Order status moved to completed", pay.body?.order?.status === "completed", `got ${pay.body?.order?.status}`);

    // Tender restriction: this restaurant settles by MoMo or cash only.
    const cardAttempt = await cashier.fetch(`/api/orders/${paidOrderId}/pay`, {
      method: "POST",
      body: JSON.stringify({ amount: "10.00", paymentMethod: "card" }),
    });
    check("Card tender is rejected (MoMo & cash only)", cardAttempt.status === 400, `got ${cardAttempt.status}`);

    const stripeAttempt = await cashier.fetch(`/api/orders/${paidOrderId}/pay`, {
      method: "POST",
      body: JSON.stringify({ amount: "10.00", paymentMethod: "stripe" }),
    });
    check("Stripe tender is rejected (MoMo & cash only)", stripeAttempt.status === 400, `got ${stripeAttempt.status}`);
  }

  // --------------------------------------------- cash tender & change
  section("8b. Cash tender and change calculation");
  {
    const res = await cashier.fetch("/api/orders", {
      method: "POST",
      body: JSON.stringify({
        branchId: 1,
        orderType: "takeaway",
        customerName: "E2E Cash Customer",
        subtotal: "60.00",
        taxAmount: "0.00",
        totalAmount: "60.00",
        items: [
          {
            menuItemId: tilapiaDish.id,
            itemName: tilapiaDish.name,
            quantity: 1,
            unitPrice: "60.00",
            totalPrice: "60.00",
            costPrice: tilapiaDish.costPrice,
            station: "grill",
          },
        ],
      }),
    });
    const cashOrderId = res.body?.order?.id;
    const cashDue = Number(res.body?.order?.totalAmount || 0);
    const cashTendered = cashDue + 40;

    const pay = await cashier.fetch(`/api/orders/${cashOrderId}/pay`, {
      method: "POST",
      body: JSON.stringify({ amount: cashDue.toFixed(2), paymentMethod: "cash", cashTendered: cashTendered.toFixed(2) }),
    });
    check("Cash payment accepted", pay.status === 200 && pay.body?.success === true);
    check("Change computed correctly from authoritative bill (GH₵40 over-tender)", pay.body?.changeGiven === "40.00", `got ${pay.body?.changeGiven}`);
  }

  // --------------------------------------------- split payment (Cash + MoMo)
  section("8c. Split payment (Cash + MoMo) option");
  {
    const res = await cashier.fetch("/api/orders", {
      method: "POST",
      body: JSON.stringify({
        branchId: 1,
        orderType: "dine_in",
        customerName: "E2E Split Customer",
        subtotal: "120.00",
        taxAmount: "0.00",
        totalAmount: "120.00",
        items: [
          {
            menuItemId: tilapiaDish.id,
            itemName: tilapiaDish.name,
            quantity: 1,
            unitPrice: "120.00",
            totalPrice: "120.00",
            costPrice: tilapiaDish.costPrice,
            station: "grill",
          },
        ],
      }),
    });
    const splitOrderId = res.body?.order?.id;
    const splitDue = Number(res.body?.order?.totalAmount || 0);

    // Underpaid split should be rejected.
    const underpaid = await cashier.fetch(`/api/orders/${splitOrderId}/pay`, {
      method: "POST",
      body: JSON.stringify({
        amount: splitDue.toFixed(2),
        paymentMethod: "split",
        cashAmount: "40.00",
        momoAmount: "50.00",
      }),
    });
    check("Underpaid split is rejected", underpaid.status === 400, `got ${underpaid.status}`);

    // Valid split: GH₵50 Cash + the balance by MoMo.
    const splitCash = 50;
    const splitMomo = splitDue - splitCash;
    const validSplit = await cashier.fetch(`/api/orders/${splitOrderId}/pay`, {
      method: "POST",
      body: JSON.stringify({
        amount: splitDue.toFixed(2),
        paymentMethod: "split",
        cashAmount: splitCash.toFixed(2),
        momoAmount: splitMomo.toFixed(2),
        cashTendered: "100.00",
        referenceNumber: "SPLIT-MOMO-RECORDED",
      }),
    });
    check("Split (Cash + MoMo) payment accepted", validSplit.status === 200 && validSplit.body?.success === true);
    check("Split change calculated on the cash portion (GH₵100 - GH₵50 = GH₵50)", validSplit.body?.changeGiven === "50.00", `got ${validSplit.body?.changeGiven}`);
    check("Split order marked fully paid", validSplit.body?.isFullyPaid === true);
    check("Split writes one cash row and one MoMo row", validSplit.body?.payments?.length === 2 &&
      validSplit.body.payments.some((p) => p.paymentMethod === "cash") &&
      validSplit.body.payments.some((p) => p.paymentMethod === "momo"));

    // Paying an already-settled order again must be refused, not double-booked.
    const again = await cashier.fetch(`/api/orders/${splitOrderId}/pay`, {
      method: "POST",
      body: JSON.stringify({ amount: "120.00", paymentMethod: "cash", cashTendered: "120.00" }),
    });
    check("Already-paid order cannot be paid again (409)", again.status === 409, `got ${again.status}`);

    const mk = (name) => cashier.fetch("/api/orders", {
      method: "POST",
      body: JSON.stringify({
        branchId: 1, orderType: "takeaway", customerName: name,
        subtotal: "50.00", taxAmount: "0.00", totalAmount: "50.00",
        items: [{ menuItemId: tilapiaDish.id, itemName: tilapiaDish.name, quantity: 1,
          unitPrice: "50.00", totalPrice: "50.00", costPrice: tilapiaDish.costPrice, station: "grill" }],
      }),
    });

    // Split that adds up to MORE than the bill is rejected.
    const overOrderObj = (await mk("E2E Overpay")).body?.order;
    const overOrderId = overOrderObj?.id;
    const overOrderTotal = Number(overOrderObj?.totalAmount || 0);

    const overSplit = await cashier.fetch(`/api/orders/${overOrderId}/pay`, {
      method: "POST",
      body: JSON.stringify({
        amount: overOrderTotal.toFixed(2),
        paymentMethod: "split",
        cashAmount: "30.00",
        momoAmount: (overOrderTotal + 10).toFixed(2),
      }),
    });
    check("Split totalling more than the bill is rejected", overSplit.status === 400, `got ${overSplit.status}`);
    const overTooMuch = await cashier.fetch(`/api/orders/${overOrderId}/pay`, {
      method: "POST",
      body: JSON.stringify({ amount: (overOrderTotal + 100).toFixed(2), paymentMethod: "momo" }),
    });
    check("Paying more than is owed is rejected", overTooMuch.status === 400, `got ${overTooMuch.status}`);
    const stillOwed = await cashier.fetch(`/api/orders/${overOrderId}`);
    check("Rejected attempts leave the order unpaid", Number(stillOwed.body?.order?.paidAmount) === 0);

    // A double-tapped Settle button: only one of two simultaneous requests may win.
    const raceOrderObj = (await mk("E2E Double Tap")).body?.order;
    const raceOrderId = raceOrderObj?.id;
    const raceOrderTotal = raceOrderObj?.totalAmount;
    const body = JSON.stringify({ amount: raceOrderTotal, paymentMethod: "momo", referenceNumber: "RACE" });
    const race = await Promise.all([
      cashier.fetch(`/api/orders/${raceOrderId}/pay`, { method: "POST", body }),
      cashier.fetch(`/api/orders/${raceOrderId}/pay`, { method: "POST", body }),
    ]);
    check("Simultaneous double settle: exactly one succeeds",
      race.filter((r) => r.status === 200).length === 1 && race.filter((r) => r.status === 409).length === 1,
      race.map((r) => r.status).join(","));
    const raced = await cashier.fetch(`/api/orders/${raceOrderId}`);
    check(`Double settle recorded the bill once (GH₵${raceOrderTotal})`, Number(raced.body?.order?.paidAmount) === Number(raceOrderTotal));
  }

  // ---------------------------------------- no fake payment gateway
  section("8d. No payment gateway is simulated");
  {
    const owner = makeSession();
    await login(owner, "1111");
    const fake = await owner.fetch("/api/integrations", {
      method: "POST", body: JSON.stringify({ action: "test_momo", amount: "50.00" }),
    });
    check("Fake MoMo approval endpoint returns 501, not success", fake.status === 501 && !fake.body?.success, `got ${fake.status}`);
    const anon = await makeSession().fetch("/api/integrations", {
      method: "POST", body: JSON.stringify({ action: "export_accounting", format: "xero" }),
    });
    check("Integrations endpoint requires sign-in (401)", anon.status === 401, `got ${anon.status}`);
    const csv = await cashier.fetch("/api/integrations", {
      method: "POST", body: JSON.stringify({ action: "export_accounting", format: "xero" }),
    });
    check("Cashier cannot export accounting data (403)", csv.status === 403, `got ${csv.status}`);
    const ok = await owner.fetch("/api/integrations", {
      method: "POST", body: JSON.stringify({ action: "export_accounting", format: "xero" }),
    });
    check("Owner can export the sales CSV", ok.status === 200 && ok.body?.recordCount > 0);
  }

  // ------------------------------------------------------------- refund
  section("9. Refunds require manager authorization");
  {
    const noPin = await cashier.fetch(`/api/orders/${paidOrderId}/refund`, {
      method: "POST",
      body: JSON.stringify({ amount: "120.00", reason: "E2E no pin" }),
    });
    check("Refund without manager PIN is rejected", noPin.status === 403, `got ${noPin.status}`);

    const wrongPin = await cashier.fetch(`/api/orders/${paidOrderId}/refund`, {
      method: "POST",
      body: JSON.stringify({ amount: "120.00", reason: "E2E bad pin", managerPin: "3333" }),
    });
    check("Refund with a cashier PIN is rejected", wrongPin.status === 403, `got ${wrongPin.status}`);

    const before = await getIngredientByName(inventoryOfficer, "Fresh Whole Volta Tilapia (Large)");
    const good = await cashier.fetch(`/api/orders/${paidOrderId}/refund`, {
      method: "POST",
      body: JSON.stringify({ amount: "120.00", reason: "E2E authorized", managerPin: "2222", returnStock: true }),
    });
    check("Refund with manager PIN succeeds", good.status === 200 && good.body?.success === true, `got ${good.status}`);

    const after = await getIngredientByName(inventoryOfficer, "Fresh Whole Volta Tilapia (Large)");
    const restored = Number(after.currentStock) - Number(before.currentStock);
    check("Refund restored the whole tilapia to inventory", Math.abs(restored - 1) < 0.001, `restored ${restored}`);

    // Replaying the refund must not restore stock a second time.
    const beforeReplay = Number(after.currentStock);
    await cashier.fetch(`/api/orders/${paidOrderId}/refund`, {
      method: "POST",
      body: JSON.stringify({ amount: "120.00", reason: "E2E replay", managerPin: "2222", returnStock: true }),
    });
    const afterReplay = await getIngredientByName(inventoryOfficer, "Fresh Whole Volta Tilapia (Large)");
    check(
      "Replayed refund does not restore stock twice",
      Math.abs(Number(afterReplay.currentStock) - beforeReplay) < 0.001,
      `${beforeReplay} -> ${afterReplay.currentStock}`
    );
  }

  // --------------------------------------------------- goods receiving
  section("10. Goods receipt increases Ghanaian stock (Tema Fish Depot)");
  {
    const before = await getIngredientByName(inventoryOfficer, "Fresh Whole Volta Tilapia (Large)");
    const { body: sup } = await inventoryOfficer.fetch("/api/purchasing/suppliers");
    const supplier = sup.suppliers?.[0];

    const po = await inventoryOfficer.fetch("/api/purchasing/orders", {
      method: "POST",
      body: JSON.stringify({
        supplierId: supplier.id,
        notes: "E2E fresh fish receiving test",
        items: [{ ingredientId: before.id, orderedQuantity: "20", unitPrice: "38.00", unit: "pcs" }],
      }),
    });
    check("Purchase order created for Tema Fish Depot", po.status === 200 && po.body?.success === true);

    const { body: poList } = await inventoryOfficer.fetch("/api/purchasing/orders");
    const created = poList.purchaseOrders.find((p) => p.id === po.body.purchaseOrder.id);

    const grn = await inventoryOfficer.fetch("/api/purchasing/orders", {
      method: "PATCH",
      body: JSON.stringify({
        purchaseOrderId: created.id,
        action: "receive_goods",
        invoiceNumber: "TEMA-GRN-001",
        receivedItems: created.items.map((it) => ({
          poItemId: it.id,
          ingredientId: it.ingredientId,
          receivedQuantity: it.orderedQuantity,
          unitPrice: it.unitPrice,
        })),
      }),
    });
    check("Goods receipt processed", grn.status === 200 && grn.body?.success === true);

    const after = await getIngredientByName(inventoryOfficer, "Fresh Whole Volta Tilapia (Large)");
    const gained = Number(after.currentStock) - Number(before.currentStock);
    check("Receiving 20 tilapias raised stock by 20", Math.abs(gained - 20) < 0.001, `gained ${gained}`);
  }

  // ------------------------------------------------------------ reports
  section("11. Reporting reflects real Ghanaian transactions in GH₵");
  {
    const owner = makeSession();
    await login(owner, "1111");
    const { status, body } = await owner.fetch("/api/reports?timeframe=all");
    check("Reports endpoint responds", status === 200);
    check("Revenue is a positive GH₵ number", Number(body.summary?.totalSales) > 0, `${body.summary?.totalSales}`);
    check("Gross profit is computed in Cedis", body.summary?.grossProfit !== undefined);
    check("Food cost percentage is computed", body.summary?.foodCostPercentage !== undefined);
    check("Category breakdown present", Array.isArray(body.categoryBreakdown));
  }

  // ------------------------------------------------------------- logout
  section("12. Logout clears the session");
  {
    const out = await cashier.fetch("/api/auth/logout", { method: "POST" });
    check("Logout succeeds", out.status === 200);
    const me = await fetch(`${BASE}/api/auth/me`);
    const body = await me.json();
    check("Fresh client is unauthenticated", body.authenticated === false);
  }

  // -------------------------------------------------------------- report
  console.log(`\n${"=".repeat(58)}`);
  console.log(`\x1b[1mRESULTS:\x1b[0m \x1b[32m${passed} passed\x1b[0m, ${failed > 0 ? `\x1b[31m${failed} failed\x1b[0m` : "0 failed"}`);
  if (failures.length) {
    console.log(`\n\x1b[31mFailures:\x1b[0m`);
    failures.forEach((f) => console.log(`  - ${f}`));
  }
  console.log(`${"=".repeat(58)}\n`);

  process.exit(failed === 0 ? 0 : 1);
}

run().catch((err) => {
  console.error("\nTest harness crashed:", err);
  process.exit(1);
});
