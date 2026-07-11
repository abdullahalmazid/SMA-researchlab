import React, { useEffect } from "react";
import { useSiteContent } from "../firebase/hooks";

const BrandingHead: React.FC = () => {
  const { content } = useSiteContent();
  const favicon = content["branding.faviconUrl"] || content["branding.logoUrl"];
  useEffect(() => {
    if (!favicon) return;
    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!link) { link = document.createElement("link"); link.rel = "icon"; document.head.appendChild(link); }
    link.href = favicon;
  }, [favicon]);
  return null;
};
export default BrandingHead;
