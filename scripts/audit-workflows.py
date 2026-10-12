#!/usr/bin/env python3
"""Static workflow audit: user-visible feedback, unchecked responses, money-path guards.

Deliberately conservative: it fails only on rules where a false positive is
unlikely, and prints informational findings separately so they can be reviewed
rather than silently trusted. An intentional exception is marked in the source
with `audit-ok: <reason>` on the line, or above a catch block.

Runs from the repository root:  python3 scripts/audit-workflows.py [--verbose]
"""
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src"
VERBOSE = "--verbose" in sys.argv

failures: list[str] = []
warnings: list[str] = []
notes: list[str] = []


def line_of(text: str, index: int) -> int:
    return text.count("\n", 0, index) + 1


def block_after(text: str, open_index: int) -> str:
    """Return the source of a brace block starting at open_index (the '{')."""
    depth = 0
    for i in range(open_index, len(text)):
        if text[i] == "{":
            depth += 1
        elif text[i] == "}":
            depth -= 1
            if depth == 0:
                return text[open_index : i + 1]
    return text[open_index : open_index + 400]


def has_feedback(body: str) -> bool:
    """Does this block tell the user something, or refuse to swallow the error?"""
    patterns = [
        r"\balert\s*\(",
        r"\bnotify\s*\(",
        r"\bsetError\b",
        r"\bsetNotice\b",
        r"\bsetMessage\b",
        r"\bsetSaveError\b",
        r"\bsetLoadError\b",
        r"\bthrow\b",
        r"\bsetFailed\b",
        r"\bsetFeedback\b",
        r"\bsetStatus\b",
        r"\bsetBanner\b",
        r"\breturn\s+Result\.err",
        r"\bset[A-Za-z]*(Error|Status|Notice|Message|Feedback|Failed|Warning|Banner)\b",
        r"\bsetAuthState\b",
        r"\bNextResponse\.json\s*\(",
        r"\bResponse\.json\s*\(",
        r"\breturn\s*\{\s*error",
    ]
    return any(re.search(p, body) for p in patterns)


def allowed(text: str, index: int, body: str) -> bool:
    line_start = text.rfind("\n", 0, index) + 1
    if "audit-ok" in text[line_start : text.find("\n", index)]:
        return True
    if "audit-ok" in body:
        return True
    # The line(s) directly above the catch, where the reason is usually written.
    above = text[max(0, line_start - 300) : line_start]
    return "audit-ok" in above


# ---------------------------------------------------------------- rules -----
CLIENT = [
    p for p in sorted(list(SRC.rglob("*.ts")) + list(SRC.rglob("*.tsx")))
    if "/api/" not in str(p.relative_to(SRC))
]

for path in sorted(list(SRC.rglob("*.ts")) + list(SRC.rglob("*.tsx"))):
    rel = path.relative_to(ROOT)
    text = path.read_text()

    # 1. Swallowed failures in client code: a catch that neither tells the user
    #    nor rethrows. (Server routes answer with a status instead; a library
    #    returning a fallback leaves the decision to its caller, which rule 1
    #    then covers.)
    for match in (re.finditer(r"catch\s*(?:\([^)]*\))?\s*\{", text) if path in CLIENT else []):
        body = block_after(text, match.end() - 1)
        if has_feedback(body) or allowed(text, match.start(), body):
            continue
        snippet = " ".join(body.split())[:90]
        failures.append(f"{rel}:{line_of(text, match.start())} catch swallows the failure (no user feedback, no rethrow): {snippet}")

    # 2. Responses used without checking .ok / status first.
    for match in re.finditer(r"await\s+fetch\s*\(", text):
        window = text[match.end() : match.end() + 600]
        first_use = re.search(r"(await\s+\w+\.json\(\)|\.json\(\))", window)
        if not first_use:
            continue
        # The status is often inspected right after parsing, so look at the
        # whole statement rather than only the part before .json().
        if re.search(r"\.ok\b|\.status\b", window):
            continue
        if "audit-ok" in text[max(0, match.start() - 200) : match.start()]:
            continue
        warnings.append(f"{rel}:{line_of(text, match.start())} fetch response parsed without checking ok/status")

    # 3. Blocking browser alerts (finger-hostile on a phone, and they vanish).
    for match in re.finditer(r"(?<![\w.])alert\s*\(", text):
        line_start = text.rfind("\n", 0, match.start()) + 1
        line = text[line_start : text.find("\n", match.start())]
        if "audit-ok" in line:
            continue
        notes.append(f"alert {rel}:{line_of(text, match.start())} {line.strip()[:100]}")

    # 4. A mutation route must refuse or answer; never silently no-op.
    if "/api/" in str(rel) and rel.name == "route.ts":
        for method in ("POST", "PATCH", "PUT", "DELETE"):
            if f"export async function {method}" not in text:
                continue
            body_start = text.find(f"export async function {method}")
            body = text[body_start : body_start + 4000]
            if not re.search(r"requireSession|requirePermission|canAccess|hasTerminalAccess|checkRequest", body):
                warnings.append(f"{rel} {method} does not check a session/permission near the top")

# 5. Money routes must be idempotent on the write that moves money.
for name in ("pay", "refund"):
    for path in sorted((SRC / "app/api").rglob("route.ts")):
        if name not in path.parts:
            continue
        text = path.read_text()
        if "idempotency" not in text.lower():
            failures.append(f"{path.relative_to(ROOT)} takes money without an idempotency guard")

# 6. Every data table in the UI has a mobile card rendering, or is inside a
#    scroller (structural, mirrors audit-responsive.py but only reports).
for path in sorted((SRC / "components").glob("*.tsx")):
    text = path.read_text()
    if "<table" not in text:
        continue
    if "overflow-x-auto" not in text and "md:hidden" not in text:
        warnings.append(f"{path.relative_to(ROOT)} renders a table with no scroller or phone card view")

# ---------------------------------------------------------------- report ----
print(f"Workflow audit: {len(list(SRC.rglob('*.ts')))} TS + {len(list(SRC.rglob('*.tsx')))} TSX files")
for finding in failures:
    print(f"FAIL  {finding}")
for finding in warnings:
    print(f"warn  {finding}")
if VERBOSE:
    for note in notes:
        print(f"note  {note}")
print(f"\n{len(failures)} failure(s), {len(warnings)} warning(s), {len(notes)} advisory note(s)")
if notes and not VERBOSE:
    print("(advisory notes are listed with --verbose)")
sys.exit(1 if failures else 0)
