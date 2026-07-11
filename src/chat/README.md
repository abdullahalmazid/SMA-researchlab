# Chat Module

This folder isolates all chat-related logic.

## What is included

- `types.ts`: conversation/message/encryption payload contracts
- `crypto.ts`: browser-side end-to-end encryption helpers (RSA-OAEP + AES-GCM)
- `service.ts`: Firestore chat reads/writes with 72-hour expiry fields
- `hooks.ts`: React hooks for conversations and messages subscriptions
- `components/ChatWorkspace.tsx`: reusable chat workspace UI shell

## Security and privacy notes

- Message text is intended to be encrypted before Firestore write.
- Store only encrypted payload + metadata in Firestore.
- Configure Firestore rules so only conversation participants can read/write.
- Enable Firestore TTL on `expiresAt` to auto-delete messages after 3 days.

## Next implementation step

- Add a dedicated chat route/page and connect message compose/decrypt flows.
