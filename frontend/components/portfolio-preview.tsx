"use client";

import { AnimatePresence, motion } from "framer-motion";
import { BriefcaseBusiness, Download, Filter, GraduationCap, Mail, MoonStar, SunMedium } from "lucide-react";
import { useMemo, useState } from "react";

import type { PortfolioDocument, ThemeMode } from "../types/portfolio";

type Props = {
  portfolio: PortfolioDocument;
  theme: ThemeMode;
  onThemeToggle: () => void;
  onDownloadResume: () => void;
};

export function PortfolioPreview({ portfolio, theme, onThemeToggle, onDownloadResume }: Props) {
  const [activeFilter, setActiveFilter] = useState("All");
  const [expandedProject, setExpandedProject] = useState<string | null>(portfolio.projects[0]?.name ?? null);

  const categories = useMemo(
    () => ["All", ...Array.from(new Set(portfolio.projects.map((project) => project.category)))],
    [portfolio.projects],
  );

  const visibleProjects = portfolio.projects.filter(
    (project) => activeFilter === "All" || project.category === activeFilter,
  );

  return (
    <div className={`preview-shell ${theme}`}>
      <div className="preview-toolbar">
        <div>
          <p className="eyebrow">Portfolio Preview</p>
          <h2>{portfolio.template.replace("-", " ")}</h2>
        </div>
        <div className="toolbar-actions">
          <button className="ghost-button" onClick={onThemeToggle} type="button">
            {theme === "dark" ? <SunMedium size={16} /> : <MoonStar size={16} />}
            {theme === "dark" ? "Light mode" : "Dark mode"}
          </button>
          <button className="primary-button" onClick={onDownloadResume} type="button">
            <Download size={16} />
            Resume
          </button>
        </div>
      </div>

      <motion.section
        animate={{ opacity: 1, y: 0 }}
        className="preview-hero"
        initial={{ opacity: 0, y: 24 }}
        transition={{ duration: 0.35 }}
      >
        <span className="eyebrow">{portfolio.hero.availability}</span>
        <h1>{portfolio.hero.headline}</h1>
        <p>{portfolio.hero.subheadline}</p>
        <div className="hero-chip-row">
          {portfolio.skills.featured.map((skill) => (
            <span key={skill} className="hero-chip">
              {skill}
            </span>
          ))}
        </div>
      </motion.section>

      <section className="preview-section two-up">
        <div className="card">
          <p className="eyebrow">About</p>
          <h3>{portfolio.about.heading}</h3>
          <p>{portfolio.about.body}</p>
        </div>
        <div className="card">
          <p className="eyebrow">Contact</p>
          <h3>{portfolio.contact.callToAction}</h3>
          <div className="contact-stack">
            {portfolio.contact.email ? (
              <a href={`mailto:${portfolio.contact.email}`}>
                <Mail size={16} />
                {portfolio.contact.email}
              </a>
            ) : null}
            {portfolio.contact.linkedin ? <a href={portfolio.contact.linkedin}>LinkedIn</a> : null}
            {portfolio.contact.github ? <a href={portfolio.contact.github}>GitHub</a> : null}
            {portfolio.contact.website ? <a href={portfolio.contact.website}>Website</a> : null}
          </div>
        </div>
      </section>

      <section className="preview-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Skills</p>
            <h3>Capability map</h3>
          </div>
        </div>
        <div className="skills-grid">
          {Object.entries(portfolio.skills.grouped).map(([label, items]) => (
            <article key={label} className="card skill-card">
              <h4>{label}</h4>
              <p>{items.join(", ")}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="preview-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Experience</p>
            <h3>Timeline</h3>
          </div>
          <BriefcaseBusiness size={18} />
        </div>
        <div className="timeline-list">
          {portfolio.experience.map((item) => (
            <article key={`${item.company}-${item.role}`} className="timeline-item">
              <div className="timeline-marker" />
              <div className="timeline-content">
                <div className="timeline-head">
                  <div>
                    <h4>{item.role}</h4>
                    <p>{item.company}</p>
                  </div>
                  <span>{[item.startDate, item.endDate].filter(Boolean).join(" - ") || "Dates not listed"}</span>
                </div>
                <p>{item.summary}</p>
                <ul>
                  {item.highlights.map((highlight) => (
                    <li key={highlight}>{highlight}</li>
                  ))}
                </ul>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="preview-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Projects</p>
            <h3>Expandable case studies</h3>
          </div>
          <div className="filter-row">
            <Filter size={16} />
            {categories.map((category) => (
              <button
                key={category}
                className={`filter-button ${activeFilter === category ? "active" : ""}`}
                onClick={() => setActiveFilter(category)}
                type="button"
              >
                {category}
              </button>
            ))}
          </div>
        </div>
        <div className="project-list">
          {visibleProjects.map((project) => {
            const expanded = expandedProject === project.name;
            return (
              <article key={project.name} className="project-card">
                <button
                  className="project-header"
                  onClick={() => setExpandedProject(expanded ? null : project.name)}
                  type="button"
                >
                  <div>
                    <h4>{project.name}</h4>
                    <p>{project.category}</p>
                  </div>
                  <span>{expanded ? "Collapse" : "Expand"}</span>
                </button>
                <AnimatePresence initial={false}>
                  {expanded ? (
                    <motion.div
                      animate={{ height: "auto", opacity: 1 }}
                      className="project-details"
                      exit={{ height: 0, opacity: 0 }}
                      initial={{ height: 0, opacity: 0 }}
                    >
                      <p>{project.summary}</p>
                      <p>
                        <strong>Outcome:</strong> {project.outcome ?? project.impact ?? project.summary}
                      </p>
                      <div className="project-tags">
                        {project.technologies.map((item) => (
                          <span key={item}>{item}</span>
                        ))}
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </article>
            );
          })}
        </div>
      </section>

      <section className="preview-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Education</p>
            <h3>Credentials</h3>
          </div>
          <GraduationCap size={18} />
        </div>
        <div className="education-list">
          {portfolio.education.map((item) => (
            <article key={`${item.institution}-${item.degree}`} className="card">
              <h4>{item.degree}</h4>
              <p>{item.institution}</p>
              <span>{item.endDate ?? item.startDate ?? "Date not listed"}</span>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
