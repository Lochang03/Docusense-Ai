"use client";

import { useEffect, useState } from "react";
import { MessagesSquare, User, Sparkles, Loader2, ArrowLeft } from "lucide-react";
import { api, type ChatHistoryEntry } from "@/lib/api";

interface ChatHistoryViewProps {
  onBack: () => void;
  onOpenDocument: (docId: string) => void;
}

export function ChatHistoryView({ onBack, onOpenDocument }: ChatHistoryViewProps) {
  const [entries, setEntries] = useState<ChatHistoryEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getAllChatHistory()
      .then(setEntries)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load history."));
  }, []);

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden bg-paper">
      <div className="flex items-center gap-3 border-b border-border px-6 py-4">
        <button
          onClick={onBack}
          className="rounded-md p-1.5 text-slate hover:bg-black/5 hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <MessagesSquare className="h-4 w-4 text-brass" />
        <h1 className="font-display text-lg italic text-ink">Your question history</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        {entries === null && !error && (
          <div className="flex justify-center pt-12">
            <Loader2 className="h-5 w-5 animate-spin text-slate-light" />
          </div>
        )}

        {error && (
          <p className="mx-auto max-w-md rounded-md bg-rust-light px-4 py-3 text-sm text-rust">
            {error}
          </p>
        )}

        {entries && entries.length === 0 && (
          <p className="pt-12 text-center text-sm text-slate">
            You haven&rsquo;t asked any questions yet — open a document and start a chat.
          </p>
        )}

        {entries && entries.length > 0 && (
          <div className="mx-auto max-w-2xl space-y-3">
            {entries.map((entry) => (
              <button
                key={entry.id}
                onClick={() => onOpenDocument(entry.doc_id)}
                className="lift-on-hover flex w-full items-start gap-3 rounded-lg border border-border bg-paper-dim/40 p-4 text-left"
              >
                <div
                  className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                    entry.role === "user" ? "bg-ink/10" : "bg-brass/15"
                  }`}
                >
                  {entry.role === "user" ? (
                    <User className="h-3 w-3 text-ink" />
                  ) : (
                    <Sparkles className="h-3 w-3 text-brass" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-slate">
                    {entry.document_title}
                  </p>
                  <p className="mt-0.5 text-sm text-ink line-clamp-2">{entry.content}</p>
                  <p className="mt-1 text-xs text-slate-light">
                    {new Date(entry.created_at).toLocaleString()}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}