import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import type { DocumentStatus } from "@/lib/api";

const LABELS: Record<DocumentStatus, string> = {
  uploaded: "Queued",
  extracting: "Reading pages",
  chunking: "Structuring content",
  embedding: "Building index",
  ready: "Ready",
  failed: "Failed",
};

export function StatusPill({ status }: { status: DocumentStatus }) {
  if (status === "ready") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-verify-light px-3 py-1 text-xs font-medium text-verify">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Ready
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-rust-light px-3 py-1 text-xs font-medium text-rust">
        <XCircle className="h-3.5 w-3.5" />
        Failed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-brass/10 px-3 py-1 text-xs font-medium text-brass">
      <Loader2 className="h-3.5 w-3.5 animate-spin" />
      {LABELS[status]}
    </span>
  );
}