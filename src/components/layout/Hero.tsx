import type { useDashboardState } from '../../hooks/useDashboardState';

type StateType = ReturnType<typeof useDashboardState>;

interface HeroProps {
  state: StateType;
  executionMode: string;
}

export function Hero({ state, executionMode }: HeroProps) {
  const selectedTargetName = state.selectedTarget?.name ?? 'No target selected';
  const currentWorkspaceName = state.workspace.data?.workspaceName ?? 'Loading workspace…';
  const targetCount = state.targets.data?.length ?? state.workspace.data?.targetCount ?? 0;
  const runCount = state.runs.data?.length ?? state.workspace.data?.runCount ?? 0;
  const runtimeSource = state.health.data?.runtimeSource ?? 'loading…';

  return (
    <>
      <header className="hero">
        <div>
          <p className="eyebrow">FFHN Desktop</p>
          <h1>Run FFHN without leaving the desktop</h1>
          <p className="hero-text">
            Open a workspace, define a target, run it through <code>ffhn</code>, and inspect the
            latest result from one place. The desktop stays in strict wrapper role and reports
            exactly when it is using mock mode versus bundled sidecars.
          </p>
        </div>
        <div className="hero-actions">
          <button
            className="button-primary"
            onClick={() => {
              state.setIsCreatingTarget(true);
            }}
          >
            Add target
          </button>
          <button
            onClick={() => {
              void state.handleOpenWorkspace();
            }}
          >
            Open sample workspace
          </button>
          {state.selectedTarget ? (
            state.executingTargets.has(state.selectedTarget.id) ? (
              <button disabled>Running {state.selectedTarget.name}…</button>
            ) : (
              <button
                onClick={() => {
                  void state.handleRunTarget();
                }}
              >
                Run selected target
              </button>
            )
          ) : (
            <button disabled>Run selected target</button>
          )}
          <button
            onClick={() => {
              void state.bootstrap();
            }}
          >
            Refresh app state
          </button>
        </div>
      </header>
      <div className="banner banner-strong">
        <strong>Execution mode:</strong> {executionMode}. <strong>Workspace:</strong>{' '}
        {currentWorkspaceName}. <strong>Selected target:</strong> {selectedTargetName}.{' '}
        <strong>Targets:</strong> {String(targetCount)}. <strong>Runs:</strong> {String(runCount)}.{' '}
        <strong>Runtime source:</strong> {runtimeSource}.
      </div>
      {executionMode === 'mock' ? (
        <div className="banner">
          Mock mode is active, which is fine for UI development. Bundle real <code>ffhn</code> and{' '}
          <code>HTMLCut</code> sidecars when you want live execution.
        </div>
      ) : null}
      {state.actionMessage ? <div className="banner">{state.actionMessage}</div> : null}
    </>
  );
}
