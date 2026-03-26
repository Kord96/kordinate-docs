# stoik

Stream-to-store pipeline framework. Kafka -> buffer -> batch flush -> DuckDB.

`producer -> buffer -> consumer`

```
pip install stoik        # core
pip install stoik[all]   # includes flight deps
```

PyPI: `stoik`. Deploy method: `git-branch` (trusted publishing via GitHub Actions OIDC).

## Key Classes

| Class | Role |
|-------|------|
| StoicProducer | Kafka producer with delivery callbacks |
| StoicBuffer | In-memory buffer with flush triggers (size/time) |
| StoicConsumer | Kafka consumer with commit tracking |
| StoicServer | FastAPI + FlightSQL server for serving stored data |

## When to Use

- Ingesting data from Kafka into DuckDB or other stores
- Event processing with buffered batch writes
- Stream pipelines that need backpressure and retry logic

??? note "Agent perspectives"

    === "Designer"

        **Architecture Review Checklist:**

        - Is the buffer flush configured correctly (size + time triggers)?
        - Are delivery callbacks handling errors (dead letter, retry)?
        - Is commit tracking aligned with flush (exactly-once semantics)?
        - Is FlightSQL server used for query access instead of direct DB reads?

    === "Deployer"

        **Deployment Notes:**

        - All consumers use the same Docker image — component selection via entrypoint/args
        - FlightSQL server needs the `stoik[all]` extras (flight dependencies)
        - Buffer flush depends on DuckDB — ensure PVC is bound before scaling up
        - Consumer lag may spike during rollout restarts — expected, recovers after rebalance

    === "Sauron"

        **Metrics** (prefix: `stoik_`):

        | Metric | Type | What it tells you |
        |--------|------|-------------------|
        | stoik_messages_consumed_total | counter | Consumer ingestion rate |
        | stoik_messages_produced_total | counter | Producer output rate |
        | stoik_buffer_flush_total | counter | Flush frequency |
        | stoik_buffer_flush_duration_seconds | histogram | Flush performance |
        | stoik_errors_total | counter | Error rate |

        Config file: `config.py`. Use nokrashi-tools TestSuite. Skip: `test_constants_in_config`.
