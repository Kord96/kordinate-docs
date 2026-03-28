# Data {#data}

## Where Truth Lives {#data-truth}

logBD's state is distributed across three storage tiers, each chosen for a specific access pattern. Understanding which tier holds which data -- and why -- is essential for anyone operating or extending the system.

## DuckDB: The Source of Truth {#duckdb-storage}

Every entity and relationship in the graph lives in a dedicated DuckDB file on Longhorn-backed persistent volumes. The system allocates roughly 1,090Gi across 18 PVCs, with the largest being the emailed_with edge table at 200Gi.

Node databases follow a consistent naming convention: `base_domain.duckdb`, `base_host.duckdb`, `base_uri.duckdb`, and so on. Each has a single writer (its consumer) and multiple readers (the derived refresh engine, the classifier pipeline, and the API via snapshots). DuckDB's single-writer model means the consumer owns the write lock exclusively. When the **Derived Refresh** engine needs to read base data, it ATTACHes the file read-only with retry logic -- exponential backoff with jitter, up to 5 attempts -- to handle the inevitable moments when the writer is mid-flush.

The derived databases (`derived_domain.duckdb`, `derived_subnet.duckdb`, etc.) hold computed properties. Unlike base tables which are append-heavy, derived tables are upsert-heavy: every refresh cycle updates existing rows with fresher computations. Each row carries a `last_computed_at` timestamp that drives the staleness-based scheduling.

Edge databases are the heaviest. The `base_emailed_with.duckdb` at 259M+ rows stores co-occurrence relationships between entities that appear in the same email. The team chose DuckDB over a purpose-built graph database because the query patterns are fundamentally analytical: "show me all domains that co-occur with this IP subnet, ranked by spam ratio" is a columnar scan, not a graph traversal.

Score databases store external reputation data (`external_score.duckdb`) and classifier releases (`release_domain.duckdb`, etc.). The classifier writes model outputs as release files, which the **FlightSQL Server** attaches at startup -- using reflink-copy to temporary locations so that active model training does not lock the read path.

## MinIO: The Read Cache {#minio-storage}

MinIO holds Parquet exports of every DuckDB database. This layer exists because of a fundamental tension: the graph engine needs exclusive DuckDB write access, but the serving layer needs fast read access to the same data.

The **Derived Refresh** engine exports updated tables as Parquet files to MinIO's `snapshots` bucket after each computation cycle. The **FlightSQL Server** reads these Parquet files through DuckDB's S3 integration, creating views over them. The **EdgePool** in the REST API takes a different approach: it opens direct DuckDB connections to local snapshot copies and monitors file modification times to know when to refresh.

The trade-off is freshness. Parquet snapshots lag behind the live DuckDB files by the derived refresh interval (5 minutes for Tier A data, up to 24 hours for Tier E). For the query workloads this serves -- analyst investigations and classifier training -- this staleness is acceptable. Real-time is not the goal; correctness and query speed are.

## Kafka: The Event Backbone {#kafka-storage}

Kafka holds 29 topics organized by function. Entity topics (`node.domain`, `etl.uri`, `node.text_content`) carry structured events in Avro format. Edge topics (`edge.emailed_with`, `edge.dns`, `edge.struct`) carry relationship events. Score topics (`score.external_source`, `score.signal`) carry reputation signals.

Kafka is not a long-term store here -- it is a staging and fan-out layer. Retention is configured per-topic by expected volume: entity topics get 5-10Gi per partition, edge topics 1-5Gi, and garbage topics (ignored MIME types) only 100MB. The system depends on Kafka for replay during consumer restarts: consumers track their offsets and resume from the last committed position.

The single-broker KRaft configuration is the system's most significant infrastructure risk. With replication factor 1, a Kafka broker failure halts the entire ingestion pipeline. The team accepted this trade-off for simplicity in a single-cluster deployment -- but it means the ingestion pipeline has no high-availability failover.

## Redis: The Ephemeral Layer {#redis-storage}

Redis serves three roles, all ephemeral:

**Enrichment queues** -- `enrichment:result:uclt`, `enrichment:result:whois`, `enrichment:result:ct` -- hold enrichment results as Redis lists. The domain enrichment subsystem pushes results; the domain consumer drains them with `LPOP`. If Redis is lost, enrichment results in flight are lost, but the enrichment can be re-triggered.

**Deduplication** -- URI downloads and entity extraction use Redis sets to avoid processing the same entity twice within a time window. This is a performance optimization, not a correctness guarantee: if Redis is lost, the worst case is redundant processing.

**SPF auth cache** -- SPF validation results are cached in Redis because DNS lookups for SPF records can be slow and repetitive. The cache has a TTL; misses fall through to live DNS.

Redis has no manifest in the repository -- it is managed externally with unknown HA configuration. This invisibility is flagged as a high-severity risk in the dependency assessment.

## The Reference Database {#reference-storage}

A special DuckDB file (`reference.duckdb`) sits on a ReadWriteMany PVC, readable by 7 consumers simultaneously. It holds static reference data: TLD categories, file extension mappings, ASN reputation baselines, and curated clean/spam lists. The **Bootstrap** process publishes updated reference data from external sources. The API loads it once at startup for URI parsing, and the derived refresh engine uses it for reputation lookups.

## Storage Architecture Decisions {#storage-decisions}

The choice of DuckDB-per-entity-type over a single monolithic database was driven by operational isolation. When the URI consumer needs a restart, it only locks its own DuckDB file. The derived refresh engine can process domain entities while the image consumer is in backfill mode. This isolation has a cost -- cross-entity joins require attaching multiple databases -- but the system pays that cost only in the derived refresh engine and the FlightSQL server, which are designed for exactly that workload.

The Parquet-over-MinIO layer adds complexity but solves a real problem: DuckDB's single-writer lock means readers cannot coexist with a flushing consumer. By exporting to Parquet and reading from S3, the system decouples the write path from the read path entirely. The FlightSQL server never touches a live DuckDB file.
