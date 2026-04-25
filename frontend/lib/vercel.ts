import "server-only";

import type { PortfolioDocument } from "../types/portfolio";

type DeployAsset = {
  file: string;
  data: string;
};

type VercelDeployment = {
  id: string;
  url: string | null;
  readyState?: string;
  alias?: string[];
  aliasFinal?: string | null;
  inspectorUrl?: string;
  errorMessage?: string;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderResumeText(portfolio: PortfolioDocument): string {
  const { sourceResume, resumeVariant } = portfolio;
  return [
    resumeVariant.headline,
    "",
    resumeVariant.profile,
    "",
    "CONTACT",
    [sourceResume.contact.email, sourceResume.contact.phone, sourceResume.contact.location].filter(Boolean).join(" | "),
    "",
    "EXPERIENCE",
    ...resumeVariant.experienceBullets,
    "",
    "PROJECTS",
    ...resumeVariant.projectBullets,
    "",
    "SKILLS",
    resumeVariant.skillsLine,
    "",
    "EDUCATION",
    resumeVariant.educationLine,
  ].join("\n");
}

function renderStaticHtml(portfolio: PortfolioDocument): string {
  const projectCards = portfolio.projects
    .map(
      (project, index) => `
        <article class="project-card" data-category="${escapeHtml(project.category)}">
          <button class="project-toggle" type="button" data-project-toggle="${index}">
            <span>
              <strong>${escapeHtml(project.name)}</strong>
              <small>${escapeHtml(project.category)}</small>
            </span>
            <span>Expand</span>
          </button>
          <div class="project-body" data-project-body="${index}">
            <p>${escapeHtml(project.summary)}</p>
            <p><strong>Outcome:</strong> ${escapeHtml(project.outcome ?? project.impact ?? project.summary)}</p>
            <p><strong>Stack:</strong> ${escapeHtml(project.technologies.join(", "))}</p>
            ${project.link ? `<a href="${escapeHtml(project.link)}" target="_blank" rel="noreferrer">Project link</a>` : ""}
          </div>
        </article>`,
    )
    .join("");

  const skillFilters = Array.from(new Set(portfolio.projects.map((project) => project.category)))
    .map((category) => `<button class="filter-chip" type="button" data-filter="${escapeHtml(category)}">${escapeHtml(category)}</button>`)
    .join("");

  const experiences = portfolio.experience
    .map(
      (item) => `
        <article class="timeline-card">
          <div class="timeline-dot"></div>
          <div>
            <p class="eyebrow">${escapeHtml(item.startDate ?? "")}${item.endDate ? ` - ${escapeHtml(item.endDate)}` : ""}</p>
            <h3>${escapeHtml(item.role)} <span>@ ${escapeHtml(item.company)}</span></h3>
            <p>${escapeHtml(item.summary)}</p>
            <ul>${item.highlights.map((highlight) => `<li>${escapeHtml(highlight)}</li>`).join("")}</ul>
          </div>
        </article>`,
    )
    .join("");

  const education = portfolio.education
    .map((item) => `<li><strong>${escapeHtml(item.degree)}</strong> | ${escapeHtml(item.institution)}</li>`)
    .join("");

  const contactLinks = [
    portfolio.contact.email ? `<a href="mailto:${escapeHtml(portfolio.contact.email)}">${escapeHtml(portfolio.contact.email)}</a>` : "",
    portfolio.contact.linkedin ? `<a href="${escapeHtml(portfolio.contact.linkedin)}" target="_blank" rel="noreferrer">LinkedIn</a>` : "",
    portfolio.contact.github ? `<a href="${escapeHtml(portfolio.contact.github)}" target="_blank" rel="noreferrer">GitHub</a>` : "",
    portfolio.contact.website ? `<a href="${escapeHtml(portfolio.contact.website)}" target="_blank" rel="noreferrer">Website</a>` : "",
  ]
    .filter(Boolean)
    .join("");

  return `<!DOCTYPE html>
<html lang="en" data-theme="${escapeHtml(portfolio.theme)}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(portfolio.sourceResume.name)} Portfolio</title>
    <meta name="description" content="${escapeHtml(portfolio.hero.subheadline)}" />
    <link rel="stylesheet" href="/styles.css" />
  </head>
  <body>
    <header class="site-header">
      <nav>
        <a href="#about">About</a>
        <a href="#experience">Experience</a>
        <a href="#projects">Projects</a>
        <a href="#contact">Contact</a>
      </nav>
      <button class="theme-toggle" id="theme-toggle" type="button">Toggle theme</button>
    </header>
    <main>
      <section class="hero">
        <p class="eyebrow">${escapeHtml(portfolio.hero.availability)}</p>
        <h1>${escapeHtml(portfolio.hero.headline)}</h1>
        <p class="hero-copy">${escapeHtml(portfolio.hero.subheadline)}</p>
        <div class="hero-actions">
          <a class="primary" href="/resume.txt" download>Download resume</a>
          <a class="secondary" href="#projects">Browse projects</a>
        </div>
      </section>
      <section id="about" class="panel">
        <p class="eyebrow">${escapeHtml(portfolio.about.heading)}</p>
        <h2>Profile</h2>
        <p>${escapeHtml(portfolio.about.body)}</p>
        <div class="skill-grid">
          ${Object.entries(portfolio.skills.grouped)
            .map(
              ([group, values]) => `
                <article class="skill-card">
                  <h3>${escapeHtml(group)}</h3>
                  <p>${escapeHtml(values.join(", "))}</p>
                </article>`,
            )
            .join("")}
        </div>
      </section>
      <section id="experience" class="panel">
        <p class="eyebrow">Experience</p>
        <h2>Work timeline</h2>
        <div class="timeline">${experiences}</div>
      </section>
      <section id="projects" class="panel">
        <div class="section-head">
          <div>
            <p class="eyebrow">Projects</p>
            <h2>Selected work</h2>
          </div>
          <div class="filters">
            <button class="filter-chip active" type="button" data-filter="All">All</button>
            ${skillFilters}
          </div>
        </div>
        <div class="project-grid">${projectCards}</div>
      </section>
      <section class="panel">
        <p class="eyebrow">Education</p>
        <h2>Academic background</h2>
        <ul class="education-list">${education}</ul>
      </section>
      <section id="contact" class="panel contact-panel">
        <div>
          <p class="eyebrow">Contact</p>
          <h2>${escapeHtml(portfolio.contact.callToAction)}</h2>
          <div class="contact-links">${contactLinks}</div>
        </div>
        <form class="contact-form">
          <input name="name" placeholder="Your name" required />
          <input name="email" type="email" placeholder="Your email" required />
          <textarea name="message" placeholder="Project scope" rows="5" required></textarea>
          <button class="primary" type="submit">Send message</button>
        </form>
      </section>
    </main>
    <script src="/script.js"></script>
  </body>
</html>`;
}

function renderStaticCss(): string {
  return `
:root {
  --bg: #f4efe6;
  --surface: rgba(255, 255, 255, 0.78);
  --surface-strong: #ffffff;
  --text: #1a1715;
  --muted: #6e655d;
  --line: rgba(34, 28, 23, 0.12);
  --accent: #d95d39;
  --accent-soft: #ffd7c9;
}

html[data-theme="dark"] {
  --bg: #111315;
  --surface: rgba(25, 28, 31, 0.86);
  --surface-strong: #181b1e;
  --text: #edf0f3;
  --muted: #a3adb8;
  --line: rgba(255, 255, 255, 0.09);
  --accent: #7ce0bf;
  --accent-soft: rgba(124, 224, 191, 0.18);
}

* { box-sizing: border-box; }
html { scroll-behavior: smooth; }
body {
  margin: 0;
  font-family: "Segoe UI", sans-serif;
  background:
    radial-gradient(circle at top left, rgba(217, 93, 57, 0.18), transparent 22rem),
    radial-gradient(circle at top right, rgba(124, 224, 191, 0.18), transparent 24rem),
    var(--bg);
  color: var(--text);
}
a { color: inherit; text-decoration: none; }
main { width: min(1120px, calc(100vw - 32px)); margin: 0 auto 48px; }
.site-header {
  width: min(1120px, calc(100vw - 32px));
  margin: 24px auto 0;
  padding: 14px 18px;
  border: 1px solid var(--line);
  background: var(--surface);
  backdrop-filter: blur(18px);
  border-radius: 999px;
  display: flex;
  justify-content: space-between;
  gap: 16px;
  position: sticky;
  top: 16px;
  z-index: 10;
}
nav, .hero-actions, .filters, .contact-links { display: flex; flex-wrap: wrap; gap: 12px; }
.theme-toggle, .filter-chip, .project-toggle, input, textarea, button {
  font: inherit;
}
.hero, .panel {
  border: 1px solid var(--line);
  background: var(--surface);
  backdrop-filter: blur(14px);
  border-radius: 28px;
}
.hero {
  margin-top: 24px;
  padding: 72px 32px;
}
.hero h1, .panel h2 { margin: 0; }
.hero h1 { font-size: clamp(2.8rem, 8vw, 6rem); line-height: 0.95; max-width: 10ch; }
.hero-copy { max-width: 55ch; color: var(--muted); font-size: 1.05rem; line-height: 1.7; }
.eyebrow { text-transform: uppercase; letter-spacing: 0.18em; font-size: 0.75rem; color: var(--muted); }
.primary, .secondary, .theme-toggle, .filter-chip, .project-toggle, .contact-form button {
  border-radius: 999px;
  border: 1px solid var(--line);
  padding: 0.9rem 1.1rem;
  background: var(--surface-strong);
  color: var(--text);
  cursor: pointer;
}
.primary { background: var(--accent); color: #fff; border-color: transparent; }
.secondary, .theme-toggle, .filter-chip.active { background: var(--accent-soft); }
.panel { margin-top: 20px; padding: 28px; }
.skill-grid, .project-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
}
.skill-card, .project-card, .timeline-card {
  border: 1px solid var(--line);
  border-radius: 20px;
  background: var(--surface-strong);
}
.skill-card { padding: 18px; }
.section-head {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: end;
  margin-bottom: 18px;
}
.project-toggle {
  width: 100%;
  display: flex;
  justify-content: space-between;
  text-align: left;
  background: transparent;
  border: 0;
}
.project-body { display: none; padding: 0 18px 18px; color: var(--muted); line-height: 1.7; }
.project-body.open { display: block; }
.timeline { display: grid; gap: 16px; }
.timeline-card { padding: 18px; display: grid; grid-template-columns: 20px 1fr; gap: 16px; }
.timeline-dot {
  width: 12px;
  height: 12px;
  margin-top: 6px;
  background: var(--accent);
  border-radius: 999px;
  box-shadow: 0 0 0 8px var(--accent-soft);
}
.education-list { margin: 16px 0 0; padding-left: 20px; color: var(--muted); }
.contact-panel {
  display: grid;
  grid-template-columns: 1.1fr 0.9fr;
  gap: 20px;
}
.contact-form { display: grid; gap: 12px; }
input, textarea {
  width: 100%;
  border: 1px solid var(--line);
  background: var(--surface-strong);
  color: var(--text);
  border-radius: 18px;
  padding: 0.95rem 1rem;
}
@media (max-width: 800px) {
  .site-header, .section-head, .contact-panel { display: block; }
  .site-header nav { margin-bottom: 12px; }
  .hero { padding: 48px 22px; }
}
`;
}

function renderStaticJs(): string {
  return `
const root = document.documentElement;
const storedTheme = localStorage.getItem("portfolio-theme");
if (storedTheme) root.dataset.theme = storedTheme;

document.getElementById("theme-toggle")?.addEventListener("click", () => {
  root.dataset.theme = root.dataset.theme === "dark" ? "light" : "dark";
  localStorage.setItem("portfolio-theme", root.dataset.theme);
});

document.querySelectorAll("[data-project-toggle]").forEach((button) => {
  button.addEventListener("click", () => {
    const key = button.getAttribute("data-project-toggle");
    const body = document.querySelector('[data-project-body="' + key + '"]');
    body?.classList.toggle("open");
  });
});

const filterButtons = document.querySelectorAll("[data-filter]");
filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const filter = button.getAttribute("data-filter");
    filterButtons.forEach((entry) => entry.classList.remove("active"));
    button.classList.add("active");
    document.querySelectorAll(".project-card").forEach((card) => {
      const category = card.getAttribute("data-category");
      card.style.display = !filter || filter === "All" || category === filter ? "block" : "none";
    });
  });
});
`;
}

function buildAssets(portfolio: PortfolioDocument): DeployAsset[] {
  return [
    { file: "index.html", data: renderStaticHtml(portfolio) },
    { file: "styles.css", data: renderStaticCss() },
    { file: "script.js", data: renderStaticJs() },
    { file: "resume.txt", data: renderResumeText(portfolio) },
  ];
}

function buildQueryString(): string {
  const params = new URLSearchParams();
  if (process.env.VERCEL_TEAM_ID) {
    params.set("teamId", process.env.VERCEL_TEAM_ID);
  }
  if (process.env.VERCEL_TEAM_SLUG) {
    params.set("slug", process.env.VERCEL_TEAM_SLUG);
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

async function vercelFetch<T>(path: string, init: RequestInit): Promise<T> {
  const token = process.env.VERCEL_ACCESS_TOKEN;
  if (!token) {
    throw new Error("Missing VERCEL_ACCESS_TOKEN.");
  }

  const response = await fetch(`https://api.vercel.com${path}${buildQueryString()}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json() as Promise<T>;
}

async function pollDeployment(deploymentId: string): Promise<VercelDeployment> {
  let attempts = 0;
  let current = await vercelFetch<VercelDeployment>(`/v13/deployments/${deploymentId}`, { method: "GET" });

  while (attempts < 20 && current.readyState && !["READY", "ERROR", "CANCELED"].includes(current.readyState)) {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    current = await vercelFetch<VercelDeployment>(`/v13/deployments/${deploymentId}`, { method: "GET" });
    attempts += 1;
  }

  return current;
}

export async function deployPortfolioToVercel(portfolio: PortfolioDocument, requestedName?: string) {
  const deploymentName =
    requestedName ||
    portfolio.sourceResume.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) ||
    "portfolio-site";

  const deployment = await vercelFetch<VercelDeployment>("/v13/deployments", {
    method: "POST",
    body: JSON.stringify({
      name: deploymentName,
      target: "production",
      project: process.env.VERCEL_PROJECT_NAME || deploymentName,
      files: buildAssets(portfolio),
      public: false,
      projectSettings: {
        framework: null,
      },
    }),
  });

  const ready = await pollDeployment(deployment.id);
  if (ready.readyState === "ERROR" || ready.readyState === "CANCELED") {
    throw new Error(ready.errorMessage || `Vercel deployment ended in state ${ready.readyState}.`);
  }

  const host = ready.aliasFinal || ready.alias?.[0] || ready.url;

  return {
    deploymentId: ready.id,
    url: host ? `https://${host}` : null,
    inspectorUrl: ready.inspectorUrl ?? null,
    readyState: ready.readyState ?? null,
  };
}
