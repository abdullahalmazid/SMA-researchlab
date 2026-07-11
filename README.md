# Rahman Research Lab

Rahman Research Lab is a public-facing website for a research group. It showcases the lab's people, publications, ideas, announcements, gallery, and contact channels, while also providing secure role-based portals for collaborators and administrators.

## Overview

The application is built as a single-page React experience with a polished landing page, content-managed sections, authenticated collaboration features, and Firebase-backed data flows. It is designed to present the lab professionally on the web while keeping private workflows separated behind login.

## Features

- Responsive home page with hero content, highlights, and call-to-action sections
- Public pages for About, Collaborators, Publications, Research Ideas, Gallery, and Contact
- Research idea listing, detail pages, and comment threads
- Collaborator profiles with search and filter controls
- Admin and collaborator portals protected by role-based routing
- Firebase-powered content, authentication, and Firestore data management
- Cloudinary-powered media uploads for profile and content assets
- Theme-aware UI built with Tailwind CSS and custom CSS variables

## Tech Stack

| Layer     | Technology                         |
| --------- | ---------------------------------- |
| Frontend  | React 18, TypeScript, Vite         |
| Styling   | Tailwind CSS, custom CSS variables |
| Routing   | React Router v6                    |
| Backend   | Firebase Authentication, Firestore |
| Media     | Cloudinary                         |
| Messaging | Encrypted Firestore chat + Firebase Authentication email |

## Public Routes

| Route                  | Purpose                                      |
| ---------------------- | -------------------------------------------- |
| `/`                    | Home page                                    |
| `/about`               | Lab overview                                 |
| `/collaborators`       | Collaborator directory and join request flow |
| `/publications`        | Publications and ongoing work                |
| `/research-ideas`      | Research idea feed                           |
| `/research-ideas/:id`  | Research idea detail page                    |
| `/gallery`             | Lab gallery                                  |
| `/contact`             | Contact form                                 |
| `/login`               | Lab-head and collaborator login              |
| `/admin-login`         | Separate administrator login                 |
| `/chat`                | Collaborator private encrypted chat          |
| `/admin/*`             | Admin dashboard                              |
| `/collaborator-portal` | Collaborator portal                          |

## Project Structure

```text
rahmanlab/
  ├── index.html
  ├── package.json
  ├── vite.config.ts
  ├── tsconfig.json
  ├── tsconfig.node.json
  ├── tailwind.config.js
  ├── postcss.config.js
  ├── firebase.json
  ├── firestore.rules
  ├── firestore.indexes.json
  ├── vercel.json
  ├── .env.example
  ├── README.md
  ├── scripts/
  │   └── firestore-seed.ts
  └── src/
      ├── App.tsx
      ├── main.tsx
      ├── index.css
      ├── components/
      │   ├── Navbar.tsx
      │   ├── Footer.tsx
      │   ├── ContactForm.tsx
      │   ├── PublicationCard.tsx
      │   ├── IdeaCard.tsx
      │   ├── CollaboratorCard.tsx
      │   ├── CollaboratorPublicProfile.tsx
      │   ├── CommentSection.tsx
      │   ├── CloudinaryUpload.tsx
      │   └── ProtectedRoute.tsx
      ├── context/
      │   ├── AuthContext.tsx
      │   └── ThemeContext.tsx
      ├── firebase/
      │   ├── config.ts
      │   └── hooks.ts
      ├── pages/
      │   ├── Home.tsx
      │   ├── About.tsx
      │   ├── Collaborators.tsx
      │   ├── Publications.tsx
      │   ├── ResearchIdeas.tsx
      │   ├── IdeaDetail.tsx
      │   ├── Gallery.tsx
      │   ├── Contact.tsx
      │   └── Login.tsx
      ├── portals/
      │   ├── AdminDashboard.tsx
      │   └── CollaboratorPortal.tsx
      ├── admin/
      │   ├── AdminSections.tsx
      │   ├── ContentEditor.tsx
      │   ├── ThemeControl.tsx
      │   ├── CollaboratorRequests.tsx
      │   ├── ManageCollaborators.tsx
      │   ├── ManagePublications.tsx
      │   └── ManageGallery.tsx
      └── types/
          └── index.ts
```

## Getting Started

1. Install dependencies.

```bash
npm install
```

2. Create a local environment file from the template.

```bash
cp .env.example .env
```

If you are using PowerShell on Windows, the equivalent command is `Copy-Item .env.example .env`.

3. Fill in the Firebase and Cloudinary values for your own project. Keep private keys, production credentials, and service-account files out of version control.

4. Run the app locally.

```bash
npm run dev
```

Open http://localhost:5173 in your browser.

## Environment Variables

The app expects these client-side variables in the local `.env` file:

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_MEASUREMENT_ID=
VITE_CLOUDINARY_CLOUD_NAME=
VITE_CLOUDINARY_UPLOAD_PRESET=
VITE_SITE_URL=http://localhost:5173
```

## Available Scripts

```bash
npm run dev
npm run build
npm run preview
```

## Deployment

The project builds as a standard Vite app and can be deployed to platforms such as Firebase Hosting, Vercel, or any static host that supports SPA routing.

```bash
npm run build
```

Before deploying, make sure your hosting provider is configured to serve `dist/` and route unknown paths back to `index.html`.

### Firebase Rules and Indexes (Spark plan)

Deploy Firestore security rules and indexes:

```bash
firebase use syedlab-research
firebase deploy --only firestore:rules,firestore:indexes
```

This version does not require Cloud Functions or the Blaze plan. Conversation deletion removes encrypted message payloads and hides the conversation for both participants through security-rule-controlled Firestore batches.

### Canonical collaborator migration

New collaborator profiles use `collaborators/{uid}`. Existing random-ID profiles remain supported. To preview the non-destructive migration with Google application credentials configured:

```bash
npx ts-node --esm scripts/migrate-collaborators-to-uid.ts
```

After reviewing the report, apply it with:

```bash
npx ts-node --esm scripts/migrate-collaborators-to-uid.ts --commit
```

The script preserves legacy documents for manual verification and cleanup.

### Administrative access

The primary administrator can grant limited moderator access from **Admin Dashboard → Roles & Permissions**. Moderator permissions are enforced by Firestore rules. The protected primary administrator cannot be demoted by a moderator.

### Segmented dashboard architecture

Dashboard routes now use stable URLs such as `/admin/research-ideas`, `/admin/publications`, and `/admin/gallery`. Feature entry points live under `src/admin/features`, shared modal/page infrastructure under `src/admin/components`, navigation contracts under `src/admin/app`, and layer constants under `src/admin/core`.

The Research Ideas feature is fully separated into its page, editor, Firestore service, and realtime hooks. Its edit, moderation, details, comment deletion, filtering, and sorting flows no longer depend on the legacy monolithic component.

## Security & Privacy

- Do not commit private credentials or service-account JSON files.
- Keep any seeded user accounts and internal admin data out of the public repository.
- Treat all `VITE_` variables as public client-side configuration, not secrets.
- The seed script creates content only. Create Authentication users yourself, then add matching `users/{uid}` documents with role `admin`, `lab_head`, or `collaborator`.
- Chat private keys stay in the user's browser; only public keys are stored in Firestore. Clearing browser storage prevents that browser from decrypting older messages.
