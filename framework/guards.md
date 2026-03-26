# Guards

Guards enforce domain boundaries by restricting operations to the agent that owns them. They are built on the runtime's PreToolUse hook system and check authentication lock files before allowing actions through.

## Unified Guard

All domain enforcement lives in a single script: [`guard.sh`](../../kordinate/hooks/guard.sh). It routes by tool type:

| Tool trigger | Condition | Auth required | Deny message |
|---|---|---|---|
| Write/Edit to `*/.kord/*` | `curated: true` in KORD.json | `/tmp/.scribe-auth` | Use `/kord remember` |
| Write/Edit to `*/dashboards/*.json` | any | `/tmp/.sauron-auth` | Use `/authenticate` as sauron |
| Bash `git push` to main | branch has diverged | — | Use `/merge` to rebase |
| Bash `git push` to test/prod | any | `/tmp/.deployer-auth` | Use `/infra roll` |
| Bash `kubectl` write ops | mutating verbs | `/tmp/.deployer-auth` | Use `/infra` |
| Bash `kubectl` workstation/master/drain/cordon | any | **always blocked** | Never allowed |
| Bash Grafana API calls | any | `/tmp/.sauron-auth` | Use `/authenticate` as sauron |
| `mcp__grafana*` | any | `/tmp/.sauron-auth` | Use `/authenticate` as sauron |

Non-curated, non-templated `.kord/` files are allowed without scribe auth. Pushes to `session/*` and `memory/*` branches are always allowed. Main-branch pushes pass if fast-forward is possible or a `.merge-lock` directory exists.

## Authentication Flow

1. Agent runs `/authenticate` — copies `profile/locks/<agent>` to `/tmp/.<agent>-auth`
2. Guard reads both files and compares contents
3. Match — allow. Missing or mismatch — deny.

## Automation Hooks

Alongside the guard, one automation hook is registered:

| Hook | Trigger | Purpose |
|---|---|---|
| `agent-memory.sh` | Agent (PreToolUse) | Regenerate agent MEMORY.md on spawn (hash-based caching) |

## Adding Guards

New guards are added as cases within `guard.sh`, not as separate scripts. The routing switch at the bottom dispatches by tool name:

```bash
case "$TOOL" in
  Write|Edit)     guard_write ;;
  Bash)           guard_bash ;;
  mcp__grafana*)  guard_grafana_mcp ;;
  *)              allow ;;
esac
```

To add a new guard: add a handler function, then add a case to the switch. Register the tool trigger in `settings.json` if it is not already covered.
