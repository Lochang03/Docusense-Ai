"""
FR-01.2: Hybrid Text & OCR Engine.

Extracts text page-by-page using PyMuPDF's direct digital extraction.
If a page's printable-character density is too low (i.e. it's likely a
scanned image with no real text layer), we rasterize that page and run
Tesseract OCR on it instead.

For .docx and .txt we skip OCR entirely — those formats don't have "scanned
pages" in the same sense.
"""
import io
from dataclasses import dataclass

import fitz  # PyMuPDF
import pytesseract
from PIL import Image

from app.config import settings


@dataclass
class PageText:
    page_num: int          # 1-indexed, matches how humans refer to pages
    text: str
    used_ocr: bool
    bbox_map: list          # list of {"text": str, "bbox": [x0,y0,x1,y1]} word-level boxes


def _printable_density(text: str, page_area: float) -> float:
    """
    Rough heuristic: characters of real text per unit of page area.
    A genuinely scanned page (image only) will extract near-zero text via
    direct extraction, giving a very low score here.
    """
    if page_area <= 0:
        return 0.0
    normalized = len(text.strip()) / (page_area / 1000.0)
    return min(normalized / 50.0, 1.0)  # cap at 1.0, tuned empirically


def extract_pdf(file_path: str) -> list[PageText]:
    """Extract text from every page of a PDF, falling back to OCR per-page as needed."""
    doc = fitz.open(file_path)
    pages: list[PageText] = []

    for i, page in enumerate(doc):
        page_num = i + 1
        direct_text = page.get_text("text")
        area = page.rect.width * page.rect.height
        density = _printable_density(direct_text, area)

        if density >= settings.OCR_FALLBACK_DENSITY_THRESHOLD:
            words = page.get_text("words")  # (x0,y0,x1,y1,word,block,line,word_no)
            bbox_map = [
                {"text": w[4], "bbox": [w[0], w[1], w[2], w[3]]}
                for w in words
            ]
            pages.append(PageText(page_num=page_num, text=direct_text, used_ocr=False, bbox_map=bbox_map))
        else:
            # Fall back to OCR: render the page to an image, then run Tesseract.
            pix = page.get_pixmap(dpi=300)
            img = Image.open(io.BytesIO(pix.tobytes("png")))
            ocr_text = pytesseract.image_to_string(img)

            ocr_data = pytesseract.image_to_data(img, output_type=pytesseract.Output.DICT)
            bbox_map = []
            scale_x = page.rect.width / img.width
            scale_y = page.rect.height / img.height
            for j, word in enumerate(ocr_data["text"]):
                if word.strip():
                    x, y, w, h = (
                        ocr_data["left"][j], ocr_data["top"][j],
                        ocr_data["width"][j], ocr_data["height"][j],
                    )
                    bbox_map.append({
                        "text": word,
                        "bbox": [x * scale_x, y * scale_y, (x + w) * scale_x, (y + h) * scale_y],
                    })

            pages.append(PageText(page_num=page_num, text=ocr_text, used_ocr=True, bbox_map=bbox_map))

    doc.close()
    return pages


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
    """A standalone .png/.jpg upload — always OCR, no direct-text path exists."""
    img = Image.open(file_path)
    text = pytesseract.image_to_string(img)
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