/* Shared behaviour for the three Till concepts. Each page supplies its own chrome + CSS;
   this renders the dynamic parts (categories, tables, dish grid, ticket, pay sheet) into
   [data-slot] mount points using stable class names the concept stylesheets target.
   Pure vanilla JS, no build, nothing persisted. */
(() => {
  const IMG = (f) => `/assets/menu-images/${f}.jpg`;
  const MENU = [
    { id: "waakye", name: "Waakye", desc: "Rice & beans, shito, gari, egg", price: 4500, cat: "Kitchen", img: "waakye", mins: 12 },
    { id: "jollof", name: "Jollof Rice & Grilled Chicken", desc: "Smoky party jollof, charred thigh", price: 6500, cat: "Kitchen", img: "jollof-rice-grilled-chicken", mins: 18 },
    { id: "banku", name: "Banku & Grilled Tilapia", desc: "Corn dough, whole tilapia, pepper", price: 8000, cat: "Kitchen", img: "banku-grilled-tilapia", mins: 22 },
    { id: "fufu", name: "Fufu & Groundnut Soup", desc: "Pounded cassava-plantain, goat", price: 6000, cat: "Kitchen", img: "fufu-groundnut-soup", mins: 20 },
    { id: "kontomire", name: "Kontomire (Palava Sauce)", desc: "Cocoyam leaves, egusi, boiled yam", price: 5000, cat: "Kitchen", img: "kontomire", mins: 15 },
    { id: "kenkey", name: "Kenkey & Fried Fish", desc: "Ga kenkey, fried redfish, pepper", price: 4500, cat: "Kitchen", img: "kenkey-fried-fish", mins: 14 },
    { id: "redred", name: "Red Red", desc: "Bean stew, fried plantain, gari", price: 4000, cat: "Kitchen", img: "red-red", mins: 12 },
    { id: "omotuo", name: "Omo Tuo with Soup", desc: "Rice balls, light soup", price: 5500, cat: "Kitchen", img: "omo-tuo", mins: 16 },
    { id: "friedrice", name: "Fried Rice & Grilled Chicken", desc: "Wok rice, vegetables, chicken", price: 6500, cat: "Kitchen", img: "fried-rice-grilled-chicken", mins: 15 },
    { id: "tilapia", name: "Grilled Tilapia", desc: "Whole fish, ginger-pepper rub", price: 7000, cat: "Grill", img: "grilled-tilapia", mins: 25 },
    { id: "chicken", name: "Grilled Chicken", desc: "Half chicken, suya spice", price: 5500, cat: "Grill", img: "grilled-chicken", mins: 20 },
    { id: "suya", name: "Beef Suya", desc: "Skewers, yaji, onions", price: 3500, cat: "Grill", img: "beef-suya", mins: 10 },
    { id: "kelewele", name: "Kelewele", desc: "Spiced fried plantain, peanuts", price: 2000, cat: "Snacks", img: "kelewele", mins: 8 },
    { id: "meatpie", name: "Meat Pie", desc: "Flaky pastry, minced beef", price: 1500, cat: "Snacks", img: "meat-pie", mins: 2 },
    { id: "puffpuff", name: "Puff Puff", desc: "Sweet fried dough, 6 pcs", price: 1000, cat: "Snacks", img: "puff-puff", mins: 5 },
    { id: "sobolo", name: "Sobolo", desc: "Hibiscus, ginger, pineapple", price: 1200, cat: "Drinks", img: "sobolo", mins: 0 },
    { id: "palmwine", name: "Palm Wine", desc: "Fresh, chilled, 500 ml", price: 2500, cat: "Drinks", img: "palm-wine", mins: 0 },
  ];
  const CATS = ["Kitchen", "Grill", "Snacks", "Drinks"];
  const TABLES = [
    { id: "t1", code: "01", name: "Table 01", seats: 2, status: "free" },
    { id: "t2", code: "02", name: "Table 02", seats: 4, status: "cleaning" },
    { id: "t3", code: "03", name: "Table 03", seats: 4, status: "open", total: 24610, mins: 31 },
    { id: "t4", code: "04", name: "Table 04", seats: 4, status: "free" },
    { id: "t5", code: "05", name: "Table 05", seats: 6, status: "open", total: 9775, mins: 6 },
    { id: "t6", code: "06", name: "Table 06", seats: 4, status: "reserved" },
    { id: "t7", code: "07", name: "Table 07", seats: 4, status: "current", mins: 12 },
    { id: "t8", code: "08", name: "Table 08", seats: 8, status: "free" },
    { id: "bar", code: "Bar", name: "The bar", seats: 6, status: "free" },
    { id: "r12", code: "R12", name: "Room 12", seats: 2, status: "free" },
    { id: "ta", code: "T/A", name: "Takeaway", seats: 0, status: "free" },
  ];
  const VAT = 15;

  const state = {
    cat: "Kitchen",
    q: "",
    table: "t7",
    lines: [
      { id: "jollof", qty: 1, note: "", sent: true },
      { id: "suya", qty: 1, note: "no onions", sent: true },
      { id: "sobolo", qty: 2, note: "chilled", sent: false },
    ],
    pay: null, // { tender: 'cash'|'momo'|'split', amount: '' , network }
  };

  const item = (id) => MENU.find((m) => m.id === id);
  const money = (c, sym = true) => `${sym ? "GH₵ " : ""}${(c / 100).toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const totals = () => {
    const subtotal = state.lines.reduce((n, l) => n + item(l.id).price * l.qty, 0);
    const vat = Math.round((subtotal * VAT) / 100);
    return { subtotal, vat, total: subtotal + vat, count: state.lines.reduce((n, l) => n + l.qty, 0), unsent: state.lines.filter((l) => !l.sent).reduce((n, l) => n + l.qty, 0) };
  };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const $ = (slot) => document.querySelector(`[data-slot="${slot}"]`);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  /* ------------------------------------------------------------ render */
  function renderCats() {
    const el = $("cats");
    if (!el) return;
    const all = el.dataset.all === "true";
    const cats = all ? ["All", ...CATS] : CATS;
    el.innerHTML = cats
      .map((c) => {
        const n = c === "All" ? MENU.length : MENU.filter((m) => m.cat === c).length;
        return `<button type="button" class="cat ${state.cat === c ? "is-active" : ""}" data-cat="${c}" data-color="${c.toLowerCase()}"><i class="dot"></i><span class="cat-name">${c}</span><em class="cat-n">${n}</em></button>`;
      })
      .join("");
  }
  function renderTables() {
    const el = $("tables");
    if (!el) return;
    el.innerHTML = TABLES.map(
      (t) => `<button type="button" class="tbl is-${t.status} ${t.id === state.table ? "is-current" : ""}" data-table="${t.id}" title="${t.name}">
        <b>${t.code}</b>
        <small>${t.status === "open" ? money(t.total, false) : t.status === "current" ? `${t.mins} min` : t.status === "reserved" ? "reserved" : t.status === "cleaning" ? "clearing" : t.seats ? `${t.seats} seats` : "counter"}</small>
      </button>`,
    ).join("");
  }
  function renderGrid() {
    const el = $("grid");
    if (!el) return;
    const q = state.q.trim().toLowerCase();
    const list = MENU.filter((m) => (q ? m.name.toLowerCase().includes(q) || m.desc.toLowerCase().includes(q) : state.cat === "All" || m.cat === state.cat));
    el.innerHTML =
      list
        .map((m) => {
          const inOrder = state.lines.find((l) => l.id === m.id)?.qty || 0;
          return `<button type="button" class="tile ${inOrder ? "in-order" : ""}" data-id="${m.id}" data-color="${m.cat.toLowerCase()}">
          <span class="tile-img"><img src="${IMG(m.img)}" alt="" loading="lazy" draggable="false"/><span class="tile-badge">${inOrder || ""}</span><span class="tile-cat">${m.cat}</span>${m.mins ? `<span class="tile-mins">${m.mins} min</span>` : ""}</span>
          <span class="tile-body">
            <span class="tile-name">${esc(m.name)}</span>
            <span class="tile-desc">${esc(m.desc)}</span>
            <span class="tile-foot"><span class="tile-price"><small>GH₵</small>${(m.price / 100).toFixed(2)}</span><span class="tile-add" aria-hidden="true">${inOrder ? `${inOrder} in order` : "Add"}</span></span>
          </span>
        </button>`;
        })
        .join("") || `<p class="empty">Nothing called “${esc(state.q)}”.</p>`;
    const n = $("gridcount");
    if (n) n.textContent = `${list.length} dish${list.length === 1 ? "" : "es"}`;
  }
  function renderTicket() {
    const el = $("lines");
    if (!el) return;
    el.innerHTML =
      state.lines
        .map((l) => {
          const m = item(l.id);
          return `<li class="line ${l.sent ? "is-sent" : "is-new"}" data-id="${l.id}">
          <span class="line-qty">${l.qty}</span>
          <span class="line-main">
            <span class="line-name">${esc(m.name)}</span>
            <span class="line-meta">${l.note ? `<span class="line-note">${esc(l.note)}</span>` : `<button type="button" class="line-addnote" data-note="${l.id}">add note</button>`}${l.sent ? `<span class="line-state">sent</span>` : `<span class="line-state is-new">not sent</span>`}</span>
          </span>
          <span class="line-price">${(m.price * l.qty / 100).toFixed(2)}</span>
          <span class="stepper"><button type="button" data-dec="${l.id}" aria-label="Less">−</button><button type="button" data-inc="${l.id}" aria-label="More">+</button></span>
        </li>`;
        })
        .join("") || `<li class="line-empty">No items yet — tap a dish.</li>`;
    const t = totals();
    const tt = $("totals");
    if (tt)
      tt.innerHTML = `<div class="tot"><dt>Subtotal</dt><dd>${money(t.subtotal, false)}</dd></div>
      <div class="tot"><dt>VAT ${VAT}%</dt><dd>${money(t.vat, false)}</dd></div>
      <div class="tot tot-grand"><dt>Total</dt><dd><small>GH₵</small>${money(t.total, false)}</dd></div>`;
    $$("[data-slot=total]").forEach((x) => (x.textContent = money(t.total)));
    $$("[data-slot=count]").forEach((x) => (x.textContent = String(t.count)));
    $$("[data-slot=unsent]").forEach((x) => {
      x.textContent = String(t.unsent);
      x.closest("[data-action=send]")?.toggleAttribute("disabled", t.unsent === 0);
    });
    $$("[data-action=charge]").forEach((b) => b.toggleAttribute("disabled", t.total === 0));
    const tb = TABLES.find((x) => x.id === state.table);
    $$("[data-slot=tablename]").forEach((x) => (x.textContent = tb.name));
    $$("[data-slot=tablecode]").forEach((x) => (x.textContent = tb.code));
  }
  function renderPay() {
    const el = $("pay");
    if (!el) return;
    const p = state.pay;
    el.hidden = !p;
    document.body.classList.toggle("pay-open", Boolean(p));
    if (!p) return;
    const t = totals();
    const typed = Math.round(Number(p.amount || 0) * 100);
    const change = p.tender === "cash" && typed >= t.total ? typed - t.total : 0;
    const short = p.tender === "cash" && typed > 0 && typed < t.total ? t.total - typed : 0;
    const quick = [t.total, Math.ceil(t.total / 5000) * 5000, Math.ceil(t.total / 10000) * 10000, Math.ceil(t.total / 20000) * 20000].filter((v, i, a) => a.indexOf(v) === i);
    el.innerHTML = `
      <div class="pay-card" role="dialog" aria-modal="true" aria-label="Take payment">
        <header class="pay-head">
          <div><span class="pay-kicker">Charge · <span data-slot="tablename">${TABLES.find((x) => x.id === state.table).name}</span> · ${t.count} items</span><h2 class="pay-total">${money(t.total)}</h2></div>
          <button type="button" class="pay-close" data-pay="close" aria-label="Close">✕</button>
        </header>
        <div class="pay-tenders">
          ${[["cash", "Cash"], ["momo", "Mobile Money"], ["split", "Split"]].map(([k, l]) => `<button type="button" class="tender ${p.tender === k ? "is-active" : ""}" data-tender="${k}"><i class="tender-ic tender-${k}"></i><span>${l}</span></button>`).join("")}
        </div>
        ${
          p.tender === "cash"
            ? `<div class="pay-body">
                <div class="pay-amount ${short ? "is-short" : ""}"><span class="pay-amount-label">Tendered</span><span class="pay-amount-value">${p.amount ? money(typed) : "GH₵ 0.00"}</span>
                  <span class="pay-change">${change ? `Change due <b>${money(change)}</b>` : short ? `Short by <b>${money(short)}</b>` : typed ? "Exact" : "Type or pick an amount"}</span></div>
                <div class="pay-quick">${quick.map((v) => `<button type="button" data-quick="${v}">${v === t.total ? "Exact" : money(v, false).replace(".00", "")}</button>`).join("")}</div>
                <div class="pay-keys">${["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "⌫"].map((k) => `<button type="button" data-key="${k}">${k}</button>`).join("")}</div>
              </div>`
            : p.tender === "momo"
              ? `<div class="pay-body">
                <div class="pay-networks">${["MTN", "Telecel", "AirtelTigo"].map((n) => `<button type="button" class="net net-${n.toLowerCase()} ${p.network === n ? "is-active" : ""}" data-net="${n}">${n}</button>`).join("")}</div>
                <label class="pay-field"><span>Customer number</span><input inputmode="tel" value="${esc(p.phone || "")}" data-phone placeholder="024 000 0000"/></label>
                <p class="pay-hint">${p.network} prompt goes to the customer’s phone · merchant 0244 000 111 · the receipt prints when they approve.</p>
              </div>`
              : `<div class="pay-body">
                <div class="pay-split"><label class="pay-field"><span>Cash part</span><input inputmode="decimal" value="${esc(p.amount || "")}" data-amount placeholder="0.00"/></label><div class="pay-split-rest"><span>Mobile Money</span><b>${money(Math.max(0, t.total - typed))}</b></div></div>
                <div class="pay-networks">${["MTN", "Telecel", "AirtelTigo"].map((n) => `<button type="button" class="net net-${n.toLowerCase()} ${p.network === n ? "is-active" : ""}" data-net="${n}">${n}</button>`).join("")}</div>
              </div>`
        }
        <footer class="pay-foot">
          <button type="button" class="pay-secondary" data-pay="close">Back</button>
          <button type="button" class="pay-confirm" data-pay="confirm" ${p.tender === "cash" && typed < t.total ? "disabled" : ""}>${p.tender === "cash" ? (change ? `Take ${money(typed)} · give ${money(change)} change` : `Take ${money(t.total)}`) : p.tender === "momo" ? `Send ${p.network} prompt for ${money(t.total)}` : `Take ${money(typed)} cash + ${money(Math.max(0, t.total - typed))} MoMo`}</button>
        </footer>
      </div>`;
    el.querySelector("[data-amount]")?.focus();
  }
  function renderAll() {
    renderCats();
    renderTables();
    renderGrid();
    renderTicket();
    renderPay();
  }

  /* ------------------------------------------------------------ toast */
  let toastTimer;
  function toast(text, tone = "ok") {
    let el = $("toast");
    if (!el) {
      el = document.createElement("div");
      el.dataset.slot = "toast";
      el.className = "toast";
      document.body.appendChild(el);
    }
    el.textContent = text;
    el.dataset.tone = tone;
    el.classList.add("is-on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("is-on"), 2800);
  }

  /* ------------------------------------------------------------ events */
  function bump(id, d) {
    const l = state.lines.find((x) => x.id === id);
    if (!l) {
      if (d > 0) state.lines.push({ id, qty: 1, note: "", sent: false });
    } else {
      l.qty += d;
      if (l.qty <= 0) state.lines.splice(state.lines.indexOf(l), 1);
      else if (d > 0 && l.sent) l.sent = false;
    }
    renderGrid();
    renderTicket();
  }
  document.addEventListener("click", (e) => {
    const t = e.target.closest("button, [data-action]");
    if (!t) return;
    if (t.dataset.cat) {
      state.cat = t.dataset.cat;
      state.q = "";
      const s = $("search");
      if (s) s.value = "";
      renderCats();
      renderGrid();
    } else if (t.dataset.table) {
      state.table = t.dataset.table;
      renderTables();
      renderTicket();
    } else if (t.dataset.id && t.classList.contains("tile")) {
      bump(t.dataset.id, 1);
      t.classList.remove("pop");
      void t.offsetWidth;
      t.classList.add("pop");
    } else if (t.dataset.inc) bump(t.dataset.inc, 1);
    else if (t.dataset.dec) bump(t.dataset.dec, -1);
    else if (t.dataset.note) {
      const l = state.lines.find((x) => x.id === t.dataset.note);
      const v = window.prompt(`Kitchen note for ${item(l.id).name}`, "");
      if (v !== null) {
        l.note = v.trim();
        renderTicket();
      }
    } else if (t.dataset.action === "send") {
      const n = totals().unsent;
      if (!n) return;
      state.lines.forEach((l) => (l.sent = true));
      renderTicket();
      toast(`${n} item${n > 1 ? "s" : ""} sent to the kitchen`);
    } else if (t.dataset.action === "charge") {
      if (!totals().total) return;
      state.pay = { tender: t.dataset.tender || "cash", amount: "", network: "MTN", phone: "" };
      renderPay();
    } else if (t.dataset.tender && state.pay) {
      state.pay.tender = t.dataset.tender;
      state.pay.amount = "";
      renderPay();
    } else if (t.dataset.quick) {
      state.pay.amount = (Number(t.dataset.quick) / 100).toFixed(2);
      renderPay();
    } else if (t.dataset.key) {
      const k = t.dataset.key;
      let a = state.pay.amount;
      if (k === "⌫") a = a.slice(0, -1);
      else if (k === ".") a = a.includes(".") ? a : (a || "0") + ".";
      else if (/\.\d\d$/.test(a)) return;
      else a = (a === "0" ? "" : a) + k;
      state.pay.amount = a.slice(0, 9);
      renderPay();
    } else if (t.dataset.net) {
      state.pay.network = t.dataset.net;
      renderPay();
    } else if (t.dataset.pay === "close") {
      state.pay = null;
      renderPay();
    } else if (t.dataset.pay === "confirm") {
      const p = state.pay;
      const total = totals().total;
      state.pay = null;
      renderPay();
      const how = p.tender === "cash" ? "Cash" : p.tender === "momo" ? `MoMo ${p.network}` : "Split";
      toast(`${how} · ${money(total)} taken · receipt printed`);
      state.lines = [];
      renderGrid();
      renderTicket();
    } else if (t.dataset.action === "discount") toast("Discount sheet — manager PIN", "info");
    else if (t.dataset.action === "hold") toast("Order held — it stays on Table 07", "info");
  });
  document.addEventListener("input", (e) => {
    if (e.target.matches("[data-slot=search]")) {
      state.q = e.target.value;
      renderGrid();
    } else if (e.target.matches("[data-amount]") && state.pay) {
      state.pay.amount = e.target.value.replace(/[^\d.]/g, "");
      const pos = e.target.selectionStart;
      renderPay();
      const i = $("pay")?.querySelector("[data-amount]");
      if (i) {
        i.focus();
        i.setSelectionRange(pos, pos);
      }
    } else if (e.target.matches("[data-phone]") && state.pay) state.pay.phone = e.target.value;
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && state.pay) {
      state.pay = null;
      renderPay();
    }
    if (e.key === "/" && !e.target.matches("input")) {
      e.preventDefault();
      $("search")?.focus();
    }
  });

  /* ------------------------------------------------------------ clock */
  function tick() {
    const c = $("clock");
    if (c) c.textContent = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  }
  tick();
  setInterval(tick, 10000);

  renderAll();
  window.TILL = { state, MENU, TABLES, renderAll, money, totals };
})();
