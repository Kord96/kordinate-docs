# Sessions & Branches

Each tmux window runs its own agent runtime with isolated agents and hooks. Windows create isolated git worktrees + branches via `bin/claude-session`. On exit: commits uncommitted work, cleans up if no changes.

```mermaid
flowchart TB
    subgraph tmux
        direction TB
        subgraph p1[project-1 session]
            W0[window 0 — main branch<br/>no worktree]
            W1[window 1 — session/w1<br/>isolated worktree]
            W2[window 2 — session/w2<br/>isolated worktree]
        end
        subgraph p2[project-2 session]
            PW0[window 0 — main branch]
            PW1[window 1 — session/w1<br/>isolated worktree]
        end
    end

    W1 & W2 & PW1 -->|on exit| CHK{changes?}
    CHK -->|yes| COMMIT[commit uncommitted work]
    CHK -->|no| CLEAN[cleanup worktree]
    COMMIT --> PRESERVE[session preserved locally]
```

## Branch Model

Session branches are **local only** -- never pushed to remote. The agent pushes directly to main when ready (`git push origin HEAD:main`). If that fails (non-fast-forward), use `/merge` to rebase.

`main` → `test` → `prod`
