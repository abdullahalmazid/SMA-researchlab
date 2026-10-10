import React, { createContext, useCallback, useContext, useMemo, useRef } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useAnnouncements } from "../firebase/hooks";
import AnnouncementView, { titleOf } from "./AnnouncementView";
import CollaboratorProfileView, { CollaboratorName } from "./CollaboratorProfileView";
import SideDrawer from "./SideDrawer";

/**
 * Opens a collaborator's profile on top of whatever page you're on — a side
 * drawer on desktop, a resizable bottom sheet on phones — instead of jumping
 * to the Collaborators section. The open profile lives in the URL as
 * ?person=<uid>, so Back closes it and the link can be shared.
 */
const PARAM = "person";
/** Same idea for a news item: ?news=<id>. */
const NEWS_PARAM = "news";

interface PersonDrawerApi {
  /** `name`, when known, titles the drawer before the profile has loaded. */
  openPerson: (uid: string, name?: string) => void;
  openNews: (id: string, title?: string) => void;
}

const PersonDrawerContext = createContext<PersonDrawerApi>({ openPerson: () => undefined, openNews: () => undefined });

export const usePersonDrawer = () => useContext(PersonDrawerContext);

export const PersonDrawerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const uid = params.get(PARAM) ?? "";
  const newsId = params.get(NEWS_PARAM) ?? "";
  /* Did we push the history entry? Then closing goes Back, so the browser's
     own Back button and our close button agree. */
  const pushed = useRef(false);
  const nameHint = useRef<Record<string, string>>({});

  const openParam = useCallback(
    (key: string, value: string, label?: string) => {
      if (!value) return;
      if (label) nameHint.current[`${key}:${value}`] = label;
      const search = new URLSearchParams(window.location.search);
      const replace = search.has(key); // switching item inside an open drawer
      search.set(key, value);
      if (!replace) pushed.current = true;
      setParams(search, { replace });
    },
    [setParams],
  );
  const openPerson = useCallback((next: string, name?: string) => openParam(PARAM, next, name), [openParam]);
  const openNews = useCallback((next: string, title?: string) => openParam(NEWS_PARAM, next, title), [openParam]);

  const closeParam = useCallback(
    (key: string) => {
      if (pushed.current && location.key !== "default") {
        pushed.current = false;
        navigate(-1);
        return;
      }
      const search = new URLSearchParams(window.location.search);
      search.delete(key);
      setParams(search, { replace: true });
    },
    [location.key, navigate, setParams],
  );
  const close = useCallback(() => closeParam(PARAM), [closeParam]);
  const closeNews = useCallback(() => closeParam(NEWS_PARAM), [closeParam]);

  const api = useMemo(() => ({ openPerson, openNews }), [openPerson, openNews]);

  return (
    <PersonDrawerContext.Provider value={api}>
      {children}
      <SideDrawer open={Boolean(uid)} onClose={close} eyebrow="Collaborator" title={uid ? <CollaboratorName uid={uid} fallback={nameHint.current[`${PARAM}:${uid}`]} /> : ""} mobileHeight={86}>
        {uid && <CollaboratorProfileView uid={uid} />}
      </SideDrawer>
      <SideDrawer
        open={Boolean(newsId)}
        onClose={closeNews}
        eyebrow="News"
        title={newsId ? <NewsTitle id={newsId} fallback={nameHint.current[`${NEWS_PARAM}:${newsId}`]} /> : ""}
        mobileHeight={80}
      >
        {newsId && <NewsPanel id={newsId} />}
      </SideDrawer>
    </PersonDrawerContext.Provider>
  );
};

/**
 * A link to someone's profile that opens it in place. It stays a real link to
 * /collaborators/<uid>, so middle-click, Ctrl-click and "open in new tab"
 * still go to the full page.
 */
export const PersonLink: React.FC<
  Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & { uid: string; /** Titles the drawer while it loads. */ name?: string }
> = ({ uid, name, onClick, children, ...rest }) => {
  const { openPerson } = usePersonDrawer();
  return (
    <a
      href={`/collaborators/${encodeURIComponent(uid)}`}
      aria-haspopup="dialog"
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        openPerson(uid, name ?? (typeof children === "string" ? children : undefined));
      }}
      {...rest}
    >
      {children}
    </a>
  );
};

const NewsTitle: React.FC<{ id: string; fallback?: string }> = ({ id, fallback }) => {
  const post = useAnnouncements().find((item) => item.id === id);
  return <>{post ? titleOf(post) : fallback || "Announcement"}</>;
};

const NewsPanel: React.FC<{ id: string }> = ({ id }) => {
  const announcements = useAnnouncements();
  const post = announcements.find((item) => item.id === id && !item.isHidden);
  if (!post) {
    return (
      <p className="px-5 py-16 text-center text-[14px] text-[color:var(--site-muted)]">
        {announcements.length ? "This announcement isn't available." : "Loading…"}
      </p>
    );
  }
  return <AnnouncementView post={post} />;
};

/** A link to a news item that opens it in place (real link to /announcements?a=<id>). */
export const NewsLink: React.FC<
  Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & { id: string; title?: string }
> = ({ id, title, onClick, children, ...rest }) => {
  const { openNews } = usePersonDrawer();
  return (
    <a
      href={`/announcements?a=${encodeURIComponent(id)}`}
      aria-haspopup="dialog"
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        openNews(id, title);
      }}
      {...rest}
    >
      {children}
    </a>
  );
};
