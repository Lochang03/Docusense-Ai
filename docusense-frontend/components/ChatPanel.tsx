"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Sparkles, User, ShieldCheck } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { api, type ChatHistoryMessage, type Citation } from "@/lib/api";
import { CitationTag } from "./CitationTag";

interface ChatPanelProps {
  docId: string;
  onCitationClick: (citation: Citation) => void;
}

interface DisplayMessage {
  role: "user" | "ai";
  content: string;
  citations: Citation[] | null;
  pending?: boolean;
}

export function ChatPanel({ docId, onCitationClick }: ChatPanelProps) {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [showSlowNotice, setShowSlowNotice] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const slowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    api
      .getChatHistory(docId)
      .then((history: ChatHistoryMessage[]) =>
        setMessages(history.map((h) => ({ role: h.role, content: h.content, citations: h.citations })))
      )
      .catch(() => {});
  }, [docId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    const question = input.trim();
    if (!question || isSending) return;

    setInput("");
    setMessages((prev) => [
      ...prev,
      { role: "user", content: question, citations: null },
      { role: "ai", content: "", citations: null, pending: true },
    ]);
    setIsSending(true);
    setShowSlowNotice(false);

    // Only show the "detailed answer" reassurance if the response takes a
    // while — keeps quick answers feeling instant, and softens longer waits
    // instead of looking stuck.
    slowTimerRef.current = setTimeout(() => setShowSlowNotice(true), 6000);

    try {
      const result = await api.chat(docId, question);
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = { role: "ai", content: result.answer, citations: result.citations };
        return next;
      });
    } catch {
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = {
          role: "ai",
          content: "Something went wrong reaching the document. Try again in a moment.",
          citations: null,
        };
        return next;
      });
    } finally {
      if (slowTimerRef.current) clearTimeout(slowTimerRef.current);
      setShowSlowNotice(false);
      setIsSending(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-ink text-paper">
      <div className="flex items-center gap-2 border-b border-white/10 px-5 py-4">
        <ShieldCheck className="h-4 w-4 text-verify" />
        <span className="text-xs uppercase tracking-wider text-slate-light">
          Grounded chat — answers cite exact pages
        </span>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-5 overflow-y-auto px-5 py-6">
        {messages.length === 0 && (
          <div className="mt-10 flex flex-col items-center gap-3 text-center text-slate-light">
            <Sparkles className="h-6 w-6 text-brass" />
            <p className="font-display text-lg text-paper">Ask this document anything</p>
            <p className="max-w-xs text-sm">
              Every answer is grounded in the text you uploaded, with clickable citations
              pointing to the exact page.
            </p>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className="flex gap-3">
            <div
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                m.role === "user" ? "bg-white/10" : "bg-brass/20"
              }`}
            >
              {m.role === "user" ? (
                <User className="h-3.5 w-3.5 text-paper" />
              ) : (
                <Sparkles className="h-3.5 w-3.5 text-brass" />
              )}
            </div>
            <div className="flex-1 space-y-2">
              {m.pending ? (
                <div className="space-y-2 pt-1">
                  <div className="flex gap-1 pt-1">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-light [animation-delay:-0.3s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-light [animation-delay:-0.15s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-light" />
                  </div>
                  {showSlowNotice && (
                    <p className="text-xs text-slate-light">
                      Generating a detailed, cited answer — this can take a bit longer for
                      broad questions.
                    </p>
                  )}
                </div>
              ) : (
                <>
                  <div className="space-y-2 text-sm leading-relaxed text-paper/90">
                    <ReactMarkdown
                      components={{
                        p: ({ children }) => <p className="text-sm leading-relaxed text-paper/90">{children}</p>,
                        strong: ({ children }) => <strong className="font-semibold text-paper">{children}</strong>,
                        ul: ({ children }) => <ul className="list-disc space-y-1 pl-4">{children}</ul>,
                        ol: ({ children }) => <ol className="list-decimal space-y-1 pl-4">{children}</ol>,
                        li: ({ children }) => <li className="text-sm leading-relaxed text-paper/90">{children}</li>,
                      }}
                    >
                      {m.content}
                    </ReactMarkdown>
                  </div>
                  {m.citations && m.citations.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {m.citations.map((c, j) => (
                        <CitationTag key={j} citation={c} onClick={onCitationClick} />
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-white/10 p-4">
        <div className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2 focus-within:ring-1 focus-within:ring-brass">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Ask about this document…"
            className="flex-1 bg-transparent text-sm text-paper placeholder:text-slate-light focus:outline-none"
          />
          <button
            onClick={handleSend}
            disabled={isSending || !input.trim()}
            className="lift-on-hover rounded-md bg-brass p-1.5 text-ink transition-opacity disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-slate-light disabled:hover:translate-y-0 disabled:hover:shadow-none"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}