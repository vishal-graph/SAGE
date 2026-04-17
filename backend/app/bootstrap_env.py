"""Load .env into os.environ before other app code runs (import this first from main)."""
from __future__ import annotations

from pathlib import Path

from dotenv import load_dotenv


def load_env_files() -> None:
    here = Path(__file__).resolve()  # .../app/bootstrap_env.py
    backend_dir = here.parent.parent
    repo_root = backend_dir.parent
    cwd = Path.cwd()

    candidates = [
        repo_root / ".env",
        backend_dir / ".env",
        cwd / ".env",
        cwd / "backend" / ".env",
    ]
    seen: set[Path] = set()
    for p in candidates:
        if not p.is_file():
            continue
        resolved = p.resolve()
        if resolved in seen:
            continue
        seen.add(resolved)
        # utf-8-sig strips BOM so the key is not "\ufeffGEMINI_API_KEY"
        load_dotenv(p, override=True, encoding="utf-8-sig")


load_env_files()
