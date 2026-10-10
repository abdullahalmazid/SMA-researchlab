export const PORTAL_TABS = [
  { id: "overview", label: "Overview" },
  { id: "profile", label: "Profile" },
  { id: "publications", label: "Publications" },
  { id: "ideas", label: "Research ideas" },
  { id: "gallery", label: "Gallery" },
  { id: "security", label: "Security" },
] as const;

export type PortalTab = (typeof PORTAL_TABS)[number]["id"];

export const isPortalTab = (value: string | null): value is PortalTab => PORTAL_TABS.some((tab) => tab.id === value);
