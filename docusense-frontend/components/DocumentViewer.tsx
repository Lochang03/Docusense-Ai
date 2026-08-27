"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  FileText,
  Loader2,
  Sparkles,
  ListTree,
  AlertTriangle,
  MessageCircleQuestion,
  X,
} from "lucide-react";
import { api, type AnnotationMode } from "@/lib/api";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

interface DocumentViewerProps {
  docId: string;
  title: string;
  mimeType: string;
  pageCount: number;
  jumpToPage: number | null;
}

interface ToolbarState {
  text: string;
  top: number;
  left: number;
}

const MODE_ACTIONS: { mode: AnnotationMode; label: string; icon: typeof Sparkles }[] = [
  { mode: "explain", label: "Explain Simply", icon: Sparkles },
  { mode: "summarize", label: "Summarize", icon: ListTree },
  { mode: "risks", label: "Identify Risks", icon: AlertTriangle },
  { mode: "custom", label: "Ask a Question", icon: MessageCircleQuestion },
];

export function DocumentViewer({ docId, title, mimeType, pageCount, jumpToPage }: DocumentViewerProps) {
  const isImage = mimeType.startsWith("image/");

  const [currentPage, setCurrentPage] = useState(1);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [zoom, setZoom] = useState(100);
  const [flash, setFlash] = useState(false);
  const [lastJump, setLastJump] = useState<number | null>(null);
  const [containerWidth, setContainerWidth] = useState(640);

  const [fileBlobUrl, setFileBlobUrl] = useState<string | null>(null);
  const [fileLoadError, setFileLoadError] = useState(false);

  const [toolbar, setToolbar] = useState<ToolbarState | null>(null);
  const [customInput, setCustomInput] = useState(false);
  const [question, setQuestion] = useState("");
  const [isAsking, setIsAsking] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [resultError, setResultError] = useState<string | null>(null);

  const pageContainerRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    setFileBlobUrl(null);
    setFileLoadError(false);

    api
      .getFileUrl(docId)
      .then((url) => {
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }
        objectUrl = url;
        setFileBlobUrl(url);
      })
      .catch(() => {
        if (!cancelled) setFileLoadError(true);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [docId]);

  if (jumpToPage && jumpToPage !== lastJump) {
    setLastJump(jumpToPage);
    setCurrentPage(jumpToPage);
    setFlash(true);
  }

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(false), 1800);
    return () => clearTimeout(t);
  }, [flash]);

  function closeToolbar() {
    setToolbar(null);
    setCustomInput(false);
    setQuestion("");
    setResult(null);
    setResultError(null);
  }

  useEffect(() => {
    function handleDocumentMouseDown(e: MouseEvent) {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        closeToolbar();
      }
    }
    document.addEventListener("mousedown", handleDocumentMouseDown);
    return () => document.removeEventListener("mousedown", handleDocumentMouseDown);
  }, []);

  const handleMouseUp = useCallback(() => {
    // Text selection (and therefore highlight-to-ask) only applies to
    // PDFs, which have a real text layer. Images have no selectable text.
    if (isImage) return;

    const selection = window.getSelection();
    const text = selection?.toString().trim();

    if (!text || !selection || selection.rangeCount === 0 || !pageContainerRef.current) {
      return;
    }

    const range = selection.getRangeAt(0);
    if (!pageContainerRef.current.contains(range.commonAncestorContainer)) {
      return;
    }

    const rect = range.getBoundingClientRect();
    const containerRect = pageContainerRef.current.getBoundingClientRect();

    setToolbar({
      text,
      top: rect.top - containerRect.top - 44,
      left: Math.max(0, rect.left - containerRect.left),
    });
    setResult(null);
    setResultError(null);
    setCustomInput(false);
  }, [isImage]);

  async function handleAction(mode: AnnotationMode) {
    if (!toolbar) return;

    if (mode === "custom" && !customInput) {
      setCustomInput(true);
      return;
    }

    setIsAsking(true);
    setResultError(null);
    try {
      const res = await api.scopedQuery(docId, {
        selected_text: toolbar.text,
        page_num: currentPage,
        mode,
        custom_question: mode === "custom" ? question : undefined,
      });
      setResult(res.ai_notes);
    } catch (e) {
      setResultError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setIsAsking(false);
    }
  }

  const effectivePageCount = isImage ? 1 : numPages ?? pageCount;

  return (
    <div className="flex h-full min-h-0 flex-col bg-paper-dim">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="h-4 w-4 shrink-0 text-slate" />
          <span className="truncate text-sm font-medium text-ink">{title}</span>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {!isImage && (
            <>
              <div className="flex items-center gap-1.5 text-sm text-slate">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  className="rounded p-1 hover:bg-black/5 disabled:opacity-30"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="font-mono text-xs">
                  {currentPage} / {effectivePageCount || 1}
                </span>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(effectivePageCount || 1, p + 1))}
                  disabled={currentPage >= effectivePageCount}
                  className="rounded p-1 hover:bg-black/5 disabled:opacity-30"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
              <div className="h-4 w-px bg-border" />
            </>
          )}

          <div className="flex items-center gap-1.5 text-slate">
            <button
              onClick={() => setZoom((z) => Math.max(50, z - 10))}
              className="rounded p-1 hover:bg-black/5"
            >
              <ZoomOut className="h-4 w-4" />
            </button>
            <span className="w-10 text-center font-mono text-xs">{zoom}%</span>
            <button
              onClick={() => setZoom((z) => Math.min(200, z + 10))}
              className="rounded p-1 hover:bg-black/5"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <div
        className="flex-1 overflow-auto px-8 py-8"
        ref={(el) => {
          if (el) setContainerWidth(Math.min(el.clientWidth - 64, 900));
        }}
      >
        <div
          ref={pageContainerRef}
          onMouseUp={handleMouseUp}
          className={`relative mx-auto w-fit rounded-sm shadow-[0_1px_2px_rgba(27,29,35,0.06),0_8px_24px_rgba(27,29,35,0.08)] ${flash ? "highlight-sweep" : ""}`}
        >
          {!fileBlobUrl && !fileLoadError && (
            <div className="flex h-[600px] w-[640px] items-center justify-center bg-paper">
              <Loader2 className="h-6 w-6 animate-spin text-slate-light" />
            </div>
          )}

          {fileLoadError && (
            <div className="flex h-[600px] w-[640px] flex-col items-center justify-center gap-2 bg-paper text-center">
              <p className="text-sm text-rust">Couldn&rsquo;t load this file.</p>
              <p className="max-w-xs text-xs text-slate-light">
                You may need to log in again.
              </p>
            </div>
          )}

          {fileBlobUrl && isImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={fileBlobUrl}
              alt={title}
              style={{ width: (containerWidth * zoom) / 100 }}
              className="block bg-paper"
            />
          )}

          {fileBlobUrl && !isImage && (
            <Document
              file={fileBlobUrl}
              onLoadSuccess={({ numPages: n }) => setNumPages(n)}
              loading={
                <div className="flex h-[600px] w-[640px] items-center justify-center bg-paper">
                  <Loader2 className="h-6 w-6 animate-spin text-slate-light" />
                </div>
              }
              error={
                <div className="flex h-[600px] w-[640px] flex-col items-center justify-center gap-2 bg-paper text-center">
                  <p className="text-sm text-rust">Couldn&rsquo;t render this file.</p>
                  <p className="max-w-xs text-xs text-slate-light">
                    Real rendering currently supports PDF and image files. Other formats
                    will get a text-based preview in a future update.
                  </p>
                </div>
              }
            >
              <Page
                pageNumber={currentPage}
                width={(containerWidth * zoom) / 100}
                renderAnnotationLayer={true}
                renderTextLayer={true}
              />
            </Document>
          )}

          {toolbar && (
            <div
              ref={toolbarRef}
              className="absolute z-20 max-w-sm rounded-lg bg-ink text-paper shadow-lg"
              style={{ top: toolbar.top, left: toolbar.left }}
            >
              {!result && !resultError && (
                <div className="flex items-center gap-1 p-1.5">
                  {MODE_ACTIONS.map(({ mode, label, icon: Icon }) => (
                    <button
                      key={mode}
                      onClick={() => handleAction(mode)}
                      disabled={isAsking}
                      title={label}
                      className="lift-on-hover flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-paper/90 hover:bg-white/10 disabled:opacity-40"
                    >
                      <Icon className="h-3.5 w-3.5 text-brass" />
                      {isAsking ? "…" : label}
                    </button>
                  ))}
                  <button
                    onClick={closeToolbar}
                    className="rounded-md p-1.5 text-slate-light hover:bg-white/10 hover:text-paper"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              {customInput && !result && !resultError && !isAsking && (
                <div className="flex items-center gap-1.5 border-t border-white/10 p-1.5">
                  <input
                    autoFocus
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAction("custom")}
                    placeholder="Ask about this selection…"
                    className="flex-1 rounded-md bg-white/5 px-2 py-1.5 text-xs text-paper placeholder:text-slate-light focus:outline-none"
                  />
                  <button
                    onClick={() => handleAction("custom")}
                    disabled={!question.trim()}
                    className="lift-on-hover rounded-md bg-brass px-2.5 py-1.5 text-xs font-medium text-ink disabled:opacity-40"
                  >
                    Ask
                  </button>
                </div>
              )}

              {(result || resultError) && (
                <div className="max-w-sm space-y-2 p-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase tracking-wider text-slate-light">
                      {resultError ? "Something went wrong" : "AI response"}
                    </span>
                    <button onClick={closeToolbar} className="text-slate-light hover:text-paper">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <p className={`text-sm leading-relaxed ${resultError ? "text-rust" : "text-paper/90"}`}>
                    {resultError || result}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}