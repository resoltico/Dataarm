import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import { DetailPanel } from '../../../src/components/dashboard/DetailPanel';
import { makeDashboardState } from '../fixtures';

afterEach(() => {
  cleanup();
});

describe('DetailPanel shell', () => {
  it('routes detail-tab clicks through the explicit panel tab strip', () => {
    const setDetailTab = vi.fn();

    render(
      <DetailPanel
        state={makeDashboardState({
          detailTab: 'changes',
          setDetailTab,
        })}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Config' }));
    fireEvent.click(screen.getByRole('button', { name: 'Artifacts' }));

    expect(setDetailTab).toHaveBeenNthCalledWith(1, 'config');
    expect(setDetailTab).toHaveBeenNthCalledWith(2, 'artifacts');
  });

  it('renders the config tab body when configuration is the active detail view', () => {
    render(
      <DetailPanel
        state={makeDashboardState({
          detailTab: 'config',
        })}
      />,
    );

    expect(screen.getByRole('button', { name: 'Preview target' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Save target' })).toBeTruthy();
  });
});
