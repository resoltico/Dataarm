use crate::models::{WatchAlertKind, WatchProfile, WatchSchedulePreset};
use std::fs;
use std::path::{Path, PathBuf};

const WATCH_PROFILE_FILE_NAME: &str = "watch.dataarm.toml";
const WATCH_PROFILE_SCHEMA_NAME: &str = "dataarm.watch_profile";
const WATCH_PROFILE_SCHEMA_VERSION: u32 = 1;

pub(crate) fn default_watch_profile() -> WatchProfile {
    WatchProfile::default()
}

pub(crate) fn load_watch_profile(target_directory: &Path) -> Result<WatchProfile, String> {
    let profile_path = watch_profile_path(target_directory);
    if !profile_path.is_file() {
        return Ok(default_watch_profile());
    }

    let raw = fs::read_to_string(&profile_path)
        .map_err(|error| format!("Failed to read {}: {error}", profile_path.display()))?;
    let profile: WatchProfile = toml::from_str(&raw)
        .map_err(|error| format!("Failed to decode {}: {error}", profile_path.display()))?;
    validate_watch_profile(profile, &profile_path)
}

pub(crate) fn persist_watch_profile(
    target_directory: &Path,
    profile: &WatchProfile,
) -> Result<(), String> {
    let profile_path = watch_profile_path(target_directory);
    let normalized = validate_watch_profile(profile.clone(), &profile_path)?;
    let encoded = toml::to_string_pretty(&normalized)
        .map_err(|error| format!("Failed to encode {}: {error}", profile_path.display()))?;
    fs::write(&profile_path, encoded)
        .map_err(|error| format!("Failed to write {}: {error}", profile_path.display()))
}

pub(crate) fn watch_profile_path(target_directory: &Path) -> PathBuf {
    target_directory.join(WATCH_PROFILE_FILE_NAME)
}

fn validate_watch_profile(mut profile: WatchProfile, path: &Path) -> Result<WatchProfile, String> {
    if profile.schema_name != WATCH_PROFILE_SCHEMA_NAME {
        return Err(format!(
            "{} must declare schema_name = \"{}\".",
            path.display(),
            WATCH_PROFILE_SCHEMA_NAME
        ));
    }
    if profile.schema_version != WATCH_PROFILE_SCHEMA_VERSION {
        return Err(format!(
            "{} must declare schema_version = {}.",
            path.display(),
            WATCH_PROFILE_SCHEMA_VERSION
        ));
    }

    profile.tags.retain(|tag| !tag.trim().is_empty());
    profile.tags.sort();
    profile.tags.dedup();
    profile.folder_name = profile
        .folder_name
        .map(|value| value.trim().to_owned())
        .filter(|value| !value.is_empty());

    if matches!(profile.schedule.preset, WatchSchedulePreset::Custom)
        && profile
            .schedule
            .custom_expression
            .as_deref()
            .map(str::trim)
            .is_none_or(str::is_empty)
    {
        return Err(format!(
            "{} uses a custom schedule but does not provide customExpression.",
            path.display()
        ));
    }

    match profile.alert_rule.kind {
        WatchAlertKind::TextAppears | WatchAlertKind::TextDisappears => {
            if profile
                .alert_rule
                .text_operand
                .as_deref()
                .map(str::trim)
                .is_none_or(str::is_empty)
            {
                return Err(format!(
                    "{} requires alertRule.textOperand for {:?}.",
                    path.display(),
                    profile.alert_rule.kind
                ));
            }
        }
        WatchAlertKind::PriceDropsBelow | WatchAlertKind::PriceChangesBy => {
            if profile.alert_rule.numeric_operand.is_none() {
                return Err(format!(
                    "{} requires alertRule.numericOperand for {:?}.",
                    path.display(),
                    profile.alert_rule.kind
                ));
            }
        }
        WatchAlertKind::RegexMatch => {
            if profile
                .alert_rule
                .regex_pattern
                .as_deref()
                .map(str::trim)
                .is_none_or(str::is_empty)
            {
                return Err(format!(
                    "{} requires alertRule.regexPattern for regex_match.",
                    path.display()
                ));
            }
        }
        WatchAlertKind::AnyChange => {}
    }

    Ok(profile)
}

#[cfg(test)]
mod tests {
    use super::default_watch_profile;
    use crate::models::WatchProfile;

    #[test]
    fn default_profile_serializes_with_human_readable_schedule_tokens() {
        let encoded =
            toml::to_string(&default_watch_profile()).expect("default profile should encode");
        assert!(encoded.contains("preset = \"every_15_minutes\""));
    }

    #[test]
    fn watch_profile_decodes_human_readable_schedule_tokens() {
        let raw = r#"
schemaName = "dataarm.watch_profile"
schemaVersion = 1
paused = false
tags = []
delivery = "in_app"

[schedule]
preset = "every_15_minutes"
customExpression = ""

[alertRule]
kind = "any_change"
ignoreTextFragments = []
"#;
        let profile: WatchProfile =
            toml::from_str(raw).expect("watch profile should decode the persisted schedule preset");
        let reencoded = toml::to_string(&profile).expect("watch profile should re-encode");
        assert!(reencoded.contains("preset = \"every_15_minutes\""));
    }
}
