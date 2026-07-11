/**
 * Safe content-only seed for a new Firebase project.
 * It intentionally creates no Authentication users and contains no passwords.
 * Run with GOOGLE_APPLICATION_CREDENTIALS pointing to a local service-account file.
 */
import { applicationDefault, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

initializeApp({ credential: applicationDefault() });
const db = getFirestore();

const theme = {
  primaryColor: "#0f5f70",
  secondaryColor: "#0ea5b7",
  accentColor: "#facc15",
  backgroundColor: "#f4fafc",
  navbarColor: "#0f5f70",
  footerColor: "#083344",
  fontFamily: "'Inter', sans-serif",
  headingFont: "'Inter', sans-serif",
};

const content: Record<string, string> = {
  "navbar.labTitle": "Syed's Lab",
  "home.heroTitle": "Research that moves ideas forward",
  "home.heroSubtitle": "A collaborative laboratory for rigorous, open, and socially useful research.",
  "home.heroCta": "Explore Research Ideas",
  "home.introTitle": "About the Lab",
  "home.introText": "We bring researchers, students, and collaborators together to develop strong questions, share methods, and publish meaningful work.",
  "home.announcementsTitle": "Latest Updates",
  "collaborators.pageTitle": "Our Collaborators",
  "collaborators.pageSubtitle": "Meet the researchers and academics driving our work forward.",
  "collaborators.requestTitle": "Become a Collaborator",
  "collaborators.requestSubtitle": "Submit your research profile for review by the lab administration team.",
  "publications.pageTitle": "Publications",
  "publications.pageSubtitle": "Published work and research currently in progress.",
  "ideas.pageTitle": "Research Ideas",
  "ideas.pageSubtitle": "Explore and discuss ideas proposed by the research team.",
  "gallery.pageTitle": "Lab Gallery",
  "gallery.pageSubtitle": "Seminars, field work, workshops, and team moments.",
  "contact.pageTitle": "Contact the Lab",
  "login.pageTitle": "Team Portal Login",
  "login.pageSubtitle": "Lab head and collaborator access",
  "footer.brandName": "Syed's Lab",
  "footer.tagline": "Research, collaboration, and measurable impact.",
};

async function seed() {
  await db.doc("theme/settings").set(theme, { merge: true });
  const batch = db.batch();
  Object.entries(content).forEach(([id, value]) => batch.set(db.doc(`siteContent/${id}`), { value }, { merge: true }));
  await batch.commit();
  console.log(`Seeded theme and ${Object.keys(content).length} default content fields. No user accounts were created.`);
}

seed().catch((error) => { console.error(error); process.exitCode = 1; });
