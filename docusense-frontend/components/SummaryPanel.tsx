"use client";

import { useEffect, useState } from "react";
import {
  FileText,
  Sparkles,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Download,
  RefreshCcw,
  Copy,
  Check,
  FileDown,
} from "lucide-react";
import { api, type SummaryResponse, type RiskAction } from "@/lib/api";

interface SummaryPanelProps {
  docId: string;
}

const RISK_STYLES: Record<RiskAction["type"], { icon: typeof AlertTriangle; className: string }> = {
  risk: { icon: AlertTriangle, className: "text-rust" },
  deadline: { icon: Clock, className: "text-brass" },
  action: { icon: CheckCircle2, className: "text-verify" },
};

export function SummaryPanel({ docId }: SummaryPanelProps) {
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isExporting, setIsExporting] = useState<"markdown" | "pdf" | null>(null);

  useEffect(() => {
    setIsLoading(true);
    api
      .getSummary(docId)
      .then(setSummary)
      .catch(() => setSummary(null))
      .finally(() => setIsLoading(false));
  }, [docId]);

  async function handleGenerate() {
    setIsGenerating(true);
    setError(null);
    try {
      const result = await api.generateSummary(docId);
      setSummary(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate summary.");
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleCopy() {
    try {
      const text = await api.getSummaryClipboardText(docId);
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // silent fail is fine here — non-critical action
    }
  }

  async function handleExport(format: "markdown" | "pdf") {
    setIsExporting(format);
    try {
      await api.downloadSummaryExport(docId, format);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Export failed — unknown error");
    } finally {
      setIsExporting(null);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-ink text-paper">
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-brass" />
          <span className="text-xs uppercase tracking-wider text-slate-light">
            Executive summary &amp; key findings
          </span>
        </div>
        {summary?.status === "ready" && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              title="Regenerate summary"
              className="lift-on-hover rounded-md p-1.5 text-slate-light hover:text-paper disabled:opacity-30"
            >
              <RefreshCcw className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={handleCopy}
              title="Copy summary to clipboard"
              className="lift-on-hover rounded-md p-1.5 text-slate-light hover:text-paper"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-verify" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
            <button
              onClick={() => handleExport("markdown")}
              disabled={isExporting !== null}
              title="Export as Markdown"
              className="lift-on-hover flex items-center gap-1.5 rounded-md bg-white/10 px-2.5 py-1.5 text-xs font-medium text-paper hover:bg-white/15 disabled:opacity-40"
            >
              <Download className="h-3.5 w-3.5" />
              .md
            </button>
            <button
              onClick={() => handleExport("pdf")}
              disabled={isExporting !== null}
              title="Export as PDF"
              className="lift-on-hover flex items-center gap-1.5 rounded-md bg-brass px-2.5 py-1.5 text-xs font-medium text-ink disabled:opacity-40"
            >
              <FileDown className="h-3.5 w-3.5" />
              PDF
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-6">
        {isLoading && (
          <div className="flex gap-1 pt-2">
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-light [animation-delay:-0.3s]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-light [animation-delay:-0.15s]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-light" />
          </div>
        )}

        {!isLoading && (!summary || summary.status !== "ready") && (
          <div className="mt-10 flex flex-col items-center gap-3 text-center text-slate-light">
            <Sparkles className="h-6 w-6 text-brass" />
            <p className="font-display text-lg text-paper">Summarize this document</p>
            <p className="max-w-xs text-sm">
              Generate an executive summary, key takeaways, and flagged risks or action
              items — grounded in the full document.
            </p>
            {error && <p className="max-w-xs text-sm text-rust">{error}</p>}
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="lift-on-hover mt-2 rounded-md bg-brass px-4 py-2 text-sm font-medium text-ink disabled:opacity-50"
            >
              {isGenerating ? "Generating…" : "Generate Summary"}
            </button>
          </div>
        )}

        {!isLoading && summary?.status === "ready" && (
          <div className="space-y-8">
            <section className="space-y-2">
              <h3 className="font-display text-base text-paper">Executive Summary</h3>
              <p className="text-sm leading-relaxed text-paper/90">{summary.executive_summary}</p>
            </section>

            {summary.key_takeaways && summary.key_takeaways.length > 0 && (
              <section className="space-y-2">
                <h3 className="font-display text-base text-paper">Key Takeaways</h3>
                <ul className="space-y-2">
                  {summary.key_takeaways.map((item, i) => (
                    <li key={i} className="flex gap-2 text-sm leading-relaxed text-paper/90">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-brass" />
                      {item}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {summary.risks_actions && summary.risks_actions.length > 0 && (
              <section className="space-y-2">
                <h3 className="font-display text-base text-paper">Risks &amp; Action Items</h3>
                <ul className="space-y-3">
                  {summary.risks_actions.map((item, i) => {
                    const { icon: Icon, className } = RISK_STYLES[item.type];
                    return (
                      <li key={i} className="flex items-start gap-2.5">
                        <Icon className={'mt-0.5 h-3.5 w-3.5 shrink-0 '} />
                        <div className="flex-1 text-sm leading-relaxed text-paper/90">
                          {item.description}
                          <span className="ml-1.5 font-mono text-xs text-slate-light">
                            [Page {item.page_num}]
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
