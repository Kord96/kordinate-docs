# Structure {#agent-system}

Kordinate is a multi-agent orchestration platform that turns a single Claude Code session into a team of seven specialists. A developer opens a terminal, types `/boot`, and the **Main** orchestrator loads its context — shared protocols, preloaded memory, recent commits. From that point on, every architectural review, deployment, security scan, or documentation change flows through a contract system called **kords**, where agents consult each other with enforced boundaries and cached results.

The platform runs inside a Kubernetes workstation pod. At its center sits **Beorn**, a shape-shifting MCP server that can become any agent on demand — loading its identity, regenerating its memory, spawning Claude Code with the right system prompt, and caching the result for next time.

## The Agent Team {#main-agent}

Seven agents divide the work along domain lines, and the boundaries are enforced by code, not convention.

**Main** is the orchestrator — the primary Claude Code session the developer interacts with directly. It never performs specialized work itself. Instead, it resolves which agent owns a domain and routes the request through a kord contract. When the developer asks "what's the deployment status?", Main doesn't check kubectl — it invokes `/kord deployer deployment-status` and lets the specialist answer.

**Designer** holds architectural authority. It analyzes project structure, detects patterns (from a catalog of 150+), assesses technical debt, maps dependencies, and reviews APIs. Its analyses feed into architecture explorers like this one. The team chose to make Designer a read-only analyst — it recommends but never modifies code — because architecture reviews that also apply changes tend to drift toward the changes they can see rather than the ones the system needs.

**Deployer** is the only agent authorized to run write kubectl operations. This is enforced at the hook level: the **Guard Hook** checks for a deployer auth lock before allowing `kubectl apply`, `create`, `delete`, `patch`, or `rollout`. Deployer manages the full infrastructure lifecycle — cluster bootstrapping, Kustomize-based manifest pipelines, migrations, rollbacks, and topology configuration.

**Scribe** is the documentation gatekeeper. Every write to a `.kord/` path requires scribe authentication. This prevents agents from accidentally overwriting each other's memory or corrupting the KORD.json registry. Scribe handles onboarding new agents, creating kord contracts, writing memories, and generating architecture documentation.

**Sauron** owns monitoring and observability. It has exclusive access to Grafana dashboards (enforced by the same guard hook), diagnoses production issues by correlating logs and metrics, and scans projects for observability gaps. The Grafana MCP integration means Sauron can read and write dashboards programmatically.

**Warden** handles security — scanning for hardcoded credentials, auditing the pass store, sanitizing code before commits, and checking for breach exposure. The pre-commit-scan kord runs as a gatekeeper before code leaves the repository.

**Alfred** manages environment consistency — profile configuration, credential routing, overlay management, and preflight checks that ensure the development environment matches expectations before work begins.

## Kord Contracts {#kord-contracts}

Agents communicate through **kords** — typed contracts stored as `contract.md` files with YAML frontmatter. Each kord defines a `mode` (stateless or stateful), a `requester` ACL (which agents can call it), a `provider` (derived from the directory path), and provider guidelines (instructions the agent receives with the request).

**Stateless kords** execute locally within the main session. The kord router authenticates as the provider agent, runs the specified skill, removes the auth lock, and returns the result. No network call, no spawning — just a skill invocation with the right identity. This is how `/kord scribe remember` works: Main temporarily becomes Scribe (with Scribe's auth lock), writes the memory, and reverts.

**Stateful kords** route through Beorn. The MCP server finds the contract, checks cache freshness via `kord-expiry.sh`, and either serves the cached response or spawns a fresh agent. This is how `/kord designer project-analysis` works: Beorn checks whether the project source has changed enough to warrant re-analysis, and if so, spawns Designer with full context.

The two-stage expiry system is deliberate. A simple TTL would either over-invalidate (spawning agents for unchanged projects) or under-invalidate (serving stale analysis after major refactors). The magnitude-based approach — measuring how many lines changed relative to the total, weighted by age — means small edits extend the cache while large restructurings trigger re-analysis immediately.

## The Runtime Layer {#guard-hook}

Three hooks registered in `settings.json` form the runtime's nervous system.

The **Guard Hook** fires on every Write, Edit, and Bash tool call. It is a chain-of-responsibility pattern: the hook parses the tool input, matches against patterns (`.kord/` paths, kubectl commands, git push, Grafana API calls), and either allows or denies based on which agent's auth lock exists in `/tmp/`. The guard also implements field-level ACL for `config.yaml` — each YAML path has an owning agent defined in `config-acl.yaml`, and only that agent (or Scribe as fallback) can modify it.

The **Agent Memory Hook** fires before any Agent tool call. It regenerates the target agent's `MEMORY.md` by hashing all source directories and comparing to a stored hash. On cache miss, it combines shared memory, agent-specific instructions, static knowledge files, and a kord discovery scan (listing which kords the agent provides and which it can request) into a single markdown file that Claude loads automatically.

The **Worktree Push Hook** fires after any Bash command. When it detects a successful `git push` from a worktree on a `session/*` branch, it automatically merges to main — fast-forward if possible, rebase if not. If the rebase conflicts, it aborts cleanly and suggests `/merge`. This is why multiple agents can work in parallel worktrees without stepping on each other: each pushes to its own session branch, and the hook handles the integration.

## State and Configuration {#config-yaml}

Truth lives in a small set of authoritative files. **Config YAML** holds all cluster IPs, ports, hostnames, and service endpoints in one place — every deployment manifest, monitoring configuration, and connection string references it rather than hardcoding values. **KORD.json Registry** is the auto-generated registry of everything in the system — agents, memory files, skills, kords, hooks — with metadata flags that power the guard's curated-file detection and Beorn's agent discovery. **Agent Memory** is the institutional knowledge layer: markdown files with frontmatter that record user preferences, feedback, project context, and external references across conversations.

The authentication model is intentionally simple. Each agent has a static lock file at `profile/locks/<name>`. To authenticate, an agent copies its lock to `/tmp/.<name>-auth`. The guard compares the file contents. This works because all agents run in the same pod — there is no network boundary to cross, and the lock file's content serves as a shared secret between the guard and the authenticated agent. The deliberate limitation is that only one agent of each type can be authenticated at a time, which prevents parallel conflicting operations.
