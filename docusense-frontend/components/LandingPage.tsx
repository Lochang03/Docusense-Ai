"use client";

import { useEffect, useRef, useState } from "react";
import {
  BookOpen,
  ScanLine,
  MessagesSquare,
  FileText,
  Highlighter,
  ShieldCheck,
  Database,
  Zap,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import { CursorGlow } from "@/components/CursorGlow";
import { WordField } from "@/components/WordField";

interface LandingPageProps {
  onGetStarted: () => void;
  onLogin: () => void;
}

function useRevealOnScroll<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let cancelled = false;
    const checkInitial = () => {
      if (cancelled) return;
      const rect = el.getBoundingClientRect();
      const inView = rect.top < window.innerHeight * 0.85 && rect.bottom > 0;
      if (inView) setVisible(true);
    };
    const raf = requestAnimationFrame(checkInitial);

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    observer.observe(el);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, []);

  return { ref, visible };
}

function Reveal({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const { ref, visible } = useRevealOnScroll<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${
        visible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
      } ${className}`}
    >
      {children}
    </div>
  );
}

function SpotlightCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const glowRef = useRef<HTMLDivElement | null>(null);

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    el.style.setProperty("--spot-x", `${(x / rect.width) * 100}%`);
    el.style.setProperty("--spot-y", `${(y / rect.height) * 100}%`);

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateY = ((x - centerX) / centerX) * 6;
    const rotateX = ((centerY - y) / centerY) * 6;
    el.style.transform = `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.02)`;
  }

  function handleEnter() {
    if (glowRef.current) glowRef.current.style.opacity = "1";
  }

  function handleLeave() {
    if (glowRef.current) glowRef.current.style.opacity = "0";
    const el = ref.current;
    if (el) el.style.transform = "perspective(800px) rotateX(0deg) rotateY(0deg) scale(1)";
  }

  return (
    <div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      className={`relative overflow-hidden transition-transform duration-200 ease-out will-change-transform ${className}`}
      style={{ "--spot-x": "50%", "--spot-y": "50%" } as React.CSSProperties}
    >
      <div
        ref={glowRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200"
        style={{
          background:
            "radial-gradient(280px circle at var(--spot-x) var(--spot-y), rgba(176,141,87,0.45), transparent 70%)",
        }}
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
}

const FEATURES = [
  {
    icon: ScanLine,
    title: "Hybrid Text & OCR Extraction",
    description:
      "Direct digital text extraction for born-digital PDFs, with automatic OCR fallback for scanned pages — so nothing gets missed, regardless of source quality.",
  },
  {
    icon: MessagesSquare,
    title: "Grounded RAG Chat",
    description:
      "Every answer is retrieved from your actual document and cited by exact page — if it's not in the text, the model says so instead of guessing.",
  },
  {
    icon: FileText,
    title: "Multi-Mode Summarization",
    description:
      "Executive summaries, key takeaways, and flagged risks or action items — generated on demand and exportable to Markdown, PDF, or clipboard.",
  },
  {
    icon: Highlighter,
    title: "Highlight-to-Ask",
    description:
      "Select any passage and get an instant, scoped answer — explain it simply, summarize it, or flag risks — without losing your place in the document.",
  },
  {
    icon: ShieldCheck,
    title: "Secure & Private by Design",
    description:
      "JWT-based authentication, per-user document ownership, and encrypted storage — your documents stay yours.",
  },
  {
    icon: Zap,
    title: "Fast, Precise Retrieval",
    description:
      "Dense vector search over your document's content finds the most relevant passages in milliseconds, not minutes of manual reading.",
  },
];

const STEPS = [
  {
    number: "01",
    title: "Upload",
    description: "Drop in a PDF, Word document, scanned image, or plain text file — up to 50MB.",
  },
  {
    number: "02",
    title: "Ask",
    description: "Chat with the document naturally, or highlight any passage for a focused question.",
  },
  {
    number: "03",
    title: "Verify",
    description: "Every answer links back to the exact page it came from — click to jump straight there.",
  },
];

export function LandingPage({ onGetStarted, onLogin }: LandingPageProps) {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-paper">
      {/* --- Nav --- */}
      <header className="relative z-20 flex items-center justify-between border-b border-border bg-paper px-6 py-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-ink text-brass">
            <BookOpen className="h-4 w-4" />
          </div>
          <span className="font-display text-lg italic text-ink">DocuSense AI</span>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={onLogin} className="text-sm text-slate hover:text-ink">
            Log In
          </button>
          <button
            onClick={onGetStarted}
            className="lift-on-hover rounded-md bg-brass px-4 py-1.5 text-sm font-medium text-ink"
          >
            Get Started
          </button>
        </div>
      </header>

      {/* --- Hero --- */}
      <section className="relative flex min-h-[70vh] flex-col items-center justify-center overflow-hidden px-6 py-20 text-center">
        <WordField />
        <CursorGlow />
        <div className="relative z-10 mx-auto max-w-2xl">
          <div className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-border bg-paper-dim/60 px-3 py-1 text-xs uppercase tracking-wider text-slate">
            <CheckCircle2 className="h-3 w-3 text-brass" />
            IEEE 830 compliant architecture
          </div>
          <h1 className="font-display text-4xl italic text-ink sm:text-5xl">
            Ask your documents anything.
          </h1>
          <p className="mx-auto mt-4 max-w-lg text-base text-slate">
            An enterprise-grade document review platform combining OCR extraction,
            grounded conversational AI, and precise page-level citations — built for
            legal analysts, researchers, and operations teams who can't afford to
            guess.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <button
              onClick={onGetStarted}
              className="lift-on-hover flex items-center gap-1.5 rounded-md bg-brass px-6 py-2.5 text-sm font-medium text-ink"
            >
              Get Started <ArrowRight className="h-4 w-4" />
            </button>
            <button
              onClick={onLogin}
              className="rounded-md border border-border px-6 py-2.5 text-sm font-medium text-ink hover:bg-black/5"
            >
              Log In
            </button>
          </div>
        </div>
      </section>

      {/* --- Problem / Solution --- */}
      <section className="border-t border-border bg-paper-dim/30 px-6 py-20">
        <Reveal className="mx-auto max-w-3xl text-center">
          <h2 className="font-display text-2xl italic text-ink sm:text-3xl">
            Manual document review doesn't scale.
          </h2>
          <p className="mt-3 text-sm text-slate sm:text-base">
            Legal briefs, technical specs, and research papers pile up faster than
            anyone can cross-reference by hand. DocuSense AI combines dense vector
            indexing with grounded LLM orchestration to give you real-time synthesis
            and precise snippet verification — so you spend time deciding, not
            searching.
          </p>
        </Reveal>
      </section>

      {/* --- Features grid --- */}
      <section className="px-6 py-20">
        <Reveal className="mx-auto mb-12 max-w-xl text-center">
          <h2 className="font-display text-2xl italic text-ink sm:text-3xl">
            Everything you need, grounded in your text.
          </h2>
        </Reveal>
        <div className="mx-auto grid max-w-5xl gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <Reveal key={feature.title}>
              <SpotlightCard className="h-full rounded-lg border border-border bg-paper-dim/40 p-5">
                <feature.icon className="h-5 w-5 text-brass" />
                <h3 className="mt-3 text-sm font-medium text-ink">{feature.title}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-slate">
                  {feature.description}
                </p>
              </SpotlightCard>
            </Reveal>
          ))}
        </div>
      </section>

      {/* --- How it works --- */}
      <section className="border-t border-border bg-ink px-6 py-20">
        <Reveal className="mx-auto mb-12 max-w-xl text-center">
          <h2 className="font-display text-2xl italic text-paper sm:text-3xl">
            How it works
          </h2>
        </Reveal>
        <div className="mx-auto grid max-w-4xl gap-8 sm:grid-cols-3">
          {STEPS.map((step) => (
            <Reveal key={step.number}>
              <div className="text-center sm:text-left">
                <span className="font-display text-3xl italic text-brass">
                  {step.number}
                </span>
                <h3 className="mt-2 text-sm font-medium text-paper">{step.title}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-light">
                  {step.description}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* --- Tech / trust strip --- */}
      <section className="px-6 py-16">
        <Reveal className="mx-auto max-w-3xl text-center">
          <div className="flex items-center justify-center gap-2 text-xs uppercase tracking-wider text-slate-light">
            <Database className="h-4 w-4" />
            Built on PostgreSQL, dense vector retrieval, and modern LLM orchestration
          </div>
        </Reveal>
      </section>

      {/* --- Final CTA --- */}
      <section className="border-t border-border bg-paper-dim/30 px-6 py-20 text-center">
        <Reveal className="mx-auto max-w-xl">
          <h2 className="font-display text-2xl italic text-ink sm:text-3xl">
            Ready to stop searching manually?
          </h2>
          <button
            onClick={onGetStarted}
            className="lift-on-hover mt-6 inline-flex items-center gap-1.5 rounded-md bg-brass px-6 py-2.5 text-sm font-medium text-ink"
          >
            Get Started <ArrowRight className="h-4 w-4" />
          </button>
        </Reveal>
      </section>

      <footer className="border-t border-border px-6 py-6 text-center text-xs text-slate-light">
        DocuSense AI — Intelligent Document Review & Analysis
      </footer>
    </div>
  );
}