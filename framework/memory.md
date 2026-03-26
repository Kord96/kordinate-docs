# Recall System

Everything in kordinate — identity, skills, memory, contracts — is knowledge. The recall system defines how knowledge is stored, loaded, and discovered.

## Properties

Every piece of knowledge is described by nine properties:

| Property | Question | Values | Default |
|----------|----------|--------|---------|
| **Path** | Where is it? | file path | required |
| **Name** | Short identifier | text | derived from path |
| **Description** | What is this? | one-line text | required |
| **Template** | Does it follow a template? | `none` / `<template>` | `none` |
| **Curated** | Updated only when explicitly requested? | `true` / `false` | `false` |
| **Preloaded** | Who loads it at startup? | `none` / `all` / `<agent>` | `none` |
| **Owner** | Who owns it? | `team` / `<kord>` / `<agent>` | `agent` |
| **Scope** | Where does it apply? | `global` / `project` | `global` |
| **Expiry** | Does it expire? | `none` / `<script>` / `<.md>` | `none` |

- **Preloaded**: `all` = imported into the main session's spawn prompt, survives compaction, everyone sees it. `<agent>` = loaded into that agent's spawn prompt. `none` = loaded on-demand via boot or explicit read.
- **Curated** files are not auto-updated by agents. Changes only happen when a human explicitly requests them.
- **Template** files must follow the referenced template.
- **Scope**: `global` lives at `~/.kord/`. `project` lives at `.kord/`.

## Registry

`KORD.md` is the registry of all knowledge. Generated and maintained by [scribe](../agents/scribe.md).

## Enforcement

All writes to kordinate paths (`kord/`) and memory paths go through scribe. A hook on `Write|Edit` blocks unauthorized writes and tells the agent to delegate to scribe. Scribe handles:

- Template validation for templated files
- Scope decision (global vs project) for memory writes
- Writing to both kordinate and runtime-native paths (linking)
- Updating KORD.md with new entries
