# Phase 14: Filipino language release (outline)

Status: **outline**. Decided by the owner (Q4, Q4a): **launch in English**, build i18n from day one, ship Filipino in a later phase. Scheduled once the translator and the reviewer are named (Q4a, still open). It does not depend on Phases 5–13 and can run whenever both people are available.

## Objectives

Make the staff app and the TV display available in Filipino. No text is shipped without a native-speaker translation and a review by someone who uses the app.

## What already exists before this phase (Phases 1–2)

- Every user-facing string in Lingui message files; lint and extraction checks block hard-coded text.
- A stretched pseudo-locale in Storybook and visual tests, so layouts already take longer text.
- Error messages keyed by API `code`, with a spec checking that every `ErrorCode`/`FieldErrorCode` has a message.

## Deliverables (outline)

- **Filipino catalogue (`fil`):**
  - translated by a **native speaker** and reviewed by a **staff member at a pilot clinic** who uses the app;
  - **no unreviewed machine translation**, especially for health, consent and error text;
  - each entry carries a "reviewed" mark, and CI fails if any shipped `fil` string is missing or unreviewed (it falls back to English only during development).
- **Glossary:** key clinic and medical terms in Filipino, and which terms stay in English because clinics use them that way (Taglish).
- **Language switcher:**
  - on the sign-in page and in the user menu;
  - each option is written in its own language ("English", "Filipino"), with the current one marked by a check icon and text;
  - stored on the device until D-25 exists.
- **Dates:** `fil-PH` formats agreed with the translator; the `lib/datetime` specs are extended to them.
- **TV display:** a per-display language setting for its fixed labels ("Now serving", "Next", connection messages).
- **Patient-facing text** (portal, Phase 12) follows the same process if the portal exists by then.

## Backend endpoints

| Need                                                                                                                   | Exists |
| ---------------------------------------------------------------------------------------------------------------------- | ------ |
| D-25: per-user language preference on `GET /me` / `PATCH /me`, and Filipino email templates (reset, setup, invitation) | **no** |

Without D-25 the choice is per device, and emails stay in English. This is stated in the release notes.

## Tests (outline)

- Every `ErrorCode`/`FieldErrorCode` has a reviewed `fil` message (spec).
- Every story and key page renders in `fil` without clipping (visual tests at 100% and 200% zoom).
- Switching language changes all text and dates on the sign-in, picker and settings pages (e2e).
- The TV in `fil` at 1920×1080 and 3840×2160.
- Screen readers read Filipino pages with `lang="fil"` set on the document.

## Open questions

- Q4a: who translates and who reviews (still open).
- Default language per clinic (needs a clinic setting on the backend) or per user only?
