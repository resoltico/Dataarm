import { cleanup, render, screen } from '@testing-library/react';

import { makeDashboardState } from './fixtures';

const { useDashboardState } = vi.hoisted(() => ({
  useDashboardState: vi.fn(),
}));

vi.mock('../../src/hooks/useDashboardState', () => ({
  useDashboardState,
}));

import App from '../../src/App';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('App shell', () => {
  it('shows the empty detail placeholder when no target is selected outside draft mode', () => {
    useDashboardState.mockReturnValue(
      makeDashboardState({
        selectedDirectoryName: null,
        selectedTarget: null,
        isDraftContext: false,
      }),
    );

    render(<App />);

    expect(screen.getByText('Select a target to view details, or create a new one.')).toBeTruthy();
  });

  it('renders the detail panel for saved selections and drafts', () => {
    useDashboardState.mockReturnValue(makeDashboardState());
    const { rerender } = render(<App />);

    expect(screen.getByRole('heading', { level: 2, name: 'Demo status board' })).toBeTruthy();

    useDashboardState.mockReturnValue(
      makeDashboardState({
        selectedDirectoryName: null,
        selectedTarget: null,
        isDraftContext: true,
        editorMode: 'http',
      }),
    );
    rerender(<App />);

    expect(screen.getByText('New HTTP target')).toBeTruthy();
  });

  it('tolerates an undefined selected directory when a saved target is still present', () => {
    useDashboardState.mockReturnValue({
      ...makeDashboardState(),
      selectedDirectoryName: undefined,
    });

    render(<App />);

    expect(screen.getByRole('heading', { level: 2, name: 'Demo status board' })).toBeTruthy();
  });
});
