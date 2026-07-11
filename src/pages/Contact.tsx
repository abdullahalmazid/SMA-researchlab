import React from "react";
import AppIcon, { type AppIconName } from "../components/AppIcon";
import ContactForm from "../components/ContactForm";
import EditableText from "../components/EditableText";
import { useThemeContext } from "../context/ThemeContext";
import { useSiteContent } from "../firebase/hooks";

const Contact: React.FC = () => {
  const { content, loading } = useSiteContent();
  const { theme } = useThemeContext();

  const hexToRgb = (hex: string) => {
    const clean = (hex ?? "").replace("#", "").trim();
    if (clean.length !== 6) return { r: 0, g: 0, b: 0 };
    return {
      r: Number.parseInt(clean.slice(0, 2), 16),
      g: Number.parseInt(clean.slice(2, 4), 16),
      b: Number.parseInt(clean.slice(4, 6), 16),
    };
  };

  const withAlpha = (hex: string, alpha: number, fallback = hex) => {
    const rgb = hexToRgb(hex);
    return rgb.r === 0 && rgb.g === 0 && rgb.b === 0 && hex !== "#000000"
      ? fallback
      : `rgba(${rgb.r},${rgb.g},${rgb.b},${alpha})`;
  };

  const isDarkTheme = React.useMemo(() => {
    const clean = (theme.backgroundColor ?? "").replace("#", "").trim();
    if (clean.length !== 6) return false;
    const r = Number.parseInt(clean.slice(0, 2), 16);
    const g = Number.parseInt(clean.slice(2, 4), 16);
    const b = Number.parseInt(clean.slice(4, 6), 16);
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    return luminance < 140;
  }, [theme.backgroundColor]);

  const headingText = isDarkTheme
    ? withAlpha(theme.backgroundColor!, 1, "var(--color-primary)")
    : "var(--color-primary)";
  const bodyText = isDarkTheme
    ? withAlpha(theme.primaryColor!, 0.8, "#cbd5e1")
    : withAlpha(theme.primaryColor!, 0.7, "#374151");
  const mutedText = isDarkTheme
    ? withAlpha(theme.primaryColor!, 0.6, "#94a3b8")
    : withAlpha(theme.primaryColor!, 0.6, "#9ca3af");
  const cardBg = isDarkTheme
    ? withAlpha(theme.backgroundColor!, 0.7, "rgba(15,23,42,0.7)")
    : "var(--color-bg)";
  const cardBorder = isDarkTheme
    ? withAlpha(theme.primaryColor!, 0.22, "rgba(148,163,184,0.22)")
    : withAlpha(theme.primaryColor!, 0.1, "#e5e7eb");

  const neuroBgLight = withAlpha(theme.primaryColor!, 0.08, "#e7edf6");
  const neuroBgDark = withAlpha(theme.backgroundColor!, 1, "#182438");
  const neuroBg = isDarkTheme ? neuroBgDark : neuroBgLight;

  const shadowLight = `10px 10px 20px ${withAlpha(theme.primaryColor!, 0.15, "#c5cdd7")}, -10px -10px 20px ${withAlpha(theme.backgroundColor!, 0.95, "#f5fbff")}`;
  const shadowDark = `10px 10px 20px ${withAlpha(theme.backgroundColor!, 0.45, "rgba(5,10,20,0.45)")}, -10px -10px 20px ${withAlpha(theme.primaryColor!, 0.18, "rgba(51,65,85,0.18)")}`;
  const neuroRaised = isDarkTheme ? shadowDark : shadowLight;
  const addressValue = String(content["contact.address"] ?? "").trim();
  const mapEmbedUrl = String(content["contact.mapEmbed"] ?? "").trim();
  const mapSearchUrl = addressValue
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressValue)}`
    : "";

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
    <div style={{ background: "var(--color-bg)" }}>
      {/* Hero */}
      <section
        className="relative min-h-[320px] overflow-hidden py-20 text-center px-4 flex items-center justify-center"
        style={{ background: "var(--color-primary)" }}
      >
        {content["contact.bannerUrl"] && (
          <img
            src={content["contact.bannerUrl"]}
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
            <EditableText id="contact.pageTitle" defaultValue={content["contact.pageTitle"] ?? "Contact Us"} />
          </h1>
          <span
            className="text-xs font-black uppercase tracking-[0.15em]"
            style={{ color: mutedText }}
          >
            <EditableText id="contact.form.directContact" defaultValue="Direct Contact" />
          </span>
          <p className="text-sm mt-2" style={{ color: bodyText }}>
            <EditableText id="contact.form.sendQuery" defaultValue="Send your query and we will respond soon." />
          </p>
          <p className="text-xs mt-4" style={{ color: mutedText }}>
            <EditableText id="contact.map.findus" defaultValue="Find us on the map" />
          </p>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 py-16 grid grid-cols-1 lg:grid-cols-5 gap-12">
        {/* Contact Info */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <h2
            className="font-black text-xl"
            style={{
              color: headingText,
              fontFamily: "var(--font-heading)",
            }}
          >
            <EditableText id="contact.getInTouch" defaultValue="Get In Touch" />
          </h2>

          {[
            {
              icon: "location" as AppIconName,
              label: "Address",
              value: addressValue,
            },
            {
              icon: "contact" as AppIconName,
              label: "Email",
              value: content["contact.email"],
              href: content["contact.email"]
                ? `mailto:${content["contact.email"]}`
                : undefined,
            },
            {
              icon: "phone" as AppIconName,
              label: "Phone",
              value: content["contact.phone"],
              href: content["contact.phone"]
                ? `tel:${content["contact.phone"]}`
                : undefined,
            },
          ]
            .filter((item) => item.value)
            .map((item) => (
              <div key={item.label} className="flex items-start gap-4">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                  style={{ background: "var(--color-primary)", fontSize: 18 }}
                >
                  <AppIcon name={item.icon} size={18} />
                </div>
                <div>
                  <p
                    className="text-xs font-bold uppercase tracking-wider mb-0.5"
                    style={{ color: mutedText }}
                  >
                    <EditableText id={`contact.info.label.${item.label.toLowerCase().replace(/\s+/g, "")}`} defaultValue={item.label} />
                  </p>
                  {item.href ? (
                    <a
                      href={item.href}
                      className="text-sm font-medium no-underline hover:underline"
                      style={{ color: "var(--color-secondary)" }}
                    >
                      <EditableText id={`contact.info.value.${item.label.toLowerCase().replace(/\s+/g, "")}`} defaultValue={item.value ?? ""} />
                    </a>
                  ) : (
                    <p className="text-sm" style={{ color: bodyText }}>
                      <EditableText id={`contact.info.value.${item.label.toLowerCase().replace(/\s+/g, "")}`} defaultValue={item.value ?? ""} />
                    </p>
                  )}
                </div>
              </div>
            ))}

          {/* Note Section */}
          <div className="flex items-center gap-2 mt-6 mb-2">
            <span
              className="inline-flex items-center justify-center w-8 h-8 rounded-lg"
              style={{
                background: "var(--color-primary)",
                color: "white",
              }}
            >
              <AppIcon name="about" size={18} />
            </span>
            <span className="font-bold text-sm" style={{ color: headingText }}>
              <EditableText id="contact.note.label" defaultValue="Note" />
            </span>
          </div>
          <p className="text-xs mt-1" style={{ color: mutedText }}>
            <EditableText id="contact.note.text" defaultValue="For urgent matters, please use the phone number above." />
          </p>

          {/* Map Section */}
          <div
            className="rounded-2xl p-4 border mt-4"
            style={{ background: cardBg, borderColor: cardBorder }}
          >
            <div className="flex items-center gap-2 mb-3">
              <span
                className="inline-flex items-center justify-center w-8 h-8 rounded-lg"
                style={{
                  background: "var(--color-primary)",
                  color: "white",
                }}
              >
                <AppIcon name="location" size={15} />
              </span>
              <span className="font-black text-xs uppercase tracking-[0.15em]" style={{ color: mutedText }}>
                <EditableText id="contact.map.label" defaultValue="Location" />
              </span>
            </div>
            {mapEmbedUrl ? (
              <iframe
                src={mapEmbedUrl}
                width="100%"
                height="220"
                style={{ border: 0, borderRadius: 12, width: "100%" }}
                allowFullScreen
                loading="lazy"
                title="Lab location map"
              />
            ) : (
              <div className="space-y-2">
                <p className="text-sm" style={{ color: mutedText }}>
                  <EditableText id="contact.map.notavailable" defaultValue="Map link is not available yet. Please use the address above." />
                </p>
                {mapSearchUrl && (
                  <a
                    href={mapSearchUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 text-sm font-semibold no-underline hover:underline"
                    style={{ color: "var(--color-secondary)" }}
                  >
                    <AppIcon name="location" size={14} />
                    <EditableText id="contact.map.openInGoogle" defaultValue="Open in Google Maps" />
                  </a>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Contact Form */}
        <div className="lg:col-span-3">
          <div
            className="rounded-[28px] p-8 border"
            style={{
              background: neuroBg,
              borderColor: cardBorder,
              boxShadow: neuroRaised,
            }}
          >
            <div className="flex items-center gap-3 mb-3">
              <span
                className="inline-flex items-center justify-center w-11 h-11 rounded-2xl"
                style={{ background: neuroBg, boxShadow: neuroRaised }}
              >
                <AppIcon
                  name="message"
                  size={18}
                  style={{ color: headingText }}
                />
              </span>
              <div>
                <p
                  className="text-[11px] font-black uppercase tracking-[0.15em]"
                  style={{ color: mutedText }}
                >
                  <EditableText id="contact.form.directContact.form" defaultValue="Direct Contact" />
                </p>
                <p className="text-sm" style={{ color: bodyText }}>
                  <EditableText id="contact.form.sendQuery.form" defaultValue="Send your query and we will respond soon." />
                </p>
              </div>
            </div>
            <h2
              className="font-black text-xl mb-6"
              style={{
                color: headingText,
                fontFamily: "var(--font-heading)",
              }}
            >
              <EditableText id="contact.formTitle" defaultValue={content["contact.formTitle"] ?? "Send a Message"} />
            </h2>
            <div className="contact-neuro-form">
              <ContactForm />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Contact;
