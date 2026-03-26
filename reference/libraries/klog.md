# klog

Structured JSON logging with context binding and validation. structlog-based.

`configure once -> log everywhere`

```
pip install klog
```

PyPI: `klog`. Deploy method: `git-branch` (trusted publishing via GitHub Actions OIDC).

## Key Classes

| Class | Role |
|-------|------|
| Logger | Structured logger with context integration and extension hooks |
| configure_logging | One-time setup — structlog processors, handlers, filters |
| log_context | Context manager for dimension binding (nested, inheritable) |
| trace_context | Context manager for service + trace_id binding |
| log_capture | Test helper — capture logs for assertions |
| APIPushHandler | Async batched HTTP log pushing (stdlib only) |

## When to Use

- Setting up structured logging in any Python service
- Adding trace context and correlation IDs
- Filtering logs by field values at runtime
- Pushing logs to an HTTP API endpoint

??? note "Agent perspectives"

    === "Designer"

        **Architecture Review Checklist:**

        - Is configure_logging called once at startup (not per-module)?
        - Is log_context used for scope binding instead of manual field passing?
        - Are stdlib loggers bridged so library logs are also structured?
        - Is APIPushHandler used only for external API targets (not Loki — Alloy handles that)?

    === "Deployer"

        **Deployment Notes:**

        - klog is a library dependency, not a standalone service — no pods to manage
        - All Python services should include klog in their requirements
        - configure_logging must be called at startup for structured JSON output (required for Alloy/Loki ingestion)
        - APIPushHandler (if used) needs network access to the target API endpoint — check NetworkPolicy

    === "Sauron"

        **What to Validate:**

        - Is configure_logging called at startup with correct renderer (JSON for prod)?
        - Are log levels used correctly per logging.md standards?
        - Are event names snake_case and consistent?
        - Are dimensions structured (not f-string interpolation)?
        - Are noisy library loggers (kafka, urllib3) suppressed?

        **Log Review Checklist:**

        - Inconsistent event names across components
        - Missing dimensions (consumer, duration_s, count)
        - Wrong log levels (info in hot loops, warning without threshold)
        - Unstructured f-strings instead of dimension kwargs
        - Missing rate limiting on high-frequency warnings
