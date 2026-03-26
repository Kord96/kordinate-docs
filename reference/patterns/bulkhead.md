# Bulkhead

Isolates resources into separate pools so one failing dependency cannot exhaust the whole system.

## When to Use

- Your service talks to multiple external dependencies (databases, caches, APIs)
- A slow or failing dependency could starve other healthy dependencies of connections or threads
- You need failure isolation — one bad dependency should not take down unrelated features

## How It Works

```mermaid
flowchart TD
    Service --> P1[Pool: Database<br/>max 20 conn]
    Service --> P2[Pool: Cache<br/>max 10 conn]
    Service --> P3[Pool: External API<br/>max 5 conn]
    P1 -.- N1[Failure here...]
    N1 -.- N2[...does not affect<br/>other pools]
```

Each dependency gets its own bounded resource pool (connections, threads, or semaphores). When one pool is exhausted, requests to that dependency are rejected immediately while the other pools continue working normally.

## Trade-offs

!!! success "Strengths"
    - Prevents a single slow dependency from consuming all resources
    - Failures are contained — unrelated features keep working
    - Pool exhaustion triggers fast failure instead of unbounded queuing

!!! warning "Watch out for"
    - A single shared pool across all dependencies defeats the purpose
    - Pool sizes need tuning per dependency based on expected load
    - No monitoring on pools means exhaustion goes unnoticed until outage
