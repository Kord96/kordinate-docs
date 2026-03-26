# Agent Reference

## Agent Structure

Every agent follows the same layout. Use `/onboard` to add new agents to the team.

```
<agent>/
├── IDENTITY.md              # role, tools, auth, workflow, rules
├── skills/<name>/SKILL.md   # agent's skills (+ optional resources)
└── memory/*.md              # domain knowledge, notes

skills/                          # global skills
├── merge/SKILL.md              # available to all agents
└── subagents/                  # shared by subagents only
    ├── boot/SKILL.md
    └── kord/SKILL.md
```

Skills are co-located with their agent — they need agent context (memory, kords) to be useful. Global skills are either available to everyone (`merge`) or shared by all subagents (`boot`, `kord`).

Any agent can be invoked as root (the main session) or as a subagent through [beorn](beorn.md). The structure is the same either way — identity, skills, and memory travel with the agent regardless of how it's invoked.

??? note "IDENTITY.md template"

    ```markdown
    ---
    name: <agent-name>
    description: <one-line role description>
    tools: [Read, Edit, Write, Bash, Glob, Grep]
    model: inherit
    ---

    # <Agent Name>

    <Role description.>

    ## Workflow

    1. <step>
    2. <step>

    ## Rules

    - <rule>
    ```

## Roster

=== "Shared"

    Skills, guards, and hooks inherited by every agent.

    **Requirements:** none

    | Type | Name | Purpose |
    |------|------|---------|
    | skill | `/boot` | Catch up on parent context and code changes |
    | skill | `/kord` | Invoke an agent via kord protocol |
    | skill | `/merge` | Merge session branch forward |
    | guard | `guard.sh` | Unified domain enforcement |
    | hook | `agent-memory.sh` | Regenerate agent MEMORY.md before spawn |

=== "Scribe"

    Documentation gate — sole structured file editor.

    **Requirements:** none

    | Type | Name | Purpose |
    |------|------|---------|
    | skill | `/onboard` | Add a new agent to the team |
    | skill | `/create-kord` | Define a new kord |
    | skill | `/kord scribe update agent docs` | Update agent documentation |
    | skill | `/kord scribe update project docs` | Update project documentation |

=== "Beorn"

    MCP server that enables any subagent to invoke any other subagent. Spawns short-lived clones that inherit the target agent's identity, memory, and skills. See [Beorn](beorn.md) for details.

    **Requirements:** beorn server (Node.js MCP server)

=== "Deployer"

    Infrastructure operations — sole kubectl write authority.

    **Requirements:** container registry, kubectl access

    | Type | Name | Purpose |
    |------|------|---------|
    | skill | `/infra` | Infrastructure operations (subcommands: bootstrap, deploy, roll, stop, clean, diff, migrate, generate-overlays) |
    | guard | `guard.sh` | Domain enforcement (kubectl write ops) |
    | tool | `postgres.py` | Local database operations |

=== "Sauron"

    Monitoring, observability, and code validation.

    **Requirements:** Grafana, Prometheus, Loki, Alloy (deployed on demand)

    | Type | Name | Purpose |
    |------|------|---------|
    | skill | `/scan` | Scan a project for monitoring gaps |
    | skill | `/diagnose` | Diagnose a specific issue |
    | guard | `guard.sh` | Domain enforcement (Grafana access) |
    | tool | Grafana MCP | Dashboard management |
    | tool | nokrashi-tools | Code analysis |
    | tool | klog | Log analysis |

=== "Designer"

    Architecture review and pattern authority.

    **Requirements:** none

    | Type | Name | Purpose |
    |------|------|---------|
    | skill | `/detect-patterns` | Scan a project for recognized patterns |
