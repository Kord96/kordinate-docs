# Libraries

Shared libraries used across projects. Each agent has its own perspective documented in its memory.

## Owned

| Library | PyPI | Description |
|---------|------|-------------|
| [klog](klog.md) | `pip install klog` | Structured logging with session IDs and trace context |
| [orchestrator](orchestrator.md) | `pip install k8s-orchestrator` | Service lifecycle, health checks, task scheduling |
| [stoik](stoik.md) | `pip install stoik` | Kafka consumer → local store with buffered flushes |
| nokrashi-tools | `pip install nokrashi-tools` | Code validation and standards testing (sauron only) |

## Third-party

| Library | PyPI | Pattern | Description |
|---------|------|---------|-------------|
| tenacity | `pip install tenacity` | [retry with backoff](../patterns/retry.md) | Configurable retries with exponential backoff, jitter, and stop conditions |
| pybreaker | `pip install pybreaker` | [circuit breaker](../patterns/circuit-breaker.md) | Circuit breaker with configurable thresholds and listeners |
