# Installation

## Tiers

### Tier 0: Image Build

What's baked into the workstation image. Built once, never seen by the user.

- Ubuntu 24.04
- Git
- Claude Code
- pass + GPG
- Tailscale client
- tmux (auto-attach to `0-general` on login)
- Shell configured (PATH, KORDINATE_HOME, .bashrc)
- Kordinate framework at `~/.kord/`
- Beorn server pre-installed
- Core agents: root, scribe
- Core guard: guard.sh
- Core skills: /kord, /boot, /merge
- Recall system (8-property knowledge model)
- Kord protocol (/kord, stateless/stateful)
- Worktree sessions (claude-session, tmux-new-window)

### Tier 1: Install

What the user runs. One command, SSH access ready.

```bash
curl -sL kordinate.dev/install | sudo bash
```

```
Installing k3s... done
Deploying headscale... done
Deploying workstation... done

Found on host:
  ✓ Claude credentials
  ✓ GPG keys
  ✓ SSH keys
  ✓ Git config (Khaled <khaled@example.com>)
  ✓ GitHub CLI
Copy to workstation? [Y/n] y
Copying credentials... done

Installing Tailscale... done

Welcome to Kordinate.
  ssh claude@workstation
```

Behind the scenes:

1. Installs k3s
2. Creates `master` namespace
3. Deploys headscale pod (self-hosted Tailscale coordination)
4. Pulls pre-built workstation image
5. Deploys workstation pod (20Gi PVC, auto-registers with headscale)
6. Copies host credentials into the workstation (if found)
7. Installs Tailscale on the user's machine and connects to headscale
8. SSH access ready: `ssh claude@workstation`

Step 6 scans the host for existing credentials and offers to copy them:

```
Found on host:
  ✓ Claude credentials
  ✓ GPG keys
  ✓ SSH keys
  ✓ Git config (Khaled <khaled@example.com>)
  ✓ GitHub CLI

Copy to workstation? [Y/n]
```

The workstation inherits your identity — git commits have your name, SSH works with your keys, Claude is logged in, GitHub is authenticated. No re-setup needed.

### Tier 2: Default Team

From inside the workstation. Installs the infra team and its dependencies.

```
"install the default team"
```

1. Deploys container registry
2. Deploys monitoring stack (Grafana, Prometheus, Loki, Alloy)
3. Enables deployer, sauron, designer agents
4. Enables infrastructure guards (guard-kubectl.sh, guard-grafana.sh)
5. Enables infrastructure kords (pattern-review, monitoring-impact, defaults)

### Tier 3: Addons

From inside the workstation. Project-specific services.

```
/infra bootstrap addon postgres
/infra bootstrap addon redis
/infra bootstrap addon cloudflare
```

Each addon deploys its manifests and configures MCP.

- Postgres — project database
- Redis — project cache/queue
- Cloudflare Tunnel + DNS — public routing

## File Layout

Kordinate lives at `~/.kord/` (global) and `.kord/` (per-project). Scribe handles writing to both kordinate and runtime-native paths.

## Credentials

All credentials live in the `pass` store under `kordinate/`.

| Credential | Tier | Setup |
|-----------|------|-------|
| Claude | 1 | Auto-copied from host, or `claude login` inside workstation |
| GPG keys | 1 | Auto-copied from host, or generated inside workstation |
| SSH keys | 1 | Auto-copied from host (prompted) |
| Git config | 1 | Auto-copied from host |
| GitHub | 1 | Auto-copied from host (gh CLI or SSH key), or `gh auth login` inside workstation |
| Pass store | 0 | Pre-initialized in image |
| Headscale | 1 | Auto-configured during install |
| Grafana | 2 | API key saved to pass |
| Cloudflare | 3 | API token saved to pass |

Credentials are portable:

```bash
kordinate export backup.gpg    # bundle to encrypted archive
kordinate import backup.gpg    # restore on another machine
```

## Adding Machines

Requires Tier 2 (default team). Adding nodes is an infrastructure operation owned by the deployer agent.

From the workstation:

```
"invite a new machine"
```

Or explicitly: `/infra bootstrap invite`

```
Join code: ABCD-1234
Expires in 10 minutes. One-time use.

Run on the new machine:
  curl -sL kordinate.dev/install | bash -s -- join ABCD-1234
```

On the new machine:

```bash
curl -sL kordinate.dev/install | bash -s -- join ABCD-1234
```

1. Installs Tailscale
2. Connects to headscale using the join code
3. Fetches k3s node token over the private network
4. Installs k3s agent
5. Machine is a worker node

```
claude@workstation:~$ kubectl get nodes
NAME          STATUS   ROLES
server-1      Ready    control-plane
new-machine   Ready    <none>
```

### Security

- Join codes are **one-time use** — expire after first use
- Join codes have a **10-minute TTL** — expire if unused
- Joining gives the machine **network access only** — cluster admin is separate (k8s RBAC)

## Current Implementation

!!! warning "Work in progress"
    The tier system is the target architecture. The current `kordinate-cli init` installs tiers 1+2 together. Tier separation and the `curl` installer are planned.

### Quick Start (current)

```bash
git clone https://github.com/kord96/kordinate.git
cd kordinate
sudo ./installer/kordinate-cli init
```

```bash
kubectl -n master exec -it deploy/workstation -c workstation -- bash
claude login
```

### After Install

```bash
# Build your own team:
/onboard myagent "manages database migrations"
/create-kord migration-review "architecture review for migration changes"

# Or use the default team:
/infra bootstrap setup-namespaces
/infra deploy <cluster>
```
