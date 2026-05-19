import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import { WatchRulesSection } from '../../../src/components/dashboard/targetEditor/WatchRulesSection';
import { makeDashboardState, makeDocument, makeWatchProfile } from '../fixtures';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function makeState(overrides: Partial<ReturnType<typeof makeDashboardState>> = {}) {
  let currentProfile = overrides.watchProfile ?? makeWatchProfile();
  const updateWatchProfile = vi.fn(
    (updater: (profile: typeof currentProfile) => typeof currentProfile) => {
      currentProfile = updater(currentProfile);
      return currentProfile;
    },
  );
  return {
    state: makeDashboardState({
      updateWatchProfile,
      ...overrides,
    }),
    updateWatchProfile,
    readProfile: () => currentProfile,
  };
}

function guidedDraftFixture() {
  const document = makeDocument();
  if (!document.guidedSession) {
    throw new Error('Expected the fixture document to include a guided session.');
  }
  return document.guidedSession.draft;
}

describe('WatchRulesSection', () => {
  it('hides the watch-rules surface when no watch profile exists', () => {
    const draft = guidedDraftFixture();
    render(
      <WatchRulesSection
        draft={draft}
        state={makeDashboardState({
          watchProfile: null,
        })}
      />,
    );

    expect(screen.queryByText('Checks and alerts')).toBeNull();
  });

  it('edits schedules, alert rules, delivery, folder, and pause state in plain watch language', () => {
    const draft = guidedDraftFixture();
    const profile = makeWatchProfile({
      schedule: { preset: 'every_15_minutes', customExpression: '0 9 * * 1-5' },
    });
    const { state, readProfile } = makeState({ watchProfile: profile });

    const { rerender } = render(<WatchRulesSection draft={draft} state={state} />);

    fireEvent.change(screen.getByLabelText('Check every'), {
      target: { value: 'custom' },
    });
    expect(readProfile()).toMatchObject({
      schedule: {
        preset: 'custom',
        customExpression: '0 9 * * 1-5',
      },
    });

    fireEvent.change(screen.getByLabelText('Check every'), {
      target: { value: 'daily' },
    });
    expect(readProfile()).toMatchObject({
      schedule: {
        preset: 'daily',
        customExpression: null,
      },
    });

    const customState = makeState({
      watchProfile: makeWatchProfile({
        schedule: { preset: 'custom', customExpression: null },
      }),
    });

    rerender(<WatchRulesSection draft={draft} state={customState.state} />);
    fireEvent.change(screen.getByLabelText('Custom schedule'), {
      target: { value: '0 9 * * 1-5' },
    });
    expect(screen.getByLabelText('Custom schedule')).toBeTruthy();
    expect(customState.readProfile()).toMatchObject({
      schedule: { preset: 'custom', customExpression: '0 9 * * 1-5' },
    });

    fireEvent.change(screen.getByLabelText('Alert when'), {
      target: { value: 'text_disappears' },
    });
    expect(customState.readProfile()).toMatchObject({
      alertRule: { kind: 'text_disappears' },
    });

    const textState = makeState({
      watchProfile: makeWatchProfile({
        alertRule: {
          kind: 'text_disappears',
          textOperand: null,
          numericOperand: null,
          regexPattern: null,
          ignoreTextFragments: [],
        },
      }),
    });

    rerender(<WatchRulesSection draft={draft} state={textState.state} />);
    fireEvent.change(screen.getByLabelText('Text to watch for'), {
      target: { value: 'Sold out' },
    });
    expect(textState.readProfile()).toMatchObject({
      alertRule: { textOperand: 'Sold out' },
    });

    const numericState = makeState({
      watchProfile: makeWatchProfile({
        alertRule: {
          kind: 'price_drops_below',
          textOperand: null,
          numericOperand: 7,
          regexPattern: null,
          ignoreTextFragments: [],
        },
      }),
    });

    rerender(<WatchRulesSection draft={draft} state={numericState.state} />);
    fireEvent.change(screen.getByLabelText('Numeric alert threshold'), {
      target: { value: '' },
    });
    expect(numericState.readProfile()).toMatchObject({
      alertRule: { numericOperand: null },
    });
    fireEvent.change(screen.getByLabelText('Numeric alert threshold'), {
      target: { value: '12.5' },
    });
    expect(numericState.readProfile()).toMatchObject({
      alertRule: { numericOperand: 12.5 },
    });

    const priceChangeState = makeState({
      watchProfile: makeWatchProfile({
        paused: true,
        alertRule: {
          kind: 'price_changes_by',
          textOperand: null,
          numericOperand: 12.5,
          regexPattern: null,
          ignoreTextFragments: [],
        },
      }),
    });

    rerender(<WatchRulesSection draft={draft} state={priceChangeState.state} />);
    expect(screen.getByText('Alert when the price changes by')).toBeTruthy();
    expect(screen.getByLabelText('Numeric alert threshold')).toHaveProperty('value', '12.5');
    expect(screen.getByLabelText('Paused')).toHaveProperty('value', 'true');

    rerender(
      <WatchRulesSection
        draft={draft}
        state={makeDashboardState({
          watchProfile: makeWatchProfile({
            alertRule: {
              kind: 'price_drops_below',
              textOperand: null,
              numericOperand: null,
              regexPattern: null,
              ignoreTextFragments: [],
            },
          }),
        })}
      />,
    );
    expect(screen.getByLabelText('Numeric alert threshold')).toHaveProperty('value', '');

    const regexState = makeState({
      watchProfile: makeWatchProfile({
        alertRule: {
          kind: 'regex_match',
          textOperand: null,
          numericOperand: null,
          regexPattern: null,
          ignoreTextFragments: [],
        },
      }),
    });

    rerender(<WatchRulesSection draft={draft} state={regexState.state} />);
    fireEvent.change(screen.getByLabelText('Regular expression'), {
      target: { value: 'Release [0-9]+' },
    });
    expect(regexState.readProfile()).toMatchObject({
      alertRule: { regexPattern: 'Release [0-9]+' },
    });

    fireEvent.change(screen.getByLabelText('Notify through'), {
      target: { value: 'both' },
    });
    fireEvent.change(screen.getByLabelText('Folder'), {
      target: { value: 'Release notes' },
    });
    fireEvent.change(screen.getByLabelText('Paused'), {
      target: { value: 'true' },
    });
    expect(regexState.readProfile()).toMatchObject({
      delivery: 'both',
      folderName: 'Release notes',
      paused: true,
    });

    expect(screen.getByText('Watch behavior')).toBeTruthy();
    expect(screen.getByText('Regular expression matches')).toBeTruthy();

    rerender(
      <WatchRulesSection
        draft={{ ...draft, kind: 'file' }}
        state={makeDashboardState({
          watchProfile: makeWatchProfile(),
          updateWatchProfile: regexState.updateWatchProfile,
        })}
      />,
    );
    expect(screen.getAllByText('Manual only').length).toBeGreaterThan(0);
    expect(screen.getByText('Local file watch')).toBeTruthy();
  });
});
