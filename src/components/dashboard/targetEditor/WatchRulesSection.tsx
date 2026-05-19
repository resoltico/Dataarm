import { schedulePresetLabel } from '../../../lib/presentation';
import type { GuidedDraft, TargetEditorState } from './shared';
import { DraftSection, Field } from './shared';

export function WatchRulesSection({
  draft,
  state,
}: {
  draft: GuidedDraft;
  state: TargetEditorState;
}) {
  const profile = state.watchProfile;
  if (!profile) {
    return null;
  }

  return (
    <DraftSection
      title="Checks and alerts"
      subtitle="Choose how often Dataarm checks this watch and which changes deserve an alert."
    >
      <Field label="Check every">
        <select
          aria-label="Check every"
          value={profile.schedule.preset}
          onChange={(event) => {
            state.updateWatchProfile((current) => ({
              ...current,
              schedule: {
                ...current.schedule,
                preset: event.target.value as typeof current.schedule.preset,
                customExpression:
                  event.target.value === 'custom' ? current.schedule.customExpression : null,
              },
            }));
          }}
        >
          <option value="every_5_minutes">Every 5 minutes</option>
          <option value="every_15_minutes">Every 15 minutes</option>
          <option value="hourly">Hourly</option>
          <option value="daily">Daily</option>
          <option value="weekdays">Weekdays</option>
          <option value="weekends">Weekends</option>
          <option value="manual_only">Manual only</option>
          <option value="custom">Custom</option>
        </select>
      </Field>
      {profile.schedule.preset === 'custom' ? (
        <Field label="Custom schedule" span="wide">
          <input
            aria-label="Custom schedule"
            placeholder="0 9 * * 1-5"
            value={profile.schedule.customExpression ?? ''}
            onChange={(event) => {
              state.updateWatchProfile((current) => ({
                ...current,
                schedule: {
                  ...current.schedule,
                  customExpression: event.target.value,
                },
              }));
            }}
          />
        </Field>
      ) : null}
      <Field label="Alert when">
        <select
          aria-label="Alert when"
          value={profile.alertRule.kind}
          onChange={(event) => {
            state.updateWatchProfile((current) => ({
              ...current,
              alertRule: {
                ...current.alertRule,
                kind: event.target.value as typeof current.alertRule.kind,
              },
            }));
          }}
        >
          <option value="any_change">Anything changes</option>
          <option value="text_appears">Text appears</option>
          <option value="text_disappears">Text disappears</option>
          <option value="price_drops_below">Price drops below</option>
          <option value="price_changes_by">Price changes by</option>
          <option value="regex_match">Regular expression matches</option>
        </select>
      </Field>
      {profile.alertRule.kind === 'text_appears' || profile.alertRule.kind === 'text_disappears' ? (
        <Field label="Text to watch for" span="wide">
          <input
            aria-label="Text to watch for"
            value={profile.alertRule.textOperand ?? ''}
            onChange={(event) => {
              state.updateWatchProfile((current) => ({
                ...current,
                alertRule: {
                  ...current.alertRule,
                  textOperand: event.target.value,
                },
              }));
            }}
          />
        </Field>
      ) : null}
      {profile.alertRule.kind === 'price_drops_below' ||
      profile.alertRule.kind === 'price_changes_by' ? (
        <Field
          label={
            profile.alertRule.kind === 'price_drops_below'
              ? 'Alert below price'
              : 'Alert when the price changes by'
          }
        >
          <input
            aria-label="Numeric alert threshold"
            min={0}
            step="0.01"
            type="number"
            value={String(profile.alertRule.numericOperand ?? '')}
            onChange={(event) => {
              state.updateWatchProfile((current) => ({
                ...current,
                alertRule: {
                  ...current.alertRule,
                  numericOperand:
                    event.target.value.trim().length === 0 ? null : Number(event.target.value),
                },
              }));
            }}
          />
        </Field>
      ) : null}
      {profile.alertRule.kind === 'regex_match' ? (
        <Field label="Regular expression" span="wide">
          <input
            aria-label="Regular expression"
            value={profile.alertRule.regexPattern ?? ''}
            onChange={(event) => {
              state.updateWatchProfile((current) => ({
                ...current,
                alertRule: {
                  ...current.alertRule,
                  regexPattern: event.target.value,
                },
              }));
            }}
          />
        </Field>
      ) : null}
      <Field label="Notify through">
        <select
          aria-label="Notify through"
          value={profile.delivery}
          onChange={(event) => {
            state.updateWatchProfile((current) => ({
              ...current,
              delivery: event.target.value as typeof current.delivery,
            }));
          }}
        >
          <option value="in_app">In app</option>
          <option value="system">System notifications</option>
          <option value="both">In app and system</option>
        </select>
      </Field>
      <Field label="Folder">
        <input
          aria-label="Folder"
          value={profile.folderName ?? ''}
          onChange={(event) => {
            state.updateWatchProfile((current) => ({
              ...current,
              folderName: event.target.value,
            }));
          }}
        />
      </Field>
      <Field label="Paused">
        <select
          aria-label="Paused"
          value={profile.paused ? 'true' : 'false'}
          onChange={(event) => {
            state.updateWatchProfile((current) => ({
              ...current,
              paused: event.target.value === 'true',
            }));
          }}
        >
          <option value="false">No</option>
          <option value="true">Yes</option>
        </select>
      </Field>
      <div className="draft-summary-card">
        <strong>Watch behavior</strong>
        <span>{schedulePresetLabel(profile)}</span>
        <span>{draft.kind === 'http' ? 'Website watch' : 'Local file watch'}</span>
      </div>
    </DraftSection>
  );
}
