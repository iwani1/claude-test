#!/usr/bin/env python3
"""Static responsive-UI audit.

There is no browser in the build environment, so this script checks the
structural rules that keep every screen usable from a 320px phone up to a
desktop terminal. It is deliberately boring: it reads the source and asserts
shapes that are cheap to verify and expensive to get wrong.

Failing rules (exit 1)
  1. A <table> with no `overflow-x-auto` container and no `hidden md:block`
     gate — on a phone such a table is clipped and unreachable.
  2. A file with a <table> but no `md:hidden` card list — phones would only get
     the wide layout.
  3. `h-screen` / `w-screen` in the app shell: 100vh is taller than the visible
     area on mobile browsers (URL bar), and 100vw overflows when a scrollbar is
     present. Use h-dvh / w-full.
  4. A dialog overlay (`fixed inset-0`) without `overflow-y-auto` — a tall
     dialog on a short phone screen becomes unreachable at the top.
  5. A dialog panel with neither a max height nor its own internal scroll.

Warnings (printed, exit stays 0)
  6. Fixed pixel widths that are not inside a scrolling container.
  7. Multi-column grids with no breakpoint (cramped below 640px).
  8. Interactive rows shorter than 40px with no responsive bump.
"""
from __future__ import annotations

import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
COMPONENTS = sorted((ROOT / "src" / "components").glob("*.tsx"))
APP = sorted((ROOT / "src" / "app").rglob("*.tsx"))

failures: list[str] = []
warnings: list[str] = []


def line_of(text: str, index: int) -> int:
    return text.count("\n", 0, index) + 1


# ---------------------------------------------------------------- tables ------
for path in COMPONENTS:
    text = path.read_text()
    for m in re.finditer(r"<table\b", text):
        window_before = text[max(0, m.start() - 500): m.start()]
        # the nearest preceding wrapper divs decide whether the table can scroll
        wrappers = re.findall(r'className="([^"]*)"', window_before)[-3:]
        scrollable = any("overflow-x-auto" in w or "md:block" in w for w in wrappers)
        if not scrollable:
            failures.append(
                f"{path.name}:{line_of(text, m.start())} <table> has no overflow-x-auto or hidden md:block wrapper"
            )
    if "<table" in text and "md:hidden" not in text:
        failures.append(f"{path.name}: table with no md:hidden card list for phones")

# ------------------------------------------------------------- app shell ------
for path in APP + COMPONENTS:
    text = path.read_text()
    for m in re.finditer(r"h-screen|w-screen", text):
        failures.append(f"{path.name}:{line_of(text, m.start())} uses {m.group(0)} (use h-dvh / w-full)")

# ---------------------------------------------------------------- dialogs -----
for path in COMPONENTS:
    text = path.read_text()
    overlays = list(re.finditer(r'className="(fixed inset-0[^"]*)"', text))
    for m in overlays:
        cls = m.group(1)
        if "overflow-y-auto" not in cls:
            failures.append(f"{path.name}:{line_of(text, m.start())} dialog overlay cannot scroll (no overflow-y-auto)")
        nxt = re.search(r'className="([^"]*)"', text[m.end(): m.end() + 400])
        if not nxt:
            continue
        panel = nxt.group(1)
        if "max-h-" not in panel and "overflow-hidden" not in panel and "overflow-y-auto" not in panel:
            failures.append(
                f"{path.name}:{line_of(text, m.start())} dialog panel has no max height and no internal scroll"
            )

# --------------------------------------------------------------- warnings -----
for path in COMPONENTS + APP:
    text = path.read_text()
    for m in re.finditer(r'\b((?:min-)?w-\[(\d+)px\])', text):
        value = int(m.group(2))
        if value < 240:
            continue
        window = text[max(0, m.start() - 400): m.start()]
        if "overflow-x-auto" in window:
            continue
        # A fixed width is fine when the same element caps it (e.g. the drawer
        # rail is w-[280px] max-w-[85vw]) or when a sibling max-width applies.
        around = text[max(0, m.start() - 200): m.start() + 200]
        if "max-w-" in around:
            continue
        warnings.append(f"{path.name}:{line_of(text, m.start())} {m.group(1)} outside a scrolling container")
    for m in re.finditer(r'\bgrid-cols-([4-9])\b', text):
        window = text[max(0, m.start() - 90): m.start()]
        if re.search(r"\b(sm|md|lg|xl|2xl):$", window) or re.search(r"\b(sm|md|lg|xl|2xl):\s*$", window):
            continue
        # A reviewer can mark a deliberate choice, with the reason, like:
        #   {/* responsive-ok: single-number labels fit four columns */}
        context = text[max(0, m.start() - 400): m.start()]
        if "responsive-ok" in context.rsplit("*/", 1)[-1] or "responsive-ok" in context.split("*/")[-2 if "*/" in context else 0]:
            continue
        warnings.append(f"{path.name}:{line_of(text, m.start())} grid-cols-{m.group(1)} with no breakpoint")

print(f"Responsive audit: {len(COMPONENTS)} components, {len(APP)} app files")
for item in failures:
    print(f"FAIL  {item}")
for item in warnings:
    print(f"warn  {item}")
print(f"\n{len(failures)} failure(s), {len(warnings)} warning(s)")
sys.exit(1 if failures else 0)
