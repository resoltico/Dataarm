import { makeDocument, makeWatchProfile } from './fixtures';
import { resetDraftAction } from '../../src/hooks/dashboardState.actions';

describe('dashboardState actions', () => {
  it('resets the draft to the editor baseline and recreates the default watch profile when no baseline profile exists', () => {
    const document = makeDocument();
    const applyEditorState = vi.fn();
    const setDirty = vi.fn();
    let nextProfile = null;
    const updateWatchProfile = vi.fn(
      (updater: (profile: ReturnType<typeof makeWatchProfile>) => unknown) => {
        nextProfile = updater(makeWatchProfile());
        return nextProfile;
      },
    );

    resetDraftAction({
      workspaceLoading: false,
      openingWorkspace: false,
      loadingTarget: false,
      selectedDirectoryName: 'demo_status_board',
      selectedTarget: null,
      workspaceSummary: null,
      workspaceInput: '',
      hasUnsavedWork: true,
      editorContext: {} as never,
      newTargetContext: {} as never,
      workspaceLifecycleContext: {} as never,
      beginWorkspaceUpdate: () => 1,
      isCurrentWorkspaceUpdate: () => true,
      hydrateWorkspaceSnapshot: async () => {},
      setFeedback: vi.fn(),
      setDirty,
      applyEditorState,
      cloneBaselineSession: () => document.guidedSession,
      cloneBaselineWatchProfile: () => null,
      editorBaselineToml: document.canonicalToml,
      updateGuidedDraft: vi.fn(),
      updateWatchProfile,
      addCanonicalizerToDraft: vi.fn(),
      updateCanonicalizerInDraft: vi.fn(),
      removeCanonicalizerFromDraft: vi.fn(),
    });

    expect(applyEditorState).toHaveBeenCalledWith(document.guidedSession, document.canonicalToml);
    expect(updateWatchProfile).toHaveBeenCalledTimes(1);
    expect(nextProfile).toMatchObject({
      schemaName: 'dataarm.watch_profile',
      paused: false,
      schedule: {
        preset: 'every_15_minutes',
        customExpression: null,
      },
      delivery: 'in_app',
    });
    expect(setDirty).toHaveBeenCalledWith(false);
  });
});
