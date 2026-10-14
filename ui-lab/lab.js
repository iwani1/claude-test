/* UI Lab shell: variant tabs, device widths, and the prompt drawer. No dependencies. */
(function () {
  "use strict";

  const VARIANTS = [
    {
      id: "01",
      name: "Aurora",
      style: "dark · glass",
      file: "heroes/01-aurora.html",
      prompt: "prompts/01-aurora.md",
      library: "Aceternity UI",
      moves: "Aurora background, pointer spotlight, background beams, tilted glass product card, floating badges",
    },
    {
      id: "02",
      name: "Grid & Shimmer",
      style: "light · bento",
      file: "heroes/02-grid-shimmer.html",
      prompt: "prompts/02-grid-shimmer.md",
      library: "Magic UI",
      moves: "Animated grid pattern, shiny announcement text, blur-in headline, shimmer button, marquee, number ticker, border beam",
    },
    {
      id: "03",
      name: "Orbs",
      style: "dark · canvas",
      file: "heroes/03-orbs.html",
      prompt: "prompts/03-orbs.md",
      library: "React Bits",
      moves: "Particle constellation with pointer repulsion, drifting orbs, film-grain overlay, split-text headline, 3D tilt card with glare",
    },
    {
      id: "04",
      name: "Brutalist",
      style: "paper · ink",
      file: "heroes/04-brutalist.html",
      prompt: "prompts/04-brutalist.md",
      library: "Promter (Brutalist UI module)",
      moves: "Ticker marquee, 3px borders, hard offset shadows that collapse on press, monospace receipt, rotating sticker",
    },
  ];

  const $ = (id) => document.getElementById(id);
  const tabs = $("tabs");
  const view = $("view");
  const frame = $("frame");
  const drawer = $("drawer");
  const scrim = $("scrim");
  const promptBtn = $("promptBtn");
  const copyBtn = $("copyBtn");
  const dlBtn = $("dlBtn");
  const openBtn = $("openBtn");
  const hint = $("hint");

  let current = null;
  let promptText = "";

  // ------------------------------------------------------------- tabs
  VARIANTS.forEach((v) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "tab";
    b.dataset.id = v.id;
    b.innerHTML = `<span class="n">${v.id}</span><span>${v.name}</span><span class="s">${v.style}</span>`;
    b.addEventListener("click", () => select(v.id, true));
    tabs.appendChild(b);
  });

  function select(id, pushHash) {
    const v = VARIANTS.find((x) => x.id === id) || VARIANTS[0];
    if (current && current.id === v.id) return;
    current = v;
    tabs.querySelectorAll(".tab").forEach((t) => t.classList.toggle("on", t.dataset.id === v.id));
    view.src = "/" + v.file;
    openBtn.href = "/" + v.file;
    dlBtn.href = "/" + v.prompt;
    dlBtn.setAttribute("download", v.prompt.split("/").pop());
    $("dEyebrow").textContent = `Prompt · ${v.id}`;
    $("dTitle").textContent = `${v.name} — ${v.style}`;
    $("dLib").textContent = v.library;
    $("dMoves").textContent = v.moves;
    document.title = `UI Lab — ${v.id} ${v.name}`;
    if (pushHash) history.replaceState(null, "", "#" + v.id);
    loadPrompt(v);
  }

  async function loadPrompt(v) {
    const pre = $("dPrompt");
    pre.textContent = "Loading…";
    promptText = "";
    try {
      const res = await fetch("/" + v.prompt, { cache: "no-store" });
      if (!res.ok) throw new Error(res.status + " " + res.statusText);
      promptText = await res.text();
      if (current === v) pre.textContent = promptText;
    } catch (err) {
      if (current === v) pre.textContent = `Could not load ${v.prompt} (${err.message}). Serve this folder with \`node ui-lab/serve.mjs\` rather than opening the file directly.`;
    }
  }

  // ------------------------------------------------------------- drawer
  function setDrawer(open) {
    drawer.classList.toggle("open", open);
    scrim.classList.toggle("open", open);
    drawer.setAttribute("aria-hidden", String(!open));
    promptBtn.setAttribute("aria-expanded", String(open));
    if (open) $("dPrompt").focus({ preventScroll: true });
  }
  promptBtn.addEventListener("click", () => setDrawer(!drawer.classList.contains("open")));
  $("closeBtn").addEventListener("click", () => setDrawer(false));
  scrim.addEventListener("click", () => setDrawer(false));

  copyBtn.addEventListener("click", async () => {
    if (!promptText) return;
    let ok = false;
    try {
      await navigator.clipboard.writeText(promptText);
      ok = true;
    } catch {
      // Fallback for non-secure contexts: select the text so Ctrl/Cmd+C works.
      const range = document.createRange();
      range.selectNodeContents($("dPrompt"));
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      try {
        ok = document.execCommand("copy");
      } catch {
        ok = false;
      }
    }
    const label = copyBtn.textContent;
    copyBtn.textContent = ok ? "Copied ✓" : "Select & press Ctrl+C";
    copyBtn.classList.toggle("ok", ok);
    setTimeout(() => {
      copyBtn.textContent = label;
      copyBtn.classList.remove("ok");
    }, 1800);
  });

  // ------------------------------------------------------------- devices
  $("devices").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-w]");
    if (!b) return;
    $("devices").querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
    frame.style.setProperty("--w", b.dataset.w);
  });

  // ------------------------------------------------------------- keyboard
  document.addEventListener("keydown", (e) => {
    if (e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
    const idx = VARIANTS.findIndex((v) => v === current);
    if (/^[1-4]$/.test(e.key)) select(VARIANTS[Number(e.key) - 1].id, true);
    else if (e.key === "ArrowRight") select(VARIANTS[(idx + 1) % VARIANTS.length].id, true);
    else if (e.key === "ArrowLeft") select(VARIANTS[(idx - 1 + VARIANTS.length) % VARIANTS.length].id, true);
    else if (e.key.toLowerCase() === "p") setDrawer(!drawer.classList.contains("open"));
    else if (e.key === "Escape") setDrawer(false);
  });
  window.addEventListener("hashchange", () => select(location.hash.replace("#", ""), false));

  hint.innerHTML = "Switch with <kbd>1</kbd>–<kbd>4</kbd> or <kbd>←</kbd> <kbd>→</kbd> · <kbd>P</kbd> toggles the prompt · each hero is a single HTML file with no dependencies";

  select(location.hash.replace("#", "") || "01", false);
})();
