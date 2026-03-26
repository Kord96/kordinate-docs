# Saga

Coordinates a multi-step distributed transaction by pairing each step with a compensating rollback action.

## When to Use

- A business operation spans multiple services and you need all-or-nothing semantics
- Two-phase commit is too expensive or not available across your datastores
- Each step has a natural "undo" (cancel order, release reservation, refund payment)

## How It Works

```mermaid
flowchart LR
    S1[Step 1: Reserve] -->|ok| S2[Step 2: Charge]
    S2 -->|ok| S3[Step 3: Ship]
    S3 -->|ok| Done[Success]
    S3 -->|fail| C3[Compensate 3]
    C3 --> C2[Compensate 2]
    C2 --> C1[Compensate 1]
    C1 --> RB[Rolled back]
```

Each step executes in sequence. If any step fails, the saga walks backward through compensating actions to undo previously completed steps. A saga coordinator tracks which steps have completed so it knows where to start compensating.

## Trade-offs

!!! success "Strengths"
    - Achieves consistency across services without distributed locks
    - Each service stays autonomous — no shared database required
    - Works naturally with event-driven architectures

!!! warning "Watch out for"
    - Missing compensation for even one step means partial rollback (data inconsistency)
    - Compensating actions must be idempotent — they may be retried on failure
    - Adds complexity; use a simple transaction if the operation fits in one service
    - Sagas that hang need timeout handling to avoid stuck-in-progress states
