"use client";

import { BookMarked } from "lucide-react";
import type { Citation } from "@/lib/api";

interface CitationTagProps {
  citation: Citation;
  onClick: (citation: Citation) => void;
}

/**
 * The "index tab" — this project's signature UI element. Styled like a
 * foil-stamped tab on a bound document rather than a generic chip, because
 * page-precise citation is DocuSense AI's actual differentiator, not an
 * afterthought.
 */
export function CitationTag({ citation, onClick }: CitationTagProps) {
  return (
    <button
      onClick={() => onClick(citation)}
      className="citation-tab rounded-full px-2.5 py-0.5 font-mono text-xs cursor-pointer"
      title={`Jump to page ${citation.page} · confidence ${(citation.score * 100).toFixed(0)}%`}
    >
      <BookMarked className="h-3 w-3" />
      Page {citation.page}
    </button>
  );
}