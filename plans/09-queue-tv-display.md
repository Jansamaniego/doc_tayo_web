# Phase 9: Waiting-room queue and TV display (outline)

Status: **outline** (revised 2026-11-20 with the owner's priority and resolution answers). Backend: **NOT planned**. Every dependency is listed in plan.md §12.4 (D-18 to D-23). The TV layout itself is designed in Phase 2 with mock data.

## Objectives

- A queue built from check-ins (Phase 7) and walk-ins.
- Reception "call next" controls.
- Doctor "next patient" controls, which open the consultation (Phase 8).
- The TV display connected to live data, with device pairing.

## Deliverables (outline)

- **Reception queue board** (tablet landscape first):
  - waiting list per doctor or room with queue numbers and wait times;
  - "Call next", "Recall", "Skip", "Move to another doctor/room", "Add walk-in";
  - each action gives feedback, and Skip asks first.
- **Doctor control:** "Call next patient" on the doctor's home and consultation screen. Calling opens the patient's consultation.
- **TV display** (`/display`):
  - pairing screen → paired display showing the layout from Phase 2 §10;
  - live updates (SSE or polling, D-22);
  - chime on call;
  - offline and stale handling;
  - daily reload and watchdog.
- **Display management** (Settings → Displays, clinic admin): pair a display by code, name it, choose branch/rooms, choose the name format (number only or first name + last initial), chime on/off, see last seen, revoke.
- **Priority lanes** (Q11, decided):
  - **Per-clinic setting**, off by default: priority for seniors, PWD and pregnant patients, and how strictly they go ahead (always first, or one in every *N* calls).
  - Reception marks priority at check-in. The category is shown to authorised staff only, because it is health-related information.
  - **The TV never reveals it:** no "PWD"/"Senior"/"Priority" label, no special prefix, colour or icon, and the same number series as everyone else.
  - A priority ticket being called earlier is the only visible effect.
  - Before release, the exact legal basis is confirmed with the clinic owners (Q11b).
- **Privacy:** the TV only receives display-safe data reduced on the server (D-21). A test asserts that the display API types have no full-name field and no priority field.

## Backend endpoints

All needed, none exist and none are planned:
- D-18 queue domain and actions;
- D-19 rooms;
- D-20 display device pairing and credential;
- D-21 display-safe queue view;
- D-22 live updates;
- D-23 rate limits for shared IPs.

## Tests (outline)

- Queue actions and their errors; concurrent "call next" from two receptionists (the server must decide; UI shows the result).
- TV:
  - updates within N seconds;
  - reconnect, and the stale state after 2 minutes;
  - chime fires once per call;
  - revoked display returns to the pairing screen;
  - full layout at 1920×1080 and 3840×2160, in English and Filipino;
  - with priority on: priority tickets are called in the configured order, and nothing on the TV (text, number format, colour, data received) differs from a normal ticket;
  - readability check from 5 m on a real TV (manual).

## Open questions

Q8b TV screen size; Q11b legal basis for priority lanes (with clinic owners); queue number format and daily reset; voice announcements in English and Filipino.
