# Thoughtful

> Your guide to building beautiful relationships by being thoughtful.

Thoughtful is a relationship-aware reminder app that helps you stay connected with the people who matter. Create reminders in plain language, manage contact profiles, sync with Google Calendar, and get notified at the right time to reach out.

---

## Features

### Natural Language Reminder Creation

Type reminders the way you think — no forms, no dropdowns.

- **Plain text input:** `"Call Mom next Friday at 2pm"` → parses date, time, and creates reminder
- **Relative dates:** today, tomorrow, next week, in 3 days
- **Absolute dates:** March 15, Dec 25
- **Time:** 9am, 14:00, noon
- **Recurrence:**
  - `"every week"`, `"monthly"`, `"yearly"`
  - `"every other Friday"`
  - `"last Saturday of every month"`
  - `"15th of every month"`
  - `"every 3 days"`
  - `"until June"` — sets an end date
- **Birthdays:** `"Mom's birthday March 15"` → yearly recurring with 1-day advance reminder
- **Anniversaries:** `"Anniversary June 10"` → yearly with advance reminder
- **Update:** `"update call mom to 4pm"` → edits existing reminder in place

If no date is found in your text, a date picker opens automatically.

---

### AI-Generated Titles

After parsing, reminders are rewritten into warm, natural language using Google Gemini 1.5 Flash.

- `"call mom"` → `"A gentle nudge to call Mom"`
- `"dentist friday"` → `"Heads up — dentist appointment Friday"`

Falls back to smart regex extraction if AI is unavailable.

---

### Google Calendar Two-Way Sync

Reminders sync to your primary Google Calendar and stay in sync automatically.

**Creating:**
- New reminder → Google Calendar event created immediately
- Recurring reminders use RRULE syntax (weekly, monthly, yearly, etc.)
- Calendar reminders set automatically: 1-day before birthdays, 10 minutes before regular events

**Updating:**
- Edit a reminder → Calendar event updated
- If reminder has no calendar event yet, one is created

**Deleting:**
- Delete reminder → Calendar event removed

**Detecting external changes:**
- When you return to the app (tab focus or visibility change), the app checks Google Calendar for any changes made elsewhere
- If an event was renamed or rescheduled externally, the reminder updates automatically
- A notification banner appears: `"Calendar update: rescheduled to 4:00 PM"`
- Polling is debounced to at most once every 30 seconds

**Google Meet:**
- When creating from a template, optionally add a Google Meet link to the calendar event
- If the person has an email saved, they receive a calendar invite

---

### Profile System

Every person you mention can have a profile.

**Auto-detection:** When you type a reminder like `"Call Sarah"` or `"Send Mom flowers"`, the app detects the name and offers to create a profile.

- Relationship terms (mom, sister, partner) → high-confidence, auto-linked
- Proper nouns in context (Call Sarah) → prompts confirmation modal

**Each profile stores:**
- Name
- Relationship type: Family / Close Friend / Friend / Work / Other
- Birthday (optional, triggers automatic birthday reminders)
- Email (for Google Calendar invites)
- Phone number (for WhatsApp, format: `919962593404` — no spaces or `+`)
- All linked reminders

**Profile page shows:**
- Upcoming reminders (sorted by date)
- History (past reminders)
- Care action templates
- Contact details with inline editing

---

### Care Action Templates

On each profile page, suggested reminder templates are shown based on the person's relationship type.

| Relationship | Templates |
|---|---|
| Family | Weekly call, Birthday gift (7 days before), Monthly check-in |
| Close Friend | Weekly catch-up, Monthly hangout, Birthday reminder, Bi-monthly plans |
| Friend | Monthly catch-up, Quarterly check-in, Birthday reminder |
| Work | Quarterly check-in, Monthly update, Event wishes |
| Other | Monthly check-in |

Click any template → confirm date, time, recurrence → optionally add Google Meet → reminder created and synced to calendar.

"Show all" expands every template regardless of relationship type.

---

### WhatsApp Integration

- Every reminder card shows a WhatsApp icon
- Clicking it opens a direct WhatsApp chat with the linked person
- Phone number is looked up from: the reminder itself → linked person's profile → person name match → text content match
- Browser notifications include a WhatsApp prompt: `"Click to reach out to Sarah on WhatsApp for Call Sarah"`

---

### Browser Notifications

The app checks Firestore every 60 seconds for due reminders.

- Reminder triggers at the set time → browser notification appears
- Clicking the notification opens WhatsApp (if phone number available) or brings the app to focus
- Notifications marked as triggered in Firestore — no duplicates across devices or tabs
- Notification permission is requested on first use

---

### Progressive Web App (PWA)

- Installable on iOS, Android, and desktop
- Works offline with service worker caching (network-first strategy)
- Standalone display mode (no browser chrome)
- App icon and splash screen included

---

### Google Sign-In & Auth

- Sign in with Google to enable Calendar sync and cross-device data
- OAuth 2.0 scopes: Google Calendar events + email
- Token stored locally with 50-minute expiry window
- Silent token refresh (`prompt: ''`) keeps you logged in without a popup
- If refresh fails, a "Reconnect Calendar" button appears — local data is never affected

---

### Multi-Device Sync (Firestore)

- **localStorage** is the primary data store — instant, offline-capable
- **Firestore** mirrors all data in the background under `/users/{email}/reminders/` and `/users/{email}/people/`
- On a new device: data pulls automatically from Firestore on sign-in
- On edits: every change syncs immediately to Firestore
- On sign-in: full sync pushes any local-only items to the cloud

---

### Reminder History

**Main page:**
- **Upcoming:** All future, non-completed reminders, sorted by date
- **History:** Past reminders and manually completed reminders — toggle show/hide

**Profile page:**
- **Upcoming tab:** Upcoming reminders for that person
- **History tab:** All past reminders for that person

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router, TypeScript) |
| Styling | Tailwind CSS 3.4 with custom design system |
| Date Parsing | chrono-node 2.9 |
| AI Titles | Google Gemini 1.5 Flash |
| Auth & Calendar | Google OAuth 2.0 + Calendar API v3 |
| Database | Firebase Firestore |
| Notifications | Web Notifications API + Service Worker |
| Analytics | PostHog |
| Deployment | Vercel |

---

## Design System

**Colors:** Terracotta palette — `terra` (#D4756A), `cream` (#FEFAF9), `blush-pale` (#FBE8E4)

**Fonts:** Dancing Script (logo/headings) + DM Sans (body)

**Shapes:** Pill-shaped inputs and buttons, `rounded-2xl` cards

**Animations:** Spring-curve fade-up entrances, scale-in modals, staggered list items

---

## Environment Variables

Create a `.env.local` file:

```env
# Google OAuth (required for Calendar sync)
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_client_id

# Firebase (required for cross-device sync)
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# Gemini AI (optional — falls back to regex if missing)
GEMINI_API_KEY=your_gemini_api_key
```

---

## Getting Started

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build
```

Open [http://localhost:3000](http://localhost:3000).

---

## Project Structure

```
thoughtful-web/
├── app/
│   ├── page.tsx                  # Main page — reminders, input, sign-in
│   ├── person/[id]/page.tsx      # Profile page — contact details, templates
│   ├── api/generate-title/       # Gemini API route for AI titles
│   └── globals.css               # Global styles and font imports
├── components/
│   ├── ReminderInput.tsx          # Pill-shaped input
│   ├── ReminderList.tsx           # Upcoming + history lists
│   ├── RelationshipsSidebar.tsx   # Profiles drawer
│   ├── CareActionsPanel.tsx       # Template browser
│   ├── DatePickerModal.tsx        # Date fallback modal
│   ├── TemplateConfirmationModal.tsx
│   ├── RelationshipTypeModal.tsx
│   ├── PersonConfirmationModal.tsx
│   └── ServiceWorkerRegister.tsx
├── lib/
│   ├── parser.ts                  # NLP date + recurrence extraction
│   ├── google.ts                  # OAuth + Calendar API
│   ├── ai.ts                      # Gemini title generation
│   ├── db.ts                      # Firestore sync helpers
│   ├── people.ts                  # Profile CRUD (localStorage)
│   ├── templates.ts               # Care action templates
│   ├── reminderEngine.ts          # Notification polling + trigger
│   ├── personDetection.ts         # Name extraction from reminder text
│   └── types.ts                   # TypeScript interfaces
└── public/
    ├── sw.js                      # Service worker
    └── manifest.json              # PWA manifest
```

---

## How Reminders Work End-to-End

```
1. User types: "Call Sarah next Thursday at 3pm"

2. parseReminder() extracts:
   - date: next Thursday, 3pm
   - no recurrence

3. detectNamesInText() finds "Sarah" (proper noun in context)

4. generateTitle() → "A nudge to call Sarah"

5. Reminder saved to localStorage

6. PersonConfirmationModal: "Is this about Sarah? Create profile?"
   → Yes → profile created + reminder linked

7. createCalendarEvent() → Google Calendar event at Thu 3pm

8. calendarHtmlLink stored on reminder → calendar icon shown on card

9. syncReminderToFirestore() → backed up to cloud

10. At Thu 3pm → reminderEngine fires browser notification
    → "Click to reach out to Sarah on WhatsApp for A nudge to call Sarah"
    → User clicks → wa.me/Sarah opens
```
