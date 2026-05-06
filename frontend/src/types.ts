export interface Skill {
  name: string;
  level?: number;
}

export interface Certification {
  name: string;
  url?: string;
}

export interface Project {
  title: string;
  description?: string;
  technology?: string;
  link?: string;
}

export interface Experience {
  role: string;
  company: string;
  period?: string;
  duration?: string;
  location?: string;
  type?: string;
  highlights?: string[];
}

export interface Blog {
  title: string;
  slug?: string;
  description?: string;
  link?: string;
}

export interface CaseStudy {
  title: string;
  description?: string;
  technology?: string;
  link?: string;
}

export interface SectionIntegrityIssue {
  section: string;
  title: string;
  reason: string;
}

export interface SectionIntegrityReport {
  sourceSectionsDetected: string[];
  gapsCount: number;
  allStructuredSectionsMatchSource: boolean;
  issues: SectionIntegrityIssue[];
  supplementSections: { title: string; body: string }[];
}

export interface Author {
  id: string;
  name: string;
  /** Full resume text extracted from the uploaded file (server — exact source). */
  verbatimResumeText?: string;
  /** Full JD text when a JD file was uploaded (server — exact source). */
  verbatimJobDescriptionText?: string;
  role?: string;
  email?: string;
  phone?: string;
  location?: string;
  website?: string;
  linkedIn?: string;
  twitter?: string;
  github?: string;
  avatar?: string;
  bio?: string;
  aboutMe?: string;
  company?: string;
  yearsExperience?: string;
  techStack?: string;
  skills?: Skill[];
  expertise?: string[];
  specializations?: string[];
  languages?: string[];
  interests?: string[];
  education?: string;
  certifications?: Certification[];
  projects?: Project[];
  experience?: Experience[];
  projectOrder?: string[];
  blogs?: Blog[];
  caseStudies?: CaseStudy[];
  /** Pre-display audit: source sections vs structured fields; includes verbatim fallbacks. */
  sectionIntegrity?: SectionIntegrityReport;
}

export type ResumeStatus = 'pending' | 'processing' | 'done' | 'error';

export interface ResumeFile {
  id: string;
  file: File;
  name: string;
  status: ResumeStatus;
  result?: Author;
  error?: string;
}
