use crate::models::{
    TargetDraft, TargetDraftCanonicalizer, TargetDraftSession, TargetPreviewRequest,
    TargetSaveRequest,
};
use ffhn_core::{
    CompareBasis, DelimiterMode, HttpMethod, RegexFlag, SelectionKind, SelectionMatch,
    TargetDocument, WhitespaceMode,
};

pub(super) fn raw_toml_from_preview_request(
    request: &TargetPreviewRequest,
) -> Result<String, String> {
    raw_toml_from_optional_input(
        request.draft_session.as_ref(),
        request.raw_toml.as_deref(),
        "preview",
    )
}

pub(super) fn raw_toml_from_save_request(request: &TargetSaveRequest) -> Result<String, String> {
    raw_toml_from_optional_input(
        request.draft_session.as_ref(),
        request.raw_toml.as_deref(),
        "save",
    )
}

pub(super) fn target_draft_session(
    target: &TargetDocument,
    raw_toml: &str,
) -> Result<TargetDraftSession, String> {
    Ok(TargetDraftSession {
        draft: TargetDraft {
            kind: if target.source_url().is_some() {
                "http".to_owned()
            } else if target.file_path().is_some() {
                "file".to_owned()
            } else {
                return Err("Guided drafts require a file or HTTP source locator.".to_owned());
            },
            target_id: target.target_id().to_owned(),
            display_name: target.display_name().to_owned(),
            enabled: target.enabled(),
            source_locator: target
                .source_url()
                .map(|source| source.as_str().to_owned())
                .or_else(|| target.file_path().map(ToOwned::to_owned))
                .unwrap_or_default(),
            fetch_method: target.fetch_http_method().map(http_method_token),
            fetch_timeout_ms: target.fetch_timeout_ms(),
            fetch_max_bytes: target.fetch_max_bytes(),
            fetch_user_agent: target.fetch_user_agent().map(ToOwned::to_owned),
            fetch_follow_redirects: target.fetch_follow_redirects(),
            fetch_accept: target.fetch_accept().map(ToOwned::to_owned),
            selection_kind: selection_kind_token(target.selection_kind()).to_owned(),
            selection_match: selection_match_token(target.selection_match()).to_owned(),
            selection_index: target.selection_index(),
            selection_selector: target.selection_selector().map(ToOwned::to_owned),
            selection_start: target.selection_start().map(ToOwned::to_owned),
            selection_end: target.selection_end().map(ToOwned::to_owned),
            selection_delimiter_mode: target
                .selection_delimiter_mode()
                .map(delimiter_mode_token)
                .map(ToOwned::to_owned),
            selection_include_start: target.selection_include_start(),
            selection_include_end: target.selection_include_end(),
            selection_regex_flags: target
                .selection_regex_flags()
                .iter()
                .map(regex_flag_token)
                .map(ToOwned::to_owned)
                .collect(),
            compare_basis: compare_basis_token(target.compare_basis()).to_owned(),
            compare_whitespace: target
                .compare_whitespace()
                .map(whitespace_mode_token)
                .map(ToOwned::to_owned),
            compare_rewrite_urls: target.compare_rewrite_urls(),
            compare_canonicalizers: target
                .compare_canonicalization()
                .iter()
                .map(|canonicalizer| TargetDraftCanonicalizer {
                    kind: canonicalizer.kind().as_str().to_owned(),
                    pattern: canonicalizer.pattern().map(ToOwned::to_owned),
                    flags: canonicalizer
                        .flags()
                        .iter()
                        .map(regex_flag_token)
                        .map(ToOwned::to_owned)
                        .collect(),
                })
                .collect(),
            storage_history_limit: target.storage_history_limit(),
        },
        contract_seed_toml: raw_toml.to_owned(),
    })
}

pub(super) fn build_raw_toml_from_session(session: &TargetDraftSession) -> Result<String, String> {
    let mut contract_seed = parse_contract_seed(session.contract_seed_toml.as_str())?;
    apply_draft_to_contract_seed(&mut contract_seed, &session.draft)?;
    toml::to_string_pretty(&contract_seed)
        .map_err(|error| format!("Failed to serialize guided target draft: {error}"))
}

fn raw_toml_from_optional_input(
    draft_session: Option<&TargetDraftSession>,
    raw_toml: Option<&str>,
    operation: &str,
) -> Result<String, String> {
    match (draft_session, raw_toml) {
        (Some(_), Some(_)) => Err(format!(
            "Target {operation} requests must choose guided draft input or raw TOML, not both."
        )),
        (Some(session), None) => build_raw_toml_from_session(session),
        (None, Some(raw_toml)) => Ok(raw_toml.to_owned()),
        (None, None) => Err(format!(
            "Target {operation} requests must provide guided draft input or raw TOML."
        )),
    }
}

fn parse_contract_seed(raw_toml: &str) -> Result<toml::Table, String> {
    toml::from_str(raw_toml)
        .map_err(|error| format!("Failed to decode guided target seed: {error}"))
}

fn apply_draft_to_contract_seed(seed: &mut toml::Table, draft: &TargetDraft) -> Result<(), String> {
    seed.insert("schema_name".to_owned(), toml_string("ffhn.target"));
    seed.insert("schema_version".to_owned(), toml_integer(4));
    seed.insert(
        "target_id".to_owned(),
        toml_string(draft.target_id.as_str()),
    );
    seed.insert(
        "display_name".to_owned(),
        toml_string(draft.display_name.as_str()),
    );
    seed.insert("enabled".to_owned(), toml_boolean(draft.enabled));

    let mut target_table = match (
        read_nested_string(seed.get("target"), "kind"),
        draft.kind.as_str(),
    ) {
        (Some(existing_kind), next_kind) if existing_kind == next_kind => {
            cloned_table(seed.get("target"))
        }
        _ => toml::Table::new(),
    };
    remove_keys(&mut target_table, &["kind", "source_url", "file_path"]);
    target_table.insert("kind".to_owned(), toml_string(draft.kind.as_str()));
    match draft.kind.as_str() {
        "http" => target_table.insert(
            "source_url".to_owned(),
            toml_string(draft.source_locator.as_str()),
        ),
        "file" => target_table.insert(
            "file_path".to_owned(),
            toml_string(draft.source_locator.as_str()),
        ),
        other => return Err(format!("Unsupported guided target kind: {other}")),
    };
    seed.insert("target".to_owned(), toml::Value::Table(target_table));

    let mut fetch_table = match (
        read_nested_string(seed.get("fetch"), "engine"),
        draft.kind.as_str(),
    ) {
        (Some(existing_engine), next_engine) if existing_engine == next_engine => {
            cloned_table(seed.get("fetch"))
        }
        _ => toml::Table::new(),
    };
    remove_keys(
        &mut fetch_table,
        &[
            "engine",
            "method",
            "timeout_ms",
            "max_bytes",
            "user_agent",
            "follow_redirects",
            "accept",
        ],
    );
    fetch_table.insert("engine".to_owned(), toml_string(draft.kind.as_str()));
    fetch_table.insert(
        "max_bytes".to_owned(),
        toml_integer(draft.fetch_max_bytes as i64),
    );
    if draft.kind == "http" {
        fetch_table.insert(
            "method".to_owned(),
            toml_string(draft.fetch_method.as_deref().unwrap_or("GET")),
        );
        fetch_table.insert(
            "timeout_ms".to_owned(),
            toml_integer(draft.fetch_timeout_ms.unwrap_or(15_000) as i64),
        );
        fetch_table.insert(
            "user_agent".to_owned(),
            toml_string(
                draft
                    .fetch_user_agent
                    .as_deref()
                    .unwrap_or("dataarm/template"),
            ),
        );
        fetch_table.insert(
            "follow_redirects".to_owned(),
            toml_boolean(draft.fetch_follow_redirects.unwrap_or(true)),
        );
        fetch_table.insert(
            "accept".to_owned(),
            toml_string(
                draft
                    .fetch_accept
                    .as_deref()
                    .unwrap_or("text/html,application/xhtml+xml"),
            ),
        );
    }
    seed.insert("fetch".to_owned(), toml::Value::Table(fetch_table));

    let mut selection_table = match (
        read_nested_string(seed.get("selection"), "kind"),
        draft.selection_kind.as_str(),
    ) {
        (Some(existing_kind), next_kind) if existing_kind == next_kind => {
            cloned_table(seed.get("selection"))
        }
        _ => toml::Table::new(),
    };
    remove_keys(
        &mut selection_table,
        &[
            "kind",
            "match",
            "index",
            "selector",
            "start",
            "end",
            "mode",
            "include_start",
            "include_end",
            "flags",
        ],
    );
    selection_table.insert(
        "kind".to_owned(),
        toml_string(draft.selection_kind.as_str()),
    );
    selection_table.insert(
        "match".to_owned(),
        toml_string(draft.selection_match.as_str()),
    );
    if draft.selection_match == "nth" {
        let selection_index = draft
            .selection_index
            .ok_or_else(|| "Guided nth-match targets must include selectionIndex.".to_owned())?;
        selection_table.insert("index".to_owned(), toml_integer(selection_index as i64));
    }
    match draft.selection_kind.as_str() {
        "css_selector" => {
            selection_table.insert(
                "selector".to_owned(),
                toml_string(draft.selection_selector.as_deref().unwrap_or("main")),
            );
        }
        "delimiter_pair" => {
            selection_table.insert(
                "start".to_owned(),
                toml_string(draft.selection_start.as_deref().unwrap_or("<main>")),
            );
            selection_table.insert(
                "end".to_owned(),
                toml_string(draft.selection_end.as_deref().unwrap_or("</main>")),
            );
            selection_table.insert(
                "mode".to_owned(),
                toml_string(
                    draft
                        .selection_delimiter_mode
                        .as_deref()
                        .unwrap_or("literal"),
                ),
            );
            selection_table.insert(
                "include_start".to_owned(),
                toml_boolean(draft.selection_include_start.unwrap_or(false)),
            );
            selection_table.insert(
                "include_end".to_owned(),
                toml_boolean(draft.selection_include_end.unwrap_or(false)),
            );
            if !draft.selection_regex_flags.is_empty() {
                selection_table.insert(
                    "flags".to_owned(),
                    toml::Value::Array(
                        draft
                            .selection_regex_flags
                            .iter()
                            .map(|flag| toml_string(flag.as_str()))
                            .collect(),
                    ),
                );
            }
        }
        other => return Err(format!("Unsupported guided selection kind: {other}")),
    }
    seed.insert("selection".to_owned(), toml::Value::Table(selection_table));

    let mut compare_table = cloned_table(seed.get("compare"));
    remove_keys(
        &mut compare_table,
        &["basis", "whitespace", "rewrite_urls", "canonicalization"],
    );
    compare_table.insert(
        "basis".to_owned(),
        toml_string(draft.compare_basis.as_str()),
    );
    compare_table.insert(
        "rewrite_urls".to_owned(),
        toml_boolean(draft.compare_rewrite_urls),
    );
    if draft.compare_basis == "text" {
        compare_table.insert(
            "whitespace".to_owned(),
            toml_string(draft.compare_whitespace.as_deref().unwrap_or("normalize")),
        );
    }
    compare_table.insert(
        "canonicalization".to_owned(),
        toml::Value::Array(
            draft
                .compare_canonicalizers
                .iter()
                .map(|canonicalizer| {
                    let mut table = toml::Table::new();
                    table.insert("kind".to_owned(), toml_string(canonicalizer.kind.as_str()));
                    if let Some(pattern) = &canonicalizer.pattern {
                        table.insert("pattern".to_owned(), toml_string(pattern.as_str()));
                    }
                    if !canonicalizer.flags.is_empty() {
                        table.insert(
                            "flags".to_owned(),
                            toml::Value::Array(
                                canonicalizer
                                    .flags
                                    .iter()
                                    .map(|flag| toml_string(flag.as_str()))
                                    .collect(),
                            ),
                        );
                    }
                    toml::Value::Table(table)
                })
                .collect(),
        ),
    );
    seed.insert("compare".to_owned(), toml::Value::Table(compare_table));

    let mut storage_table = cloned_table(seed.get("storage"));
    remove_keys(&mut storage_table, &["history_limit"]);
    storage_table.insert(
        "history_limit".to_owned(),
        toml_integer(draft.storage_history_limit as i64),
    );
    seed.insert("storage".to_owned(), toml::Value::Table(storage_table));

    Ok(())
}

fn cloned_table(value: Option<&toml::Value>) -> toml::Table {
    match value {
        Some(toml::Value::Table(table)) => table.clone(),
        _ => toml::Table::new(),
    }
}

fn read_nested_string<'a>(value: Option<&'a toml::Value>, key: &str) -> Option<&'a str> {
    match value {
        Some(toml::Value::Table(table)) => table.get(key).and_then(toml::Value::as_str),
        _ => None,
    }
}

fn remove_keys(table: &mut toml::Table, keys: &[&str]) {
    for key in keys {
        table.remove(*key);
    }
}

fn toml_string(value: &str) -> toml::Value {
    toml::Value::String(value.to_owned())
}

fn toml_integer(value: i64) -> toml::Value {
    toml::Value::Integer(value)
}

fn toml_boolean(value: bool) -> toml::Value {
    toml::Value::Boolean(value)
}

fn http_method_token(method: HttpMethod) -> String {
    match method {
        HttpMethod::GET => "GET".to_owned(),
        other => format!("{other:?}"),
    }
}

fn selection_kind_token(kind: SelectionKind) -> &'static str {
    match kind {
        SelectionKind::CssSelector => "css_selector",
        SelectionKind::DelimiterPair => "delimiter_pair",
        _ => "css_selector",
    }
}

fn selection_match_token(selection_match: SelectionMatch) -> &'static str {
    match selection_match {
        SelectionMatch::Single => "single",
        SelectionMatch::First => "first",
        SelectionMatch::Nth => "nth",
        _ => "single",
    }
}

fn delimiter_mode_token(mode: DelimiterMode) -> &'static str {
    match mode {
        DelimiterMode::Literal => "literal",
        DelimiterMode::Regex => "regex",
        _ => "literal",
    }
}

fn regex_flag_token(flag: &RegexFlag) -> &'static str {
    match flag {
        RegexFlag::CaseInsensitive => "case_insensitive",
        RegexFlag::MultiLine => "multi_line",
        RegexFlag::DotMatchesNewLine => "dot_matches_new_line",
        RegexFlag::SwapGreed => "swap_greed",
        RegexFlag::IgnoreWhitespace => "ignore_whitespace",
        _ => "case_insensitive",
    }
}

fn compare_basis_token(basis: CompareBasis) -> &'static str {
    match basis {
        CompareBasis::Text => "text",
        CompareBasis::InnerHtml => "inner_html",
        CompareBasis::OuterHtml => "outer_html",
        _ => "text",
    }
}

fn whitespace_mode_token(mode: WhitespaceMode) -> &'static str {
    match mode {
        WhitespaceMode::Preserve => "preserve",
        WhitespaceMode::Normalize => "normalize",
        _ => "normalize",
    }
}
