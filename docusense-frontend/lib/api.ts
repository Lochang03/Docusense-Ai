/**
 * Thin client for the DocuSense AI FastAPI backend.
 * All calls point at localhost:8000 during development — the same server
 * you've been testing through Swagger UI.
 */
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";
const TOKEN_KEY = "docusense_token";

export type DocumentStatus =
  | "uploaded"
  | "extracting"
  | "chunking"
  | "embedding"
  | "ready"
  | "failed";

export interface DocumentSummary {
  id: string;
  title: string;
  status: DocumentStatus;
  page_count: number;
}

export interface DocumentStatusResponse extends DocumentSummary {
  error_message: string | null;
  mime_type: string;
}

export interface Citation {
  page: number;
  chunk_id: number;
  score: number;
}

export interface ChatResponse {
  answer: string;
  citations: Citation[];
}

export interface ChatHistoryMessage {
  role: "user" | "ai";
  content: string;
  citations: Citation[] | null;
  created_at: string;
}

export type SummaryStatus = "pending" | "generating" | "ready" | "failed";

export interface RiskAction {
  type: "risk" | "action" | "deadline";
  description: string;
  page_num: number;
}

export interface ChatHistoryEntry {
  id: string;
  doc_id: string;
  document_title: string;
  role: "user" | "ai";
  content: string;
  citations: Citation[] | null;
  created_at: string;
}

export interface SummaryResponse {
  status: SummaryStatus;
  executive_summary: string | null;
  key_takeaways: string[] | null;
  risks_actions: RiskAction[] | null;
  error_message: string | null;
}

export type AnnotationMode = "explain" | "summarize" | "risks" | "custom";

export interface AnnotationResponse {
  id: string;
  doc_id: string;
  page_num: number;
  selected_text: string;
  ai_notes: string | null;
  rect_coords: Record<string, number> | null;
  created_at: string;
}

// --- Token storage ---

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

async function handle<T>(res: Response): Promise<T> {
  if (res.status === 401) {
    clearToken();
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(body.detail || `Request failed (${res.status})`);
  }
  return res.json();
}

/**
 * Every authenticated request goes through this — centralizing the
 * Authorization header here means no individual method below has to
 * remember to add it manually.
 */
async function authFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = getToken();
  const headers = new Headers(options.headers);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return fetch(`${API_BASE}${path}`, { ...options, headers });
}

export const api = {  async getAllChatHistory(): Promise<ChatHistoryEntry[]> {
    const res = await authFetch(`/documents/chat/history`);
    return handle(res);
  },
  // --- Auth ---

  isAuthenticated(): boolean {
    return getToken() !== null;
  },

  logout() {
    clearToken();
  },

  async register(email: string, password: string): Promise<void> {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await handle<{ access_token: string }>(res);
    setToken(data.access_token);
  },

  async login(email: string, password: string): Promise<void> {
    const form = new URLSearchParams();
    form.append("username", email);
    form.append("password", password);
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    });
    const data = await handle<{ access_token: string }>(res);
    setToken(data.access_token);
  },

  // --- Documents ---

  async uploadDocument(file: File): Promise<{ id: string; status: DocumentStatus }> {
    const form = new FormData();
    form.append("file", file);
    const res = await authFetch(`/documents/upload`, {
      method: "POST",
      body: form,
    });
    return handle(res);
  },

  async getStatus(docId: string): Promise<DocumentStatusResponse> {
    const res = await authFetch(`/documents/${docId}/status`);
    return handle(res);
  },

  async listDocuments(): Promise<DocumentSummary[]> {
    const res = await authFetch(`/documents`);
    return handle(res);
  },

  async chat(docId: string, question: string): Promise<ChatResponse> {
    const res = await authFetch(`/documents/${docId}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    });
    return handle(res);
  },

  async getChatHistory(docId: string): Promise<ChatHistoryMessage[]> {
    const res = await authFetch(`/documents/${docId}/chat/history`);
    return handle(res);
  },

  async generateSummary(docId: string): Promise<SummaryResponse> {
    const res = await authFetch(`/documents/${docId}/summary`, {
      method: "POST",
    });
    return handle(res);
  },

  async getSummary(docId: string): Promise<SummaryResponse> {
    const res = await authFetch(`/documents/${docId}/summary`);
    return handle(res);
  },

  /**
   * Export downloads need the token attached too, but since these are
   * opened via window.open() (not fetch), we can't add a header directly.
   * Instead we fetch the file as a blob here (with auth) and hand the
   * browser a local blob URL to open/download — same end result for the
   * user, just routed through an authenticated request first.
   */
  async downloadSummaryExport(docId: string, format: "markdown" | "clipboard" | "pdf" = "markdown"): Promise<void> {
    const res = await authFetch(`/documents/${docId}/summary/export?format=${format}`);
    if (!res.ok) {
      throw new Error(`Export failed (${res.status})`);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  },

  async getSummaryClipboardText(docId: string): Promise<string> {
    const res = await authFetch(`/documents/${docId}/summary/export?format=clipboard`);
    return res.text();
  },

  async scopedQuery(
    docId: string,
    payload: {
      selected_text: string;
      page_num: number;
      mode: AnnotationMode;
      custom_question?: string;
      rect_coords?: Record<string, number>;
    }
  ): Promise<AnnotationResponse> {
    const res = await authFetch(`/documents/${docId}/annotations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return handle(res);
  },

  /**
   * The document file itself is served as a raw stream for react-pdf to
   * consume directly via <Document file={url} /> — react-pdf can't attach
   * custom headers to its internal fetch, so instead we fetch it here
   * (with auth) and hand back a blob URL, same pattern as exports above.
   */
  async getFileUrl(docId: string): Promise<string> {
    const res = await authFetch(`/documents/${docId}/file`);
    if (!res.ok) {
      throw new Error(`Failed to load file (${res.status})`);
    }
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  },
};