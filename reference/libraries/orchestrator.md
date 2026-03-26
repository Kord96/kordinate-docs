# orchestrator

Service lifecycle framework for k8s. Scheduling, health checks, retry logic, and process management.

`scheduler -> runner -> health -> retry`

```
pip install k8s-orchestrator
```

PyPI: `k8s-orchestrator`. Deploy method: `git-branch` (trusted publishing via GitHub Actions OIDC).

## Key Classes

| Class | Role |
|-------|------|
| ServiceManager | Lifecycle manager for multiple services |
| Scheduler | Cron-based task scheduling |
| HealthCheck | HTTP/TCP/process health monitoring |
| RetryPolicy | Configurable retry with backoff |
| ProcessRunner | Subprocess management with signal handling |

## When to Use

- Managing long-running services with health checks
- Scheduling periodic tasks (cron-like)
- Process supervision with restart policies
- Services that need graceful shutdown and retry logic

??? note "Agent perspectives"

    === "Designer"

        **Architecture Review Checklist:**

        - Is ServiceManager used for multi-process coordination (not bare subprocess)?
        - Are HealthChecks wired to all external dependencies?
        - Is RetryPolicy configured with appropriate backoff for each failure mode?
        - Is Scheduler used for periodic tasks instead of sleep loops?
        - Is graceful shutdown handled (SIGTERM propagation)?

    === "Deployer"

        **Deployment Notes:**

        - ServiceManager handles graceful shutdown — pods need appropriate terminationGracePeriodSeconds
        - HealthCheck endpoints should be wired to k8s readiness/liveness probes
        - Scheduler tasks are in-process — no external cron needed
        - RetryPolicy backoff may delay service recovery — check restart counts after deploys

    === "Sauron"

        **Metrics** (prefix: `orchestrator_`):

        | Metric | Type | What it tells you |
        |--------|------|-------------------|
        | orchestrator_services_running | gauge | How many services are active |
        | orchestrator_services_healthy | gauge | How many pass health checks |
        | orchestrator_restarts_total | counter | Restart frequency — high means instability |
        | orchestrator_health_check_duration_seconds | histogram | Health check latency |
        | orchestrator_task_executions_total | counter | Scheduled task runs |

        Config file: `config.py`. Use nokrashi-tools TestSuite.
