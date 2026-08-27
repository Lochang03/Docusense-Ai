"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { BookOpen, MessagesSquare, FileText, History } from "lucide-react";
import { api, type DocumentStatusResponse, type Citation } from "@/lib/api";
import { UploadDropzone } from "@/components/UploadDropzone";
import { StatusPill } from "@/components/StatusPill";
import { ChatPanel } from "@/components/ChatPanel";
import { SummaryPanel } from "@/components/SummaryPanel";
import { CursorGlow } from "@/components/CursorGlow";
import { WordField } from "@/components/WordField";
import { AuthGate } from "@/components/AuthGate";
import { ChatHistoryView } from "@/components/ChatHistoryView";

const DocumentViewer = dynamic(
  () => import("@/components/DocumentViewer").then((mod) => mod.DocumentViewer),
  { ssr: false }
);

type RightPanelTab = "chat" | "summary";

export default function Home() {
  const [doc, setDoc] = useState<DocumentStatusResponse | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jumpToPage, setJumpToPage] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<RightPanelTab>("chat");
  const [showHistory, setShowHistory] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const pollStatus = useCallback((docId: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const status = await api.getStatus(docId);
        setDoc(status);
        if (status.status === "ready" || status.status === "failed") {
          if (pollRef.current) clearInterval(pollRef.current);
        }
      } catch {
        if (pollRef.current) clearInterval(pollRef.current);
      }
    }, 1500);
  }, []);

  useEffect(() => () => {
    if (pollRef.current) clearInterval(pollRef.current);
  }, []);

  // On first load, check whether the URL already points at a document
  // (?doc=<id>) — this is what lets refreshing the page (or sharing/
  // bookmarking a link) restore the same view instead of always dropping
  // back to the upload screen.
  useEffect(() => {
    const existingId = new URLSearchParams(window.location.search).get("doc");
    if (!existingId) return;
    (async () => {
      try {
        const status = await api.getStatus(existingId);
        setDoc(status);
        if (status.status !== "ready" && status.status !== "failed") {
          pollStatus(existingId);
        }
      } catch {
        // The document no longer exists on the backend — fall back to
        // the upload screen quietly rather than showing a confusing
        // error on load.
      }
    })();
    // Intentionally run once on mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the URL's ?doc= param in sync with whatever document is open,
  // so the browser's address bar always reflects the current view.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (doc?.id) {
      url.searchParams.set("doc", doc.id);
    } else {
      url.searchParams.delete("doc");
    }
    window.history.replaceState(null, "", url.toString());
  }, [doc?.id]);

  function goHome() {
    if (pollRef.current) clearInterval(pollRef.current);
    setDoc(null);
    setError(null);
    setShowHistory(false);
  }

  async function handleUpload(file: File) {
    setError(null);
    setIsUploading(true);
    try {
      const { id } = await api.uploadDocument(file);
      const status = await api.getStatus(id);
      setDoc(status);
      pollStatus(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setIsUploading(false);
    }
  }

  function handleCitationClick(citation: Citation) {
    setJumpToPage(citation.page);
    setTimeout(() => setJumpToPage(null), 100);
  }

  const isReady = doc?.status === "ready";

  return (
    <AuthGate>
      <main className="flex h-screen flex-col">
        <header className="relative z-20 flex items-center justify-between border-b border-border bg-paper px-6 py-3.5">
          <button onClick={goHome} className="flex items-center gap-2.5 cursor-pointer">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-ink text-brass">
              <BookOpen className="h-4 w-4" />
            </div>
            <span className="font-display text-lg italic text-ink">DocuSense AI</span>
          </button>
          <div className="flex items-center gap-4">
            {doc && (
              <div className="flex items-center gap-3">
                <span className="max-w-xs truncate text-sm text-slate">{doc.title}</span>
                <StatusPill status={doc.status} />
              </div>
            )}
            <button
              onClick={() => setShowHistory(true)}
              title="Question history"
              className="rounded-md p-1.5 text-slate hover:bg-black/5 hover:text-ink"
            >
              <History className="h-4 w-4" />
            </button>
            <button
              onClick={() => {
                api.logout();
                window.location.reload();
              }}
              className="text-sm text-slate-light hover:text-ink"
            >
              Log out
            </button>
          </div>
        </header>

        {showHistory ? (
          <ChatHistoryView
            onBack={() => setShowHistory(false)}
            onOpenDocument={async (docId) => {
              setShowHistory(false);
              const status = await api.getStatus(docId);
              setDoc(status);
              if (status.status !== "ready" && status.status !== "failed") {
                pollStatus(docId);
              }
            }}
          />
        ) : !doc ? (
          <div className="relative flex flex-1 items-center justify-center overflow-hidden px-6">
            <WordField />
            <CursorGlow />
            <div className="relative z-10 w-full max-w-lg">
              <div className="mb-8 text-center">
                <h1 className="font-display text-3xl italic text-ink">
                  Ask your documents anything.
                </h1>
                <p className="mt-2 text-sm text-slate">
                  Every answer is traced back to the exact page it came from.
                </p>
              </div>
              <UploadDropzone onFileSelected={handleUpload} isUploading={isUploading} />
              {error && (
                <p className="mt-4 rounded-md bg-rust-light px-4 py-2 text-sm text-rust">
                  {error}
                </p>
              )}
            </div>
          </div>
        ) : isReady ? (
          <div className="relative grid flex-1 grid-cols-[1fr_560px] overflow-hidden">
            <CursorGlow variant="workspace" />
            <div className="relative z-10 min-h-0">
              <DocumentViewer
                title={doc.title}
                docId={doc.id}
                mimeType={doc.mime_type}
                pageCount={doc.page_count}
                jumpToPage={jumpToPage}
              />
            </div>
            <div className="relative z-10 flex min-h-0 flex-col">
              <div className="flex shrink-0 border-b border-white/10 bg-ink">
                <button
                  onClick={() => setActiveTab("chat")}
                  className={`flex flex-1 items-center justify-center gap-1.5 px-4 py-3 text-xs uppercase tracking-wider transition-colors ${
                    activeTab === "chat"
                      ? "border-b-2 border-brass text-paper"
                      : "border-b-2 border-transparent text-slate-light hover:text-paper"
                  }`}
                >
                  <MessagesSquare className="h-3.5 w-3.5" />
                  Chat
                </button>
                <button
                  onClick={() => setActiveTab("summary")}
                  className={`flex flex-1 items-center justify-center gap-1.5 px-4 py-3 text-xs uppercase tracking-wider transition-colors ${
                    activeTab === "summary"
                      ? "border-b-2 border-brass text-paper"
                      : "border-b-2 border-transparent text-slate-light hover:text-paper"
                  }`}
                >
                  <FileText className="h-3.5 w-3.5" />
                  Summary
                </button>
              </div>
              <div className="min-h-0 flex-1">
                {activeTab === "chat" ? (
                  <ChatPanel docId={doc.id} onCitationClick={handleCitationClick} />
                ) : (
                  <SummaryPanel docId={doc.id} />
                )}
              </div>
            </div>
          </div>
        ) : doc.status === "failed" ? (
          <div className="flex flex-1 items-center justify-center px-6">
            <div className="max-w-md rounded-lg bg-rust-light px-6 py-5 text-center">
              <p className="font-display text-lg text-rust">Processing failed</p>
              <p className="mt-1 text-sm text-rust/80">
                {doc.error_message || "Something went wrong reading this document."}
              </p>
              <button
                onClick={goHome}
                className="mt-4 rounded-md border border-rust px-4 py-1.5 text-sm text-rust hover:bg-rust/5"
              >
                Try another file
              </button>
            </div>
          </div>
        ) : (
          <div className="relative flex flex-1 flex-col items-center justify-center gap-4 overflow-hidden px-6">
            <WordField />
            <CursorGlow />
            <div className="relative z-10 flex flex-col items-center gap-4">
              <StatusPill status={doc.status} />
              <p className="font-display text-xl italic text-slate">
                Reading &ldquo;{doc.title}&rdquo;…
              </p>
              <p className="text-sm text-slate-light">
                This usually takes a moment — longer for scanned pages.
              </p>
            </div>
          </div>
        )}
      </main>
    </AuthGate>
  );
}