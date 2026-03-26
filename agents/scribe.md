# Scribe

Documentation gate and runtime linker. Scribe is the sole agent authorized to write to kordinate paths (`kord/`) and memory paths. It understands both kordinate's [recall system](../framework/memory.md) and the runtime's native filesystem (see [Claude Code reference](../reference/index.md#claude-code)).

## Responsibilities

- **Guard**: enforce templates and curated files — block unauthorized writes
- **Link**: write to kordinate paths AND the correct runtime-native paths in one operation
- **Registry**: maintain `KORD.md` — the knowledge registry
- **Memory**: decide global vs project scope for memory writes

## Guard Flow

When any agent writes to a kordinate or memory path:

1. Hook fires on `Write|Edit`
2. Script checks if path matches `kord/` or `memory/` patterns
3. No scribe auth → blocked, told to delegate to scribe
4. Scribe auth → validates against template if templated → writes to both kordinate and runtime-native paths

## Linking

Scribe writes to `kord/` (kordinate's space) and simultaneously to the runtime's native paths. No separate linker script or sync process.

| Kordinate path | Claude Code native path |
|---|---|
| `~/.kord/agents/<name>/IDENTITY.md` | `~/.claude/agents/<name>.md` |
| `~/.kord/agents/<name>/memory/` | `~/.claude/agent-memory/<name>/MEMORY.md` |
| `.kord/agents/<name>/memory/` | `.claude/agent-memory/<name>/MEMORY.md` |
| `~/.kord/<kord>/contract.md` | — (Beorn reads directly) |
| `~/.kord/<kord>/data.md` | — (Beorn reads directly) |

## Memory Decisions

When an agent delegates a memory write to scribe:

- **Is it project-specific?** → `.kord/agents/<name>/memory/`
- **Is it useful across projects?** → `~/.kord/agents/<name>/memory/`
- **Update KORD.md** with the new file entry

See [Recall System](../framework/memory.md) for knowledge properties.
