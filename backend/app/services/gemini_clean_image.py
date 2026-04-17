"""Generate a walls-and-doors-only raster from a floor plan using Gemini image models."""
from __future__ import annotations

import base64
import logging
import os
from io import BytesIO
from typing import Any, Iterator

from PIL import Image

from app.services.gemini_client import _resize_for_api, build_gemini_client

logger = logging.getLogger(__name__)

try:
    from google.genai import types as genai_types
except ImportError:  # pragma: no cover
    genai_types = None  # type: ignore

DEFAULT_IMAGE_MODEL = "gemini-3.1-flash-image-preview"

CLEAN_PLAN_PROMPT = """You are given a 2D architectural floor plan image (bitmap).

Redraw it as a clean technical 2D plan that matches the SAME footprint, room layout, and wall positions as closely as possible:
- Black wall lines on pure white background (high contrast), orthogonal top-down view.
- ALL exterior and interior structural/partition walls from the source; same openings.
- Doors only: gap in the wall plus a simple standard door swing arc per opening.
- Remove EVERYTHING else: no furniture, no fixtures, no room names, no dimensions, no text, no legends, no shading, no gray scan tones.

Output: one image — the plan structure only."""


def _iter_response_parts(response: Any) -> Iterator[Any]:
    parts = getattr(response, "parts", None)
    if parts:
        for p in parts:
            yield p
        return
    for cand in getattr(response, "candidates", None) or []:
        content = getattr(cand, "content", None)
        ps = getattr(content, "parts", None) if content else None
        if not ps:
            continue
        for p in ps:
            yield p


def clean_floorplan_image(image_b64: str, mime_in: str, orig_width: int, orig_height: int) -> dict[str, Any]:
    if genai_types is None:
        raise RuntimeError("google-genai is not installed (pip install google-genai)")

    client = build_gemini_client()
    raw = base64.b64decode(image_b64)
    jpeg_bytes, mime_send, ow, oh, _ = _resize_for_api(raw, mime_in)

    model_name = (os.environ.get("GEMINI_IMAGE_MODEL") or DEFAULT_IMAGE_MODEL).strip() or DEFAULT_IMAGE_MODEL

    image_part = genai_types.Part.from_bytes(data=jpeg_bytes, mime_type=mime_send)
    contents: list[Any] = [CLEAN_PLAN_PROMPT, image_part]

    cfg = genai_types.GenerateContentConfig(
        temperature=0.2,
        response_modalities=[genai_types.Modality.IMAGE],
    )

    try:
        response = client.models.generate_content(
            model=model_name,
            contents=contents,
            config=cfg,
        )
    except Exception as e:
        logger.warning("Image model generate_content failed (%s): %s", model_name, e)
        raise

    for part in _iter_response_parts(response):
        inline = getattr(part, "inline_data", None)
        if inline is None:
            continue
        data = getattr(inline, "data", None)
        if not data:
            continue
        blob = data if isinstance(data, (bytes, bytearray)) else base64.b64decode(str(data))
        pil: Image.Image | None = None
        try:
            pil = Image.open(BytesIO(blob))
            pil.load()
        except Exception as e:
            logger.debug("PIL open from inline_data failed: %s", e)
        if pil is None:
            try:
                candidate = part.as_image()
                # google-genai may return a non-PIL wrapper; only use real PIL images here.
                if isinstance(candidate, Image.Image):
                    pil = candidate
            except Exception as e:
                logger.debug("part.as_image() failed: %s", e)
        if pil is None:
            continue
        out = BytesIO()
        if pil.mode not in ("RGB", "L"):
            pil = pil.convert("RGB")
        pil.save(out, format="PNG")
        pw, ph = pil.size
        return {
            "image_b64": base64.b64encode(out.getvalue()).decode("ascii"),
            "mime_type": "image/png",
            "width": pw,
            "height": ph,
            "source_width": ow,
            "source_height": oh,
            "model": model_name,
        }

    raise ValueError(
        "Model did not return an image. Use an image-capable model, e.g. GEMINI_IMAGE_MODEL=gemini-3.1-flash-image-preview "
        "(see backend/.env.example)."
    )
