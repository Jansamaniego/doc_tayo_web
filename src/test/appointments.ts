/** An appointment as the API answers it: 9:00 to 9:30 AM on 7 December 2026 in Manila. */
export function appointmentAnswer(over: Record<string, unknown> = {}) {
  return {
    id: 'ap000000-0000-4000-8000-000000000001',
    kind: 'scheduled',
    status: 'scheduled',
    branchId: 'a0000000-0000-4000-8000-000000000001',
    patient: { id: 'p1', patientNumber: 'P-000001', firstName: 'Juan', lastName: 'Dela Cruz' },
    practitioner: { membershipId: 'm1', profileId: 'pr1', displayName: 'Dr. Dan Doctor, MD' },
    service: { id: 's1', name: 'Follow-up' },
    startsAt: '2026-12-07T01:00:00.000Z',
    endsAt: '2026-12-07T01:30:00.000Z',
    reason: 'Annual check-up',
    checkedInAt: null,
    cancelledAt: null,
    cancelReason: null,
    version: 1,
    createdAt: '2026-12-06T23:40:12.345Z',
    updatedAt: '2026-12-06T23:40:12.345Z',
    ...over,
  };
}
