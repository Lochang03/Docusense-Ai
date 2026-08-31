"use client";

import { useState, useEffect } from "react";
import { BookOpen, Loader2, Eye, EyeOff, MessagesSquare, FileText, Sparkles } from "lucide-react";
import { api } from "@/lib/api";
import { CursorGlow } from "@/components/CursorGlow";
import { WordField } from "@/components/WordField";
import { LandingPage } from "@/components/LandingPage";

interface AuthGateProps {
  children: React.ReactNode;
}

type View = "landing" | "form";

export function AuthGate({ children }: AuthGateProps) {
  const [checked, setChecked] = useState(false);
  const [isAuthed, setIsAuthed] = useState(false);
  const [view, setView] = useState<View>("landing");
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setIsAuthed(api.isAuthenticated());
    setChecked(true);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (mode === "register" && password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (mode === "login") {
        await api.login(email, password);
      } else {
        await api.register(name, email, password);
      }
      setIsAuthed(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function switchMode() {
    setMode(mode === "login" ? "register" : "login");
    setError(null);
    setPassword("");
    setConfirmPassword("");
  }

  function openForm(startMode: "login" | "register") {
    setMode(startMode);
    setError(null);
    setView("form");
  }

  if (!checked) {
    return (
      <div className="flex h-screen items-center justify-center bg-paper">
        <Loader2 className="h-6 w-6 animate-spin text-slate-light" />
      </div>
    );
  }

  if (isAuthed) {
    return <>{children}</>;
  }

  // --- Public landing page (shown to anyone who isn't logged in) ---
  if (view === "landing") {
    return (
      <LandingPage onGetStarted={() => openForm("register")} onLogin={() => openForm("login")} />
    );
  }

  // --- Login / register form ---
  return (
    <div className="relative flex h-screen items-center justify-center overflow-hidden bg-paper px-6">
      <WordField />
      <CursorGlow />
      <div className="relative z-10 w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <button
            onClick={() => setView("landing")}
            className="flex h-10 w-10 items-center justify-center rounded-md bg-ink text-brass"
          >
            <BookOpen className="h-5 w-5" />
          </button>
          <div>
            <h1 className="font-display text-2xl italic text-ink">DocuSense AI</h1>
            <p className="mt-1 text-sm text-slate">
              {mode === "login" ? "Log in to your documents." : "Create an account to get started."}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === "register" && (
            <div>
              <label className="mb-1 block text-xs uppercase tracking-wider text-slate-light">
                Name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-md border border-border bg-paper px-3 py-2 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-brass"
                placeholder="Your name"
              />
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs uppercase tracking-wider text-slate-light">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-border bg-paper px-3 py-2 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-brass"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs uppercase tracking-wider text-slate-light">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-md border border-border bg-paper px-3 py-2 pr-10 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-brass"
                placeholder="At least 8 characters"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                tabIndex={-1}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-light hover:text-ink"
              >
                {showPassword ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </button>
            </div>
            {mode === "register" && (
              <p className="mt-1 text-xs text-slate-light">
                Must include an uppercase letter, lowercase letter, number, and special character.
              </p>
            )}
          </div>

          {mode === "register" && (
            <div>
              <label className="mb-1 block text-xs uppercase tracking-wider text-slate-light">
                Confirm Password
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  required
                  minLength={8}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full rounded-md border border-border bg-paper px-3 py-2 pr-10 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-brass"
                  placeholder="Re-enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((v) => !v)}
                  tabIndex={-1}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-light hover:text-ink"
                >
                  {showConfirmPassword ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </button>
              </div>
            </div>
          )}

          {error && <p className="rounded-md bg-rust-light px-3 py-2 text-sm text-rust">{error}</p>}

          <button
            type="submit"
            disabled={isSubmitting}
            className="lift-on-hover w-full rounded-md bg-brass px-4 py-2 text-sm font-medium text-ink disabled:opacity-50"
          >
            {isSubmitting ? "Please wait…" : mode === "login" ? "Log In" : "Create Account"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-slate">
          {mode === "login" ? "Don't have an account? " : "Already have an account? "}
          <button onClick={switchMode} className="font-medium text-brass hover:underline">
            {mode === "login" ? "Create one" : "Log in"}
          </button>
        </p>
      </div>
    </div>
  );
}