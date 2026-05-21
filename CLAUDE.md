# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server at localhost:3000
npm run build        # Production build
npm run lint         # Next.js ESLint
npm test             # Run all tests
npm run test:watch   # Watch mode

# Run a single test file
npx jest __tests__/lib/parser.test.ts
npx jest __tests__/components/ReminderList.test.tsx
```

## Architecture

**Two independent auth layers that must not be confused:**

1. **Google OAuth (GIS Token Client)** — `lib/google.ts`
   - Uses `google.accounts.oauth2.initTokenClient` (popup-based, no redirect URI)
   - **Incremental auth:** sign-in requests `openid email profile` only; Calendar (`https://www.googleapis.com/auth/calendar`) via explicit `connectCalendar()` with `include_granted_scopes: true`
   - Access token stored in localStorage with 55-min expiry; proactive silent refresh 8 min before expiry (calendar grant required)
   - `signOut()` clears local session only — does **not** call `revoke()` (use `revokeGoogleAccess()` for explicit disconnect)
   - Client ID comes from `NEXT_PUBLIC_GOOGLE_CLIENT_ID`, baked into the bundle at build time — **Vercel redeploy required after any env var change**
   - `SCOPE_VERSION` in `lib/google.ts` (`gis-v4-incremental`) — legacy tokens with email are preserved on migration

2. **Firebase Anonymous Auth + Firestore** — `app/page.tsx:181`, `lib/db.ts`
   - Anonymous sign-in runs silently on mount; satisfies Firestore `request.auth != null` rules
   - Google email is the Firestore path key (`users/{email}/reminders/`, `users/{email}/people/`), not the Firebase identity
   - New domain must be added to Firebase Console → Authentication → Authorized domains

**Data flow: localStorage is source of truth, Firestore is the sync layer**
- All reads/writes go to localStorage first (instant, offline-capable)
- `syncReminderToFirestore` / `syncPersonToFirestore` mirror changes to Firestore in the background
- `pullFromFirestore` on sign-in downloads data from other devices

**Google Calendar sub-calendar pattern** — `lib/google.ts:291`
- On sign-in, `getOrCreateThoughtfulCalendar()` finds or creates a "Thoughtful" calendar in the user's calendar list
- All calendar events are written to this sub-calendar, never to primary
- Sub-calendar ID is cached in localStorage (`thoughtful-gcal-calendar-id`); cleared on sign-out

**Key files:**
- `lib/google.ts` — all OAuth, token lifecycle, and Calendar API calls
- `lib/db.ts` — all Firestore sync logic
- `lib/parser.ts` — NLP date/recurrence extraction (chrono-node based)
- `app/page.tsx` — main page; all auth state, reminder CRUD, and Firestore sync coordination live here
- `app/person/[id]/page.tsx` — profile page
- `app/api/generate-title/route.ts` — Gemini API route for AI title generation

**Auth error handling**
- Any Calendar API 401/403 calls `clearCalendarToken()` which immediately sets `calendarConnected=false` and shows "Reconnect Calendar" button
- The Firebase cross-origin frame error logged by PostHog's session recorder is noise — PostHog tries to read the Firebase auth iframe DOM; this does not affect Firebase auth functionality

## Environment variables

```
NEXT_PUBLIC_GOOGLE_CLIENT_ID     # GIS OAuth client — must match authorized JS origins in Google Cloud Console
NEXT_PUBLIC_FIREBASE_*           # Firebase project config
GEMINI_API_KEY                   # Server-side only — Gemini title generation
```

For a new deployment domain, three things must be updated:
1. Google Cloud Console → Credentials → OAuth client → Authorized JavaScript origins (sensitive scope — may require re-verification)
2. Firebase Console → Authentication → Settings → Authorized domains
3. Vercel env vars → redeploy to bake `NEXT_PUBLIC_*` into the bundle
