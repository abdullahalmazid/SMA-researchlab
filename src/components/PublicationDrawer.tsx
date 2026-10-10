import React, { useMemo } from "react";
import { normalizePublication } from "../firebase/hooks";
import { PublicationView, usePublication } from "../pages/PublicationDetail";
import type { CollaboratorPublication, Publication } from "../types";
import SideDrawer from "./SideDrawer";

export interface PublicationDrawerTarget {
  entry: CollaboratorPublication;
  /** Shared publication record behind the entry, when there is one. */
  detailId?: string;
}

/**
 * Opens a collaborator's paper in place, on their profile. Papers a contributor
 * adds without the lab head as co-author are kept off the Publications section
 * on purpose, so this never routes into /publications.
 */
const PublicationDrawer: React.FC<{ target: PublicationDrawerTarget | null; onClose: () => void }> = ({
  target,
  onClose,
}) => (
  <SideDrawer
    open={target !== null}
    onClose={onClose}
    eyebrow="Publication"
    title={target?.entry.title || "Untitled publication"}
  >
    {target && <DrawerBody target={target} />}
  </SideDrawer>
);

/** A hand-typed profile entry has no record — show what the person entered. */
const fromEntry = (entry: CollaboratorPublication): Publication =>
  normalizePublication(entry.id || "profile-entry", {
    title: entry.title,
    journal: entry.journal,
    year: entry.year,
    url: entry.url,
    type: "published",
  });

const DrawerBody: React.FC<{ target: PublicationDrawerTarget }> = ({ target }) => {
  const state = usePublication(target.detailId);
  const fallback = useMemo(() => fromEntry(target.entry), [target.entry]);

  if (target.detailId && state.status === "loading") {
    return (
      <div className="grid gap-4 p-6 motion-safe:animate-pulse md:p-8" aria-busy="true" aria-live="polite">
        <span className="sr-only">Loading publication</span>
        <div className="h-40 rounded-2xl bg-slate-200" />
        <div className="h-64 rounded-2xl bg-slate-200" />
      </div>
    );
  }

  if (target.detailId && state.status === "error") {
    return (
      <p className="p-8 text-[15px] text-slate-600">
        This publication didn't load. Check your connection and try again.
      </p>
    );
  }

  // A record that was removed falls back to the profile's own copy.
  const publication = state.status === "ready" ? state.publication : fallback;
  return <PublicationView publication={publication} variant="drawer" />;
};

/** A shared publication record by id, for split views and sheets. */
export const PublicationPanel: React.FC<{ id: string }> = ({ id }) => {
  const state = usePublication(id);
  if (state.status === "loading") {
    return (
      <div className="grid gap-4 p-6 motion-safe:animate-pulse" aria-busy="true">
        <span className="sr-only">Loading publication</span>
        <div className="h-40 rounded-2xl bg-slate-200" />
        <div className="h-64 rounded-2xl bg-slate-200" />
      </div>
    );
  }
  if (state.status !== "ready") {
    return <p className="p-8 text-[15px] text-slate-600">This publication isn't available.</p>;
  }
  return <PublicationView publication={state.publication} variant="drawer" />;
};

export default PublicationDrawer;
