# Phase 10: Billing and payments (outline)

Status: **outline**. Backend: **backend Phase 6, not available** (D-12, D-16).

## Objectives

- Invoices from services and consultations.
- Senior Citizen and PWD discounts.
- Partial payments and refunds.
- Printable receipts.
- All amounts in ₱.

## Deliverables (outline)

- **Invoice from a visit:** line items (services, consultation fee), subtotal, discount line(s), VAT treatment shown as the server computed it, total, paid, balance. All computation is **server-side**; the UI only displays it.
- **Senior Citizen / PWD discount:** select the discount and record the ID number as the API requires. The breakdown is shown clearly.
- **Payments:**
  - record a payment (cash and others as the API defines), with partial payments allowed and the balance shown;
  - each payment action is confirmed and gives feedback;
  - uses `Idempotency-Key` if the backend supports it.
- **Refunds:** confirmation with the amount and reason; shown in history.
- **Receipt:** a **printable template only**. Until a clinic's accountant confirms the BIR rules for official receipts and invoices (which have changed in recent years), it is **never presented as an official receipt**: no "Official Receipt" title, no OR number series. A clear title such as "Payment summary" is proposed. See plan.md §15.1, Q15.
- Money input: MoneyField (Phase 2) with ₱ prefix; never floats in the client (D-12).

## Backend endpoints

All needed, none exist (D-12 money representation, D-16 invoices, discounts, payments, refunds, receipts).

## Tests (outline)

Peso formatting edge cases (0, centavos, large amounts), partial payment balances as returned by the API, refund confirmation, print snapshot, permission variants, cross-clinic isolation.

## Open questions

Q15b (BIR rules, to be confirmed by a clinic's accountant; this plan gives no legal advice); payment methods (GCash/Maya?); PhilHealth/HMO billing (out of scope unless requested).
