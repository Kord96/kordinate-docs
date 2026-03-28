# Resilience {#beorn}

## When Beorn Goes Down {#beorn-unreachable}

At 2am, the workstation pod's OOM killer terminates the **Beorn** process. The developer does not notice immediately — they are working in **Main**, which runs as its own Claude Code session. But the next time they type `/kord designer pattern-review`, the **Kord Router** HTTP POST to `localhost:3100/mcp` times out.

The system degrades gracefully. The **Kord Router** detects the MCP connection failure and falls back to native subagent spawning via Claude Code's built-in Agent tool. It reads the contract's provider guidelines, spawns **Designer** directly, and returns the result. The difference: no caching. Every subsequent request to the same kord spawns a fresh agent, which is slower (30-60 seconds instead of instant cache hits) and costs more (each spawn is a full Claude Code invocation). But the system stays functional.

The recovery path is straightforward: restart the workstation pod or restart the Beorn process within it. Since Beorn runs as a background process (`node server.js &`), a simple `kill` and restart restores full functionality. Cache files are lost on pod restart (they live on the local filesystem), so the first request after restart triggers a fresh analysis, and subsequent requests hit the rebuilt cache.

## The Guard Hook Locks Everything {#guard-hook-failure}

The **Guard Hook** is the most critical single point of failure in the system. If `guard.sh` has a syntax error, fails to parse JSON input, or crashes with a non-zero exit code, Claude Code's hook system treats it as a denial — and every Write, Edit, and Bash operation across all agents fails.

This happened during development when a `git fetch` call in the guard's push-to-main check broke in worktree environments where `git` could not determine the repo root. The fix was to extract the repository path from `git -C <dir>` flags in the command string and use explicit `-C <repo_root>` for all git operations in the guard. But during the outage, no agent could write anything.

The detection is immediate: any tool call returns a deny with an unexpected reason. The recovery requires editing `guard.sh` directly — which is itself guarded. The emergency escape hatch is removing the hook from **Settings & Hook Config** temporarily, but this disables all domain enforcement. The deeper lesson is that the guard must be tested against every tool input pattern that could reach it, including edge cases like worktree-relative paths, `git -C` flags, and kubectl commands piped through other tools.

The system's design acknowledges this risk by keeping the guard as a single bash script with a simple structure: parse input, match patterns, check auth, allow or deny. There are no external dependencies, no network calls, no dynamic loading. The failure mode is all-or-nothing, which is preferable to partial enforcement (where some agents bypass the guard silently).

## Worktree Merge Conflicts {#worktree-merge-conflict}

When **Designer** is analyzing architecture in `session/w1-kordinate` while **Deployer** is updating manifests in `session/w2-kordinate`, both may push to their session branches within seconds of each other. The **Worktree Push Hook** processes them sequentially (the `.merge-lock` directory acts as a mutex), and the first push merges cleanly. But the second push finds that main has moved — the rebase may conflict if both agents touched overlapping files.

The impact is contained: the session branch is pushed successfully (the agent's work is safe on the remote), but it is not merged to main. The hook reports the conflict and suggests `/merge`. The developer — or any agent with the **Merge Skill** — can then resolve manually.

The system prevents the worst-case scenario (lost work) by design. The rebase is always attempted in a disposable temporary worktree, and on conflict, the hook runs `rebase --abort` before cleaning up. The session branch is never modified. The `.merge-lock` prevents race conditions between concurrent merge attempts.

In practice, conflicts are rare because agents work in different domains: **Designer** reads architecture files, **Deployer** writes manifests, **Scribe** writes documentation. The **Guard Hook** domain enforcement means agents rarely touch the same files. When they do (both writing to KORD.json after adding new entries, for example), the conflicts are typically trivial — adjacent line additions that git could merge if it understood the file format, but cannot because they appear in the same hunk.

## Memory Goes Wrong {#memory-corruption}

**Agent Memory** corruption is subtle. It does not crash the system — it degrades it. An agent boots with incomplete context, forgets a user preference it learned three sessions ago, or fails to apply a feedback correction that was already resolved. The developer notices when the agent repeats a mistake they already corrected, or when its suggestions feel generic rather than tailored.

The most common cause is concurrent memory writes from different conversations. If two sessions both invoke `/kord scribe remember` with different facts about the same topic, the worktree isolation prevents file-level conflicts, but the semantic conflict remains: which memory is current? The system does not have a conflict resolution strategy for semantic memory — the last write wins.

Detection relies on the developer noticing behavioral regression. The `/audit-kordinate` skill provides a structural health check (are memory files well-formed? do frontmatter properties match expected schemas? are preloaded files actually being loaded?), but it cannot detect semantic staleness — a memory that was true last week but no longer applies.

Recovery is straightforward: agent memory is versioned by git. Running `git log` on `~/.kord/` shows when each memory file was last modified, and `git diff` reveals what changed. Restoring a previous version is a `git checkout` away. The MEMORY.md regeneration is idempotent — deleting the dynamic MEMORY.md and spawning the agent rebuilds it from current sources.

## Cache Expiry Gets It Wrong {#cache-expiry-miscalibration}

The magnitude-based expiry in the **Kord Expiry Engine** is a heuristic, and heuristics can be wrong in both directions.

**Too aggressive** (low thresholds): every small edit triggers a full agent spawn. A developer fixing a typo in a README causes **Designer** to re-analyze the entire project. The symptom is slow kord responses — what should be a cache hit takes 30-60 seconds as the agent re-runs its analysis. The fix is raising the `threshold` value in the contract's `cache_inputs` frontmatter.

**Too conservative** (high thresholds): the cache serves stale data after significant changes. The developer refactors a major module, but the change score stays below the stale threshold because it is proportional to the total project size (300 lines changed out of 10,000). The symptom is that kord responses reference components or patterns that no longer exist. The fix is lowering `stale_threshold` or reducing `max_age`.

The uncertain zone (between threshold and stale_threshold) was designed to handle the gray area. When the change score falls in this range, **Beorn** runs a lightweight review instead of a full regeneration — it fills in a review template with the diff since last snapshot and the current cached data, and asks an agent to determine if the changes invalidate the analysis. This catches cases where a small change (renaming a core interface) has outsized architectural impact that the line-count heuristic would miss.

The escape hatch is manual: delete the `.snapshot` file for a kord, and the next invocation treats the cache as uncertain (it has data but cannot measure change), which triggers the review path. Delete `data-<slug>.md`, and the cache is fully cleared.
