export type ResumeFileType = "pdf" | "docx" | "txt";

export type PortfolioTemplate = "minimal" | "ai-engineer" | "freelancer" | "modern";

export type ThemeMode = "light" | "dark";

export type ContactInfo = {
  email?: string;
  phone?: string;
  location?: string;
  website?: string;
  linkedin?: string;
  github?: string;
};

export type ResumeProject = {
  name: string;
  summary: string;
  impact?: string;
  technologies: string[];
  link?: string;
};

export type ExperienceItem = {
  company: string;
  role: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  summary: string;
  achievements: string[];
  technologies: string[];
};

export type EducationItem = {
  institution: string;
  degree: string;
  startDate?: string;
  endDate?: string;
  details?: string;
};

export type ParsedResume = {
  fileName: string;
  fileType: ResumeFileType;
  rawText: string;
  name: string;
  title?: string;
  contact: ContactInfo;
  summary: string;
  skills: string[];
  experience: ExperienceItem[];
  projects: ResumeProject[];
  education: EducationItem[];
};

export type PortfolioSection = {
  heading: string;
  body: string;
};

export type PortfolioProject = ResumeProject & {
  challenge?: string;
  outcome?: string;
  category: string;
};

export type PortfolioExperience = ExperienceItem & {
  highlights: string[];
};

export type ResumeVariant = {
  headline: string;
  profile: string;
  experienceBullets: string[];
  projectBullets: string[];
  skillsLine: string;
  educationLine: string;
};

export type PortfolioDocument = {
  template: PortfolioTemplate;
  theme: ThemeMode;
  hero: {
    headline: string;
    subheadline: string;
    ctaLabel: string;
    availability: string;
  };
  about: PortfolioSection;
  skills: {
    featured: string[];
    grouped: Record<string, string[]>;
  };
  experience: PortfolioExperience[];
  projects: PortfolioProject[];
  education: EducationItem[];
  contact: ContactInfo & { callToAction: string };
  resumeVariant: ResumeVariant;
  sourceResume: ParsedResume;
};
