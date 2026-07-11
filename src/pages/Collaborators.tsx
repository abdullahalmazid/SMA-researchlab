import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import CollaboratorCard from "../components/CollaboratorCard";
import CollaboratorRequestForm from "../components/CollaboratorRequestForm";
import EditableText from "../components/EditableText";
import FilterSelect from "../components/FilterSelect";
import SearchField from "../components/SearchField";
import {
  useCollaborators,
  useSiteContent,
} from "../firebase/hooks";

const Collaborators: React.FC = () => {
  const { collaborators, loading } = useCollaborators();
  const { content } = useSiteContent();
  const navigate = useNavigate();

  const [designationFilter, setDesignationFilter] = useState("");
  const [affiliationFilter, setAffiliationFilter] = useState("");
  const [search, setSearch] = useState("");

  const designationOptions = useMemo(() => {
    const set = new Set(
      collaborators.map((c) => c.designation?.trim()).filter(Boolean),
    );
    return Array.from(set).sort();
  }, [collaborators]);

  const affiliationOptions = useMemo(() => {
    const set = new Set(
      collaborators.map((c) => c.affiliation?.trim()).filter(Boolean),
    );
    return Array.from(set).sort();
  }, [collaborators]);

  const filtered = useMemo(() => {
    return collaborators.filter((c) => {
      const matchDesignation =
        !designationFilter || c.designation?.trim() === designationFilter;
      const matchAffiliation =
        !affiliationFilter || c.affiliation?.trim() === affiliationFilter;
      const matchSearch =
        !search ||
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.affiliation?.toLowerCase().includes(search.toLowerCase()) ||
        c.designation?.toLowerCase().includes(search.toLowerCase()) ||
        c.researchInterests?.some((r) =>
          r.toLowerCase().includes(search.toLowerCase()),
        );
      return matchDesignation && matchAffiliation && matchSearch;
    });
  }, [collaborators, designationFilter, affiliationFilter, search]);

  const hasActiveFilter = !!(designationFilter || affiliationFilter || search);
  const clearFilters = () => {
    setDesignationFilter("");
    setAffiliationFilter("");
    setSearch("");
  };

  if (loading)
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div
          className="w-10 h-10 rounded-full border-4 border-t-transparent animate-spin"
          style={{
            borderColor: "var(--color-primary)",
            borderTopColor: "transparent",
          }}
        />
      </div>
    );

  return (
    <div>
      {/* Hero */}
      <section
        className="relative min-h-[320px] overflow-hidden py-20 text-center px-4 flex items-center justify-center"
        style={{ background: "var(--color-primary)" }}
      >
        {content["collaborators.bannerUrl"] && (
          <img
            src={content["collaborators.bannerUrl"]}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            style={{ filter: "brightness(0.45)" }}
          />
        )}
        <div className="relative z-10">
          <h1
            className="font-black text-white mb-4"
            style={{
              fontSize: "clamp(2rem,4vw,3rem)",
              fontFamily: "var(--font-heading)",
            }}
          >
            <EditableText
              id="collaborators.pageTitle"
              defaultValue={
                content["collaborators.pageTitle"] ?? "Our Collaborators"
              }
              className="font-black text-white mb-4"
            />
          </h1>
          <p
            className="text-base max-w-xl mx-auto"
            style={{ color: "rgba(255,255,255,0.75)" }}
          >
            <EditableText
              id="collaborators.pageSubtitle"
              defaultValue={content["collaborators.pageSubtitle"] ?? ""}
              className="text-base max-w-xl mx-auto"
            />
          </p>
          <button
            onClick={() => {
              document
                .getElementById("collaborator-request")
                ?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            className="mt-6 font-bold px-8 py-3 rounded-xl text-sm"
            style={{
              background: "var(--color-accent)",
              color: "#1f2937",
              border: "none",
              cursor: "pointer",
              boxShadow: "0 8px 20px rgba(0,0,0,0.2)",
            }}
          >
            <EditableText
              id="collaborators.requestCta"
              defaultValue={
                content["collaborators.requestCta"] ?? "Become a Collaborator"
              }
              className="font-bold text-sm"
            />
          </button>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 py-12">
        {/* Filter Bar */}
        {collaborators.length > 0 && (
          <div
            className="bg-white rounded-2xl p-4 mb-8 flex flex-wrap items-center gap-3"
            style={{
              boxShadow: "0 2px 12px rgba(0,0,0,0.07)",
              border: "1px solid #f0f0f0",
            }}
          >
            <SearchField className="min-w-[240px] flex-1" value={search} onChange={setSearch} placeholder="Search by name, university, or interest…" ariaLabel="Search collaborators" />
            <FilterSelect
              value={designationFilter}
              onChange={setDesignationFilter}
              ariaLabel="Filter by designation"
              className="min-w-[190px]"
              options={[{ value: "", label: "All Designations" }, ...designationOptions.map((value) => ({ value, label: value }))]}
            />
            <FilterSelect
              value={affiliationFilter}
              onChange={setAffiliationFilter}
              ariaLabel="Filter by university"
              className="min-w-[210px]"
              options={[{ value: "", label: "All Universities" }, ...affiliationOptions.map((value) => ({ value, label: value }))]}
            />
            {hasActiveFilter && (
              <button
                onClick={clearFilters}
                className="text-xs font-bold px-4 py-2 rounded-xl border-none cursor-pointer"
                style={{ background: "#fee2e2", color: "#991b1b" }}
              >
                ✕ Clear
              </button>
            )}
            <div
              className="ml-auto text-xs font-semibold"
              style={{ color: "#9ca3af" }}
            >
              {filtered.length} of {collaborators.length} shown
            </div>
          </div>
        )}

        {/* Grid */}
        {filtered.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">🔍</div>
            <p className="text-gray-500 font-semibold text-lg">
              <EditableText
                id="collaborators.noMatch"
                defaultValue="No collaborators match your filters."
                className="text-lg font-semibold"
              />
            </p>
            <button
              onClick={clearFilters}
              className="mt-4 text-sm font-bold px-5 py-2.5 rounded-xl border-none cursor-pointer text-white"
              style={{ background: "var(--color-primary)" }}
            >
              <EditableText
                id="collaborators.clearFilters"
                defaultValue="Clear Filters"
                className="text-sm font-bold"
              />
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-20">
            {filtered.map((c) => (
              <CollaboratorCard
                key={c.id}
                collaborator={c}
                onClick={() => navigate(`/collaborators/${encodeURIComponent(c.uid)}`)}
              />
            ))}
          </div>
        )}
      </div>

      <section
        id="collaborator-request"
        className="px-4 py-14"
        style={{
          background: "#f8fafc",
          borderTop: "1px solid #e5e7eb",
        }}
      >
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-7">
            <p
              className="text-xs font-black uppercase tracking-[0.18em]"
              style={{ color: "#64748b" }}
            >
              <EditableText
                id="collaborators.joinNetwork"
                defaultValue="Join the Network"
                className="text-xs font-black uppercase tracking-[0.18em]"
              />
            </p>
            <div
              className="mx-auto mt-2 h-1 w-14 rounded-full"
              style={{ background: "var(--color-accent)" }}
            />
          </div>
          <div className="bg-white rounded-2xl p-6 md:p-10 shadow-md max-w-4xl mx-auto">
            <div className="text-center mb-6">
              <h2
                className="font-black text-2xl mb-3"
                style={{
                  color: "var(--color-primary)",
                  fontFamily: "var(--font-heading)",
                }}
              >
                <EditableText
                  id="collaborators.requestTitle"
                  defaultValue={
                    content["collaborators.requestTitle"] ??
                    "Become a Collaborator"
                  }
                  className="font-black text-2xl mb-3"
                />
              </h2>
              <p className="text-gray-600 text-sm leading-relaxed">
                <EditableText
                  id="collaborators.requestSubtitle"
                  defaultValue={
                    content["collaborators.requestSubtitle"] ??
                    "Interested in joining our research community? Submit your request below and our admin will review your profile."
                  }
                  className="text-gray-600 text-sm leading-relaxed"
                />
              </p>
            </div>
            <CollaboratorRequestForm />
          </div>
        </div>
      </section>
    </div>
  );
};

export default Collaborators;
