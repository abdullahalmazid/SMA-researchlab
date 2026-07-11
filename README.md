# Rahman Research Lab

Rahman Research Lab is a full research-team website and collaboration platform. It combines a public research presence with authenticated collaborator tools, granular administration, encrypted private messaging, content management, publications, research ideas, galleries, and role-based portals.

The production application uses React, TypeScript, Firebase Authentication, Cloud Firestore, Cloudinary and Vercel. The current release is compatible with Firebase's free Spark plan and does not require Cloud Functions.

## Main Features

### Public website

- Responsive Home, About, Lab Head, Collaborators, Publications, Research Ideas, Gallery and Contact pages
- Consistent page heroes, navigation, footer branding and route-level scroll reset
- Searchable collaborator directory with public profile pages
- Formal publication catalogue with dedicated publication-detail routes
- Research idea cards, detail pages, comments, replies and synchronized author identities
- Gallery viewer with navigation-safe modal positioning
- Dynamic content and branding from Firestore
- Lab logo synchronized across navigation, footer and browser favicon
- Configurable global colors and typography

### Collaborator portal

- Authenticated profile editing
- Canonical collaborator name, photo and identity synchronization
- Personal publications and gallery management
- Research idea and discussion participation
- Secure private team messenger
- Lab-head support through the same canonical collaborator model

### Administration

- Separate administrator login and protected dashboard
- Page content editor with page cards, expandable field groups and save-state feedback
- Compact Theme Studio with colors, typography, preview and premium presets
- Logo, favicon and branding management
- Collaboration-request review and approval
- Collaborator directory management
- Publication, research idea, gallery, announcement and contact-message management
- Moderator roles with granular permissions
- Primary administrator protection
- Real-time grant, edit and withdrawal of administrative access
- Permission audit records
- Admin preview modes for lab-head and collaborator interfaces

### Private messenger

- Full-screen encrypted collaborator messaging
- Right-edge launcher with unread-message count instead of a main navigation tab
- Recent conversations and searchable team directory
- Synchronized collaborator names and profile images
- Online, offline, last-seen and typing states
- Replies, editing, reactions, pinned messages and read receipts
- Delete for me, delete for everyone, clear conversation and tray removal
- Former-collaborator/orphan-conversation handling
- Short collaborator profile panel with full-profile navigation
- Lab-theme synchronization
- Personal chat themes: Lab, Light, Dark, Monochrome, Midnight and Soft Blue
- Compact density, background pattern and reduced-motion preferences

Personal chat appearance is stored on the current device and does not require additional Firestore writes.

## Technology

| Layer | Technology |
| --- | --- |
| Frontend | React 18, TypeScript, Vite |
| Styling | Tailwind CSS, CSS variables, theme tokens |
| Routing | React Router v6 |
| Authentication | Firebase Authentication |
| Database | Cloud Firestore |
| Media | Cloudinary |
| Hosting | Vercel |
| Messaging | Encrypted Firestore private chat |
| Email | Firebase Authentication password-reset email |

## Routes

### Public routes

| Route | Purpose |
| --- | --- |
| `/` | Home |
| `/about` | Lab overview |
| `/lab-head` | Dedicated lab-head page |
| `/collaborators` | Collaborator directory and application flow |
| `/collaborators/:uid` | Public collaborator profile |
| `/publications` | Publication catalogue |
| `/publications/:id` | Publication details |
| `/research-ideas` | Research idea feed |
| `/research-ideas/:id` | Research idea details and discussion |
| `/gallery` | Lab and collaborator gallery |
| `/contact` | Contact page |
| `/login` | Lab-head and collaborator login |
| `/admin-login` | Primary and moderator administrator login |

### Protected routes

| Route | Access |
| --- | --- |
| `/chat` | Collaborators and lab head |
| `/collaborator-portal` | Collaborators and lab head |
| `/admin/*` | Primary administrator and authorized moderators |

Dashboard sections use stable routes such as `/admin/content`, `/admin/permissions`, `/admin/publications`, `/admin/research-ideas` and `/admin/gallery`.

## Project Structure

```text
.
├── firebase.json
├── firestore.indexes.json
├── firestore.rules
├── index.html
├── package.json
├── vercel.json
├── vite.config.ts
├── scripts/
│   ├── firestore-seed.ts
│   └── migrate-collaborators-to-uid.ts
└── src/
    ├── admin/
    │   ├── app/                 # Dashboard navigation contracts
    │   ├── components/          # Shared admin pages, dialogs and modals
    │   ├── core/                # Dashboard layer constants
    │   └── features/            # Feature entry points
    ├── chat/
    │   ├── components/          # Messenger workspace and settings
    │   ├── theme/               # Chat tokens and personal appearance
    │   ├── crypto.ts
    │   ├── hooks.ts
    │   ├── keyStore.ts
    │   ├── service.ts
    │   └── types.ts
    ├── components/              # Shared public components
    ├── context/                 # Auth, theme, editing and preview contexts
    ├── firebase/                # Firebase configuration and realtime hooks
    ├── hooks/                   # Shared application hooks
    ├── pages/                   # Public pages and detail routes
    ├── portals/                 # Admin and collaborator portals
    ├── types/
    ├── App.tsx
    ├── index.css
    └── main.tsx
```

## Local Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create the local environment file

macOS/Linux:

```bash
cp .env.example .env
```

PowerShell:

```powershell
Copy-Item .env.example .env
```

### 3. Configure client environment variables

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_MEASUREMENT_ID=

VITE_ADMIN_UID=
VITE_LAB_HEAD_UID=

VITE_CLOUDINARY_CLOUD_NAME=
VITE_CLOUDINARY_UPLOAD_PRESET=
VITE_SITE_URL=http://localhost:5173
```

All `VITE_` variables are included in the browser bundle. Never place a Firebase Admin service account, SMTP password, private server credential or Cloudinary API secret in these variables.

### 4. Start development

```bash
npm run dev
```

Open `http://localhost:5173`.

## Scripts

```bash
npm run dev      # Development server
npm run build    # TypeScript check and production build
npm run preview  # Preview the production build locally
```

## Firebase Deployment

Select the Firebase project and deploy only Firestore rules and indexes:

```bash
firebase login
firebase use syedlab-research
firebase deploy --only firestore:rules,firestore:indexes
```

Do not deploy Functions for this Spark-plan release.

Keep these files in version control:

- `firebase.json`
- `.firebaserc`
- `firestore.rules`
- `firestore.indexes.json`

Firestore rules are not secret. They must be reviewed and versioned with the application.

## Vercel Deployment

1. Import the GitHub repository into Vercel.
2. Select the Vite framework preset.
3. Use:

```text
Install Command: npm install
Build Command: npm run build
Output Directory: dist
```

4. Add every required `VITE_` variable under **Vercel → Project Settings → Environment Variables**.
5. Deploy the project.
6. Add the generated Vercel domain under **Firebase Authentication → Settings → Authorized domains**.

`vercel.json` provides the SPA rewrite needed when refreshing protected or detail routes.

## Collaborator Application and Password Setup

This release uses a Spark-plan-compatible workflow:

1. A visitor submits a collaborator request.
2. The website displays an under-review confirmation and request reference.
3. The administrator approves the request.
4. Firebase Authentication creates the account.
5. Canonical `users/{uid}` and `collaborators/{uid}` documents are created.
6. Firebase sends its standard password-reset email.
7. The approved collaborator uses that link to create the first password.

Applicants should check Inbox, Spam, Junk and Promotions folders. EmailJS, Cloud Functions and the Blaze plan are not required.

## Roles and Permissions

`users/{uid}` is the canonical authorization record:

```ts
adminLevel: "primary" | "moderator" | "none"
adminPermissions: string[]
```

The primary administrator can grant, change and withdraw moderator access from **Admin Dashboard → Roles & Permissions**. The interface shows moderator status, active permission count and the administrator who last changed access. Firestore rules enforce the same permissions. The primary administrator cannot be demoted by a moderator.

## Canonical Collaborator Data

New profiles use:

```text
collaborators/{uid}
```

The collaborator document is the canonical public identity for names, photos and profile information. The user document is canonical for authentication roles and administrative permissions.

Preview the legacy migration:

```bash
npx ts-node --esm scripts/migrate-collaborators-to-uid.ts
```

Apply it only after reviewing the report:

```bash
npx ts-node --esm scripts/migrate-collaborators-to-uid.ts --commit
```

The migration is non-destructive and preserves legacy documents for manual verification.

## Chat Security and Limitations

- Private message payloads are encrypted before being stored in Firestore.
- Private keys remain in the user's browser; public keys are stored in Firestore.
- Clearing browser storage or switching to a new device can prevent that browser from decrypting messages encrypted for an older local key.
- Messages are configured with expiry metadata.
- Deletion uses security-rule-controlled updates and batches; Cloud Functions are not required.
- Chat appearance preferences are local to the device.
- A collaborator must sign in at least once before other users can encrypt new messages for that account.

## Security Checklist

- Do not commit `.env`, `syedlab.env`, service-account JSON or Firebase Admin credentials.
- Treat every `VITE_` value as public browser configuration.
- Keep Firestore rules and indexes in Git.
- Configure the production domain in Firebase Authorized Domains.
- Create Authentication users through the approval workflow or Firebase Console.
- Keep `users/{uid}` and `collaborators/{uid}` aligned by UID.
- Test grants and withdrawals with separate accounts before production launch.
- Test chat with two different authenticated browsers.

## License

See [LICENSE](LICENSE).