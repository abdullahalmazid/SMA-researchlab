import { doc, setDoc } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import CloudinaryUpload from "../components/CloudinaryUpload";
import { db } from "../firebase/config";
import { useSiteContent } from "../firebase/hooks";

const BrandingControl: React.FC = () => {
  const { content } = useSiteContent();
  const [logoUrl, setLogoUrl] = useState("");
  const [faviconUrl, setFaviconUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setLogoUrl(content["branding.logoUrl"] ?? "");
    setFaviconUrl(content["branding.faviconUrl"] ?? "");
  }, [content]);

  const save = async () => {
    setSaving(true);
    try {
      await Promise.all([
        setDoc(doc(db, "siteContent", "branding.logoUrl"), { value: logoUrl, updatedAt: new Date().toISOString() }, { merge: true }),
        setDoc(doc(db, "siteContent", "branding.faviconUrl"), { value: faviconUrl || logoUrl, updatedAt: new Date().toISOString() }, { merge: true }),
      ]);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1800);
    } finally { setSaving(false); }
  };

  return <div className="mx-auto max-w-5xl space-y-6">
    <div><h2 className="text-2xl font-black text-slate-900">Lab branding</h2><p className="mt-1 text-sm text-slate-500">Manage the navigation logo and browser-tab icon from one place.</p></div>
    <div className="grid gap-5 lg:grid-cols-2">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <CloudinaryUpload label="Navigation logo" aspectHint="Transparent PNG, WebP or SVG recommended" currentUrl={logoUrl} onUpload={(result) => setLogoUrl(result.secure_url)} />
        {logoUrl && <button type="button" onClick={() => setLogoUrl("")} className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-600">Remove logo</button>}
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <CloudinaryUpload label="Browser favicon" aspectHint="Square image recommended, ideally 512 × 512" currentUrl={faviconUrl} onUpload={(result) => setFaviconUrl(result.secure_url)} />
        <p className="mt-3 text-xs text-slate-500">If left empty, the navigation logo will also be used as the favicon.</p>
      </section>
    </div>
    <div className="flex items-center gap-3"><button type="button" onClick={() => void save()} disabled={saving || !logoUrl} className="rounded-xl border-0 bg-slate-900 px-5 py-3 text-sm font-black text-white disabled:opacity-50">{saving ? "Saving…" : "Save branding"}</button>{saved && <span className="text-sm font-bold text-emerald-600">Branding updated</span>}</div>
  </div>;
};
export default BrandingControl;
