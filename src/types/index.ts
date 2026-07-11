export type UserRole = "admin" | "lab_head" | "collaborator" | "pending";

export interface User {
  uid: string;
  email: string;
  role: UserRole;
  name: string;
  createdAt: string;
  adminLevel?: "primary" | "moderator" | "none";
  adminPermissions?: string[];
  accountStatus?: "active" | "disabled";
  collaboratorProfileId?: string;
  updatedAt?: string;
  adminUpdatedByUid?: string;
  adminUpdatedByName?: string;
}

export interface CollaboratorProfile {
  id: string;
  uid: string;
  name: string;
  email: string;
  photo: string; // Cloudinary URL
  affiliation: string;
  designation: string;
  bio: string;
  researchInterests: string[];
  linkedin: string;
  orcid: string;
  scholar: string;
  researchgate: string;
  facebook: string;
  publications: CollaboratorPublication[];
  isActive: boolean;
  order: number;
  createdAt: string;
}

export interface CollaboratorPublication {
  id: string;
  title: string;
  journal: string;
  year: number;
  url: string;
}

export interface PendingRequest {
  id: string;
  name: string;
  email: string;
  photo: string;
  affiliation: string;
  designation: string;
  bio: string;
  researchInterests: string[];
  linkedin: string;
  orcid: string;
  scholar: string;
  researchgate: string;
  facebook: string;
  publications: CollaboratorPublication[];
  status: "pending" | "approved" | "rejected";
  submittedAt: string;
  approvedUid?: string;
  approvalStage?: "pending" | "auth_created" | "completed";
  emailDeliveryStatus?: "pending" | "sent" | "failed";
  emailAttempts?: number;
  emailLastError?: string;
  approvedAt?: string;
}

export interface Publication {
  id: string;
  title: string;
  authors: string;
  journal: string;
  year: number;
  abstract: string;
  url: string;
  doi: string;
  type: "ongoing" | "published";
  tags: string[];
  // Canonical shared-paper model
  paperKey?: string;
  hasLabHeadAuthorship?: boolean;
  authorEntries?: PublicationAuthorEntry[];
  contributorUids?: string[];
  createdByUid?: string;
  updatedAt?: string;
  createdAt: string;
}

export type PublicationAuthorEntryType = "linked" | "external";

export interface PublicationAuthorEntry {
  type: PublicationAuthorEntryType;
  name: string;
  uid?: string;
  photo?: string;
  role?: UserRole | "external";
  affiliation?: string;
}

export interface ResearchIdea {
  id: string;
  title: string;
  shortDescription: string;
  fullDescription: string;
  tags: string[];
  authorId: string;
  authorName: string;
  authorPhoto: string;
  createdAt: string;
  updatedAt: string;
  commentCount: number;
  isPublished?: boolean; // moderation: draft vs published
  isHidden?: boolean; // moderation: hide from public view
  isFlagged?: boolean; // moderation: flagged for review
  isPinned?: boolean; // moderation: featured/pinned idea
}

export interface Comment {
  id: string;
  ideaId: string;
  authorId: string;
  authorName: string;
  authorPhoto: string;
  content: string;
  parentId?: string | null;
  createdAt: string;
}

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  isRead: boolean;
  submittedAt: string;
}

export interface Announcement {
  id: string;
  content: string;
  createdAt: string;
  order: number;
  updatedAt?: string;
  isPinned?: boolean;
  isHidden?: boolean;
}

export interface ThemeSettings {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  navbarColor: string;
  footerColor: string;
  fontFamily: string;
  headingFont: string;
}

// Site content — keyed by tab + field
export interface SiteContent {
  // Home
  "home.heroTitle": string;
  "home.heroSubtitle": string;
  "home.heroCta": string;
  "home.bannerUrl": string;
  "home.introTitle": string;
  "home.introText": string;
  "home.announcementsTitle": string;
  "home.statsLabel1": string;
  "home.statsLabel2": string;
  "home.statsLabel3": string;
  "home.statsLabel4": string;
  // About
  "about.pageTitle": string;
  "about.pageSubtitle": string;
  "about.section1Title": string;
  "about.section1Text": string;
  "about.section2Title": string;
  "about.section2Text": string;
  "about.section3Title": string;
  "about.section3Text": string;
  "about.missionTitle": string;
  "about.missionText": string;
  "about.visionTitle": string;
  "about.visionText": string;
  // Collaborators
  "collaborators.pageTitle": string;
  "collaborators.pageSubtitle": string;
  "collaborators.requestTitle": string;
  "collaborators.requestSubtitle": string;
  "collaborators.requestCta": string;
  // Publications
  "publications.pageTitle": string;
  "publications.pageSubtitle": string;
  "publications.ongoingTitle": string;
  "publications.ongoingSubtitle": string;
  "publications.publishedTitle": string;
  "publications.publishedSubtitle": string;
  // Research Ideas
  "ideas.pageTitle": string;
  "ideas.pageSubtitle": string;
  "ideas.postCta": string;
  "ideas.emptyText": string;
  // Contact
  "contact.pageTitle": string;
  "contact.pageSubtitle": string;
  "contact.address": string;
  "contact.email": string;
  "contact.phone": string;
  "contact.mapEmbed": string;
  "contact.formTitle": string;
  "contact.successMessage": string;
  //banner for all tabs
  "about.bannerUrl": string;
  "collaborators.bannerUrl": string;
  "publications.bannerUrl": string;
  "ideas.bannerUrl": string;
  "contact.bannerUrl": string;
  "gallery.bannerUrl": string;
  [key: string]: string;
}

export interface CloudinaryUploadResult {
  secure_url: string;
  public_id: string;
  width: number;
  height: number;
}
export interface GalleryItem {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  order: number;
  createdAt: string;
  updatedAt?: string;
  uploaderUid?: string;
  uploaderName?: string;
  uploaderEmail?: string;
  isVisible?: boolean;
  moderationStatus?: "pending" | "approved" | "rejected";
}
