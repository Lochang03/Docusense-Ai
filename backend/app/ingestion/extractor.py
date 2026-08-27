"""
FR-01.2: Hybrid Text & OCR Engine.

Extracts text page-by-page using PyMuPDF's direct digital extraction. Only if a
page has effectively *no* text layer (i.e. it's a scan) do we rasterize it and
run Tesseract OCR on that page instead.

Two design rules here, both learned the hard way:

1. The OCR test is an absolute character count, not a per-area "density" score.
   Area-normalized scoring is impossible to tune — page sizes and layouts vary
   far too much, and a threshold that looks reasonable can silently send every
   page down the OCR path.

2. OCR is best-effort. If Tesseract is missing or errors on a page, we log it
   and keep whatever direct text we extracted rather than raising. One awkward
   page must never fail an entire document's ingestion.

For .docx and .txt we skip OCR entirely — those formats have no "scanned pages".
"""
import io
import logging
from dataclasses import dataclass

import fitz  # PyMuPDF
from PIL import Image

from app.config import settings

log = logging.getLogger(__name__)

# pytesseract is a thin wrapper around the `tesseract` binary. The import can
# succeed while the binary is absent, so a missing binary surfaces later as a
# runtime error from the call itself, not from this import.
try:
    import pytesseract
except ImportError:  # pragma: no cover
    pytesseract = None
    log.warning("pytesseract is not installed — OCR will be skipped entirely.")


@dataclass
class PageText:
    page_num: int          # 1-indexed, matches how humans refer to pages
    text: str
    used_ocr: bool
    bbox_map: list         # list of {"text": str, "bbox": [x0,y0,x1,y1]} word-level boxes
    ocr_unavailable: bool = False  # True if this page needed OCR but couldn't get it


def _has_text_layer(text: str) -> bool:
    """
    True if direct extraction produced enough characters that this page clearly
    already has a real text layer and does not need OCR.
    """
    return len(text.strip()) >= settings.OCR_MIN_CHARS_PER_PAGE


def _direct_page(page, page_num: int, direct_text: str) -> PageText:
    """Build a PageText from PyMuPDF's own word boxes — no OCR involved."""
    # words entries are (x0, y0, x1, y1, word, block_no, line_no, word_no)
    words = page.get_text("words")
    bbox_map = [{"text": w[4], "bbox": [w[0], w[1], w[2], w[3]]} for w in words]
    return PageText(page_num=page_num, text=direct_text, used_ocr=False, bbox_map=bbox_map)


def _ocr_page(page, page_num: int) -> tuple[str, list] | None:
    """
    Rasterize one page and run Tesseract on it exactly once, deriving both the
    text and the word boxes from that single pass.

    Returns (text, bbox_map), or None if OCR is unavailable or failed — callers
    must treat None as "carry on without OCR", not as a fatal error.
    """
    if not settings.OCR_ENABLED or pytesseract is None:
        return None

    try:
        pix = page.get_pixmap(dpi=settings.OCR_DPI)
        with Image.open(io.BytesIO(pix.tobytes("png"))) as img:
            data = pytesseract.image_to_data(img, output_type=pytesseract.Output.DICT)
            # OCR boxes are in image pixels; citations need PDF points.
            scale_x = page.rect.width / img.width
            scale_y = page.rect.height / img.height
    except Exception as exc:
        # Most commonly TesseractNotFoundError when the binary isn't installed.
        log.warning("OCR unavailable for page %s (%s: %s)", page_num, type(exc).__name__, exc)
        return None

    # Rebuild reading order by grouping words into their original lines. Tesseract
    # emits words in reading order, so iterating in index order keeps bbox_map
    # aligned with text.split() — the chunker relies on that alignment to map
    # chunks back to regions on the page.
    lines: dict[tuple, list[str]] = {}
    bbox_map: list[dict] = []

    for j, raw_word in enumerate(data["text"]):
        word = (raw_word or "").strip()
        if not word:
            continue

        key = (data["block_num"][j], data["par_num"][j], data["line_num"][j])
        lines.setdefault(key, []).append(word)

        x, y, w, h = data["left"][j], data["top"][j], data["width"][j], data["height"][j]
        bbox_map.append({
            "text": word,
            "bbox": [x * scale_x, y * scale_y, (x + w) * scale_x, (y + h) * scale_y],
        })

    text = "\n".join(" ".join(words) for _, words in sorted(lines.items()))
    return text, bbox_map


def extract_pdf(file_path: str) -> list[PageText]:
    """Extract text from every page of a PDF, falling back to OCR per-page as needed."""
    doc = fitz.open(file_path)
    try:
        pages: list[PageText] = []

        for i, page in enumerate(doc):
            page_num = i + 1
            direct_text = page.get_text("text")

            if _has_text_layer(direct_text):
                pages.append(_direct_page(page, page_num, direct_text))
                continue

            result = _ocr_page(page, page_num)
            if result is None:
                # OCR wasn't available. Keep the sparse direct text rather than
                # losing the page (and rather than failing the whole document).
                fallback = _direct_page(page, page_num, direct_text)
                fallback.ocr_unavailable = True
                pages.append(fallback)
            else:
                ocr_text, bbox_map = result
                pages.append(
                    PageText(page_num=page_num, text=ocr_text, used_ocr=True, bbox_map=bbox_map)
                )

        ocr_used = sum(1 for p in pages if p.used_ocr)
        degraded = sum(1 for p in pages if p.ocr_unavailable)
        log.info(
            "Extracted %s page(s): %s via direct text, %s via OCR, %s degraded (OCR wanted but unavailable).",
            len(pages), len(pages) - ocr_used - degraded, ocr_used, degraded,
        )
        return pages
    finally:
        doc.close()


def extract_docx(file_path: str) -> list[PageText]:
    """
    .docx has no fixed 'pages' the way a PDF does. We treat the whole
    document as a single logical page (page_num=1) for citation purposes.
    """
    import docx
    d = docx.Document(file_path)
    full_text = "\n".join(p.text for p in d.paragraphs)
    return [PageText(page_num=1, text=full_text, used_ocr=False, bbox_map=[])]


def extract_txt(file_path: str) -> list[PageText]:
    with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
        content = f.read()
    return [PageText(page_num=1, text=content, used_ocr=False, bbox_map=[])]


def extract_image(file_path: str) -> list[PageText]:
    """
    A standalone .png/.jpg upload — OCR is the only possible path, so here a
    missing Tesseract genuinely is fatal. Fail with a message that explains
    what the user can do about it.
    """
    if not settings.OCR_ENABLED or pytesseract is None:
        raise RuntimeError(
            "This file is an image, so text can only be read from it using OCR, "
            "and OCR is not available on the server. Try uploading a PDF, .docx, "
            "or .txt file instead."
        )

    try:
        with Image.open(file_path) as img:
            text = pytesseract.image_to_string(img)
    except Exception as exc:
        raise RuntimeError(
            f"Could not read text from this image ({type(exc).__name__}). "
            "If it is a photo of a document, try a clearer or higher-resolution scan."
        ) from exc

    return [PageText(page_num=1, text=text, used_ocr=True, bbox_map=[])]


def extract(file_path: str, mime_type: str) -> list[PageText]:
    """Dispatch to the right extractor based on mime type."""
    if mime_type == "application/pdf":
        return extract_pdf(file_path)
    elif mime_type == "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        return extract_docx(file_path)
    elif mime_type == "text/plain":
        return extract_txt(file_path)
    elif mime_type in ("image/png", "image/jpeg"):
        return extract_image(file_path)
    else:
        raise ValueError(f"Unsupported mime type: {mime_type}")
