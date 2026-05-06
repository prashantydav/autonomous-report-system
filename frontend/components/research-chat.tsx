"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  CheckCircle2,
  CircleDashed,
  Download,
  FileText,
  Menu,
  PanelLeftClose,
  Plus,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  User,
  XCircle,
} from "lucide-react";

import type { JobRecord, MessageRecord, SessionDetailResponse, SessionRecord } from "../types/research";

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");

const agentStages = [
  {
    name: "Researcher",
    description: "Plans diverse searches and gathers source evidence.",
  },
  {
    name: "Analyst",
    description: "Synthesizes patterns, contradictions, and supported claims.",
  },
  {
    name: "Critic",
    description: "Checks weak evidence and requests more research when needed.",
  },
  {
    name: "Writer",
    description: "Drafts the professional report with inline citations.",
  },
  {
    name: "Editor",
    description: "Refines structure, clarity, and executive tone.",
  },
];

const promptExamples = [
  "Market outlook for AI agents in enterprise software over the next 24 months",
  "Competitive research report on vertical AI tools for real estate brokerages",
  "Risks and opportunities for autonomous report generation platforms",
];

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail ?? data.error ?? `Request failed with status ${response.status}`);
  }
  return data as T;
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function artifactUrl(messageId: string, kind: "markdown" | "html" | "pdf"): string {
  return `${API_BASE_URL}/messages/${messageId}/artifacts/${kind}`;
}

function summarizeMarkdown(markdown: string): string {
  const cleaned = markdown
    .replace(/^#\s+/gm, "")
    .replace(/^##\s+/gm, "")
    .replace(/\[[0-9]+\]/g, "")
    .trim();
  return cleaned.length > 900 ? `${cleaned.slice(0, 900).trim()}...` : cleaned;
}

function newestJob(jobs: JobRecord[]): JobRecord | null {
  return [...jobs].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())[0] ?? null;
}

type AgentStatus = "idle" | "active" | "complete" | "error";

function stageStatus(job: JobRecord | null, index: number): AgentStatus {
  if (!job) return "idle";
  if (job.status === "failed") return index === 0 ? "error" : "idle";
  if (job.status === "completed") return "complete";
  if (job.status === "running") return index === 0 ? "active" : "idle";
  return index === 0 ? "active" : "idle";
}

function AgentIcon({ status }: { status: AgentStatus }) {
  if (status === "complete") return <CheckCircle2 size={16} />;
  if (status === "error") return <XCircle size={16} />;
  return <CircleDashed size={16} />;
}

export function ResearchChat() {
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [activeSession, setActiveSession] = useState<SessionRecord | null>(null);
  const [messages, setMessages] = useState<MessageRecord[]>([]);
  const [jobs, setJobs] = useState<JobRecord[]>([]);
  const [input, setInput] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingSession, setIsLoadingSession] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const currentJob = useMemo(() => newestJob(jobs), [jobs]);
  const isWorking = currentJob?.status === "queued" || currentJob?.status === "pending" || currentJob?.status === "running";
  const completedReport = useMemo(
    () => [...messages].reverse().find((message) => message.role === "assistant" && Boolean(message.report_title)),
    [messages],
  );

  async function loadSessions() {
    const data = await requestJson<SessionRecord[]>("/sessions");
    setSessions(data);
    return data;
  }

  async function loadSession(sessionId: string) {
    setIsLoadingSession(true);
    setError(null);
    try {
      const data = await requestJson<SessionDetailResponse>(`/sessions/${sessionId}`);
      setActiveSession(data.session);
      setMessages(data.messages);
      setJobs(data.jobs);
    } catch (sessionError) {
      setError(sessionError instanceof Error ? sessionError.message : "Could not load the session.");
    } finally {
      setIsLoadingSession(false);
    }
  }

  async function createSession(title = "New Research") {
    const session = await requestJson<SessionRecord>("/sessions", {
      method: "POST",
      body: JSON.stringify({ title }),
    });
    setActiveSession(session);
    setMessages([]);
    setJobs([]);
    setSessions((current) => [session, ...current.filter((item) => item.id !== session.id)]);
    return session;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const topic = input.trim();
    if (!topic || isSubmitting || isWorking) return;

    setIsSubmitting(true);
    setError(null);
    setInput("");

    try {
      const session = activeSession ?? (await createSession(topic.slice(0, 80)));
      const optimisticMessage: MessageRecord = {
        id: `local-${Date.now()}`,
        session_id: session.id,
        role: "user",
        content: topic,
        created_at: new Date().toISOString(),
      };
      setMessages((current) => [...current, optimisticMessage]);

      const job = await requestJson<JobRecord>(`/sessions/${session.id}/messages`, {
        method: "POST",
        body: JSON.stringify({ content: topic }),
      });
      setJobs((current) => [job, ...current.filter((item) => item.id !== job.id)]);
      await loadSessions();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not start the research job.");
      setInput(topic);
    } finally {
      setIsSubmitting(false);
    }
  }

  useEffect(() => {
    loadSessions()
      .then((data) => {
        if (data[0]) {
          return loadSession(data[0].id);
        }
        return null;
      })
      .catch((loadError) => {
        setError(loadError instanceof Error ? loadError.message : "Could not connect to the research API.");
      });
  }, []);

  useEffect(() => {
    if (!currentJob || !activeSession || !isWorking) return;

    const interval = window.setInterval(async () => {
      try {
        const job = await requestJson<JobRecord>(`/jobs/${currentJob.id}`);
        setJobs((current) => [job, ...current.filter((item) => item.id !== job.id)]);
        if (job.status === "completed" || job.status === "failed") {
          await loadSession(activeSession.id);
          await loadSessions();
        }
      } catch (pollError) {
        setError(pollError instanceof Error ? pollError.message : "Could not poll job status.");
      }
    }, 2500);

    return () => window.clearInterval(interval);
  }, [activeSession, currentJob, isWorking]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, isWorking]);

  const metadata = currentJob?.report_json?.metadata;

  return (
    <main className="chat-app">
      <aside className={`chat-sidebar ${sidebarOpen ? "open" : "closed"}`}>
        <div className="sidebar-header">
          <button className="icon-button" onClick={() => setSidebarOpen((value) => !value)} title="Toggle sidebar" type="button">
            {sidebarOpen ? <PanelLeftClose size={18} /> : <Menu size={18} />}
          </button>
          {sidebarOpen ? <strong>Research</strong> : null}
        </div>

        {sidebarOpen ? (
          <>
            <button className="new-chat-button" onClick={() => createSession().catch((err) => setError(err.message))} type="button">
              <Plus size={16} />
              New chat
            </button>
            <div className="session-list">
              {sessions.map((session) => (
                <button
                  key={session.id}
                  className={`session-item ${activeSession?.id === session.id ? "active" : ""}`}
                  onClick={() => loadSession(session.id)}
                  type="button"
                >
                  <span>{session.title}</span>
                  <small>{session.last_message_preview ?? "No messages yet"}</small>
                </button>
              ))}
            </div>
          </>
        ) : null}
      </aside>

      <section className="chat-main">
        <header className="chat-header">
          <div>
            <p className="eyebrow">Autonomous report system</p>
            <h1>{activeSession?.title ?? "Ask the research agents"}</h1>
          </div>
          <div className={`status-pill ${isWorking ? "working" : "ready"}`}>
            <Sparkles size={15} />
            {isWorking ? "Agents running" : "Ready"}
          </div>
        </header>

        <div className="chat-layout">
          <div className="conversation-panel">
            <div className="messages" ref={scrollRef}>
              {!messages.length && !isLoadingSession ? (
                <section className="empty-state">
                  <div className="empty-icon">
                    <Search size={24} />
                  </div>
                  <h2>What should the agents research?</h2>
                  <p>
                    Send a topic and the system will research sources, analyze evidence, critique the claims, write the
                    report, and return downloadable artifacts.
                  </p>
                  <div className="example-grid">
                    {promptExamples.map((example) => (
                      <button key={example} onClick={() => setInput(example)} type="button">
                        {example}
                      </button>
                    ))}
                  </div>
                </section>
              ) : null}

              {messages.map((message) => (
                <article key={message.id} className={`message-row ${message.role === "user" ? "user" : "assistant"}`}>
                  <div className="avatar">{message.role === "user" ? <User size={18} /> : <Bot size={18} />}</div>
                  <div className="message-bubble">
                    <div className="message-meta">
                      <strong>{message.role === "user" ? "You" : "Research agents"}</strong>
                      <span>{formatTime(message.created_at)}</span>
                    </div>
                    {message.report_title ? <h2>{message.report_title}</h2> : null}
                    <p>{message.role === "assistant" ? summarizeMarkdown(message.content) : message.content}</p>
                    {message.report_title ? (
                      <div className="artifact-row">
                        <a href={artifactUrl(message.id, "markdown")} rel="noreferrer" target="_blank">
                          <FileText size={15} />
                          Markdown
                        </a>
                        <a href={artifactUrl(message.id, "html")} rel="noreferrer" target="_blank">
                          <FileText size={15} />
                          HTML
                        </a>
                        {message.report_pdf_path ? (
                          <a href={artifactUrl(message.id, "pdf")} rel="noreferrer" target="_blank">
                            <Download size={15} />
                            PDF
                          </a>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </article>
              ))}

              {isWorking ? (
                <article className="message-row assistant">
                  <div className="avatar">
                    <Bot size={18} />
                  </div>
                  <div className="message-bubble thinking">
                    <div className="message-meta">
                      <strong>Research agents</strong>
                      <span>{currentJob?.status}</span>
                    </div>
                    <p>Working on: {currentJob?.topic}</p>
                    <div className="typing-dots" aria-label="Agents are working">
                      <span />
                      <span />
                      <span />
                    </div>
                  </div>
                </article>
              ) : null}

              {error ? <div className="error-banner">{error}</div> : null}
            </div>

            <form className="composer" onSubmit={handleSubmit}>
              <textarea
                disabled={isSubmitting || isWorking}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
                placeholder={isWorking ? "Wait for the current report to finish..." : "Message the research agents"}
                rows={1}
                value={input}
              />
              <button className="send-button" disabled={!input.trim() || isSubmitting || isWorking} title="Send" type="submit">
                <Send size={18} />
              </button>
            </form>
          </div>

          <aside className="agent-panel">
            <div className="agent-panel-header">
              <div>
                <p className="eyebrow">Agent run</p>
                <h2>{currentJob?.status ?? "Idle"}</h2>
              </div>
              <ShieldCheck size={19} />
            </div>

            <div className="agent-list">
              {agentStages.map((stage, index) => {
                const status = stageStatus(currentJob, index);
                return (
                  <article key={stage.name} className={`agent-card ${status}`}>
                    <div className="agent-status">
                      <AgentIcon status={status} />
                    </div>
                    <div>
                      <strong>{stage.name}</strong>
                      <p>{stage.description}</p>
                    </div>
                  </article>
                );
              })}
            </div>

            <div className="run-facts">
              <div>
                <span>Sources</span>
                <strong>{metadata?.source_count ?? "-"}</strong>
              </div>
              <div>
                <span>Critic</span>
                <strong>{metadata?.critic_approved === undefined ? "-" : metadata.critic_approved ? "Approved" : "Flagged"}</strong>
              </div>
              <div>
                <span>Artifacts</span>
                <strong>{completedReport ? "Ready" : "-"}</strong>
              </div>
            </div>

            {metadata?.search_queries?.length ? (
              <div className="query-list">
                <p className="eyebrow">Search plan</p>
                {metadata.search_queries.slice(0, 5).map((query) => (
                  <span key={query}>{query}</span>
                ))}
              </div>
            ) : null}
          </aside>
        </div>
      </section>
    </main>
  );
}
