import type { Meta, StoryObj } from '@storybook/react-vite';

import { Button } from './button.tsx';
import { Card, CardBody, CardFooter, CardHeader } from './card.tsx';

const meta: Meta = { title: 'Components/Card' };
export default meta;
type Story = StoryObj;

export const Plain: Story = {
  render: () => (
    <Card className="max-w-md">
      <CardHeader title="Main branch" action={<Button variant="secondary">Edit</Button>} />
      <CardBody>Quezon City, Metro Manila</CardBody>
      <CardFooter>Updated today</CardFooter>
    </Card>
  ),
};
export const WholeCardIsALink: Story = {
  render: () => (
    <Card href="/branches/1" className="max-w-md">
      <CardHeader title="Quezon City Annex" />
      <CardBody>Open the branch</CardBody>
    </Card>
  ),
};
