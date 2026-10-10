# Chat Module

End-to-end encrypted direct and group messaging for collaborators and the lab head.

## Files

- `types.ts` — conversation, message, key and attachment shapes
- `crypto.ts` — RSA-OAEP + AES-GCM message encryption, passphrase key backup (PBKDF2), file encryption
- `keyStore.ts` — works out whether this browser can use chat yet (`setup`, `create-backup`, `unlock`, `ready`)
- `service.ts` — every Firestore read and write
- `envelope.ts` — message envelope (text + optional encrypted file), unread / presence / typing helpers
- `attachments.ts` — encrypted upload to and download from Cloudinary
- `hooks.ts` — React subscriptions (conversations, messages, member keys, presence)
- `useChatNotifications.ts` — site-wide unread count, tab title and desktop notifications
- `components/` — `ChatWorkspace` (the screen) and its parts

## How keys work

Each member has an RSA key pair. The public key is published in `chatPublicKeys/{uid}`. The
private key is kept in this browser's localStorage and backed up in `chatKeyBackups/{uid}`,
encrypted with the member's chat passphrase. The passphrase never leaves the browser.

A new device or a cleared browser restores the key with the passphrase, and old messages stay
readable. Nothing ever re-keys an account silently. "Forgot your passphrase?" starts a new key
after a confirmation, and messages sent to the old key then become unreadable.

Each message is encrypted once with a fresh AES key, and that key is wrapped for every member.
List previews (`previewByUser`) are encrypted the same way.

## Data model

`privateChats/{id}`. Direct chats use the id `<uidA>__<uidB>` (sorted). Groups use a random
id plus `title`, `admins` and `createdBy`. Per-member state is stored in maps keyed by uid
(`readAt`, `typingBy`, `mutedBy`, `clearedAtBy`), and the rules let a member change only
their own key. Unread means `lastMessageAt > readAt[uid]` and the last sender is someone else.

`privateChats/{id}/messages/{id}`. `createdAt` is a server timestamp. `reactions` is
uid → emoji. Only the sender can edit or delete for everyone.

## Deploying

1. Deploy the rules: `firebase deploy --only firestore:rules`.
2. Firebase console → Firestore → TTL: add a policy on collection group `messages`, field
   `expiresAt`. Without it, messages never actually get deleted. The app hides expired
   messages either way.
3. File sharing uploads encrypted bytes to Cloudinary as `raw` files. The unsigned upload
   preset in `VITE_CLOUDINARY_UPLOAD_PRESET` must allow the raw resource type. Encrypted files
   aren't covered by the Firestore TTL.

## Limits

- No backend, so there's no email or push to members who are offline. Notifications appear
  only while the site is open in a tab.
- Members added to a group can't read messages sent before they joined.
- Groups are capped at 50 members.
