"""Shared Gemini API client and raster resize for SIGE AI image calls."""
from __future__ import annotations

import os
from io import BytesIO
from typing import Tuple

from PIL import Image

try:
    from google import genai as google_genai
    from google.genai import types as genai_types
except ImportError:  # pragma: no cover
    google_genai = None  # type: ignore
    genai_types = None  # type: ignore

MAX_SEND_SIDE = 1536
DEFAULT_API_VERSION = "v1beta"


def _resize_for_api(raw: bytes, mime: str) -> Tuple[bytes, str, int, int, float]:
    """
    Returns (jpeg_bytes, 'image/jpeg', orig_w, orig_h, scale_to_orig).
    Uniform scale from resized send size back to original pixels.
    """
    bio = BytesIO(raw)
    im = Image.open(bio)
    im = im.convert("RGB")
    ow, oh = im.size
    m = max(ow, oh)
    if m <= MAX_SEND_SIDE:
        out = BytesIO()
        im.save(out, format="JPEG", quality=90)
        return out.getvalue(), "image/jpeg", ow, oh, 1.0
    s = MAX_SEND_SIDE / m
    nw, nh = max(1, int(ow * s)), max(1, int(oh * s))
    im = im.resize((nw, nh), Image.Resampling.LANCZOS)
    out = BytesIO()
    im.save(out, format="JPEG", quality=90)
    scale_to_orig = ow / nw
    return out.getvalue(), "image/jpeg", ow, oh, scale_to_orig


def build_gemini_client():
    """Gemini Developer API (API key) or Vertex AI when GEMINI_USE_VERTEX=1."""
    if google_genai is None or genai_types is None:
        raise RuntimeError("google-genai is not installed (pip install google-genai)")

    api_version = os.environ.get("GEMINI_API_VERSION", DEFAULT_API_VERSION).strip() or DEFAULT_API_VERSION
    http_options = genai_types.HttpOptions(api_version=api_version)

    if os.environ.get("GEMINI_USE_VERTEX", "").strip() in ("1", "true", "yes"):
        project = os.environ.get("GOOGLE_CLOUD_PROJECT") or os.environ.get("GCP_PROJECT")
        location = os.environ.get("GOOGLE_CLOUD_LOCATION", "us-central1")
        if not project:
            raise RuntimeError("GEMINI_USE_VERTEX is set but GOOGLE_CLOUD_PROJECT is missing")
        return google_genai.Client(
            vertexai=True,
            project=project,
            location=location,
            http_options=http_options,
        )

    api_key = (os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY") or "").strip()
    if not api_key:
        raise RuntimeError(
            "GEMINI_API_KEY is not set. Create backend/.env with GEMINI_API_KEY=your_key "
            "(see backend/.env.example), or put the same line in the repo root .env, then restart uvicorn."
        )
    return google_genai.Client(api_key=api_key, http_options=http_options)
