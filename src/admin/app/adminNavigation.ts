import type { AppIconName } from "../../components/AppIcon";

export type AdminSection = "overview" | "content" | "theme" | "branding" | "requests" | "collaborators" | "publications" | "ideas" | "messages" | "delivery" | "announcements" | "gallery" | "roles";
export type AdminNavItem = { id: AdminSection; label: string; icon: AppIconName; badge?: number; group: string };
export const ADMIN_SECTIONS: AdminSection[] = ["overview", "content", "theme", "branding", "requests", "collaborators", "publications", "ideas", "messages", "delivery", "announcements", "gallery", "roles"];
export const isAdminSection = (value: string): value is AdminSection => ADMIN_SECTIONS.includes(value as AdminSection);
export const buildAdminNavigation = (pendingRequests: number, unreadMessages: number): AdminNavItem[] => [
  { id: "overview", label: "Overview", icon: "admin", group: "Site" },
  { id: "content", label: "Content Editor", icon: "content", group: "Site" },
  { id: "theme", label: "Theme Control", icon: "theme", group: "Site" },
  { id: "branding", label: "Logo & Branding", icon: "theme", group: "Site" },
  { id: "announcements", label: "Announcements", icon: "announcements", group: "Site" },
  { id: "requests", label: "Collab Requests", icon: "requests", group: "People", badge: pendingRequests },
  { id: "collaborators", label: "Collaborators", icon: "collaborators", group: "People" },
  { id: "roles", label: "Roles & Permissions", icon: "admin", group: "People" },
  { id: "publications", label: "Publications", icon: "publications", group: "Research" },
  { id: "ideas", label: "Research Ideas", icon: "ideas", group: "Research" },
  { id: "messages", label: "Contact Messages", icon: "contact", group: "Inbox", badge: unreadMessages },
  { id: "delivery", label: "Delivery Status", icon: "message", group: "Inbox" },
  { id: "gallery", label: "Gallery", icon: "gallery", group: "Media" },
];
export const ADMIN_SECTION_PERMISSION: Partial<Record<AdminSection, string>> = { content: "content.manage", theme: "content.manage", branding: "content.manage", announcements: "content.manage", requests: "requests.manage", collaborators: "collaborators.manage", publications: "publications.manage", ideas: "ideas.manage", gallery: "gallery.manage", messages: "messages.manage", delivery: "messages.manage" };
export const ADMIN_DESCRIPTIONS: Record<AdminSection, string> = { overview: "Track website readiness and jump into priority actions.", content: "Update headlines, page copy, and core website messaging.", theme: "Curate palettes, typography, and visual identity.", branding: "Upload the lab logo and browser favicon.", requests: "Review incoming collaborator applications and approvals.", collaborators: "Manage active members and collaborator profiles.", publications: "Maintain ongoing and published research records.", ideas: "Moderate research ideas, comments, and curation quality.", messages: "Track outreach inbox, unread status, and responses.", delivery: "Monitor notification delivery outcomes.", announcements: "Publish key updates for homepage visibility.", gallery: "Organize lab media and storytelling assets.", roles: "Grant and revoke protected moderator-admin permissions." };
export const ADMIN_ROUTE_TO_SECTION: Record<string, AdminSection> = { "": "overview", overview: "overview", content: "content", appearance: "theme", branding: "branding", announcements: "announcements", requests: "requests", collaborators: "collaborators", permissions: "roles", publications: "publications", "research-ideas": "ideas", gallery: "gallery", messages: "messages", delivery: "delivery" };
export const ADMIN_SECTION_TO_ROUTE: Record<AdminSection, string> = { overview: "", content: "content", theme: "appearance", branding: "branding", announcements: "announcements", requests: "requests", collaborators: "collaborators", roles: "permissions", publications: "publications", ideas: "research-ideas", gallery: "gallery", messages: "messages", delivery: "delivery" };
