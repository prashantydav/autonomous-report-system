import "server-only";

import mammoth from "mammoth";
import pdfParse from "pdf-parse";

import type {
  ContactInfo,
  EducationItem,
  ExperienceItem,
  ParsedResume,
  ResumeFileType,
  ResumeProject,
} from "../types/portfolio";

const SECTION_ALIASES: Record<string, string[]> = {
  summary: ["summary", "profile", "professional summary", "about"],
  skills: ["skills", "technical skills", "core competencies", "technologies"],
  experience: ["experience", "work experience", "employment", "professional experience"],
  projects: ["projects", "selected projects", "project experience"],
  education: ["education", "academic background", "qualifications"],
};

function normalizeWhitespace(input: string): string {
  return input.replace(/\r/g, "").replace(/\t/g, " ").replace(/\u2022/g, "-").replace(/[ ]{2,}/g, " ").trim();
}

function splitLines(input: string): string[] {
  return normalizeWhitespace(input)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function getSectionBlocks(rawText: string): Record<string, string[]> {
  const lines = rawText.replace(/\r/g, "").split("\n");
  const blocks: Record<string, string[]> = {};
  let currentSection = "header";
  blocks[currentSection] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }

    const foundSection = Object.entries(SECTION_ALIASES).find(([, aliases]) =>
      aliases.some((alias) => line.toLowerCase() === alias),
    )?.[0];

    if (foundSection) {
      currentSection = foundSection;
      blocks[currentSection] = blocks[currentSection] ?? [];
      continue;
    }

    blocks[currentSection] = blocks[currentSection] ?? [];
    blocks[currentSection].push(line);
  }

  return blocks;
}

function extractContact(lines: string[]): ContactInfo {
  const joined = lines.join(" | ");
  const email = joined.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];
  const phone = joined.match(/(?:\+\d{1,3}\s*)?(?:\(?\d{3}\)?[\s.-]*)?\d{3}[\s.-]*\d{4}/)?.[0];
  const website = joined.match(/https?:\/\/[^\s|]+|www\.[^\s|]+/i)?.[0];
  const linkedin = joined.match(/linkedin\.com\/[^\s|]+/i)?.[0];
  const github = joined.match(/github\.com\/[^\s|]+/i)?.[0];

  const locationLine =
    lines.find(
      (line) =>
        !line.includes("@") &&
        !/linkedin|github|https?:\/\//i.test(line) &&
        /[A-Za-z]/.test(line) &&
        (line.includes(",") || /\bremote\b/i.test(line)),
    ) ?? undefined;

  return {
    email,
    phone,
    location: locationLine,
    website,
    linkedin: linkedin ? `https://${linkedin.replace(/^https?:\/\//, "")}` : undefined,
    github: github ? `https://${github.replace(/^https?:\/\//, "")}` : undefined,
  };
}

function extractName(lines: string[]): string {
  return lines[0] ?? "Candidate";
}

function extractTitle(lines: string[]): string | undefined {
  return lines.find((line, index) => index > 0 && line.length < 90 && !line.includes("@"));
}

function extractSummary(blocks: Record<string, string[]>): string {
  return (blocks.summary ?? []).join(" ").trim();
}

function parseSkills(lines: string[]): string[] {
  return Array.from(
    new Set(
      lines
        .flatMap((line) => line.split(/[,|]/))
        .map((item) => item.replace(/^[-*]\s*/, "").trim())
        .filter(Boolean),
    ),
  );
}

function parseExperience(lines: string[]): ExperienceItem[] {
  const items: ExperienceItem[] = [];
  let current: ExperienceItem | null = null;

  for (const line of lines) {
    const bullet = line.startsWith("-") || line.startsWith("*");
    if (!bullet && (line.includes("|") || / at /i.test(line))) {
      if (current) {
        items.push(current);
      }
      const [left, right = ""] = line.split("|").map((part) => part.trim());
      const roleCompany = left.split(/ at /i).map((part) => part.trim());
      current = {
        role: roleCompany[0] || left,
        company: roleCompany[1] || right || "Company",
        summary: line,
        achievements: [],
        technologies: [],
        startDate: right.match(/\b(?:19|20)\d{2}\b(?:\s*[-–]\s*(?:Present|Current|\b(?:19|20)\d{2}\b))?/i)?.[0],
      };
      continue;
    }

    if (!current) {
      current = {
        role: line,
        company: "Company",
        summary: line,
        achievements: [],
        technologies: [],
      };
      continue;
    }

    if (bullet) {
      const text = line.replace(/^[-*]\s*/, "").trim();
      current.achievements.push(text);
      const techMatches = text.match(/\b[A-Z][A-Za-z0-9+#.]+\b/g) ?? [];
      current.technologies.push(...techMatches.filter((token) => token.length > 2));
    } else {
      current.summary = `${current.summary} ${line}`.trim();
    }
  }

  if (current) {
    items.push(current);
  }

  return items.map((item) => ({
    ...item,
    technologies: Array.from(new Set(item.technologies)).slice(0, 8),
  }));
}

function parseProjects(lines: string[]): ResumeProject[] {
  const items: ResumeProject[] = [];
  let current: ResumeProject | null = null;

  for (const line of lines) {
    const bullet = line.startsWith("-") || line.startsWith("*");
    if (!bullet) {
      if (current) {
        items.push(current);
      }
      current = {
        name: line.replace(/\s{2,}.+$/, "").trim(),
        summary: line,
        technologies: [],
        link: line.match(/https?:\/\/\S+/)?.[0],
      };
      continue;
    }

    if (!current) {
      continue;
    }

    const text = line.replace(/^[-*]\s*/, "").trim();
    current.summary = `${current.summary} ${text}`.trim();
    const technologies = text
      .split(/[,/]/)
      .map((token) => token.trim())
      .filter((token) => /^[A-Za-z0-9+#.\- ]{2,}$/.test(token) && token.length < 30);
    current.technologies.push(...technologies);
    if (!current.impact) {
      current.impact = text;
    }
  }

  if (current) {
    items.push(current);
  }

  return items.map((item) => ({
    ...item,
    technologies: Array.from(new Set(item.technologies)).slice(0, 6),
  }));
}

function parseEducation(lines: string[]): EducationItem[] {
  return lines.map((line) => {
    const [degree, institution = "Institution"] = line.split("|").map((part) => part.trim());
    return {
      degree,
      institution,
      endDate: line.match(/\b(?:19|20)\d{2}\b(?:\s*[-–]\s*(?:\b(?:19|20)\d{2}\b|Present))?/i)?.[0],
      details: line,
    };
  });
}

async function extractText(fileType: ResumeFileType, buffer: Buffer): Promise<string> {
  if (fileType === "txt") {
    return buffer.toString("utf8");
  }

  if (fileType === "pdf") {
    const { text } = await pdfParse(buffer);
    return text;
  }

  const { value } = await mammoth.extractRawText({ buffer });
  return value;
}

export async function parseResumeFile(file: File): Promise<ParsedResume> {
  const extension = file.name.split(".").pop()?.toLowerCase();
  const fileType = extension === "pdf" || extension === "docx" || extension === "txt" ? extension : null;
  if (!fileType) {
    throw new Error("Unsupported file type. Upload a PDF, DOCX, or TXT resume.");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const rawText = normalizeWhitespace(await extractText(fileType, buffer));
  const blocks = getSectionBlocks(rawText);
  const headerLines = splitLines((blocks.header ?? []).join("\n"));

  return {
    fileName: file.name,
    fileType,
    rawText,
    name: extractName(headerLines),
    title: extractTitle(headerLines),
    contact: extractContact(headerLines),
    summary: extractSummary(blocks),
    skills: parseSkills(blocks.skills ?? []),
    experience: parseExperience(blocks.experience ?? []),
    projects: parseProjects(blocks.projects ?? []),
    education: parseEducation(blocks.education ?? []),
  };
}
