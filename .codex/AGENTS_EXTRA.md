# Dataarm Directives

## Upstream projects defects reporting

If you encounter any defects/bugs with either 'htmlcut' and/or 'ffhn' deps - write the specifics of such defects to the file .codex/htmlcut-and-ffhn-defects.txt.

The file is a plain list of open defects with enough detail to reproduce and fix them. No status fields, no "FIXED" markers, no verification notes — just the defect descriptions. When a defect is resolved, remove it. When no open defects remain, delete the file.

## Local browser QA discipline

When using the in-app browser or any local browser automation against this repository's frontend:

1. Start the dev server in a persistent TTY session, not a disposable background shell.
2. Bind it explicitly to `127.0.0.1` or `0.0.0.0`; do not rely on the default host binding.
3. Verify the listener before browser navigation with both:
   - `lsof -nP -iTCP:<port> -sTCP:LISTEN`
   - `curl -I http://127.0.0.1:<port>/`
4. If browser navigation fails, distinguish the first failing layer precisely:
   - no listening process;
   - wrong bind address;
   - connection refused by the OS networking stack;
   - browser-tool policy on the generated error page.
5. If the dev server is stopped for tests, packaging, or port isolation, say so explicitly and relaunch it before handing the local browser back to the user.
