import type { AppIconName } from "../../components/AppIcon";

export type AdminSection =
  | "overview"
  | "content"
  | "theme"
  | "branding"
  | "requests"
  | "collaborators"
  | "publications"
  | "ideas"
  | "messages"
  | "delivery"
  | "announcements"
  | "gallery"
  | "roles"
  | "analytics"
  | "audit";
export type AdminNavItem = { id: AdminSection; label: string; icon: AppIconName; badge?: number; group: string };

export const ADMIN_SECTIONS: AdminSection[] = [
  "overview", "content", "theme", "branding", "requests", "collaborators", "publications", "ideas",
  "messages", "delivery", "announcements", "gallery", "roles", "analytics", "audit",
];
export const isAdminSection = (value: string): value is AdminSection => ADMIN_SECTIONS.includes(value as AdminSection);

/** Sections only the primary administrator ever sees. */
export const PRIMARY_ONLY_SECTIONS: AdminSection[] = ["analytics", "audit"];

/*
 * "Delivery Status" is no longer listed: it reads a notification log that
 * nothing writes (there's no backend to send email). The route still resolves
 * so old bookmarks don't 404, and it returns once notifications exist.
 */
export const buildAdminNavigation = (pendingRequests: number, unreadMessages: number, pendingAccess = 0): AdminNavItem[] => [
  { id: "overview", label: "Overview", icon: "admin", group: "Site" },
  { id: "content", label: "Content Editor", icon: "content", group: "Site" },
  { id: "theme", label: "Theme Control", icon: "theme", group: "Site" },
  { id: "branding", label: "Logo & Branding", icon: "theme", group: "Site" },
  { id: "announcements", label: "Announcements", icon: "announcements", group: "Site" },
  { id: "requests", label: "Collab Requests", icon: "requests", group: "People", badge: pendingRequests },
  { id: "collaborators", label: "Collaborators", icon: "collaborators", group: "People" },
  { id: "roles", label: "Roles & Permissions", icon: "admin", group: "People", badge: pendingAccess },
  { id: "publications", label: "Publications", icon: "publications", group: "Research" },
  { id: "ideas", label: "Research Ideas", icon: "ideas", group: "Research" },
  { id: "messages", label: "Contact Messages", icon: "contact", group: "Inbox", badge: unreadMessages },
  { id: "gallery", label: "Gallery", icon: "gallery", group: "Media" },
  { id: "analytics", label: "Analytics", icon: "lab", group: "Security" },
  { id: "audit", label: "Audit Log", icon: "admin", group: "Security" },
];

export const ADMIN_SECTION_PERMISSION: Partial<Record<AdminSection, string>> = {
  content: "content.manage",
  theme: "content.manage",
  branding: "content.manage",
  announcements: "content.manage",
  requests: "requests.manage",
  collaborators: "collaborators.manage",
  publications: "publications.manage",
  ideas: "ideas.manage",
  gallery: "gallery.manage",
  messages: "messages.manage",
  delivery: "messages.manage",
};

export const ADMIN_DESCRIPTIONS: Record<AdminSection, string> = {
  overview: "Track website readiness and jump into priority actions.",
  content: "Update headlines, page copy, and core website messaging.",
  theme: "Curate palettes, typography, and visual identity.",
  branding: "Upload the lab logo and browser favicon.",
  requests: "Review incoming collaborator applications and approvals.",
  collaborators: "Manage active members and collaborator profiles.",
  publications: "Maintain ongoing and published research records.",
  ideas: "Moderate research ideas, comments, and curation quality.",
  messages: "Track outreach inbox, unread status, and responses.",
  delivery: "Monitor notification delivery outcomes.",
  announcements: "Publish key updates for homepage visibility.",
  gallery: "Organize lab media and storytelling assets.",
  roles: "Grant moderator permissions — moderator changes need primary-admin approval.",
  analytics: "Visitor traffic and collaborator activity.",
  audit: "Every change made in the admin panel, and who made it.",
};

export const ADMIN_ROUTE_TO_SECTION: Record<string, AdminSection> = {
  "": "overview",
  overview: "overview",
  content: "content",
  appearance: "theme",
  branding: "branding",
  announcements: "announcements",
  requests: "requests",
  collaborators: "collaborators",
  permissions: "roles",
  publications: "publications",
  "research-ideas": "ideas",
  gallery: "gallery",
  messages: "messages",
  delivery: "delivery",
  analytics: "analytics",
  "audit-log": "audit",
};

export const ADMIN_SECTION_TO_ROUTE: Record<AdminSection, string> = {
  overview: "",
  content: "content",
  theme: "appearance",
  branding: "branding",
  announcements: "announcements",
  requests: "requests",
  collaborators: "collaborators",
  roles: "permissions",
  publications: "publications",
  ideas: "research-ideas",
  gallery: "gallery",
  messages: "messages",
  delivery: "delivery",
  analytics: "analytics",
  audit: "audit-log",
};
