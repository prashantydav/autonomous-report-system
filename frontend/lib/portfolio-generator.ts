import "server-only";

import OpenAI from "openai";
import { z } from "zod";

import type {
  ContactInfo,
  ParsedResume,
  PortfolioDocument,
  PortfolioTemplate,
  ResumeVariant,
  ThemeMode,
} from "../types/portfolio";

const groupedSkillBuckets = [
  { label: "Languages", match: /(javascript|typescript|python|java|c\+\+|go|sql|rust)/i },
  { label: "Frameworks", match: /(react|next|node|django|flask|fastapi|express|spring|tailwind)/i },
  { label: "AI / Data", match: /(openai|llm|rag|pytorch|tensorflow|langchain|embedding|vector|ml|ai)/i },
  { label: "Cloud / DevOps", match: /(aws|gcp|azure|docker|kubernetes|netlify|vercel|ci\/cd|github actions)/i },
];

const portfolioSchema = z.object({
  hero: z.object({
    headline: z.string(),
    subheadline: z.string(),
    ctaLabel: z.string(),
    availability: z.string(),
  }),
  about: z.object({
    heading: z.string(),
    body: z.string(),
  }),
  experience: z.array(
    z.object({
      company: z.string(),
      role: z.string(),
      location: z.string().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      summary: z.string(),
      achievements: z.array(z.string()),
      technologies: z.array(z.string()),
      highlights: z.array(z.string()),
    }),
  ),
  projects: z.array(
    z.object({
      name: z.string(),
      summary: z.string(),
      impact: z.string().optional(),
      technologies: z.array(z.string()),
      link: z.string().optional(),
      challenge: z.string().optional(),
      outcome: z.string().optional(),
      category: z.string(),
    }),
  ),
  contact: z.object({
    email: z.string().optional(),
    phone: z.string().optional(),
    location: z.string().optional(),
    website: z.string().optional(),
    linkedin: z.string().optional(),
    github: z.string().optional(),
    callToAction: z.string(),
  }),
  resumeVariant: z.object({
    headline: z.string(),
    profile: z.string(),
    experienceBullets: z.array(z.string()),
    projectBullets: z.array(z.string()),
    skillsLine: z.string(),
    educationLine: z.string(),
  }),
});

function toSentenceCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function groupSkills(skills: string[]): Record<string, string[]> {
  const groups = Object.fromEntries(groupedSkillBuckets.map((bucket) => [bucket.label, [] as string[]]));
  const uncategorized: string[] = [];

  for (const skill of skills) {
    const bucket = groupedSkillBuckets.find((entry) => entry.match.test(skill));
    if (bucket) {
      groups[bucket.label].push(skill);
    } else {
      uncategorized.push(skill);
    }
  }

  if (uncategorized.length) {
    groups["Tooling"] = uncategorized;
  }

  return Object.fromEntries(
    Object.entries(groups).filter(([, values]) => values.length).map(([label, values]) => [label, Array.from(new Set(values))]),
  );
}

function categoryForProject(projectName: string, technologies: string[]): string {
  const haystack = `${projectName} ${technologies.join(" ")}`.toLowerCase();
  if (/(ai|ml|llm|rag|nlp)/.test(haystack)) return "AI";
  if (/(react|next|frontend|ui|tailwind)/.test(haystack)) return "Frontend";
  if (/(api|backend|node|fastapi|django|sql)/.test(haystack)) return "Backend";
  return "Product";
}

function buildResumeVariant(resume: ParsedResume): ResumeVariant {
  return {
    headline: `${resume.name} | ${resume.title ?? "Professional Portfolio"}`,
    profile: resume.summary || `${resume.name} builds reliable software grounded in the experience captured in this resume.`,
    experienceBullets: resume.experience.flatMap((item) =>
      item.achievements.slice(0, 2).map((achievement) => `${item.role} at ${item.company}: ${achievement}`),
    ),
    projectBullets: resume.projects.slice(0, 4).map((project) => `${project.name}: ${project.summary}`),
    skillsLine: resume.skills.join(" | "),
    educationLine: resume.education.map((item) => `${item.degree} - ${item.institution}`).join(" | "),
  };
}

function buildFallbackPortfolio(
  resume: ParsedResume,
  template: PortfolioTemplate,
  theme: ThemeMode,
): PortfolioDocument {
  const featuredSkills = resume.skills.slice(0, 8);
  const grouped = groupSkills(resume.skills);
  const contact: ContactInfo & { callToAction: string } = {
    ...resume.contact,
    callToAction: `Interested in discussing ${resume.title ?? "this work"}? Reach out using the contact details from the resume.`,
  };

  return {
    template,
    theme,
    hero: {
      headline: `${resume.name}${resume.title ? `, ${resume.title}` : ""}`,
      subheadline:
        resume.summary ||
        `${resume.name} brings together experience across ${featuredSkills.slice(0, 3).join(", ")}.`,
      ctaLabel: "View Resume",
      availability: "Open to conversations aligned with the experience listed here.",
    },
    about: {
      heading: "About",
      body:
        resume.summary ||
        `${resume.name} has built a track record across ${resume.experience.length} roles and ${resume.projects.length} documented projects.`,
    },
    skills: {
      featured: featuredSkills,
      grouped,
    },
    experience: resume.experience.map((item) => ({
      ...item,
      highlights: item.achievements.slice(0, 3).map(toSentenceCase),
    })),
    projects: resume.projects.map((project) => ({
      ...project,
      challenge: project.summary,
      outcome: project.impact ?? project.summary,
      category: categoryForProject(project.name, project.technologies),
    })),
    education: resume.education,
    contact,
    resumeVariant: buildResumeVariant(resume),
    sourceResume: resume,
  };
}

async function buildWithOpenAI(
  resume: ParsedResume,
  template: PortfolioTemplate,
  theme: ThemeMode,
): Promise<PortfolioDocument> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return buildFallbackPortfolio(resume, template, theme);
  }

  const client = new OpenAI({ apiKey });
  const completion = await client.responses.create({
    model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
    input: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text:
              "Transform the resume into concise portfolio-ready copy without adding facts. Use only explicit resume content or direct paraphrases. Preserve omissions if the resume lacks data.",
          },
        ],
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: JSON.stringify({ template, theme, resume }),
          },
        ],
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "portfolio_document",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            hero: {
              type: "object",
              additionalProperties: false,
              properties: {
                headline: { type: "string" },
                subheadline: { type: "string" },
                ctaLabel: { type: "string" },
                availability: { type: "string" },
              },
              required: ["headline", "subheadline", "ctaLabel", "availability"],
            },
            about: {
              type: "object",
              additionalProperties: false,
              properties: {
                heading: { type: "string" },
                body: { type: "string" },
              },
              required: ["heading", "body"],
            },
            experience: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  company: { type: "string" },
                  role: { type: "string" },
                  location: { type: "string" },
                  startDate: { type: "string" },
                  endDate: { type: "string" },
                  summary: { type: "string" },
                  achievements: { type: "array", items: { type: "string" } },
                  technologies: { type: "array", items: { type: "string" } },
                  highlights: { type: "array", items: { type: "string" } },
                },
                required: ["company", "role", "summary", "achievements", "technologies", "highlights"],
              },
            },
            projects: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  name: { type: "string" },
                  summary: { type: "string" },
                  impact: { type: "string" },
                  technologies: { type: "array", items: { type: "string" } },
                  link: { type: "string" },
                  challenge: { type: "string" },
                  outcome: { type: "string" },
                  category: { type: "string" },
                },
                required: ["name", "summary", "technologies", "category"],
              },
            },
            contact: {
              type: "object",
              additionalProperties: false,
              properties: {
                email: { type: "string" },
                phone: { type: "string" },
                location: { type: "string" },
                website: { type: "string" },
                linkedin: { type: "string" },
                github: { type: "string" },
                callToAction: { type: "string" },
              },
              required: ["callToAction"],
            },
            resumeVariant: {
              type: "object",
              additionalProperties: false,
              properties: {
                headline: { type: "string" },
                profile: { type: "string" },
                experienceBullets: { type: "array", items: { type: "string" } },
                projectBullets: { type: "array", items: { type: "string" } },
                skillsLine: { type: "string" },
                educationLine: { type: "string" },
              },
              required: [
                "headline",
                "profile",
                "experienceBullets",
                "projectBullets",
                "skillsLine",
                "educationLine",
              ],
            },
          },
          required: ["hero", "about", "experience", "projects", "contact", "resumeVariant"],
        },
      },
    },
  });

  const content = completion.output_text;
  const parsed = portfolioSchema.parse(JSON.parse(content));
  const fallback = buildFallbackPortfolio(resume, template, theme);

  return {
    ...fallback,
    hero: parsed.hero,
    about: parsed.about,
    experience: parsed.experience,
    projects: parsed.projects,
    contact: parsed.contact,
    resumeVariant: parsed.resumeVariant,
  };
}

export async function generatePortfolioDocument(
  resume: ParsedResume,
  template: PortfolioTemplate,
  theme: ThemeMode,
): Promise<PortfolioDocument> {
  return buildWithOpenAI(resume, template, theme);
}
