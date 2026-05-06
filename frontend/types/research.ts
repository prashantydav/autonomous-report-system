export type SessionRecord = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  message_count: number;
  last_message_preview?: string | null;
};

export type MessageRecord = {
  id: string;
  session_id: string;
  role: "user" | "assistant" | string;
  content: string;
  created_at: string;
  job_id?: string | null;
  report_title?: string | null;
  report_markdown_path?: string | null;
  report_html_path?: string | null;
  report_pdf_path?: string | null;
};

export type JobRecord = {
  id: string;
  session_id: string;
  topic: string;
  status: "queued" | "pending" | "running" | "completed" | "failed" | string;
  created_at: string;
  updated_at: string;
  error?: string | null;
  assistant_message_id?: string | null;
  report_json?: {
    title?: string;
    topic?: string;
    executive_summary?: string;
    metadata?: {
      source_count?: number;
      search_queries?: string[];
      crewai_agent_roles?: string[];
      critic_approved?: boolean;
    };
  } | null;
};

export type SessionDetailResponse = {
  session: SessionRecord;
  messages: MessageRecord[];
  jobs: JobRecord[];
};
