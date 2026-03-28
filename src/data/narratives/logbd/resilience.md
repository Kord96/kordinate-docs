# Resilience {#resilience}

## The Critical Path: When Kafka Goes Down {#kafka-failure}

At 2am, the single Kafka broker crashes. Within seconds, every consumer in the pipeline discovers it cannot poll. The **Message Producer** fails to publish parsed messages and logs `kafka_publish_failed`. The 27 graph consumers lose their event stream. The **Pipeline Sentinel**, running its 30-second health check loop inside the API pod, detects that all consumer processes have gone from OK to STUCK within one cycle.

Here is what does not happen: the query side stays up. The **REST API** continues serving from its **EdgePool** connections to DuckDB snapshot files. The **FlightSQL Server** continues answering analytical queries from MinIO Parquet views. An analyst investigating a domain at 2:05am gets the same results they would have gotten at 1:55am -- the data is slightly stale, but the system is available.

When Kafka recovers, all consumers automatically reconnect. Kafka replays events from the last committed offset, so no data is lost if the broker's storage survived. The ingestion pipeline catches up, and the derived refresh engine processes the backlog. From the analyst's perspective, the graph goes quiet for a while, then fills in.

The risk here is structural: KRaft single-broker with replication factor 1 means there is no failover. The team chose this for operational simplicity in a single-cluster deployment. It is the most significant single point of failure in the system.

## DuckDB Lock Contention {#duckdb-locks}

DuckDB enforces single-writer access. When the **Derived Refresh** engine tries to ATTACH `base_domain.duckdb` for reading while the domain consumer is mid-flush, it hits a lock error. The system handles this with `_connect_with_retry`: exponential backoff starting at 500ms, jitter of +/-30%, up to 5 attempts with a 3-second ceiling.

This is not a bug -- it is an expected operational pattern. The derived refresh engine processes entity types in round-robin order, and each cycle involves attaching 3-5 DuckDB files. Most attempts succeed on the first try; the retry handles the minority case where a consumer happens to be flushing. The structured log message `duckdb_attach_failed` at warning level appears a few times per hour in normal operation -- it becomes concerning only when it appears at error level (all retries exhausted).

The same pattern appears in the retention scheduler. The daily 02:00 UTC cronjob runs retention policies on all entity and edge databases. If a consumer is actively writing, the retention job retries. Because retention runs during low-traffic hours, contention is rare but not impossible.

## Enrichment Backpressure {#enrichment-backpressure}

The **Domain Consumer** has a clever backpressure mechanism. Under normal load, every new domain triggers the full enrichment pipeline: WHOIS, DNS, HTTP probes. But when a sudden traffic spike pushes the consumer's buffer past 80% capacity, it switches to catchup mode.

In catchup mode, domains are staged to DuckDB without enrichment. The consumer's priority shifts from completeness to throughput -- better to have 50,000 domains in the graph without WHOIS data than to have the consumer fall behind Kafka and eventually hit consumer group rebalancing. Once the buffer drains below threshold, the consumer resumes normal enrichment. The missing enrichments are backfilled asynchronously: enrichment events re-enter the Redis queues, and the next enrichment cycle picks them up.

This is a deliberate trade-off between data completeness and pipeline stability. The team chose it after experiencing consumer group rebalancing events during traffic spikes, which caused more data loss than temporarily skipping enrichment.

## Timeout Budget {#timeout-budget}

The system maintains an aggressive timeout budget across all external interactions:

- **DNS resolution**: 5 seconds per query, semaphore-bounded to 500 concurrent
- **HTTP enrichment**: 5 seconds connect, 10 seconds read
- **URI download worker pool**: 600 seconds overall
- **WHOIS lookups**: single retry, no specified timeout (relies on DNS timeout)
- **Kafka flush**: 30 seconds
- **Webhook delivery**: 10 seconds

These timeouts are not arbitrary. DNS at 5 seconds covers even slow authoritative servers; HTTP at 5+10 seconds prevents indefinite hangs on unresponsive phishing sites; the 600-second worker pool timeout catches cases where a JavaScript rendering job hangs in Playwright.

When a timeout fires, the system does not retry by default. DNS and HTTP failures are recorded as "unreachable" -- itself a valuable signal. A domain that cannot be reached is more likely to be ephemeral spam infrastructure. The exception is DuckDB lock contention, where retry is warranted because the lock will release within seconds.

## MinIO and the Read Path {#minio-resilience}

If MinIO dies, the read path degrades but does not fail completely. The **FlightSQL Server** cannot open new Parquet views, but existing in-memory connections continue serving until they are closed. The **EdgePool** in the REST API reads from local snapshot copies, not directly from MinIO, so it continues operating with the last-known snapshots.

The **Derived Refresh** engine cannot export new Parquet snapshots, so the read path goes increasingly stale. The `snapshot_refresh_failed` log message appears, but the engine continues computing and storing results in DuckDB -- the write path is unaffected. When MinIO recovers, the next export cycle pushes fresh snapshots, and the read path catches up.

## NFS Mount Failure {#nfs-failure}

The NFS mount at `/mnt/nfs/rawLog` is the sole ingestion source. If it becomes unreachable, the **Message Producer** logs `nfs_mount_unreachable` and its inventory scan returns empty. No new slots are processed. Every downstream consumer gradually exhausts its Kafka backlog and goes idle.

The recovery is automatic: the producer's scan cycle retries every 60 seconds. When NFS recovers, the inventory scan discovers all slots that accumulated during the outage, and ingestion resumes. The systemd watchdog integration (`WATCHDOG=1` notifications) prevents the pod from being killed during the outage, as long as the main loop is still cycling.

## Observability: How You Know Things Are Wrong {#observability}

The **Pipeline Sentinel** is the central health observer. It probes all 27 consumers via their Prometheus metrics ports, checks Kafka consumer lag, monitors flush rates, and computes per-section health scores. Health is reported as Prometheus gauges:

- `pipeline_process_status{process="X"}`: 0=FAIL, 1=STUCK, 2=OK per consumer
- `pipeline_ingestion_status`, `pipeline_buffers_status`, `pipeline_enrichment_status`, `pipeline_download_status`, `pipeline_storage_status`: per-section composite scores
- `pipeline_status`: overall system health (minimum of all sections)

Five Grafana dashboards visualize this data: the overview board shows system-wide health at a glance, the operational-health board shows per-consumer detail, the classifier board tracks model training metrics, and two drill boards let analysts explore cluster and URI template patterns.

Structured logging via structlog with JSON output feeds into Loki. Every log line carries context variables (entity type, consumer group, slot ID), making it possible to filter by pipeline stage. The combination of metrics (for alerting) and logs (for diagnosis) means the team can usually identify the failing component from Grafana and then drill into Loki for the specific error.
