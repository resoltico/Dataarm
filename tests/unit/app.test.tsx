import { render, screen } from '@testing-library/react';

const { useDashboardState } = vi.hoisted(() => ({
  useDashboardState: vi.fn(),
}));

vi.mock('../../src/hooks/useDashboardState', () => ({ useDashboardState }));
vi.mock('../../src/components/layout/TopBar', () => ({
  TopBar: () => <div data-testid="top-bar" />,
}));
vi.mock('../../src/components/layout/NavSidebar', () => ({
  NavSidebar: () => <div data-testid="nav-sidebar" />,
}));
vi.mock('../../src/components/dashboard/TargetTable', () => ({
  TargetTable: () => <div data-testid="target-table" />,
}));
vi.mock('../../src/components/dashboard/DetailPanel', () => ({
  DetailPanel: ({
    state,
  }: {
    state: { editorMode: string; selectedDirectoryName: string | null };
  }) => (
    <div data-testid="detail-panel">
      {state.selectedDirectoryName ?? `draft:${state.editorMode}`}
    </div>
  ),
}));

import App from '../../src/App';

function makeState(overrides: Record<string, unknown> = {}) {
  return {
    selectedDirectoryName: null,
    isDraftContext: false,
    editorMode: 'existing',
    ...overrides,
  };
}

describe('App', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('shows the placeholder when no target is selected and no draft is active', () => {
    useDashboardState.mockReturnValue(makeState());

    render(<App />);

    expect(screen.getByTestId('top-bar')).toBeTruthy();
    expect(screen.getByTestId('nav-sidebar')).toBeTruthy();
    expect(screen.getByTestId('target-table')).toBeTruthy();
    expect(
      screen.getByText('Select a watch to view its checks and history, or add a new one.'),
    ).toBeTruthy();
    expect(screen.queryByTestId('detail-panel')).toBeNull();
  });

  it('renders the detail panel for selected targets and draft contexts', () => {
    useDashboardState.mockReturnValue(makeState({ selectedDirectoryName: 'status_board' }));
    const { rerender } = render(<App />);

    expect(screen.getByTestId('detail-panel').textContent).toContain('status_board');

    useDashboardState.mockReturnValue(makeState({ isDraftContext: true, editorMode: 'file' }));
    rerender(<App />);

    expect(screen.getByTestId('detail-panel').textContent).toContain('draft:file');
  });

  it('falls back to the defensive empty target key when a non-draft detail state has no directory id', () => {
    useDashboardState.mockReturnValue(
      makeState({
        selectedDirectoryName: undefined,
        isDraftContext: false,
      }),
    );

    render(<App />);

    expect(screen.getByTestId('detail-panel')).toBeTruthy();
  });
});
