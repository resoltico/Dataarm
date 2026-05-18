import { formatTimestamp } from '../../lib/presentation';
import type {
  NotificationChannel,
  NotificationDelivery,
  NotificationPermissionState,
  NotificationPolicy,
} from '../../types';
import type { useDashboardState } from '../../hooks/useDashboardState';

type StateType = ReturnType<typeof useDashboardState>;

const policyOptions: Array<{ value: NotificationPolicy; label: string }> = [
  { value: 'off', label: 'Off' },
  { value: 'errors_only', label: 'Errors only' },
  { value: 'changes_and_errors', label: 'Changes and errors' },
  { value: 'all_completions', label: 'All completions' },
];

const deliveryOptions: Array<{ value: NotificationDelivery; label: string }> = [
  { value: 'in_app', label: 'In app' },
  { value: 'system', label: 'System' },
  { value: 'both', label: 'Both' },
];

function permissionMessage(
  permissionState: NotificationPermissionState,
  delivery: NotificationDelivery,
) {
  if (delivery === 'in_app') {
    return 'Important alerts stay inside Dataarm until you enable system delivery.';
  }

  switch (permissionState) {
    case 'granted':
      return 'System delivery is ready for this runtime.';
    case 'denied':
      return 'System delivery was denied by the platform.';
    case 'prompt':
      return 'System delivery is waiting for a platform permission prompt.';
    case 'prompt_with_rationale':
      return 'System delivery needs a platform permission prompt with rationale.';
    case 'unknown':
    default:
      return 'System delivery is unavailable on this runtime.';
  }
}

function channelsLabel(channels: NotificationChannel[]) {
  if (channels.length === 0) {
    return 'History only';
  }
  if (channels.length === 2) {
    return 'In app + system';
  }
  return channels[0] === 'system' ? 'System' : 'In app';
}

export function NotificationCenter({ state }: { state: StateType }) {
  const notificationCenter = state.notificationCenter;
  const settings = notificationCenter?.settings ?? {
    notifyWhen: 'changes_and_errors' as const,
    delivery: 'in_app' as const,
  };

  return (
    <section className="sidebar-subsection" aria-label="Notification center">
      <div className="sidebar-subsection-head">
        <div>
          <p className="sidebar-eyebrow">Notifications</p>
          <h3>Alert center</h3>
        </div>
        <button
          className="button-quiet"
          onClick={() => {
            void state.handleClearNotificationFeed();
          }}
          disabled={!notificationCenter || notificationCenter.items.length === 0}
        >
          Clear
        </button>
      </div>

      <div className="notification-controls">
        <label className="notification-control">
          <span>Alert when</span>
          <select
            aria-label="Alert when"
            value={settings.notifyWhen}
            onChange={(event) => {
              void state.handleUpdateNotificationSettings({
                ...settings,
                notifyWhen: event.target.value as NotificationPolicy,
              });
            }}
          >
            {policyOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="notification-control">
          <span>Deliver via</span>
          <select
            aria-label="Deliver via"
            value={settings.delivery}
            onChange={(event) => {
              void state.handleUpdateNotificationSettings({
                ...settings,
                delivery: event.target.value as NotificationDelivery,
              });
            }}
          >
            {deliveryOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <p className="notification-status">
        {notificationCenter
          ? permissionMessage(notificationCenter.permissionState, settings.delivery)
          : 'Loading notification settings.'}
      </p>

      {!notificationCenter || notificationCenter.items.length === 0 ? (
        <p className="notification-empty-note">
          No important alerts yet. Run a target or the workspace to populate the history.
        </p>
      ) : (
        <div className="notification-feed scroll-region">
          {notificationCenter.items.map((item) => (
            <article key={item.id} className={`notification-entry notification-entry-${item.tone}`}>
              <div className="notification-entry-row">
                <strong>{item.title}</strong>
                <span>{formatTimestamp(item.createdAt)}</span>
              </div>
              <p>{item.body}</p>
              <div className="notification-entry-meta">
                <span>{channelsLabel(item.deliveredChannels)}</span>
                <span>{item.targetDisplayName ?? item.workspaceName}</span>
              </div>
              {item.deliveryError ? (
                <p className="notification-delivery-error">{item.deliveryError}</p>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
