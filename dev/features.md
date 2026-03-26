# Feature Inventory

Complete inventory of everything in kordinate — implemented and planned.

## Framework Core

### Agents

| Agent | Identity | Skills | Memory |
|-------|----------|--------|--------|
| scribe | IDENTITY.md | /remember, /onboard, /create-kord | workflow.md, tools.md, scratchpad.md |
| deployer | IDENTITY.md | /infra (bootstrap, deploy, roll, stop, clean, diff, migrate, generate-overlays) | infra.md, migration.md, tools.md, troubleshooting.md, scratchpad.md |
| sauron | IDENTITY.md | /scan, /diagnose | monitoring.md, logging.md, tools.md, workflow.md, scratchpad.md |
| designer | IDENTITY.md | /detect-patterns | patterns/ (16), libraries/ (4), tools.md, workflow.md, app-contract.md |

### Global Skills

| Skill | Purpose |
|-------|---------|
| /boot | Load shared protocols + 2D memory on spawn |
| /kord | Send a request to another agent through a kord contract |
| /authenticate | Copy lock file before guarded operations |
| /merge | Merge session branch forward |

### Guards

| Guard | Protects | Agent |
|-------|----------|-------|
| guard.sh (unified domain enforcement) | Memory, kord, kubectl, Grafana path writes | all |

### Kords

| Kord | Mode | Requester | Provider |
|------|------|-----------|----------|
| remember | stateless | any | scribe |
| onboard | stateful | any | scribe |
| create-kord | stateful | any | scribe |
| deployer-default | stateful | any | deployer |
| sauron-default | stateful | any | sauron |
| designer-default | stateful | any | designer |
| scribe-default | stateful | any | scribe |
| pattern-review | stateful | deployer, sauron | designer |
| monitoring-impact | stateful | deployer | sauron |

### Configuration

| File | Purpose |
|------|---------|
| settings.json | Hook configuration (guards, PreToolUse) |
| profile/.mcp.json | MCP server registration (playwright, beorn) |
| profile/config.yaml | Cluster configuration (IPs, namespaces, services) |
| KORD.md | Auto-generated knowledge registry |

### Libraries

| File | Purpose |
|------|---------|
| lib/mcp-agent-server/server.js | Beorn MCP server (Express + MCP SDK) |

## Installer

| Script | Purpose |
|--------|---------|
| kordinate-cli | Bootstrap CLI (init, join, hydrate, export, import) |
| setup-shell.sh | PATH, KORDINATE_HOME, tmux config |
| auth-check.sh | Credential setup (GPG, pass, GitHub, Tailscale, Claude, Grafana) |
| lib.sh | Shared utilities (logging, kubectl resolution) |

## Bin

| Script | Purpose |
|--------|---------|
| claude-session | Worktree-based Claude sessions with auto-commit on exit |
| tmux-session.bash | Auto-attach on SSH, default session, tmux.conf generation |
| tmux-new-window | Route new tmux windows to repo-named sessions |

## Kubernetes Manifests

Live at `agents/deployer/skills/infra/manifests/` (namespace-prefixed flat files). Images at `agents/deployer/skills/infra/images/`, dashboards at `agents/deployer/skills/infra/dashboards/`, topology at `agents/deployer/skills/infra/topology.yaml`. Kustomize overlays at `profile/overlays/<cluster>/`.

### Gateway Namespace

| Manifest | Purpose |
|----------|---------|
| gateway-pod.yaml | Gateway Tailscale pod (cluster front door) |
| gateway-ingress.yaml | Ingress configuration |
| gateway-minio.yaml | MinIO object storage |

### Master Namespace

| Manifest | Purpose |
|----------|---------|
| master-prometheus.yaml | Master Prometheus (30d retention) |
| master-loki.yaml | Master Loki (30d retention) |
| master-grafana.yaml | Grafana |
| master-datasources.yaml | Grafana datasources |
| master-alloy.yaml | Master Alloy collector |
| master-workstation.yaml | Workstation deployment + PVC (Beorn runs inside) |
| master-kord-storage.yaml | Shared kord PVC storage |
| dashboards/ | Dashboard provisioning + JSON definitions |
| log-puller/ | Loki federation sidecar (Python + Dockerfile) |

### Monitor Namespace

| Manifest | Purpose |
|----------|---------|
| monitor-prometheus.yaml | Cluster Prometheus |
| monitor-loki.yaml | Cluster Loki |
| monitor-alloy.yaml + monitor-alloy-config.yaml | Cluster Alloy + config |
| monitor-node-exporter.yaml | Host metrics |
| monitor-kube-state-metrics.yaml | K8s state metrics |

### RBAC

| Manifest | Purpose |
|----------|---------|
| agent-rbac.yaml | Agent readonly service account |
| agent-scaler-rbac.yaml | Workstation → beorn scaling permissions |

### Bootstrap

| File | Purpose |
|------|---------|
| namespaces.yaml | Namespace definitions |
| setup-cluster.sh | Cluster bootstrap script |

## Agent Utilities

Now live as Level 3 resources inside skills:

| File | Skill | Purpose |
|------|-------|---------|
| deployer/skills/infra/postgres.py | /infra diff | PostgreSQL schema comparison |
| sauron/skills/scan/grafana_api.py | /scan | Grafana dashboard push/pull |
| sauron/skills/diagnose/metrics_pusher.py | /diagnose | Metrics pushing |

## Designer Knowledge Base

### Patterns (16)

circuit-breaker, sidecar, api-gateway, stream-to-store, event-sourcing, etl, retry, cqrs, hexagonal, service-manager, ddd, bulkhead, choreography, saga, backpressure, plugin

### Libraries (4)

klog, orchestrator, stoik, nokrashi-tools

## CI/CD

| File | Purpose |
|------|---------|
| .github/workflows/deploy-docs.yml | Deploy mkdocs to GitHub Pages on push to main |

## Referenced but Not Implemented

| Feature | Where Referenced |
|---------|-----------------|
| Gemini MCP validation | designer IDENTITY.md |
| Pattern TODOs (examples, implementation guides) | 18 pattern files in designer memory |
| Tier-based installation | installation docs (planned) |
| KORD.json generation | guard.sh needs it for property lookup |
