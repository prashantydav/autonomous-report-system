"use client";

import { FormEvent, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { CloudUpload, Rocket, Sparkles, WandSparkles } from "lucide-react";

import { PortfolioPreview } from "./portfolio-preview";
import type { ParsedResume, PortfolioDocument, PortfolioTemplate, ThemeMode } from "../types/portfolio";

const templates: PortfolioTemplate[] = ["minimal", "ai-engineer", "freelancer", "modern"];

function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function PortfolioStudio() {
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [parsedResume, setParsedResume] = useState<ParsedResume | null>(null);
  const [portfolio, setPortfolio] = useState<PortfolioDocument | null>(null);
  const [template, setTemplate] = useState<PortfolioTemplate>("ai-engineer");
  const [theme, setTheme] = useState<ThemeMode>("dark");
  const [siteName, setSiteName] = useState("");
  const [loadingStep, setLoadingStep] = useState<string | null>(null);
  const [deployUrl, setDeployUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const stats = useMemo(
    () =>
      parsedResume
        ? [
            { label: "Skills", value: parsedResume.skills.length },
            { label: "Roles", value: parsedResume.experience.length },
            { label: "Projects", value: parsedResume.projects.length },
            { label: "Education", value: parsedResume.education.length },
          ]
        : [],
    [parsedResume],
  );

  async function handleParseResume(event: FormEvent) {
    event.preventDefault();
    if (!resumeFile) {
      setError("Select a PDF, DOCX, or TXT resume first.");
      return;
    }

    setLoadingStep("Parsing resume");
    setError(null);
    setDeployUrl(null);

    try {
      const formData = new FormData();
      formData.set("resume", resumeFile);
      const response = await fetch("/api/resume/parse", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Resume parsing failed.");
      }
      setParsedResume(data.parsedResume);
      setPortfolio(null);
    } catch (parseError) {
      setError(parseError instanceof Error ? parseError.message : "Resume parsing failed.");
    } finally {
      setLoadingStep(null);
    }
  }

  async function handleGeneratePortfolio() {
    if (!parsedResume) {
      setError("Parse a resume before generating the portfolio.");
      return;
    }

    setLoadingStep("Generating portfolio");
    setError(null);
    setDeployUrl(null);

    try {
      const response = await fetch("/api/portfolio/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resume: parsedResume,
          template,
          theme,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Portfolio generation failed.");
      }
      setPortfolio(data.portfolio);
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : "Portfolio generation failed.");
    } finally {
      setLoadingStep(null);
    }
  }

  async function handleDeploy() {
    if (!portfolio) {
      setError("Generate a portfolio before deploying.");
      return;
    }

    setLoadingStep("Deploying to Vercel");
    setError(null);

    try {
      const response = await fetch("/api/deploy/vercel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          portfolio,
          siteName: siteName || undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Vercel deployment failed.");
      }
      setDeployUrl(data.deploy.url);
    } catch (deployError) {
      setError(deployError instanceof Error ? deployError.message : "Vercel deployment failed.");
    } finally {
      setLoadingStep(null);
    }
  }

  function handleResumeDownload() {
    if (!portfolio) return;
    downloadTextFile(
      `${portfolio.sourceResume.name.replace(/\s+/g, "-").toLowerCase()}-resume.txt`,
      [
        portfolio.resumeVariant.headline,
        "",
        portfolio.resumeVariant.profile,
        "",
        "EXPERIENCE",
        ...portfolio.resumeVariant.experienceBullets,
        "",
        "PROJECTS",
        ...portfolio.resumeVariant.projectBullets,
        "",
        "SKILLS",
        portfolio.resumeVariant.skillsLine,
        "",
        "EDUCATION",
        portfolio.resumeVariant.educationLine,
      ].join("\n"),
    );
  }

  function handlePortfolioFieldChange(field: "headline" | "subheadline" | "about", value: string) {
    if (!portfolio) return;
    setPortfolio({
      ...portfolio,
      hero: {
        ...portfolio.hero,
        headline: field === "headline" ? value : portfolio.hero.headline,
        subheadline: field === "subheadline" ? value : portfolio.hero.subheadline,
      },
      about: {
        ...portfolio.about,
        body: field === "about" ? value : portfolio.about.body,
      },
    });
  }

  return (
    <main className="studio-shell">
      <section className="topbar">
        <div>
          <p className="eyebrow">AI Portfolio & Resume Generator</p>
          <h1>Resume in. Portfolio and deployable site out.</h1>
          <p className="lead">
            Upload a resume, extract structured data, generate portfolio-ready copy without hallucination, preview
            multiple templates, regenerate a resume variant, and deploy a static portfolio directly to Vercel.
          </p>
        </div>
        <div className="topbar-badges">
          <span>Next.js App Router</span>
          <span>AI rewrite with resume-only guardrails</span>
          <span>Vercel deploy endpoint</span>
        </div>
      </section>

      <section className="workspace-grid">
        <motion.div
          animate={{ opacity: 1, x: 0 }}
          className="control-column"
          initial={{ opacity: 0, x: -12 }}
          transition={{ duration: 0.25 }}
        >
          <form className="panel control-panel" onSubmit={handleParseResume}>
            <div className="section-heading">
              <div>
                <p className="eyebrow">Step 1</p>
                <h2>Upload resume</h2>
              </div>
              <CloudUpload size={18} />
            </div>
            <label className="upload-dropzone">
              <input
                accept=".pdf,.docx,.txt"
                onChange={(event) => setResumeFile(event.target.files?.[0] ?? null)}
                type="file"
              />
              <span>{resumeFile ? resumeFile.name : "Choose PDF, DOCX, or TXT"}</span>
              <small>Portfolio content is derived only from the parsed resume.</small>
            </label>
            <button className="primary-button" disabled={!resumeFile || !!loadingStep} type="submit">
              {loadingStep === "Parsing resume" ? "Parsing..." : "Parse Resume"}
            </button>
          </form>

          <div className="panel control-panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Step 2</p>
                <h2>Choose output</h2>
              </div>
              <Sparkles size={18} />
            </div>
            <div className="template-grid">
              {templates.map((item) => (
                <button
                  key={item}
                  className={`template-card ${template === item ? "active" : ""}`}
                  onClick={() => setTemplate(item)}
                  type="button"
                >
                  <strong>{item}</strong>
                  <span>
                    {item === "minimal" && "Editorial, clean, restrained"}
                    {item === "ai-engineer" && "Sharper technical emphasis"}
                    {item === "freelancer" && "Client-facing and conversion-focused"}
                    {item === "modern" && "Bold presentation with broad appeal"}
                  </span>
                </button>
              ))}
            </div>
            <button className="primary-button" disabled={!parsedResume || !!loadingStep} onClick={handleGeneratePortfolio} type="button">
              {loadingStep === "Generating portfolio" ? "Generating..." : "Generate Portfolio"}
            </button>
          </div>

          {parsedResume ? (
            <div className="panel control-panel">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Extracted Resume</p>
                  <h2>{parsedResume.name}</h2>
                </div>
              </div>
              <div className="stats-row">
                {stats.map((stat) => (
                  <article key={stat.label} className="stat-card">
                    <strong>{stat.value}</strong>
                    <span>{stat.label}</span>
                  </article>
                ))}
              </div>
              <p className="supporting-copy">{parsedResume.summary || "No summary section detected in the uploaded resume."}</p>
            </div>
          ) : null}

          {portfolio ? (
            <div className="panel control-panel">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Step 3</p>
                  <h2>Edit generated copy</h2>
                </div>
                <WandSparkles size={18} />
              </div>
              <label>
                Hero headline
                <input
                  onChange={(event) => handlePortfolioFieldChange("headline", event.target.value)}
                  value={portfolio.hero.headline}
                />
              </label>
              <label>
                Hero subheadline
                <textarea
                  onChange={(event) => handlePortfolioFieldChange("subheadline", event.target.value)}
                  rows={4}
                  value={portfolio.hero.subheadline}
                />
              </label>
              <label>
                About copy
                <textarea
                  onChange={(event) => handlePortfolioFieldChange("about", event.target.value)}
                  rows={5}
                  value={portfolio.about.body}
                />
              </label>
            </div>
          ) : null}

          <div className="panel control-panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Step 4</p>
                <h2>Deploy to Vercel</h2>
              </div>
              <Rocket size={18} />
            </div>
            <label>
              Optional site name
              <input onChange={(event) => setSiteName(event.target.value)} placeholder="john-doe-portfolio" value={siteName} />
            </label>
            <button className="primary-button" disabled={!portfolio || !!loadingStep} onClick={handleDeploy} type="button">
              {loadingStep === "Deploying to Vercel" ? "Deploying..." : "Deploy Portfolio"}
            </button>
            {deployUrl ? (
              <a className="deploy-link" href={deployUrl} rel="noreferrer" target="_blank">
                Live URL: {deployUrl}
              </a>
            ) : null}
          </div>

          {error ? <div className="error-banner">{error}</div> : null}
        </motion.div>

        <section className="preview-column">
          {portfolio ? (
            <PortfolioPreview
              onDownloadResume={handleResumeDownload}
              onThemeToggle={() => {
                const nextTheme = theme === "dark" ? "light" : "dark";
                setTheme(nextTheme);
                setPortfolio({ ...portfolio, theme: nextTheme });
              }}
              portfolio={portfolio}
              theme={theme}
            />
          ) : (
            <div className="panel empty-preview">
              <p className="eyebrow">Preview</p>
              <h2>Generate a portfolio to preview the site.</h2>
              <p>
                The generated view includes an animated hero, skill filters, expandable project cards, a timeline
                experience layout, theme toggle, smooth-scroll sections, a contact form, and a resume download action.
              </p>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
