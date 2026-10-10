import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

/** Sections where moving between the list and an open item keeps your scroll
 *  position — the list stays on screen behind the open profile. */
const KEEP_SCROLL_WITHIN = ["/collaborators", "/publications", "/research-ideas"];

const section = (pathname: string) => KEEP_SCROLL_WITHIN.find((root) => pathname === root || pathname.startsWith(`${root}/`));

const ScrollToTop = () => {
  const { pathname } = useLocation();
  const previous = useRef(pathname);

  useEffect(() => {
    const from = previous.current;
    previous.current = pathname;
    if (from !== pathname && section(from) && section(from) === section(pathname)) return;
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [pathname]);

  return null;
};

export default ScrollToTop;
