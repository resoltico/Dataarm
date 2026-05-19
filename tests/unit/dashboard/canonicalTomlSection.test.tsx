import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import { CanonicalTomlSection } from '../../../src/components/dashboard/targetEditor/CanonicalTomlSection';
import { makeDashboardState } from '../fixtures';

afterEach(() => {
  cleanup();
});

describe('CanonicalTomlSection', () => {
  it('toggles the technical watch contract visibility', () => {
    render(
      <CanonicalTomlSection
        state={makeDashboardState({
          draftToml: 'target_id = "release_watch"\n',
        })}
      />,
    );

    expect(screen.queryByLabelText('Canonical watch configuration')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Show technical watch contract' }));
    expect(screen.getByLabelText('Canonical watch configuration')).toHaveProperty(
      'value',
      'target_id = "release_watch"\n',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Hide technical watch contract' }));
    expect(screen.queryByLabelText('Canonical watch configuration')).toBeNull();
  });
});
