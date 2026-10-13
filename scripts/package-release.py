"""Build/check a deterministic source-only ZIP.

The archive is the source of the application and nothing else: never secrets
(`.env`), never other ZIPs, and never a database dump. The owner's repository
also carries the legacy business backup (`2026-10-12_restpos.db`, uploaded to
`main` by hand) and releases are always built from a branch merged with `main`,
so a dump that was merely sitting in the repository used to land in the release
archive — and, once it did, the file-list check below failed on every CI run
before a single test could start. Data files are skipped here, and the check
compares against exactly the same list.
"""
from pathlib import Path
import subprocess
import sys
import zipfile

root = Path(__file__).resolve().parent.parent
paths = subprocess.check_output(
    ["git", "ls-files", "--cached", "--others", "--exclude-standard", "-z"], cwd=root
).decode().split("\0")
# Data files are never part of the source release: ZIPs are build outputs, and
# database dumps are the owner's data, not the application.
SKIP_SUFFIXES = (".zip", ".db", ".sqlite", ".sqlite3", ".dump")
files = sorted({p for p in paths if p and not p.endswith(SKIP_SUFFIXES) and (root / p).is_file()})
skipped = sorted({p for p in paths if p and p.endswith(SKIP_SUFFIXES) and p not in files})
for name in files:
    path = Path(name)
    if (root / name).is_symlink() or any(part in {".git", "node_modules", ".next", ".test-db", "__pycache__"} for part in path.parts):
        raise SystemExit(f"Unsafe release path: {name}")
    if path.name.startswith(".env") and path.name != ".env.production.example":
        raise SystemExit(f"Refusing to package environment credentials: {name}")
archive = root / "11claude-fixed.zip"
if "--check" not in sys.argv:
    with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as bundle:
        for name in files:
            info = zipfile.ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            # Preserve the executable bit: the deploy script must run from an
            # unpacked archive without a chmod first.
            mode = 0o100755 if (root / name).stat().st_mode & 0o111 else 0o100644
            info.external_attr = mode << 16
            bundle.writestr(info, (root / name).read_bytes())
with zipfile.ZipFile(archive) as bundle:
    assert bundle.testzip() is None, "ZIP integrity failure"
    assert bundle.namelist() == files, "ZIP file list is stale"
    for name in files:
        assert bundle.read(name) == (root / name).read_bytes(), f"ZIP source mismatch: {name}"
print(f"Verified {archive.name}: {len(files)} files, {archive.stat().st_size:,} bytes")
if skipped:
    print(f"Skipped {len(skipped)} non-source file(s): {', '.join(skipped)}")
