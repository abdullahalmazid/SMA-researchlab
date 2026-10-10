import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { trackPageView } from "./tracker";

/** Records one page view per route change, once auth has settled. */
const AnalyticsTracker: React.FC = () => {
  const { pathname } = useLocation();
  const { appUser, loading } = useAuth();
  const last = useRef<string>("");

  useEffect(() => {
    if (loading) return;
    const key = `${pathname}|${appUser?.uid ?? ""}`;
    if (last.current === key) return;
    last.current = key;
    void trackPageView(pathname, appUser);
  }, [pathname, appUser, loading]);

  return null;
};

export default AnalyticsTracker;
