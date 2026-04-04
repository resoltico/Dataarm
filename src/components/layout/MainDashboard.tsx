import { KeyValueTable } from '../KeyValueTable';
import { SectionCard } from '../SectionCard';
import { StatusPill } from '../StatusPill';
import { TargetEditor } from '../dashboard/TargetEditor';
import type { useDashboardState } from '../../hooks/useDashboardState';

type StateType = ReturnType<typeof useDashboardState>;

interface MainDashboardProps {
  state: StateType;
}

type WorkflowStep = {
  title: string;
  detail: string;
  status: 'complete' | 'active' | 'pending';
};

function joinLines(values: string[]) {
  return values.length > 0 ? values.join('\n') : '—';
}

export function MainDashboard({ state }: MainDashboardProps) {
  const selectedTarget = state.selectedTarget;
  const workspacePath = state.workspace.data?.workspacePath ?? null;
  const selectedTargetRuns =
    selectedTarget == null
      ? []
      : (state.runs.data ?? []).filter((run) => run.targetId === selectedTarget.id);
  const latestSelectedTargetRun = selectedTargetRuns[0] ?? null;
  const runEnvelopePath =
    workspacePath && state.runDetail.data?.id
      ? `${workspacePath}/run-results/${state.runDetail.data.id}.json`
      : null;

  const workflowSteps: WorkflowStep[] = [
    {
      title: 'Workspace ready',
      detail: state.workspace.data
        ? `${state.workspace.data.workspaceName} is loaded and ready for target work.`
        : 'Loading the current workspace.',
      status: state.workspace.data ? 'complete' : 'pending',
    },
    {
      title: 'Target selected',
      detail: selectedTarget
        ? `${selectedTarget.name} is selected for the next run.`
        : 'Create a target or choose one from the sidebar.',
      status: selectedTarget ? 'complete' : state.workspace.data ? 'active' : 'pending',
    },
    {
      title: 'Execute FFHN',
      detail: latestSelectedTargetRun
        ? `Latest run ${latestSelectedTargetRun.id} finished with status ${latestSelectedTargetRun.status}.`
        : selectedTarget
          ? 'Run the selected target to produce the first result envelope.'
          : 'A selected target is required before execution.',
      status: latestSelectedTargetRun ? 'complete' : selectedTarget ? 'active' : 'pending',
    },
    {
      title: 'Inspect the result',
      detail:
        state.runDetail.data != null
          ? `Currently inspecting ${state.runDetail.data.id}.`
          : latestSelectedTargetRun
            ? 'Open the latest run detail to review command output and notes.'
            : 'Run detail becomes useful after the first execution.',
      status:
        state.runDetail.data != null ? 'complete' : latestSelectedTargetRun ? 'active' : 'pending',
    },
  ];

  const nextAction = !selectedTarget
    ? {
        title: 'Create your first target',
        description:
          'The workspace is ready. Add a target so the desktop has something concrete to run through FFHN.',
        label: 'Add target',
        action: () => {
          state.setIsCreatingTarget(true);
        },
        disabled: false,
      }
    : latestSelectedTargetRun == null
      ? {
          title: `Run ${selectedTarget.name}`,
          description:
            'The selected target has no desktop-visible run yet. Execute it once so we can inspect the first result.',
          label: state.executingTargets.has(selectedTarget.id)
            ? 'Run in progress'
            : 'Run selected target',
          action: () => {
            void state.handleRunTarget(selectedTarget.id);
          },
          disabled: state.executingTargets.has(selectedTarget.id),
        }
      : state.selectedRun?.id !== latestSelectedTargetRun.id
        ? {
            title: 'Inspect the freshest run',
            description:
              'A newer run exists for the selected target. Switch the detail panel to that latest result.',
            label: 'Inspect latest run',
            action: () => {
              state.setSelectedRunId(latestSelectedTargetRun.id);
            },
            disabled: false,
          }
        : {
            title: 'Keep the loop moving',
            description:
              'Inspect the current result, adjust the target if needed, then run again or execute the whole workspace.',
            label: 'Run all targets',
            action: () => {
              void state.handleRunAll();
            },
            disabled: (state.targets.data?.length ?? 0) === 0 || state.executingTargets.size > 0,
          };

  if (state.isCreatingTarget) {
    return (
      <section className="main-column">
        <TargetEditor
          error={state.targetValidationError}
          onCancel={() => {
            state.setTargetValidationError(null);
            state.setIsCreatingTarget(false);
          }}
          onSave={(data) => {
            void state.handleCreateTarget(data);
          }}
        />
      </section>
    );
  }

  return (
    <section className="main-column" aria-label="Dashboard Details">
      <div className="grid-two">
        <SectionCard
          id="section-operator-flow"
          title="Operator flow"
          subtitle="The shortest path from workspace to result"
          actions={
            <button
              className="button-primary"
              onClick={nextAction.action}
              disabled={nextAction.disabled}
            >
              {nextAction.label}
            </button>
          }
        >
          <p className="section-lead">
            <strong>{nextAction.title}</strong>
            <span>{nextAction.description}</span>
          </p>
          <div className="workflow-list">
            {workflowSteps.map((step) => (
              <div key={step.title} className={`workflow-step workflow-step-${step.status}`}>
                <div className="workflow-step-title">{step.title}</div>
                <div className="workflow-step-detail">{step.detail}</div>
              </div>
            ))}
          </div>
          <div className="inline-actions">
            <button
              onClick={() => {
                void state.handleProbe();
              }}
            >
              Probe runtime
            </button>
            <button
              onClick={() => {
                void state.handleRunAll();
              }}
              disabled={(state.targets.data?.length ?? 0) === 0 || state.executingTargets.size > 0}
            >
              Run all targets
            </button>
          </div>
          {state.probe.loading ? <p className="muted">Running a fresh FFHN probe…</p> : null}
          {state.probe.error ? <p className="error">{state.probe.error}</p> : null}
          {state.probe.data ? (
            <div className="inline-note">
              Last probe: <strong>{String(state.probe.data.ok)}</strong> in{' '}
              <strong>{state.probe.data.mode}</strong> mode. {state.probe.data.note}
            </div>
          ) : null}
        </SectionCard>

        <SectionCard
          id="section-workspace-summary"
          title="Current workspace"
          subtitle="Where FFHN reads targets and writes results"
          actions={
            workspacePath ? (
              <button
                onClick={() => {
                  void state.handleOpenPath(workspacePath);
                }}
                style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}
              >
                Open in Finder
              </button>
            ) : undefined
          }
        >
          {state.workspace.data ? (
            <>
              <KeyValueTable
                items={[
                  { key: 'Workspace', value: state.workspace.data.workspaceName },
                  { key: 'Path', value: state.workspace.data.workspacePath },
                  { key: 'Targets', value: String(state.targets.data?.length ?? 0) },
                  { key: 'Runs', value: String(state.runs.data?.length ?? 0) },
                  { key: 'Mode', value: state.workspace.data.mode },
                  { key: 'Note', value: state.workspace.data.note },
                ]}
              />
              <p className="muted card-footnote">
                Need another workspace? Use the recent workspace rail on the left to reopen one.
              </p>
            </>
          ) : (
            <p>Loading…</p>
          )}
        </SectionCard>
      </div>

      <div className="grid-two">
        <SectionCard
          id="section-selected-target"
          title="Selected target"
          subtitle="What will run next"
        >
          {selectedTarget ? (
            <>
              <KeyValueTable
                items={[
                  { key: 'Target', value: selectedTarget.name },
                  { key: 'ID', value: selectedTarget.id },
                  { key: 'URL', value: selectedTarget.url },
                  { key: 'Enabled', value: selectedTarget.enabled ? 'yes' : 'no' },
                  { key: 'Status', value: selectedTarget.status },
                  { key: 'Extractor', value: selectedTarget.extractorSummary },
                  {
                    key: 'Latest desktop-visible run',
                    value:
                      latestSelectedTargetRun?.startedAt ?? selectedTarget.lastRunAt ?? 'never',
                  },
                ]}
              />
              <div className="inline-actions">
                {state.executingTargets.has(selectedTarget.id) ? (
                  <button
                    onClick={() => {
                      state.handleCancelRun(selectedTarget.id);
                    }}
                    style={{ borderColor: '#f59e0b', color: '#fcd34d' }}
                  >
                    Cancel executing run
                  </button>
                ) : (
                  <button
                    className="button-primary"
                    onClick={() => {
                      void state.handleRunTarget(selectedTarget.id);
                    }}
                  >
                    Run target
                  </button>
                )}
                <button
                  onClick={() => {
                    void state.handleDuplicateTarget(selectedTarget.id);
                  }}
                >
                  Duplicate
                </button>
                <button
                  onClick={() => {
                    void state.handleToggleTargetState(selectedTarget.id);
                  }}
                >
                  {selectedTarget.enabled ? 'Disable' : 'Enable'}
                </button>
                <button
                  onClick={() => {
                    void state.handleDeleteTarget(selectedTarget.id);
                  }}
                  style={{ borderColor: 'rgba(239, 68, 68, 0.5)', color: '#fecaca' }}
                >
                  Delete target
                </button>
              </div>
            </>
          ) : (
            <p className="muted">
              No target is selected yet. Pick one from the sidebar or add a new target.
            </p>
          )}
        </SectionCard>

        <SectionCard
          id="section-latest-result"
          title="Latest result"
          subtitle="Most recent run for the selected target"
          actions={
            latestSelectedTargetRun && state.selectedRun?.id !== latestSelectedTargetRun.id ? (
              <button
                onClick={() => {
                  state.setSelectedRunId(latestSelectedTargetRun.id);
                }}
                style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}
              >
                Inspect latest run
              </button>
            ) : undefined
          }
        >
          {latestSelectedTargetRun ? (
            <>
              <KeyValueTable
                items={[
                  { key: 'Run', value: latestSelectedTargetRun.id },
                  { key: 'Status', value: latestSelectedTargetRun.status },
                  { key: 'Summary', value: latestSelectedTargetRun.summary },
                  { key: 'Started', value: latestSelectedTargetRun.startedAt },
                  { key: 'Finished', value: latestSelectedTargetRun.finishedAt ?? 'still running' },
                  { key: 'Mode', value: latestSelectedTargetRun.mode },
                ]}
              />
              <p className="muted card-footnote">
                The full command output and note live in the run detail panel below.
              </p>
            </>
          ) : selectedTarget ? (
            <p className="muted">
              This target has not been run yet from the desktop. Execute it once to populate the
              result history.
            </p>
          ) : (
            <p className="muted">
              A selected target is required before a latest result can appear.
            </p>
          )}
        </SectionCard>
      </div>

      <div className="grid-two">
        <SectionCard
          id="section-recent-runs"
          title="Recent runs"
          subtitle="Desktop-visible history"
        >
          {state.runs.data && state.runs.data.length > 0 ? (
            <div className="target-list">
              {state.runs.data.map((run) => (
                <button
                  key={run.id}
                  className={`target-item ${state.selectedRun?.id === run.id ? 'active' : ''}`}
                  onClick={() => {
                    state.setSelectedRunId(run.id);
                  }}
                >
                  <div className="target-item-head">
                    <strong>{run.id}</strong>
                    <StatusPill value={run.status} />
                  </div>
                  <div className="muted">
                    {run.targetId} — {run.summary}
                  </div>
                  <div className="target-meta">
                    <span>Started: {run.startedAt}</span>
                    <span>Mode: {run.mode}</span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <p className="muted">No runs have been recorded in this workspace yet.</p>
          )}
        </SectionCard>

        <SectionCard
          id="section-run-detail"
          title="Selected run detail"
          subtitle="Command, output, and note from the current run envelope"
          actions={
            runEnvelopePath ? (
              <button
                onClick={() => {
                  void state.handleOpenPath(runEnvelopePath);
                }}
                style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}
              >
                Open result envelope
              </button>
            ) : undefined
          }
        >
          {state.runDetail.loading ? <p>Loading run detail…</p> : null}
          {state.runDetail.error ? <p className="error">{state.runDetail.error}</p> : null}
          {state.runDetail.data ? (
            <KeyValueTable
              items={[
                { key: 'Run', value: state.runDetail.data.id },
                { key: 'Target', value: state.runDetail.data.targetId },
                { key: 'Status', value: state.runDetail.data.status },
                { key: 'Mode', value: state.runDetail.data.mode },
                { key: 'Command attempted', value: state.runDetail.data.commandAttempted },
                { key: 'Stdout preview', value: state.runDetail.data.stdoutPreview },
                { key: 'Stderr preview', value: state.runDetail.data.stderrPreview },
                { key: 'Note', value: state.runDetail.data.note },
              ]}
            />
          ) : (
            <p className="muted">
              Select a run from the history list to inspect its command, stdout, stderr, and note.
            </p>
          )}
        </SectionCard>
      </div>

      <details className="details-card">
        <summary className="details-summary">Runtime and bundle diagnostics</summary>
        <div className="details-grid">
          <SectionCard id="section-app-info" title="App info" subtitle="Desktop metadata">
            {state.appInfo.data ? (
              <KeyValueTable
                items={[
                  { key: 'Name', value: state.appInfo.data.appName },
                  { key: 'Version', value: state.appInfo.data.appVersion },
                  { key: 'Mode', value: state.appInfo.data.mode },
                ]}
              />
            ) : (
              <p>Loading…</p>
            )}
          </SectionCard>

          <SectionCard
            id="section-sidecar-health"
            title="Sidecar health"
            subtitle="Current resolution posture"
          >
            {state.health.data ? (
              <KeyValueTable
                items={[
                  { key: 'FFHN configured', value: String(state.health.data.ffhnConfigured) },
                  {
                    key: 'HTMLCUT configured',
                    value: String(state.health.data.htmlcutConfigured),
                  },
                  { key: 'Runtime source', value: state.health.data.runtimeSource },
                  { key: 'Execution mode', value: state.health.data.executionMode },
                  {
                    key: 'FFHN path hint',
                    value: state.health.data.ffhnBinaryPathHint ?? 'not set',
                  },
                  {
                    key: 'HTMLCUT path hint',
                    value: state.health.data.htmlcutBinaryPathHint ?? 'not set',
                  },
                  { key: 'Note', value: state.health.data.note },
                ]}
              />
            ) : (
              <p>Loading…</p>
            )}
          </SectionCard>

          <SectionCard
            id="section-runtime-readiness"
            title="Runtime readiness"
            subtitle="Can the current host launch the bundled pair?"
          >
            {state.runtimeReadiness.data ? (
              <KeyValueTable
                items={[
                  { key: 'Host triple', value: state.runtimeReadiness.data.hostTargetTriple },
                  { key: 'Current state', value: state.runtimeReadiness.data.current },
                  { key: 'Runtime source', value: state.runtimeReadiness.data.runtimeSource },
                  {
                    key: 'FFHN binary path',
                    value: state.runtimeReadiness.data.ffhnBinaryPath ?? 'not present',
                  },
                  {
                    key: 'HTMLCUT binary path',
                    value: state.runtimeReadiness.data.htmlcutBinaryPath ?? 'not present',
                  },
                  {
                    key: 'Executable pair available',
                    value: state.runtimeReadiness.data.executablePairAvailable ? 'yes' : 'no',
                  },
                  { key: 'Note', value: state.runtimeReadiness.data.note },
                ]}
              />
            ) : (
              <p>Loading…</p>
            )}
          </SectionCard>

          <SectionCard
            id="section-diagnostics"
            title="Behavior diagnostics"
            subtitle="Why the app is behaving the way it is"
          >
            {state.diagnostics.data ? (
              <KeyValueTable
                items={[
                  { key: 'Execution mode', value: state.diagnostics.data.executionMode },
                  { key: 'Workspace path', value: state.diagnostics.data.workspacePath },
                  { key: 'FFHN resolution', value: state.diagnostics.data.ffhnResolution },
                  { key: 'HTMLCUT resolution', value: state.diagnostics.data.htmlcutResolution },
                  { key: 'Notes', value: joinLines(state.diagnostics.data.notes) },
                ]}
              />
            ) : (
              <p>Loading…</p>
            )}
          </SectionCard>
        </div>
      </details>

      <details className="details-card">
        <summary className="details-summary">Packaging and release diagnostics</summary>
        <div className="details-grid">
          <SectionCard
            id="section-bundle-manifest"
            title="Bundle manifest"
            subtitle="Pinned upstream contract"
          >
            {state.bundleManifest.data ? (
              <KeyValueTable
                items={[
                  {
                    key: 'Desktop version',
                    value: state.bundleManifest.data.desktopProduct.version,
                  },
                  { key: 'Runtime contract', value: state.bundleManifest.data.runtimeContract },
                  {
                    key: 'FFHN',
                    value: `${state.bundleManifest.data.dependencies.ffhn.versionLabel} @ ${state.bundleManifest.data.dependencies.ffhn.ref}`,
                  },
                  {
                    key: 'HTMLCUT',
                    value: `${state.bundleManifest.data.dependencies.htmlcut.versionLabel} @ ${state.bundleManifest.data.dependencies.htmlcut.ref}`,
                  },
                  {
                    key: 'Supported targets',
                    value: joinLines(state.bundleManifest.data.supportedTargetTriples),
                  },
                  { key: 'Posture', value: state.bundleManifest.data.executionPosture.note },
                ]}
              />
            ) : (
              <p>Loading…</p>
            )}
          </SectionCard>

          <SectionCard
            id="section-bundle-inputs"
            title="Bundle inputs"
            subtitle="Host-side sidecar bundle sources"
          >
            {state.bundleHydration.data ? (
              <KeyValueTable
                items={[
                  { key: 'Current state', value: state.bundleHydration.data.current },
                  { key: 'FFHN path', value: state.bundleHydration.data.ffhn.path },
                  {
                    key: 'FFHN present',
                    value: state.bundleHydration.data.ffhn.present ? 'yes' : 'no',
                  },
                  {
                    key: 'FFHN executable',
                    value: state.bundleHydration.data.ffhn.executable ? 'yes' : 'no',
                  },
                  { key: 'HTMLCUT path', value: state.bundleHydration.data.htmlcut.path },
                  {
                    key: 'HTMLCUT present',
                    value: state.bundleHydration.data.htmlcut.present ? 'yes' : 'no',
                  },
                  {
                    key: 'HTMLCUT executable',
                    value: state.bundleHydration.data.htmlcut.executable ? 'yes' : 'no',
                  },
                  {
                    key: 'Supported targets',
                    value: joinLines(state.bundleHydration.data.supportedTargetTriples),
                  },
                  { key: 'Note', value: state.bundleHydration.data.note },
                ]}
              />
            ) : (
              <p>Loading…</p>
            )}
          </SectionCard>

          <SectionCard
            id="section-project-status"
            title="Project status"
            subtitle="Supported platform and sidecar intake posture"
          >
            {state.projectStatus.data ? (
              <KeyValueTable
                items={[
                  { key: 'Runtime contract', value: state.projectStatus.data.runtimeContract },
                  {
                    key: 'Supported platform',
                    value: state.projectStatus.data.supportedPlatform.targetTriple,
                  },
                  {
                    key: 'Supported platform status',
                    value: state.projectStatus.data.supportedPlatform.status,
                  },
                  { key: 'Sidecar intake', value: state.projectStatus.data.sidecarIntake.current },
                  {
                    key: 'Intake target',
                    value: state.projectStatus.data.sidecarIntake.targetTriple,
                  },
                  {
                    key: 'Intake status',
                    value: state.projectStatus.data.sidecarIntake.status,
                  },
                  {
                    key: 'Activation receipt present',
                    value: state.projectStatus.data.sidecarIntake.activationReceiptPresent
                      ? 'yes'
                      : 'no',
                  },
                  {
                    key: 'Expected FFHN artifacts',
                    value: joinLines(state.projectStatus.data.sidecarIntake.expectedFfhnArtifacts),
                  },
                  {
                    key: 'Expected HTMLCUT artifacts',
                    value: joinLines(
                      state.projectStatus.data.sidecarIntake.expectedHtmlcutArtifacts,
                    ),
                  },
                  { key: 'Note', value: state.projectStatus.data.sidecarIntake.note },
                ]}
              />
            ) : (
              <p>Loading…</p>
            )}
          </SectionCard>
        </div>
      </details>
    </section>
  );
}
