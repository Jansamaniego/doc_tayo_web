# Phase 2: Design system and UX foundations

Status: **planned** (draft for approval; revised 2026-11-20 with the owner's answers: shadcn/ui, warm coral and the keywords confirmed, Filipino, TV at 1080p and 2160p, queue-priority privacy). Depends on Phase 1. Backend: none.

**Approval gate:** no feature screen (Phase 3 onwards) is built until the product owner approves this phase's tokens, components, patterns and TV layout in the living style guide. Ideally two or three real users also try it, including at least one senior.

The owner has **confirmed** the third colour (warm coral, Q7) and the look-and-feel keywords (Q13). The exact values below are still proposals for review at the approval gate. Every contrast ratio below was computed with the WCAG 2.x relative-luminance formula while writing this plan. Phase 2 turns them into an automated test.

---

## 1. Objectives

1. A small set of design principles the whole team designs against.
2. Design tokens (colour, type, spacing, radius, elevation, layout, motion) in **one source file** that generates CSS variables and the Tailwind theme.
3. An accessible component library built from **shadcn/ui** (Radix primitives), resized and restyled for older users, with every state.
4. Every component and pattern works in **English and Filipino**, tested with a stretched pseudo-locale.
5. UX patterns for forms, feedback, confirmation, search, pagination and permissions.
6. Responsive rules for desktop, tablet and mobile, and a separate **TV display mode**.
7. A living style guide (Storybook) showing every token and component, with automated accessibility checks.

---

## 2. Design principles

1. **Readable from arm's length.** Large text, strong contrast, generous spacing. When in doubt, make it bigger.
2. **One clear next step.** Each screen has one primary action. Everything else is visibly secondary.
3. **Say it plainly.** Short sentences, everyday words, no jargon or codes. "Save patient", not "Submit".
4. **Words with every icon.** Icons support labels; they never replace them.
5. **Always tell people what happened.** Every action gets visible feedback: saving, saved, or what went wrong and what to do.
6. **Never lose someone's work.** Errors keep what was typed. Destructive actions ask first. Nothing times out without warning.
7. **Calm, not clinical.** A fresh, friendly look that still feels trustworthy for medical work. Colour supports meaning but never carries it alone.
8. **Private by default.** Show only the personal data the task needs, especially on shared screens.

Look-and-feel keywords (confirmed, Q13): **calm, clean, trustworthy, warm, unhurried.**

---

## 3. Colour

### 3.1 Palette

**Primary: fresh green** (hue ≈ 145°). `green-300` is the brand's light, fresh green. `green-700` is the same hue darkened for text and controls.

| Token | Hex | Contrast on bg `#F9FAF7` | Contrast on white | Allowed use |
|---|---|---|---|---|
| green-50 | `#F0FAF3` | 1.02 | 1.07 | Tinted page sections, selected-row background |
| green-100 | `#DCF3E3` | 1.12 | 1.17 | Selected/active backgrounds, success-ish highlights |
| green-200 | `#BCE8CA` | 1.29 | 1.35 | Decorative fills, hover background on light items |
| **green-300** | **`#8FD9A8`** | 1.58 | 1.66 | **Brand light green**: illustrations, header accent bar, badges *with `green-950` text* (9.31:1). Never text, borders or controls. |
| green-400 | `#5EC385` | 2.08 | 2.18 | Decorative only (charts with labels) |
| green-500 | `#38A865` | 2.88 | 3.02 | Decorative; on white only, as a non-text indicator ≥ 3:1 |
| green-600 | `#25884F` | 4.25 | 4.46 | Large text only (≥ 24 px, or ≥ 18.66 px bold) |
| **green-700** | **`#1D6E41`** | **5.97** | **6.25** | **Primary controls and green text**: primary button fill (white text 6.25:1), links, focus ring, selected-state borders |
| green-800 | `#175836` | 8.06 | 8.45 | Primary hover; AAA green text; TV "Now serving" panel |
| green-900 | `#12452B` | 10.48 | 10.98 | Primary pressed; text on green-100 (9.40:1) |
| green-950 | `#0A2A1A` | 14.75 | 15.45 | Text on brand light green |

**Background and neutrals** (slightly green-tinted greys)

| Token | Hex | On bg | Use |
|---|---|---|---|
| neutral-0 | `#FFFFFF` | | Surfaces: cards, inputs, dialogs |
| **neutral-25** | **`#F9FAF7`** | | **Off-white page background** |
| neutral-50 | `#F2F4F0` | 1.06 | Subtle sections, table header |
| neutral-100 | `#E5E9E4` | 1.17 | Disabled fills, dividers on white |
| neutral-200 | `#CED5CF` | 1.43 | Decorative dividers (never the only boundary of a control) |
| neutral-300 | `#AFB9B2` | 1.93 | Decorative only |
| neutral-400 | `#87938B` | 3.05 | Placeholder icons, decorative only (placeholder *text* is not used; see §6.1) |
| neutral-500 | `#68746C` | 4.66 | **Input and control borders** (4.88:1 on white, ≥ 3:1 non-text), disabled text on neutral-100 (3.98:1; disabled text is exempt but kept readable) |
| neutral-600 | `#515C55` | 6.66 | Muted/supporting text (hints, metadata): AA |
| neutral-700 | `#3D4741` | 9.21 | Secondary text: AAA |
| neutral-800 | `#2A322E` | 12.57 | Headings alternative |
| **neutral-900** | **`#1B211E`** | **15.63** | **Body text and headings**: AAA (16.37 on white) |

**Third colour: warm coral (confirmed, Q7)**

| Token | Hex | On bg | Use |
|---|---|---|---|
| coral-50 | `#FFF4F1` | 1.03 | Accent section background |
| coral-100 | `#FFE4DD` | 1.15 | Accent badge background (text coral-900, 8.95:1) |
| coral-200 | `#FFC7B8` | 1.42 | Illustrations; text on green-900 (7.38:1, TV accent) |
| coral-300 | `#FFA28C` | 1.86 | Illustrations |
| **coral-400** | **`#FA7F62`** | 2.42 | **Brand accent fill** (with `neutral-900` text, 6.45:1): highlights such as "New", onboarding, empty-state illustrations. Never a control boundary on its own. |
| coral-500 | `#EE6142` | 3.12 | Decorative |
| coral-600 | `#D0482B` | 4.32 | Large text only |
| coral-700 | `#A93A22` | 6.05 | Accent text if needed (white on it 6.33:1) |
| coral-800 | `#86301E` | 8.16 | AAA accent text |
| coral-900 | `#6A2919` | 10.31 | Text on coral tints |

**Rule: coral is never used to mean "error".** Coral is close to the danger red, so coral is reserved for warm, positive accents and danger always uses its own red *plus* an icon *plus* a word ("Error", "Cannot be undone"). If the owner picks another third colour, the same rule applies to any colour close to a semantic one.

**Semantic colours** (each pair passes AA; always shown with an icon and text)

| Meaning | Text / icon | Background | Border | Text on bg | Text on page bg |
|---|---|---|---|---|---|
| Success | `#1D6E41` (green-700) | `#E8F6EC` | green-700 | 5.60 | 5.97 |
| Warning | `#7A4A00` | `#FFF4D6` | `#B07400` (3.59 on its bg) | 6.83 | 7.14 |
| Danger | `#B3261E` | `#FDEDEB` | danger | 5.76 | 6.24 |
| Info | `#1F5FA6` | `#EAF2FC` | info | 5.73 | 6.18 |
| Danger button | white on `#B3261E` | | | 6.54 | |

### 3.2 Semantic tokens (what components use)

Components never use palette names directly. They use role tokens, so a palette change is one edit:

`color.bg.page` (neutral-25), `color.bg.surface` (white), `color.bg.subtle` (neutral-50), `color.bg.selected` (green-100), `color.text.default` (neutral-900), `color.text.secondary` (neutral-700), `color.text.muted` (neutral-600), `color.text.onPrimary` (white), `color.text.link` (green-700), `color.action.primary` / `.hover` / `.pressed` (green-700 / 800 / 900), `color.action.secondaryBorder` (green-700), `color.border.control` (neutral-500), `color.border.divider` (neutral-200), `color.focus` (green-700, with a white inner ring), `color.brand.light` (green-300), `color.brand.accent` (coral-400), and `color.status.{success,warning,danger,info}.{fg,bg,border}`.

### 3.3 Never colour alone

- Status always has an icon **and** a word ("Checked in", "Cancelled").
- Errors: red border **and** an icon **and** a message under the field.
- Links inside text are underlined.
- Charts (Phase 11) use labels and patterns, not colour alone.
- The style guide includes a greyscale and colour-blindness simulation view.

### 3.4 Automated contrast test

`tokens.contrast.test.ts` reads `tokens.json` and a list of **declared pairings**: every text/background and control/background combination used by components. It asserts:
- body text ≥ 7:1;
- other text ≥ 4.5:1 (large text ≥ 3:1 where declared large);
- control boundaries and focus ring ≥ 3:1 against adjacent colours.

Adding a new pairing means adding it to the list. A failure blocks CI.

### 3.5 Dark mode

Not in scope (not requested). The semantic-token layer leaves room for it later. The TV mode has its own fixed palette (§9).

---

## 4. Typography

- **Typeface: Inter** (variable, weight 100–900, with an optical-size axis). A professional, widely used UI typeface designed for screens, licensed under the SIL Open Font License, and **self-hosted** (no font CDN, which keeps the CSP strict).
- **Glyph coverage, checked in the font files while planning** (Google Fonts builds):
  - Inter 4.001 contains **₱ (U+20B1)**, **ñ** and **Ñ**, and the `tnum` (tabular figures) feature.
  - The first candidate, Atkinson Hyperlegible Next, has **no ₱**, and was dropped for that reason.
- **Telling similar letters apart:** Inter's character variants are switched on with `font-feature-settings`, so that `l`, `I` and `1` differ (candidates: `cv05`, lowercase l with tail, and `cv08`, capital I with serifs). The exact set is chosen by looking at it in the style guide and is recorded in `tokens.json`.
- **Fallback:** `"Noto Sans"` (also checked: it has ₱, ñ and `tnum`), then `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`.
- **Numbers:** tabular figures (`font-variant-numeric: tabular-nums`) in tables, times, amounts and queue numbers.
- **Subsetting:** a Latin subset that keeps ₱ (U+20B1) and Latin-1 (ñ), checked by a test that renders `₱ ñ Ñ` with the subset file.
- **Base size: 18 px** (1.125 rem on a 16 px root, so the user's browser font-size setting still scales everything). **Minimum anywhere: 16 px.**
- **Line height** 1.5 for body text, 1.25 for headings. Line length at most ~70 characters.
- Weights: 400 regular, 700 bold (600 if the font provides it, for labels). No light weights.
- All sizes in `rem`, so browser zoom and font-size settings work.

| Token | Size (px / rem) | Line height | Weight | Use |
|---|---|---|---|---|
| `text.display` | 40 / 2.5 | 1.2 | 700 | Rare: sign-in welcome, big numbers on dashboards |
| `text.h1` | 32 / 2.0 | 1.25 | 700 | Page title (one per page) |
| `text.h2` | 26 / 1.625 | 1.3 | 700 | Section |
| `text.h3` | 22 / 1.375 | 1.35 | 700 | Card title, dialog title |
| `text.bodyLarge` | 20 / 1.25 | 1.5 | 400 | Key values, important sentences |
| `text.body` | **18 / 1.125** | 1.5 | 400 | Default text, inputs, buttons |
| `text.label` | 18 / 1.125 | 1.4 | 600/700 | Form labels, table headers |
| `text.small` | 16 / 1.0 | 1.5 | 400 | Hints, metadata, dense tables. **Floor.** |

TV sizes are separate (§9).

---

## 5. Spacing, radius, elevation, layout, motion

**Spacing** (4 px base, in rem): `0`, `1`=4, `2`=8, `3`=12, `4`=16, `5`=20, `6`=24, `8`=32, `10`=40, `12`=48, `16`=64, `20`=80.
- Default gap between form fields: 24 px.
- Default gap between controls side by side: at least 12 px. With 44 px targets this avoids mis-taps, beyond WCAG 2.5.8.

**Sizing:** `control.height.md` = 48 px (default inputs/buttons), `control.height.sm` = 44 px (dense tables, the minimum), `control.height.lg` = 56 px (primary action on tablet and mobile). Touch target ≥ 44×44 px everywhere, including table row actions and links in lists (padding extends the hit area).

**Radius:** `sm` 6 px (badges, checkboxes), `md` 10 px (inputs, buttons), `lg` 16 px (cards, dialogs), `full` (pills, avatars).

**Elevation** (soft, low, green-tinted shadows; borders still carry the boundary so nothing relies on shadow):

| Token | Value | Use |
|---|---|---|
| `elevation.0` | none + 1 px neutral-200 border | Cards on page |
| `elevation.1` | `0 1px 2px rgb(27 33 30 / 0.08), 0 1px 3px rgb(27 33 30 / 0.06)` | Raised cards, sticky headers |
| `elevation.2` | `0 4px 12px rgb(27 33 30 / 0.12)` | Popovers, menus, toasts |
| `elevation.3` | `0 12px 32px rgb(27 33 30 / 0.18)` | Dialogs (plus a backdrop `rgb(27 33 30 / 0.5)`) |

**Layout grid and breakpoints** (in `em`, so zooming triggers the smaller layout, which supports WCAG reflow):

| Name | Min width | Columns / gutter / margin | Typical device |
|---|---|---|---|
| `base` | 0 | 4 / 16 px / 16 px | phone |
| `sm` | 40em (640 px) | 8 / 16 / 24 | large phone, small tablet portrait |
| `md` | 48em (768 px) | 8 / 24 / 24 | tablet portrait |
| `lg` | 64em (1024 px) | 12 / 24 / 32 | tablet landscape, small laptop |
| `xl` | 80em (1280 px) | 12 / 32 / 40 | desktop |

The maximum content width is 1280 px (reading content 720 px).

**Motion:**
- Short (150–200 ms) and only to show cause and effect.
- `prefers-reduced-motion` turns transitions off.
- Nothing flashes.
- No auto-advancing carousels.

---

## 6. Components

Components come from **shadcn/ui** (built on Radix UI primitives), added with the shadcn CLI into `src/design-system/components/` and then changed to fit this audience. Where shadcn has no suitable component (typed date and time entry, money input), we build a simple one from shadcn's `Input`/`Select`/`Label`. Every component uses only semantic tokens and has stories for **every state** plus a component test that includes axe and keyboard use.

**Changes made to every shadcn component we copy in:**

- **Size:** shadcn's defaults (`h-9` = 36 px controls, `text-sm` = 14 px) are replaced by our tokens (48 px controls, 18 px text, 44 px minimum).
- **Theme mapping:** `tokens.json` generates shadcn's CSS variables from our semantic tokens:
  - `--background` → `color.bg.page`
  - `--foreground` → `color.text.default`
  - `--primary` / `--primary-foreground` → green-700 / white
  - `--destructive` → danger
  - `--border` → divider
  - `--input` → `color.border.control` (neutral-500, so input borders meet 3:1; shadcn's default light grey does not)
  - `--ring` → focus
  - `--muted-foreground` → neutral-600
  - **shadcn's `--accent`** means "hover background", so it maps to green-50/100, **not** to coral. Coral is our own `--brand-accent`.
- **Icon-only buttons:** the Button's `size="icon"` variant is **removed**, so an icon-only button cannot be written (§8).
- **Disabled actions:** an `aria-disabled` mode is added to Button, so a disabled action stays focusable and its reason can be read (§7.6).
- **Focus ring:** the stronger focus ring below replaces shadcn's default `ring-[3px]` at 50% opacity.

**Common states:**
- default, hover, **focus-visible**, pressed/active, disabled, read-only, invalid/error, loading (where it applies).
- **Focus ring:** 3 px `green-700` outline with a 2 px offset and a 2 px white inner ring, so it is visible on both light and green backgrounds (≥ 3:1 on both). Never removed. Shown for keyboard focus (`:focus-visible`).
- **Disabled:** neutral-100 fill, neutral-500 text and border, `cursor: not-allowed`. A disabled action that the user might wonder about **always has visible text explaining why** (§7.6). Prefer `aria-disabled` on buttons so they stay focusable and the reason can be announced.

| Component | Variants / notes | States beyond the common ones |
|---|---|---|
| **Button** | `primary` (green-700, white text), `secondary` (white, green-700 border and text), `tertiary` (text style, underlined on hover), `danger` (danger red), `danger-secondary`. Sizes md/lg. Icon + label (icon optional, **label mandatory**). Full-width on mobile. | loading (spinner + "Saving…" text, keeps its width, ignores repeat presses), success flash is **not** on the button (toast instead) |
| **Link** | Inline (underlined), standalone (with arrow icon) | visited not styled differently |
| **TextField** | label above (always visible), optional hint under the label, error under the field, optional "Optional" marker (we mark optional fields, not required ones) | invalid (danger border + icon + message), read-only (no border, value as text) |
| **TextArea** | auto-grow, character counter when there is a limit ("120 of 500 characters") | same as TextField |
| **PasswordField** | "Show password" toggle **with text**; rules shown as a hint list (10–128 characters, not a common password, does not contain your email), each rule checked live where the client can know it | invalid with server codes mapped to plain words |
| **NumberField / MoneyField** | Own build on shadcn `Input`. ₱ prefix, `inputmode="decimal"`, formats on blur, never changes the value while typing | invalid, out of range |
| **Select** | shadcn `Select` (Radix) for ≤ ~15 options. **Combobox** (shadcn's Popover + Command) with filtering for longer lists (branches, doctors, ICD-10 later). *To verify with NVDA and VoiceOver in Phase 2:* that the combobox announces options and result counts; if not, it is fixed in our copy before approval. | open, option hover/selected, empty results |
| **Checkbox / CheckboxGroup, Radio / RadioGroup, Switch** | large 24 px box inside a 44 px target, the label is clickable; Switch only for settings that apply immediately | indeterminate (checkbox) |
| **DateField / DatePicker** | **DateField** (own build): three labelled parts, Month (select with month names), Day and Year (number inputs), grouped in a `fieldset` with one legend; typing always works. **DatePicker**: DateField plus an optional "Choose on calendar" button opening shadcn's `Calendar` (react-day-picker) in a Popover. The **time zone is fixed to the branch/clinic** (react-day-picker `timeZone` + `@date-fns/tz`; behaviour to verify in Phase 2). | invalid (out of range, unavailable dates), min/max |
| **TimeField** | Own build: Hour and Minute selects plus an AM/PM choice, all labelled. A list of quick time slots for scheduling (Phase 7). | invalid |
| **DateRangePicker** | Two DateFields (From, To) plus the Calendar in range mode; for reports (Phase 11) | |
| **SearchField** | label + magnifier icon, "Clear" text button, results announced ("12 patients found") | searching, no results |
| **Table** | shadcn `Table` (semantic HTML table) + **TanStack Table** for sorting state: column headers, sortable columns (sort state as text + arrow, `aria-sort`), row actions as labelled buttons (no hover-only actions); sticky header | loading (skeleton rows), empty, error, selected row |
| **List / Card list** | below `md` breakpoint tables become stacked cards showing the key fields | same as Table |
| **Pagination** | "Previous" / "Next" with text, "Page 2 of 7", page-size select; uses the API's `meta` (page, pageSize, totalItems, totalPages) | first/last page disabled with reason not needed (self-evident) |
| **Card** | header (title + optional action), body, footer | interactive card (whole card is a link) has a focus ring |
| **Dialog / Modal** | shadcn `Dialog` (Radix): title, body, footer buttons (primary on the right on desktop, stacked full width on mobile, primary first); focus trapped; `Esc` closes **unless** there are unsaved changes (then ask); returns focus to the trigger | |
| **ConfirmDialog** | shadcn `AlertDialog` (Radix) for destructive confirmation (§7.3); initial focus set explicitly on "Cancel" | danger variant |
| **Drawer / Sheet** | shadcn `Sheet` / `Drawer`: side panel on desktop, bottom sheet on mobile, for quick edits | |
| **Toast** | **Sonner** (shadcn's toast) configured: icon + text, `closeButton` on, `duration` ≥ 8 s, **errors `duration: Infinity`** (never auto-dismiss), pauses on hover. *To verify:* it also pauses on keyboard focus and announces through a polite live region; if not, our wrapper fixes it. | success, info, warning, error |
| **Alert / InlineMessage** | in-page banner for page-level states (offline, rate limit, permission note) | success, info, warning, danger |
| **Badge / StatusPill** | icon + word, used for statuses | each semantic status, neutral |
| **EmptyState** | illustration (decorative, `alt=""`), plain sentence ("No branches yet"), one primary action if the user may act | with/without action (permission-aware) |
| **LoadingState** | skeletons for lists/cards; spinner with text ("Loading branches…") for short waits; text shown after 1 s to avoid flicker | |
| **ErrorState** | plain message, "Try again" button, "Details for support" disclosure with `requestId` and a "Copy" button | |
| **PageHeader** | breadcrumb (from `md`), `h1`, one primary action, secondary actions in an overflow **with labels** | |
| **AppShell / Navigation** | shadcn `Sidebar` with its **icon-only collapse mode turned off**: side navigation on `lg+` (icons **and** labels, never collapsed to icons only), top bar with clinic switcher + user menu; bottom tab bar (≤ 5 items, labelled) on mobile; "More" sheet for the rest; current page shown by colour **and** a bar **and** `aria-current="page"` | active, hover, focus, permission-hidden |
| **ClinicSwitcher / BranchSelector** | shows current clinic and branch names in full; opens a list with statuses ("Suspended" shown and not selectable) | loading, single clinic (no dropdown, just the name) |
| **UserMenu** | name, "My account", language ("English / Filipino"), "Sign out", "Sign out on all devices" | |
| **LanguageSwitcher** | Two clearly labelled choices, each written in its own language ("English", "Filipino"); also on the sign-in page | current language marked with `aria-current` and a check icon + text |
| **InactivityWarning** | Dialog for shared devices (plan.md §5.3.1): "For privacy, you will be signed out in 60 seconds", a countdown in text, one large "Stay signed in" button, a note when a form has unsaved changes | counting down, unsaved-changes variant |
| **Tabs** | for sibling views only (Day / Week), not for steps | |
| **Stepper** | multi-step forms (rare): "Step 2 of 3: Contact details" | |
| **Tooltip** | shadcn `Tooltip` (Radix); only for *extra* information on hover/focus; never the only place essential information lives; never on disabled elements | |
| **Avatar** | initials (no photos at first) | |
| **Print layout primitives** | `PrintPage` (paper size per template), header/footer, hides the app chrome. Printed documents are **templates**, never labelled as official receipts (plan.md §15.1, Q15). | |

---

## 7. UX patterns

### 7.1 Forms

- **Labels always visible** above the field. **No placeholder text as a label.** Placeholders are not used at all; examples go in the hint ("For example: 0917 123 4567").
- Mark **optional** fields ("Optional"), not required ones. Ask only for what is needed.
- One column. Related short fields may sit side by side from `md`.
- **Validate on submit, then live:** errors are first shown when the user submits (or leaves a field they changed with an obviously wrong value); after that the field re-validates as they type, so they see it become correct.
- **Inline errors in plain language** under the field, with an icon: "Enter an email address, for example juan@example.com", not "INVALID_FORMAT".
- **Error summary** at the top on submit ("2 things need fixing"), each linked to its field; focus moves to the summary.
- **Server errors map to fields:** `details[].field` (dotted path) → `setError(field)`. The field code is translated through our catalogue (`REQUIRED`, `TOO_SHORT`, `PASSWORD_TOO_COMMON`, …). Unmapped fields go to the summary.
- **Never erase what the user typed.** Not on validation errors, not on server errors, not on a network failure. Exception: password fields after a failed sign-in keep the email and clear only the password (standard and expected).
- **Unsaved changes:** leaving a dirty form asks "Leave without saving? Your changes will be lost." with "Stay" as the default.
- The submit button names the action ("Save branch") and shows a loading state; double submit is prevented.
- **Autocomplete attributes** on every field (`email`, `current-password`, `new-password`, `name`, `tel`) so password managers and autofill help older users.
- Phone numbers: accept spaces and dashes, `+63` and `09…` forms; format on display.

### 7.2 Feedback after every action

| Action result | Feedback |
|---|---|
| Saved / created | Toast "Branch saved" + the screen shows the new state; a create returns to the item or list with the item highlighted |
| Background work (email sent) | Toast with what happens next: "Invitation sent to ana@example.com. The link works for 7 days." |
| Failed (recoverable) | Inline error at the place of action + keep input |
| Failed (server/network) | ErrorState or Alert with "Try again" and support details |
| Long action (> 1 s) | Button loading text ("Saving…"); > 5 s adds "Still working…" |

### 7.3 Destructive actions

- Confirmation dialog that names the thing and the consequence: "Remove Dr. Santos from Sunrise Clinic? They will lose access immediately."
- The confirm button repeats the verb ("Remove") in the danger style; **"Cancel" receives initial focus**.
- High-impact, irreversible actions (sign out on all devices, archive patient, finalise a record) also state "This cannot be undone" or what can be undone and how.
- Prefer **undo** (toast with "Undo", 10 s) for low-impact reversible actions where the API supports it.
- No typed-confirmation ("type DELETE") for clinic users. It is hard for older users; we reserve it for platform-admin actions.

### 7.4 Search

- A labelled search field at the top of the list.
- Results update after 300 ms of no typing, or on Enter.
- Results count announced.
- Forgiving matching is the server's job (D-11). The UI highlights matched text and shows "Did you mean…" only if the API returns it.
- Empty result: "No patients match 'Dela Crus'. Check the spelling or search by phone number." plus "Register new patient" when permitted.
- Search terms go in the URL search params only for non-personal fields. **Patient names are not put in the URL** (privacy, browser history on shared devices). The search box keeps its own state instead.

### 7.5 Pagination and lists

- Server pagination using `page`/`pageSize` and the response `meta`.
- Page and filters stay in the URL (except personal search terms, §7.4), so Back works and a refresh keeps the place.
- Default page size 20 (the API's default), options 20/50/100 (the API max is 100).
- No infinite scroll (bad for keyboard and screen-reader users and for finding one's place).

### 7.6 Permissions: hide or disable

| Situation | Pattern |
|---|---|
| No read permission for a whole area | **Hide** the navigation item; a direct URL shows "You don't have access to this page. Ask your clinic admin if you need it." |
| Can view, cannot change (for example a receptionist viewing the clinic profile) | Show the data **read-only** (values as text, not disabled inputs) with a one-line note: "Only clinic admins can change these details." |
| Action the role never performs (for example "Add branch" for reception) | **Hide** the button |
| Action temporarily unavailable (for example a rate limit or a state rule) | Show it with `aria-disabled` **and visible reason text** next to it |
| Server says `403` anyway | Inline message + refresh permissions; never a blank screen |

### 7.7 Waiting, empty and error screens

Every data view designs its **loading, empty, error, and no-permission** states before its happy path. These states are in Storybook for each feature screen.

### 7.8 Wording

- Short, active and polite. "You" for the user.
- Plain-language error catalogue keyed by API `code`.
- Dates written out (`Nov 20, 2026`), times in 12-hour with AM/PM.
- Numbers with separators. Money `₱1,234.50`.
- A **wording list** in the style guide: the preferred words ("Sign in", not "Log in" or "Login"; "Clinic", not "Tenant"; "Patient record", not "Encounter"). "Tenant" never appears in the UI.
- A **Filipino glossary** next to it, agreed with the translator (Q4a): the Filipino term for each key word, and which terms stay in English because clinics use them that way.
- Labels and buttons are written so they still work when the Filipino text is 30–50% longer. Components wrap rather than truncate, and buttons never rely on fixed widths.

---

## 8. Accessibility for older users (requirements and how they are checked)

| Requirement | Rule | Checked by |
|---|---|---|
| Touch targets | ≥ 44×44 px, spacing ≥ 12 px between adjacent targets | Story visual review; a Playwright test that measures interactive element boxes on key screens |
| Focus | Visible focus ring on everything; logical order; focus never trapped except in dialogs; focus moves to the `h1` on navigation and to the error summary on failed submit | Component keyboard tests; e2e keyboard-only flow |
| Keyboard | Everything usable without a mouse; no keyboard traps; shortcuts (if any) optional and never single-key | Component tests (`userEvent.keyboard`) |
| Zoom | 200% zoom with no loss or overlap; reflow at 320 CSS px wide; text spacing override (WCAG 1.4.12) does not break layout | Playwright screenshots at 200% and at 320 px width for every story / key screen |
| Icons | No icon-only buttons. Icons are `aria-hidden` next to a visible label. | Lint rule plus a component API that requires `children` text |
| Wording | Plain language, short sentences | Review checklist |
| Timeouts | No surprise timeouts; the access token refreshes silently; any future time limit warns ahead and offers more time | Review; the session design (plan.md §5.3) |
| Spacing | Generous, from tokens only | Lint (no raw px in classes) |
| One primary action | One `primary` button per view | Review; a story-level test that counts primary buttons per page story |
| Motion | Respects reduced motion | Story with reduced-motion emulation |
| Screen readers | Labels, landmarks, live regions for toasts and results, `aria-current`, table semantics | axe + manual NVDA/VoiceOver pass per phase |
| Colour | Contrast via token test; never colour alone | Contrast unit test + review |

---

## 9. Responsive rules

| Context | Breakpoint | Layout rules |
|---|---|---|
| **Desktop** (clinic admin, doctor's desk) | `xl` | Side nav (labelled, ~260 px) + content; tables with full columns; side-by-side detail panes allowed |
| **Tablet landscape** (reception desk) | `lg` | Side nav stays labelled (it may become a top bar plus drawer if space is tight, never icons only); large controls (`control.height.lg` for primary actions); tables keep key columns, the rest in row detail |
| **Tablet portrait** | `md` | Top bar + navigation drawer (labelled "Menu" button); forms one column; tables → cards where more than 4 columns |
| **Mobile** (doctor on the move, patient portal later) | `base`–`sm` | Bottom tab bar (≤ 5 labelled items) + "More"; cards instead of tables; sticky bottom primary action; dialogs become full-screen sheets |

Touch is assumed on every breakpoint (tablets are common at reception), so hover is never required.

---

## 10. TV display mode

A separate layout and route (`/display`), not a responsive variant of the staff app. It is designed and built as Storybook stories with **mock data** in this phase. It is wired to real data only in Phase 9, once D-18 to D-22 exist.

### 10.1 Requirements

- **Resolutions (owner's answer, Q8): landscape 1920×1080 and 3840×2160.** The layout uses viewport units, so both look the same. Whether a 4K TV's browser reports 3840×2160 CSS px or 1920×1080 at device-pixel-ratio 2 makes no difference to the layout.
- **Viewing distance 3–5 m.** Sizing rule used: character height of about 1 inch per 10 feet (≈ 4.2 cm at 5 m). On a 43" 1080p screen one CSS px ≈ 0.5 mm, so readable names need about 85 px cap height. Hence:

| Element | Size (viewport-based, values at 1080p) |
|---|---|
| "Now serving" queue number | `clamp(…)` ≈ **26 vh (~280 px)**, bold, tabular figures |
| "Now serving" display name / room | ≈ **11 vh (~120 px)** |
| "Next" list entries (number + room) | ≈ **8 vh (~86 px)** |
| Section labels ("Now serving", "Next") | ≈ **6 vh (~65 px)**, bold |
| Clock, clinic name, branch | ≈ **4.5 vh (~48 px)** |

*Assumption (Q8b, screen size not yet given): screen ≥ 43". On a smaller screen the readable distance shrinks.*

### 10.2 Layout (1080p landscape)

```
┌───────────────────────────────────────────────────────────────────────┐
│ Sunrise Clinic · Main branch                              2:45 PM     │  header, neutral-900 on neutral-25
├──────────────────────────────────────┬────────────────────────────────┤
│  NOW SERVING                         │  NEXT                          │
│  ┌────────────────────────────────┐  │  Dr. Reyes · Room 1            │
│  │   A-024     (white on green-800)│  │    A-025   A-027   A-030      │
│  │   Juan D.                      │  │  Dr. Lim · Room 2              │
│  │   → Room 2 · Dr. Lim           │  │    B-011   B-012              │
│  └────────────────────────────────┘  │  Dr. Cruz · Room 3             │
│  A-023 Room 1 · B-010 Room 3         │    C-004                       │
│  (other rooms' current calls)        │                                │
├──────────────────────────────────────┴────────────────────────────────┤
│ Please have your queue number ready.          Updated 2:45 PM  ● Live │  footer
└───────────────────────────────────────────────────────────────────────┘
```

- **Now serving:** the most recent call is large, in a `green-800` panel with white text (8.45:1). Other rooms' current calls are listed under it at "Next" size.
- **Next:** grouped **per doctor or room**, up to 3–4 entries each. Overflow shows "+3 more" (no scrolling text, no carousel).
- **Background:** off-white `neutral-25` with `neutral-900`/`green-950` text (15.63 / 14.75:1). Proposed over a dark theme because it matches the brand. *Open for review:* a dark variant (white on `green-900`, 10.98:1) may be easier on the eyes in a dim waiting room, and both are in the story set.
- **When a call happens:** the new number gets a gentle highlight for 10 s (a thick coral-200 border on green-900, 7.38:1, or a pulse with reduced-motion fallback) plus an **optional chime**. Text announces, colour only supports.

### 10.3 Privacy (Data Privacy Act of 2012)

- Shows **queue number** only, or **first name + last initial** ("Juan D.") if the clinic enables it. **Never** full names, birthdays, conditions, reasons for visit, doctor specialty that implies a condition, or any other personal data.
- The reduction happens **on the server** (D-21). The device never receives a full name, so it cannot leak through dev tools or a screenshot of the network tab.
- **Queue priority stays invisible** (Q11). The clinic may give seniors, PWD and pregnant patients priority, but the reason is health-related information. So:
  - the TV shows **no label** (no "PWD", "Senior", "Priority");
  - it uses **no special prefix, colour or icon**;
  - priority tickets come from the **same number series** as everyone else.
  The display data has no priority field at all (D-21).
- Mock data in stories uses obviously fake names.

### 10.4 Unattended operation

- **No interaction needed.** There are no buttons, the cursor is hidden after 3 s, and nothing on the page takes focus.
- **Authentication without a staff session** (D-20): the first run shows a **pairing screen** with a large pairing code ("Enter this code in DocTayo → Settings → Displays: 4F7-K2Q"). After an admin pairs it, the device keeps a display-only credential. Staff never sign in on the TV.
- **Connection lost:** keep showing the last data with a visible but calm status: "Reconnecting… last updated 2:41 PM" (amber dot + text). After 2 minutes, the "Now serving" panel dims and a note asks patients to check with reception, so stale data is not mistaken for current data.
- **All-day stability:**
  - Fixed layout, no animated backgrounds.
  - Daily reload at a quiet hour (for example 3:00 AM Manila) to clear memory.
  - Watchdog: reload if no update is received for N minutes.
  - Pixel shift of the clock region by a few px every few minutes, to reduce burn-in on OLED/plasma screens.
  - Wake Lock API (where supported) to stop the screen sleeping.
- **Chime:** optional, set per display. Browsers block audio until there is a user gesture, so the pairing screen ends with "Tap to enable sound" (or a kiosk browser flag that allows autoplay, documented in the setup guide). Soft two-tone chime, ≤ 1 s, at most once per call, no voice by default (spoken announcements in Filipino/English could be added later).
- **Language:** each display has its own language setting (English or Filipino) for its fixed labels ("Now serving" / "Kasalukuyang tinatawag", final wording from the translator).
- **Hardware recommendation:** a Chromium-based kiosk (Android TV box or mini PC with Chrome in kiosk mode) rather than the TV's built-in browser.

### 10.5 TV tokens

`tv.color.bg` (neutral-25), `tv.color.text` (neutral-900), `tv.color.nowServing.bg` (green-800), `tv.color.nowServing.text` (white), `tv.color.highlight` (coral-200 on green-900), `tv.color.status.offline` (warning), and the `tv.text.*` sizes from §10.1. All are included in the contrast test.

---

## 11. Living style guide

- **Storybook**, built in CI and published as a static site (where to host it is part of Q2b) so the owner can review and approve it by link. A toolbar switch shows every story in English, Filipino or the stretched pseudo-locale.
- **Pages:**
  - Introduction (principles, keywords, wording list).
  - **Tokens:** colour swatches with hex values and contrast ratios against their declared backgrounds; type scale; spacing; radius; elevation; breakpoints.
  - Every component with every state.
  - **Patterns:** form with server errors, destructive confirmation, empty, loading and error states, permission read-only view, pagination.
  - **App shell** at each breakpoint, with an owner and a receptionist permission set.
  - **TV display:** normal, many queues, empty queue ("No one waiting"), new call highlight, reconnecting, offline > 2 min, pairing screen, sound-enable step.
- **Addons:**
  - a11y (axe) on every story, which fails the test runner on violations;
  - viewport presets (phone, tablet portrait and landscape, desktop, TV 1080p);
  - zoom-200% and reduced-motion toggles;
  - colour-blindness simulation.
- **Token source:** `src/design-system/tokens/tokens.json` (W3C Design Tokens format) → a build script generates `tokens.css` (CSS variables plus Tailwind v4 `@theme`) and a typed `tokens.ts`. Raw hex or px values are banned in components by lint and review.

---

## 12. Backend endpoints used

None. (TV display data and pairing are backend dependencies D-18 to D-22, used in Phase 9.)

## 13. Tests (written first)

| Test | What |
|---|---|
| `tokens.contrast.test.ts` | every declared pairing meets its threshold (body ≥ 7, text ≥ 4.5, large ≥ 3, non-text ≥ 3) |
| `tokens.build.test.ts` | the generated CSS and TS match `tokens.json`; no orphan tokens |
| Component tests (one per component) | renders each state; keyboard interaction (Tab, Enter/Space, arrows, Esc); the label is associated; the error is announced (`aria-describedby`, `aria-invalid`); **axe has no violations**; the Button cannot be rendered without text (type test); the Toast error variant does not auto-dismiss; the Dialog returns focus |
| Form pattern test | server `VALIDATION_FAILED` with dotted `details[].field` puts each message under the right field, keeps all values, focuses the summary |
| Storybook test runner | every story passes axe (WCAG 2.2 AA) |
| Visual regression (Playwright on stories) | 100%, 200% zoom, 320 px width: no clipping or overlap on key components |
| Target size test | interactive elements on the AppShell and form stories have boxes ≥ 44×44 px |
| TV stories | readable at 1920×1080 and 3840×2160 (no overflow), in English and Filipino; privacy: the TV components' props type only accepts display-safe fields (no full-name field and no priority field exists) |
| Language | every component story renders in `en`, `fil` and the pseudo-locale without clipping (visual test); the LanguageSwitcher changes all text and date formats |
| Font | a test renders `₱1,234.50 Ñiño` with the subset font file and checks that no fallback glyph is used |

## 14. Acceptance criteria

- [ ] `tokens.json` contains the palette, semantic tokens, type scale, spacing, radius, elevation, breakpoints, motion and TV tokens above. The contrast test passes.
- [ ] Inter is self-hosted and subset; ₱, ñ and Ñ render from it (font test passes; screenshots in the style guide).
- [ ] Every component in §6 exists with stories for every state, and component tests pass with axe clean.
- [ ] Every story renders in English, Filipino and the pseudo-locale without clipping.
- [ ] The patterns in §7 are demonstrated as stories.
- [ ] The app shell is shown at all breakpoints for two permission sets.
- [ ] The TV display stories cover all states in §11, at 1920×1080 and 3840×2160, in both languages.
- [ ] Keyboard-only and 200% zoom pass on all stories (automated plus a manual spot check).
- [ ] At least one manual screen-reader pass (NVDA or VoiceOver) on the form, dialog, table and navigation stories.
- [ ] **The product owner has approved the style guide** (recorded with a date in this file), ideally after trying it with 2–3 real users including a senior.
- [ ] plan.md §0/§6/§10 updated; ADR-0003 (design tokens and component library) written.

## 15. Open questions

- **Q8b TV screen size**: sets the minimum type size (assumed ≥ 43").
- Light or dark TV theme (§10.2): both prepared; choose at review.
- **Q4a translator and reviewer** for the Filipino catalogue and glossary.
- Inter character variants (§4): chosen visually at review.
- Print sizes for prescriptions and receipts wait for the clinic's doctor and accountant (Q15b); only the print primitives are built in this phase.

## 16. As Built

(Filled in when the phase is implemented.)
