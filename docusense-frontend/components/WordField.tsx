const TERMS: { text: string; top: string; left: string; size: string; rotate: string }[] = [
  { text: "RETRIEVAL-AUGMENTED GENERATION", top: "10%", left: "8%", size: "text-sm", rotate: "-4deg" },
  { text: "SEMANTIC CHUNKING", top: "20%", left: "70%", size: "text-base", rotate: "3deg" },
  { text: "FAISS VECTOR INDEX", top: "36%", left: "6%", size: "text-sm", rotate: "2deg" },
  { text: "OCR FALLBACK", top: "8%", left: "40%", size: "text-xs", rotate: "-2deg" },
  { text: "PAGE-PRECISE CITATIONS", top: "58%", left: "72%", size: "text-base", rotate: "-3deg" },
  { text: "HALLUCINATION MITIGATION", top: "74%", left: "10%", size: "text-sm", rotate: "4deg" },
  { text: "GROUNDED ANSWERS", top: "84%", left: "52%", size: "text-lg", rotate: "-2deg" },
  { text: "GEMINI FLASH", top: "14%", left: "80%", size: "text-xs", rotate: "5deg" },
  { text: "EMBEDDINGS", top: "48%", left: "82%", size: "text-sm", rotate: "-4deg" },
  { text: "BOUNDING BOXES", top: "90%", left: "28%", size: "text-xs", rotate: "3deg" },
  { text: "COSINE SIMILARITY", top: "28%", left: "18%", size: "text-xs", rotate: "-3deg" },
  { text: "VERIFIED SOURCES", top: "65%", left: "38%", size: "text-sm", rotate: "2deg" },
  { text: "TESSERACT OCR", top: "6%", left: "60%", size: "text-xs", rotate: "-5deg" },
  { text: "CONTEXTUAL Q&A", top: "80%", left: "76%", size: "text-sm", rotate: "3deg" },
  { text: "PDF PARSING", top: "52%", left: "12%", size: "text-xs", rotate: "4deg" },
  { text: "VECTOR SEARCH", top: "10%", left: "24%", size: "text-sm", rotate: "-3deg" },
  { text: "DOCUMENT INGESTION", top: "36%", left: "56%", size: "text-sm", rotate: "2deg" },
  { text: "SPLIT-PANE WORKSPACE", top: "66%", left: "54%", size: "text-xs", rotate: "-2deg" },
  { text: "SUMMARY EXTRACTION", top: "20%", left: "46%", size: "text-sm", rotate: "4deg" },
  { text: "RISK & ACTION ITEMS", top: "90%", left: "8%", size: "text-xs", rotate: "3deg" },
  { text: "ANNOTATION LAYER", top: "16%", left: "6%", size: "text-xs", rotate: "-4deg" },
  { text: "STREAMING RESPONSES", top: "42%", left: "30%", size: "text-xs", rotate: "2deg" },
  { text: "CONFIDENCE SCORING", top: "58%", left: "88%", size: "text-xs", rotate: "-6deg" },
  { text: "MULTI-FORMAT UPLOAD", top: "82%", left: "18%", size: "text-sm", rotate: "4deg" },
  { text: "ZOOM & NAVIGATION", top: "28%", left: "78%", size: "text-xs", rotate: "-3deg" },
  { text: "BACKGROUND PROCESSING", top: "54%", left: "6%", size: "text-xs", rotate: "3deg" },
  { text: "SCOPED PROMPTS", top: "76%", left: "40%", size: "text-xs", rotate: "-2deg" },
  { text: "HIGHLIGHT TO ASK", top: "32%", left: "38%", size: "text-sm", rotate: "-5deg" },
  { text: "DOCUMENT STATUS", top: "94%", left: "64%", size: "text-xs", rotate: "3deg" },
  { text: "CHUNK METADATA", top: "62%", left: "16%", size: "text-xs", rotate: "2deg" },
  { text: "TEXT LAYER RENDERING", top: "12%", left: "52%", size: "text-xs", rotate: "-4deg" },
  { text: "CHAT THREAD MEMORY", top: "86%", left: "80%", size: "text-xs", rotate: "3deg" },
];


export function WordField() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0"
      style={{
        maskImage:
          "radial-gradient(360px circle at var(--glow-x, 50%) var(--glow-y, 35%), black 0%, transparent 75%)",
        WebkitMaskImage:
          "radial-gradient(360px circle at var(--glow-x, 50%) var(--glow-y, 35%), black 0%, transparent 75%)",
      }}
    >
      {TERMS.map((t, i) => (
        <span
          key={i}
          className={`absolute whitespace-nowrap font-mono ${t.size} tracking-wider text-slate/70`}
          style={{ top: t.top, left: t.left, transform: `rotate(${t.rotate})` }}
        >
          {t.text}
        </span>
      ))}
    </div>
  );
}