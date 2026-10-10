import { useEffect, useState } from "react";

/** Live result of a CSS media query. */
export const useMediaQuery = (query: string) => {
  const get = () => (typeof window !== "undefined" && window.matchMedia ? window.matchMedia(query).matches : false);
  const [matches, setMatches] = useState(get);

  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [query]);

  return matches;
};

/** Same breakpoint as the navbar and Tailwind's `lg`. */
export const useIsDesktop = () => useMediaQuery("(min-width: 1024px)");
