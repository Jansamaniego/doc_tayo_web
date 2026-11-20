import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useUnsavedChanges } from './use-unsaved-changes.ts';

function Probe({ dirty }: { dirty: boolean }) {
  useUnsavedChanges(dirty);
  return null;
}

function fireBeforeUnload(): boolean {
  const event = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
}

describe('useUnsavedChanges', () => {
  it('asks the browser to confirm leaving the page while a form has unsaved changes', () => {
    render(<Probe dirty />);
    expect(fireBeforeUnload()).toBe(true);
  });

  it('does not interfere when nothing is unsaved', () => {
    render(<Probe dirty={false} />);
    expect(fireBeforeUnload()).toBe(false);
  });

  it('stops asking once the form is saved or unmounted', () => {
    const { rerender, unmount } = render(<Probe dirty />);
    rerender(<Probe dirty={false} />);
    expect(fireBeforeUnload()).toBe(false);
    rerender(<Probe dirty />);
    unmount();
    expect(fireBeforeUnload()).toBe(false);
  });
});
