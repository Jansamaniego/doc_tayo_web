# Clinical screens: frontend integration guide (Phase 5)

For the people (or AI agent) building the DocTayo web app. It covers the clinical endpoints **as each sub-phase ships**; read [frontend-integration.md](frontend-integration.md) first (sign-in, errors, environment). **The exact request and response shapes are in [openapi.json](openapi.json)**; this guide covers what that file cannot say.

| Sub-phase | Screens it unblocks | State |
|---|---|---|
| [5.1 Patients](#51-patients) | Frontend Phase 6: patient list, search, registration, edit, archive | **Available** |
| [5.2 Practitioners and directory](#52-practitioners-and-directory) | Doctor and staff pickers, doctor profiles and weekly schedules | **Available** |
| [5.2 Services catalog](#52-services-catalog) | Service picker, price list settings | **Available** |
| 5.3 Appointments | Frontend Phase 7 | Not available yet |
| 5.4 Consultations, 5.5 Prescriptions | Frontend Phase 8 | Not available yet |

**Test accounts** (after `npm run db:seed:dev`, password `dev-password-change-me-123`): in Sunrise Clinic, `reception@sunrise.test`, `doctor@sunrise.test` and `owner@sunrise.test` can all read and manage patients; `multi@doctayo.test` sees a different patient list in each clinic after switching. The seed registers 8 patients in Sunrise (accents, a child with a guardian, a likely duplicate pair with the same phone, one archived) and 2 in Lakeside.

## Rules that apply to every clinical request

- **Send `X-Expected-Tenant-Id: <active clinic id>`** on every request once the clinic is known. If another tab switched clinics, the API answers `409 TENANT_MISMATCH` and does nothing; reload the app state. Never send it empty ([api-conventions.md](api-conventions.md)).
- **Send an `Idempotency-Key`** (a fresh UUID per user action, **reused for retries of the same action**) on requests that create things. A double tap or a retry after a timeout then registers one patient, and you get the first answer again. The same key with a different body is `422 IDEMPOTENCY_KEY_REUSED`; while the first is still running, `409 IDEMPOTENCY_KEY_IN_USE` (wait `Retry-After` seconds and send the same request again). Only successful requests are remembered: after an error, send the corrected request with the same or a new key.
- **Every edit sends the `version` you read.** `409 VERSION_CONFLICT` means someone saved first: reload the record, show the user what changed, and let them redo the edit. The error does not carry the new version; `GET` the record.
- **Clinical responses are never cached** (`Cache-Control: no-store`). Do not persist patient data in the browser beyond the screen that shows it.
- Decide what to show from `GET /me` → `permissions`, not from role names: `patients.read` (list, search, view) and `patients.manage` (register, edit, archive). All five default roles hold both.

## 5.1 Patients

| Screen | Call |
|---|---|
| Patient list and search box | `GET /patients?q=&includeArchived=&page=&pageSize=` |
| Registration form (as you type) | `GET /patients/possible-duplicates?firstName=&lastName=&birthDate=&phone=` |
| Registration form (submit) | `POST /patients` with an `Idempotency-Key` |
| Patient page | `GET /patients/:patientId` |
| Edit | `PATCH /patients/:patientId` with `version` |
| Archive / restore | `POST /patients/:patientId/archive` (`reason`, `version`) and `/unarchive` (`version`) |

### The patient

`id`, `patientNumber` (`P-000123`, unique **within the clinic**, shown to staff and printed on slips), `firstName`, `middleName`, `lastName`, `suffix`, `sex` (`female`, `male`, `unknown`), `birthDate` (`YYYY-MM-DD`, a date and never a time: do not run it through a time zone), `phone` (always `+639171234567`-style), `email`, `addressLine`, `city`, `province`, `guardianName`, `guardianPhone`, `allergies`, `notes` (non-clinical, for the front desk), `archivedAt`, `archiveReason`, `version`, `createdAt`, `updatedAt`. A patient response never contains clinical records (those come with 5.4) and never the ids of the staff who created or changed it.

Only `firstName` and `lastName` are required. Leave an optional field out, or send `null` or blank text, for "no value". `sex` defaults to `unknown`.

### Phones, emails and dates

- **Phones**: type them any way people do (`0917 123 4567`, `0917-123-4567`, `+63 917 123 4567`); the API stores and returns `+639171234567`. Other countries need the `+` and 7 to 15 digits. Anything else, **a landline written without `+` included**, is `400` with `phone: INVALID_FORMAT`: for such numbers show a hint to add the country code. Search accepts the same formats.
- **Email**: stored lower-case.
- **Birth date**: a real calendar date from 1900 to tomorrow (UTC; the extra day is for clinics ahead of UTC). Impossible dates (`2020-02-30`) are `INVALID_VALUE`, out-of-range ones `OUT_OF_RANGE`. Do not pre-fill today's date.

### Searching

`q` is one box for everything; the API decides what it is:

| The user types | It is | Matching |
|---|---|---|
| `P-000123`, `p-123`, `P123` | a patient number | exact |
| `0917 123 4567`, `+63 917 123 4567` | a phone number | exact, any format |
| `dela crus`, `jose pena`, `cruz` | a name | tolerates typos and accents; any **word** of the name may start the text; best match first |

Bare digits such as `123` are not a patient number (they could be a phone or a year). Without `q` the list is by last name. Archived patients are hidden unless `includeArchived=true`. `pageSize` is 1 to 100 (default 20). A very long `q` (over 100 characters) is `400`. Search text is personal data: it is never logged by the API, so do not put it in your own analytics either. Search with a 250 to 300 ms debounce; the server answers in about 10 ms for a large clinic.

### Possible duplicates

While the front desk types a new patient, call `GET /patients/possible-duplicates` with whatever is filled in. It returns **at most five** `{ reason, patient }`: `same_phone`, or `similar_name_same_birth_date` (needs first name, last name and birth date). Archived patients are included (a returning patient was probably registered before). **It never blocks registration**: show the candidates ("Is this the same person?") and let the user continue or open the existing record. A half-typed phone is ignored rather than rejected; encode `+` as `%2B` in a query string. An empty result is `200` with `[]`.

### Registering

`POST /patients` answers `201` with the patient and its `patientNumber`. Registering the same person twice is allowed (that is why duplicates are only a warning); use `Idempotency-Key` to prevent accidental double taps. A patient with a validation problem is `400 VALIDATION_FAILED` with `details[]` per field (`firstName: REQUIRED`, `birthDate: OUT_OF_RANGE`, `phone: INVALID_FORMAT`, ...). Unknown fields are refused (`UNKNOWN_FIELD`), including `patientNumber`, `version` and `archivedAt`: they cannot be set.

### Editing

`PATCH /patients/:patientId` with `version` and **only the fields that changed** (`null` clears an optional field; a name cannot be cleared). `200` returns the patient with the next `version`. A patch that changes nothing keeps the version. You may edit an archived patient's details.

### Archiving

Patients are never deleted. `POST .../archive` with `reason` (required, up to 200 characters, for staff) and `version` hides the patient from the list and from search (unless `includeArchived=true`); `POST .../unarchive` with `version` brings them back. Archiving an archived patient, or restoring one that is not archived, is `409 CONFLICT`. An archived patient can still be opened by id.

### Errors you will see here

| Code | When | What the screen does |
|---|---|---|
| `VALIDATION_FAILED` | Bad or missing field | Show each `details[].message` at its field |
| `NOT_FOUND` | Unknown id, **or a patient of another clinic** (the API never says which) | "We could not find this patient" |
| `VERSION_CONFLICT` | Stale `version` | Reload and ask the user to repeat the edit |
| `CONFLICT` | Archive/unarchive in the wrong state | Reload the patient |
| `IDEMPOTENCY_KEY_REUSED` / `_IN_USE` / `_INVALID` | See the rules above | Fix the client; these are programming errors except `_IN_USE` |
| `TENANT_MISMATCH` | Another tab switched clinics | Reload |
| `FORBIDDEN` | The role lacks `patients.read` or `.manage` | Hide the control; this should not happen for the five default roles |

## 5.2 Practitioners and directory

Who sees what: `directory.read` (all five default roles) covers the directory, profiles and availability; `practitioners.manage` (owner, clinic admin) creates and edits profiles and schedules. Hide the management controls from everyone else.

| Screen | Call |
|---|---|
| Any staff or doctor picker | `GET /directory?practitionersOnly=&branchId=&page=&pageSize=` |
| Doctor profile | `GET /practitioners/:profileId` |
| Make a member a doctor | `POST /practitioners` (`membershipId`, `displayName`, optional `specialization`, `prcLicenseNumber`, `ptrNumber`) |
| Edit, deactivate, reactivate | `PATCH /practitioners/:profileId` (`isActive`) |
| Edit the weekly schedule | `PUT /practitioners/:profileId/schedule` (`blocks`) |
| Free hours of a day | `GET /practitioners/:profileId/availability?branchId=&date=` |
| "My schedule" | `GET /me` → `practitionerProfileId` |

### Directory

Active staff only, by name: `membershipId`, `fullName`, `jobTitle`, `roles` (`key`, `name`) and `practitioner` (`profileId`, `displayName`, `specialization`, `isActive`) or `null`. No e-mail addresses (use `GET /members` on the staff screens, which needs `members.read`). It is paginated (`pageSize` up to 100) and never cached.

- `practitionersOnly=true`: only members with an **active** profile. Use it for doctor pickers.
- `branchId=`: only active practitioners who have a schedule block at that branch.
- Without either, a deactivated profile still shows with `isActive: false`, so an admin can find it and reactivate it. Never offer it for booking.

### Profiles

`displayName` is how the doctor is printed ("Dra. Ana Cruz, MD"), separate from the account name. Only an active member can get a profile (`409 CONFLICT` otherwise), and only one per member (`409 CONFLICT_UNIQUE`). A role does not make a profile: giving someone the Doctor role does not create one. Profiles are never deleted; deactivate them. A patch sends only the fields that change (`null` clears an optional one); there is no `version`.

### Weekly schedule

`PUT` sends the **whole week**: `{ "blocks": [{ "branchId", "weekday", "startsAt", "endsAt" }] }`. `weekday` is 1 (Monday) to 7 (Sunday); times are `HH:mm` in the branch's wall clock, `endsAt` may be `24:00`; up to 50 blocks; `[]` clears the week. Blocks of the same weekday must not overlap, even at different branches; back-to-back is fine. A bad block is `400 VALIDATION_FAILED` with `details[].field` such as `blocks[1].startsAt`; an inactive branch is reported at `blocks[i].branchId`; an unknown branch is `404`. The response is the profile with the saved week. If two people save at once, the later save wins completely.

### Availability

`date` is `YYYY-MM-DD`, a day in the **branch's** zone. The answer is `{ date, timeZone, intervals: [{ startsAt, endsAt }] }` with UTC instants; show them in `timeZone`. It is **informational**: booking outside these hours is allowed. **Booked appointments are not subtracted yet** (they arrive with 5.3), so do not present the intervals as free slots. A deactivated profile or a suspended member has no intervals.

### `GET /me`

`practitionerProfileId` is your own active profile in the active clinic, or `null` (no active clinic, no profile, or a deactivated one). Read it again after switching clinics.

**Seeded data:** `doctor@sunrise.test` is a practitioner (Mon–Fri 09:00–12:00 and 13:00–17:00 at Main, Saturday morning at the annex); in Lakeside, `multi@doctayo.test` is one (Mon, Wed, Fri). The Sunrise owner and admin have no profile.

## 5.2 Services catalog

What the clinic offers, how long it usually takes and the price the desk quotes. **DocTayo takes no payments**: patients pay at the desk (cash, GCash and so on), so show prices as information, never as a checkout.

Who sees what: `services.read` (all five default roles) lists and views; `services.manage` (owner, clinic admin) adds and edits. Hide the management controls from everyone else.

| Screen | Call |
|---|---|
| Service picker | `GET /services?pageSize=100` |
| Price list settings | `GET /services?includeInactive=true&page=&pageSize=` |
| One service | `GET /services/:serviceId` |
| Add | `POST /services` (`name`, `defaultDurationMinutes`, optional `description`, `price`) |
| Edit, deactivate, reactivate | `PATCH /services/:serviceId` (`isActive`) |

- A service is `{ id, name, description, defaultDurationMinutes, price, currency, isActive, createdAt, updatedAt }`. Lists are ordered by name ignoring case and paginated (`pageSize` up to 100). `includeInactive` is `false` unless sent.
- **Money is a string.** `price` comes back with two decimals (`"500.00"`). Send a string with up to two decimals and no commas or symbols (`"500"`, `"500.50"`); a JSON number is `400 VALIDATION_FAILED`. Do not do arithmetic on it with floating-point numbers.
- `price: null` means **no fixed price** (show "price at the desk"); `"0.00"` means free. `currency` is always `PHP` and cannot be sent.
- `defaultDurationMinutes` is a whole number from 5 to 480. It is only a suggestion for the appointment length.
- Names are unique per clinic **ignoring case** (`409 CONFLICT_UNIQUE`; show it under the name field).
- Services are never deleted. Deactivate one to take it out of pickers; reading it by id still works, so old records can show its name.
- A patch sends only the fields that change (`null` clears `description` or `price`); there is no `version`, so the later save wins. `POST /services` takes no `Idempotency-Key`: if a retry answers `409 CONFLICT_UNIQUE`, reload the list.
- Every clinic starts with **General consultation** (30 minutes, no price). It is an ordinary service: it can be renamed, priced or deactivated.

**Seeded data:** Sunrise has General consultation (no price), Follow-up, Pediatric check-up, Wound dressing and an inactive Medical certificate; Lakeside has General consultation and Vaccination.

