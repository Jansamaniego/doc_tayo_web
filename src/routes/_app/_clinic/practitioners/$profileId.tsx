import { createFileRoute } from '@tanstack/react-router';

import { PractitionerPage } from '@/features/practitioners/record/PractitionerPage.tsx';

export const Route = createFileRoute('/_app/_clinic/practitioners/$profileId')({
  component: function Practitioner() {
    const { profileId } = Route.useParams();
    // A new id is a new record: the chosen branch and day do not carry over.
    return <PractitionerPage key={profileId} profileId={profileId} />;
  },
});
