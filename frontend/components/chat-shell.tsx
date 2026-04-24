"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type Session = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  message_count: number;
  last_message_preview: string | null;
};

type Message = {
  id: string;
  session_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
  job_id?: string | null;
  report_title?: string | null;
  report_markdown_path?: string | null;
  report_html_path?: string | null;
  report_pdf_path?: string | null;
};

type Job = {
  id: string;
  session_id: string;
  topic: string;
  status: "queued" | "running" | "completed" | "failed";
  created_at: string;
  updated_at: string;
  error?: string | null;
  assistant_message_id?: string | null;
};

type SessionDetail = {
  session: Session;
  messages: Message[];
  jobs: Job[];
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return response.json();
}

function formatTimestamp(value: string): string {
  return new Date(value).toLocaleString();
}

export function ChatShell() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollingJobId = useRef<string | null>(null);

  const activeJob = useMemo(
    () => detail?.jobs.find((job) => job.id === pollingJobId.current) ?? null,
    [detail],
  );

  useEffect(() => {
    void loadSessions();
  }, []);

  useEffect(() => {
    if (activeSessionId) {
      void loadSession(activeSessionId);
    }
  }, [activeSessionId]);

  useEffect(() => {
    if (!pollingJobId.current || !activeSessionId) {
      return;
    }
    const interval = setInterval(async () => {
      try {
        const job = await api<Job>(`/jobs/${pollingJobId.current}`);
        if (job.status === "completed" || job.status === "failed") {
          pollingJobId.current = null;
          await loadSession(activeSessionId);
          await loadSessions();
          setSending(false);
        } else {
          await loadSession(activeSessionId);
        }
      } catch (pollError) {
        setError(pollError instanceof Error ? pollError.message : "Polling failed");
        pollingJobId.current = null;
        setSending(false);
      }
    }, 2500);
    return () => clearInterval(interval);
  }, [activeSessionId]);

  async function loadSessions() {
    try {
      const data = await api<Session[]>("/sessions");
      setSessions(data);
      if (!activeSessionId && data.length > 0) {
        setActiveSessionId(data[0].id);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load sessions");
    }
  }

  async function loadSession(sessionId: string) {
    try {
      const data = await api<SessionDetail>(`/sessions/${sessionId}`);
      setDetail(data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load session");
    }
  }

  async function handleCreateSession() {
    try {
      const session = await api<Session>("/sessions", {
        method: "POST",
        body: JSON.stringify({ title: "New Research" }),
      });
      setSessions((current) => [session, ...current]);
      setActiveSessionId(session.id);
      setDetail({ session, messages: [], jobs: [] });
      setError(null);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Failed to create session");
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!input.trim() || !activeSessionId || sending) {
      return;
    }

    const content = input.trim();
    setInput("");
    setSending(true);
    setError(null);

    try {
      const job = await api<Job>(`/sessions/${activeSessionId}/messages`, {
        method: "POST",
        body: JSON.stringify({ content }),
      });
      pollingJobId.current = job.id;
      await loadSession(activeSessionId);
      await loadSessions();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to send message");
      setSending(false);
    }
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <button className="primary-button" onClick={handleCreateSession} type="button">
          New Session
        </button>
        <div className="session-list">
          {sessions.map((session) => (
            <button
              key={session.id}
              className={`session-item ${session.id === activeSessionId ? "active" : ""}`}
              onClick={() => setActiveSessionId(session.id)}
              type="button"
            >
              <span className="session-title">{session.title}</span>
              <span className="session-preview">
                {session.last_message_preview ?? "No messages yet"}
              </span>
            </button>
          ))}
        </div>
      </aside>

      <section className="chat-panel">
        <header className="chat-header">
          <div>
            <h1>{detail?.session.title ?? "Autonomous Research"}</h1>
            <p>{detail ? `${detail.messages.length} messages` : "Create a session to begin"}</p>
          </div>
          {activeJob && activeJob.status !== "completed" && activeJob.status !== "failed" ? (
            <div className="status-pill">{activeJob.status}</div>
          ) : null}
        </header>

        <div className="messages">
          {(detail?.messages ?? []).map((message) => (
            <article key={message.id} className={`message ${message.role}`}>
              <div className="message-role">{message.role === "user" ? "You" : "Research System"}</div>
              <pre className="message-content">{message.content}</pre>
              <div className="message-meta">{formatTimestamp(message.created_at)}</div>
              {message.role === "assistant" && (message.report_html_path || message.report_pdf_path) ? (
                <div className="artifact-list">
                  {message.report_markdown_path ? (
                    <a href={`${API_BASE_URL}/messages/${message.id}/artifacts/markdown`} target="_blank">
                      Markdown
                    </a>
                  ) : null}
                  {message.report_html_path ? (
                    <a href={`${API_BASE_URL}/messages/${message.id}/artifacts/html`} target="_blank">
                      HTML
                    </a>
                  ) : null}
                  {message.report_pdf_path ? (
                    <a href={`${API_BASE_URL}/messages/${message.id}/artifacts/pdf`} target="_blank">
                      PDF
                    </a>
                  ) : null}
                </div>
              ) : null}
            </article>
          ))}
          {!detail?.messages.length ? (
            <div className="empty-state">
              Ask for a research report. The backend will queue a multi-agent job and attach the generated artifacts.
            </div>
          ) : null}
        </div>

        {error ? <div className="error-banner">{error}</div> : null}

        <form className="composer" onSubmit={handleSubmit}>
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Research a topic, compare a market, evaluate a technology, or produce an executive report."
            rows={4}
          />
          <button className="primary-button" disabled={!activeSessionId || sending || !input.trim()} type="submit">
            {sending ? "Running..." : "Send"}
          </button>
        </form>
      </section>
    </main>
  );
}
