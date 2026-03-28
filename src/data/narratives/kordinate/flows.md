# Flows {#kord-router}

## The Kord Request Journey {#kord-stateful}

When a developer types `/kord designer project-analysis stoik` in their terminal, a chain of events unfolds across five components in under a second of orchestration overhead — or up to five minutes if the analysis is stale and Designer needs to re-examine the project.

**Main** receives the command and invokes the **Kord Router** skill. The router's first job is resolution: it scans `agents/*/kords/` directories looking for a contract named `project-analysis`. It finds it under `agents/designer/kords/project-analysis/contract.md`, which tells it the provider is Designer, the mode is stateful, and any agent can request it. The router reads the contract's provider guidelines — instructions that will be prepended to the message when Designer is spawned.

Because the mode is stateful, the router makes an HTTP POST to **Beorn** at `localhost:3100/mcp`. Beorn finds the kord directory, derives a cache slug from the message (in this case, `stoik`), and checks for a cached response at `data-stoik.md`.

Before serving the cache, Beorn runs the **Kord Expiry Engine**. This script reads `cache_inputs` from the contract frontmatter — a list of paths whose changes should invalidate the cache, plus threshold values. It loads the `.snapshot` file (md5 hashes and line counts from the last analysis), walks the current source files, and computes a change score: what fraction of lines changed, weighted by how old the cache is. If the stoik project had 2000 lines and 50 changed in the last day, the score stays below the fresh threshold — Beorn returns `[cached]` with the previous analysis.

But if the developer just finished a major refactor — 400 lines changed across 15 files — the score crosses the stale threshold. Beorn regenerates Designer's memory (via the same `agent-memory.sh` hook), loads Designer's system prompt from `IDENTITY.md` plus all preloaded memory files, and spawns `claude --print` with the provider guidelines and the message. Designer performs its analysis, writes artifacts to the project's `.kord/agents/designer/memory/` directory, and returns the response on stdout. Beorn caches it, writes a new snapshot, and sends the result back through MCP.

The uncertain zone between thresholds triggers a lightweight review instead of a full re-analysis — Beorn fills in a review template with the diff and cached data, spawns a quick agent check, and only escalates to full regeneration if the review says `STALE`.

## Agent Boot Sequence {#agent-boot}

Every agent — whether spawned by Beorn via `claude --print` or by Main via the Agent tool — goes through the same boot sequence, but the first phase happens before the agent even knows it exists.

When Main uses the Agent tool to spawn Sauron (for example), Claude Code's hook system fires the **Agent Memory Hook** as a PreToolUse event. The hook extracts the agent name from the tool input, checks if this agent exists in kordinate (skipping built-in types like "Explore" or "Plan"), and runs a hash-based freshness check. It computes an md5 hash of all files under the agent's shared memory, static knowledge, instructions, and the entire kords directory. If this hash matches the stored `.hash` file and the `MEMORY.md` already exists, the hook returns immediately — the memory is fresh.

On a cache miss, the hook rebuilds `MEMORY.md` from scratch. It reads shared team memory, inlines any instruction files, decides whether to inline or index static knowledge based on line count (under 500 lines gets inlined, over 500 gets an index with file paths), and scans all kord contracts to discover which kords this agent provides and which it can request. The result is a single markdown file that serves as the agent's full knowledge base for the session.

Once spawned, the agent runs `/boot`. This skill syncs git state (pulling from remote if configured), reads the **Shared Protocols** in `$KORDINATE_HOME/shared/`, loads memory files where frontmatter has `preloaded: <agent-name>`, and checks recent git commits for context. The agent is now fully loaded with institutional memory, team protocols, and current project state.

## Guarded Write Flow {#guarded-write}

Every tool call that could modify state — Write, Edit, or Bash — passes through the **Guard Hook** before execution. The hook receives the full tool input as JSON and makes a rapid series of pattern-matching decisions.

For Write and Edit operations, the guard checks the file path. If the path contains `/.kord/`, the guard requires scribe authentication — it looks for `/tmp/.scribe-auth` and compares its contents to the lock file at `profile/locks/scribe`. If neither matches, it checks the **KORD.json Registry** to see if the file is curated: uncurated, non-templated files in `.kord/` directories are allowed without authentication, because agents need to write their own scratchpads and non-critical memory files. But curated files — identities, contracts, registry entries — are Scribe-only.

The guard also implements special handling for **Config YAML**. Instead of blanket protection, it uses `config-acl.yaml` to determine which top-level YAML key the edit falls under, then checks if the owning agent is authenticated. This means **Alfred** can edit cluster configuration without Scribe's involvement, but cannot touch monitoring settings that belong to **Sauron**.

For Bash operations, the guard looks for specific command patterns. `git push` triggers branch analysis: pushes to `session/*` and `memory/*` branches are always allowed, pushes to `test` and `prod` require deployer authentication, and pushes to `main` require either a fast-forward check (is origin/main an ancestor of HEAD?) or the presence of a `.merge-lock` directory indicating the **Merge Skill** is running. kubectl write commands (apply, create, delete, patch, scale, rollout, drain, cordon) require deployer authentication, with a hard block on self-modifying the workstation deployment or draining nodes — those operations are never allowed from inside the pod, regardless of authentication.

## Worktree Auto-Merge {#worktree-merge}

The worktree system enables parallel agent work without merge conflicts. Each agent operates in its own git worktree on a `session/<name>` branch. When an agent finishes work and pushes, the **Worktree Push Hook** fires as a PostToolUse event.

The hook detects git push commands by pattern matching, resolves the repository root (handling `git -C <dir>` and `cd <dir>` patterns), and checks two conditions: is this a worktree (not the main repo), and is the branch a `session/*` branch?

For the merge itself, the hook first attempts a fast-forward. It fetches `origin/main`, checks if main is an ancestor of the current HEAD, and if so, updates the main ref directly and pushes — no merge commit, no noise. This is the happy path when only one agent is working.

When fast-forward is not possible — because another agent merged to main since this branch diverged — the hook creates a temporary worktree, checks out the session branch detached, and rebases onto `origin/main`. If the rebase succeeds, it pushes `HEAD:main`. If it conflicts, it aborts the rebase, cleans up, and reports the conflict with a suggestion to run `/merge`.

The `.merge-lock` directory acts as a mutex: only one merge can run at a time. If another merge is in progress, the hook reports that the session branch was pushed but not yet merged, and it will be picked up on the next push or via `/merge`.

## Installation Flow {#install-flow}

A fresh kordinate installation starts with `/install` and cascades through two agents before the system is operational.

The **Install Skill** first creates `~/.kord/` by copying the kordinate package from the development repo. It initializes git, optionally sets up a backup remote on GitHub, then delegates to **Scribe** for runtime linking. Scribe's onboard skill creates symlinks from `~/.kord/agents/` to `~/.claude/agents/`, from skills to `~/.claude/skills/`, generates KORD.md (the human-readable index), and installs the guard hook into the Claude Code settings.

If the user opted for full installation (not `--local`), the **Install Skill** then delegates to **Deployer** for infrastructure bootstrapping. **Deployer** runs the **Kordinate CLI** to install k3s, then uses the **Infra Skill** to set up namespaces (gateway, master, monitor), create storage PVCs, and deploy the workstation pod — which starts **Beorn** as a background process. At that point the system is self-hosting: Beorn can spawn agents, agents can consult each other through kords, and the developer has a fully operational multi-agent team.
