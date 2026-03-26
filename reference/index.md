# Reference

- **[Patterns](patterns/index.md)** — recognized architectural patterns (designer)
- **[Libraries](libraries/index.md)** — shared libraries and third-party dependencies (designer)
- **[Source Map](source-map.md)** — maps doc pages to implementation sources (scribe)

## Claude Code

Key behaviors ([agents](https://code.claude.com/docs/en/sub-agents), [skills](https://code.claude.com/docs/en/skills), [memory](https://code.claude.com/docs/en/memory)):

=== "Main Agent"

    The main Claude Code session — what the developer interacts with directly.

    - **Spawn prompt**: `~/.claude/CLAUDE.md` — developer-written and curated. Claude does not auto-write to it unless explicitly asked. Persists across sessions.
    - **Auto memory**: `~/.claude/projects/<project>/memory/` — Claude writes this itself. Per-project only. `MEMORY.md` acts as index, topic files hold details.
    - Has full access to all tools, MCP servers, skills, and rules.
    - CLAUDE.md is not inherited by subagents — they never see it.

=== "Auto Memory"

    `~/.claude/projects/<project>/memory/`

    - Claude writes this itself as it works — not developer-written.
    - Per-project only. No global auto memory exists. All worktrees in the same git repo share one memory directory.
    - `MEMORY.md` acts as an index — each line links to a topic file with a description. First 200 lines auto-loaded at startup.
    - Topic files (`*.md`) hold detailed notes. Claude reads these on-demand when it needs the information.
    - Beyond 200 lines, Claude is nudged to curate — move details into topic files, keep MEMORY.md concise.
    - Subagents have a simpler version: single `MEMORY.md` at `~/.claude/agent-memory/<name>/MEMORY.md`, no topic files. Only created if `memory:` is set in the agent's frontmatter.

=== "Subagents"

    `~/.claude/agents/<name>.md`

    - Defined as a flat markdown file: YAML frontmatter (`name`, `description`, `tools`, `model`, `memory`, `hooks`, `skills`) + markdown body as spawn prompt.
    - Start with only: own spawn prompt, basic environment details (working directory), inherited MCP servers and permissions.
    - No CLAUDE.md, no conversation history, no rules, no parent skills — isolated context.
    - Skills must be listed explicitly in `skills:` frontmatter to be injected at startup.
    - Auto memory at `~/.claude/agent-memory/<name>/MEMORY.md` — only if `memory:` is set. First 200 lines auto-injected. No topic files.
    - Context isolation — parent receives a concise summary, not every file the subagent read or explored.

=== "Skills"

    `~/.claude/skills/<name>/SKILL.md`

    - Skills are global — not agent-scoped. Agents reference them by name via `skills:` frontmatter.
    - Three loading levels:
        - **Level 1 (Metadata)**: SKILL.md frontmatter — all fields (see collapsible below) loaded at startup.
        - **Level 2 (Instructions)**: SKILL.md body — loaded when skill is triggered.
        - **Level 3 (Resources)**: Other files in the directory — loaded on-demand when referenced by Level 2 instructions.
    - Invocable by user (`/skill-name`) and/or by Claude automatically, controlled by frontmatter.

    ??? example "Skill with resources"

        ```
        infra/
        ├── SKILL.md              # Level 1 (frontmatter) + Level 2 (body)
        ├── checklist.md          # Level 3 — pre-roll verification steps
        └── scripts/
            └── health-check.sh   # Level 3 — executed, only output enters context
        ```

        `SKILL.md`:

        ```markdown
        ---
        name: roll
        description: Roll deployments between environments
        argument-hint: [source] [target]
        allowed-tools: Read, Edit, Bash, Glob
        disable-model-invocation: true
        ---

        Roll $ARGUMENTS between environments:

        1. Run pre-roll checks — see [checklist.md](checklist.md)
        2. Verify source health: `./scripts/health-check.sh $0`
        3. Apply manifests to target
        4. Verify target health: `./scripts/health-check.sh $1`
        ```

    ??? note "Frontmatter fields"

        | Field | Required | Purpose |
        |-------|----------|---------|
        | `name` | No | Display name, becomes `/slash-command`. Defaults to directory name |
        | `description` | Recommended | When to use the skill |
        | `argument-hint` | No | Hint for autocomplete (e.g. `[issue-number]`) |
        | `disable-model-invocation` | No | `true` = only user can invoke |
        | `user-invocable` | No | `false` = only Claude can invoke |
        | `allowed-tools` | No | Tools allowed without permission when skill is active |
        | `model` | No | Model override |
        | `effort` | No | Effort level override |
        | `context` | No | `fork` = run in subagent |
        | `agent` | No | Which subagent type when `context: fork` |
        | `hooks` | No | Hooks scoped to this skill |
