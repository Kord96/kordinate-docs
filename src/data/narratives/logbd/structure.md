# Structure {#structure}

logBD is a graph analytics platform for email security. It consumes raw email logs from a network gateway, decomposes them into entities (domains, IPs, URIs, email addresses, text patterns, images), and builds a queryable graph that security analysts use to investigate spam campaigns and phishing infrastructure. The system runs as 32 Kubernetes pods on an office cluster, processing millions of email events per day into a graph with hundreds of millions of edges.

The platform connects to three external worlds: upstream, it reads raw logs from an NFS mount written by the email gateway; laterally, it enriches entities using DNS, WHOIS, HTTP reachability probes, and certificate transparency logs; downstream, it serves analysts through a REST API, a FlightSQL endpoint for heavy analytics, and an MCP server that lets AI agents investigate the graph through natural language.

## Ingestion {#ingestion}

The data journey begins when the **Message Producer** wakes up on its scan cycle. It reads NFS directories organized by day, discovers new time slots, and parses raw email log files using a multiprocess worker pool for CPU-bound parsing. Each parsed message becomes a Kafka event. The team chose Kafka as the backbone rather than direct writes because the fan-out is enormous: a single email can produce a dozen entity events across different types, and each needs independent processing at its own pace.

The **Entity Extraction** consumer picks up raw messages and decomposes them. From one email, it might extract 3 URIs, 2 email addresses, an IP subnet, a domain, text content fingerprints, and image hashes. Each entity type is published to its own Kafka topic using Avro serialization through the **Schema Registry**, which keeps the 27 downstream consumers aligned on message formats without tight coupling.

The **Metadata Archiver** runs alongside, preserving raw email headers and metadata in DuckDB for historical reference -- the kind of data analysts need when they are tracing a campaign back to its earliest appearance.

## Graph Engine {#graph-engine}

The heart of the system is 27 Kafka consumers, each responsible for one slice of the graph. They all follow the same structural pattern: consume from Kafka, buffer records in PyArrow batches, flush to a dedicated DuckDB file. The `stoik` framework provides the consumer loop, buffer management, and DuckDB storage layer. Entity-specific logic is injected through strategy callbacks (`parse_message`, `on_flush`), which means adding a new entity type requires writing two functions, not a new service from scratch.

The **Domain Consumer** is the most complex. When a domain enters the graph, it does not just get stored -- it triggers a multi-stage enrichment pipeline. The **Domain Enrichment** subsystem runs WHOIS lookups, DNS resolution (A, MX, NS, TXT records), UCLT (URL Classification and Landing Tracking) probes, Certificate Transparency log queries, and HTTP reachability checks. These enrichments run asynchronously through Redis queues because some (WHOIS, CT) can take seconds per entity. When the consumer falls behind and its buffer hits 80% capacity, it activates backpressure mode: domains get fast-staged without enrichment, and enrichment backfills asynchronously once pressure subsides.

The **URI Consumer** and **URI Download** service handle the web-facing side. URIs are decomposed into templates (stripping variable query parameters), and interesting ones are enqueued for download. The download service fetches content, runs it through a headless browser for JavaScript rendering when needed, extracts signals, and classifies the content. This is where the system discovers phishing landing pages and malicious payloads.

Three edge consumers build the relationship layer. The **Emailed-With** consumer constructs co-occurrence edges between entities that appear in the same email -- this table alone has 259 million+ rows, making it the largest structure in the graph. The **Association** consumer builds structural edges from DNS, SPF delegation, and URI resolution relationships. The **Cluster Member** consumer connects messages to their MinHash-based clusters, which group structurally similar emails into campaigns.

The **Derived Refresh** engine is the computation backbone. It runs a continuous round-robin loop across all entity types, materializing computed properties through 7 tiers of increasing complexity. Tier A (traffic aggregation) refreshes every 5 minutes. Tier G (graph algorithms like PageRank and community detection) runs every 6 hours. The team structured it as a tiered system because the computational cost varies by orders of magnitude -- running graph algorithms at the same frequency as traffic counts would exhaust the cluster. When the system is in backfill mode (many new entities), only Tiers A and F run to maximize throughput.

## Serving Layer {#serving}

Analysts interact with the graph through three interfaces, each optimized for different access patterns.

The **REST API** is the primary interface. Built on FastAPI with 15 routers, it exposes entity lookup, search, ranking, subgraph traversal, path finding, and bulk export. Under the hood, the **EdgePool** maintains direct read-only DuckDB connections to 20+ snapshot files. The team built EdgePool specifically because FlightSQL was too slow for point lookups on the 259M-row emailed_with table (150-400ms through Flight vs single-digit ms through direct DuckDB). The API also runs background threads for warm cache refresh, health monitoring via the **Pipeline Sentinel**, and dashboard stats collection.

The **FlightSQL Server** serves heavy analytical workloads. It attaches all MinIO Parquet snapshots plus release databases into a single DuckDB connection, creating unified entity views that join base, derived, and classification data. The classifier reads training data through FlightSQL because it needs to scan millions of rows with complex joins -- exactly what columnar analytics excels at.

The **MCP Server** wraps the REST API for LLM agents. It exposes graph tools (lookup, search, neighbors, path, subgraph) with natural language instructions, letting AI assistants investigate entities without learning the API surface.

## ML Classification {#ml-classification}

The classification pipeline runs independently from the graph engine. The **Classifier Scheduler** orchestrates a six-step sequence: infrastructure classification first (to identify legitimate ESPs, CDNs, and cloud providers that should not be flagged as spam), then dataset export with graduated labels, LightGBM training, heuristic scoring, and finally verdict merging.

The **Spam Classifier** trains one LightGBM regression model per entity type (9 types total). The **Weighted Sum Scorer** provides a complementary heuristic baseline using 16 hand-tuned signals. The **Verdict Merger** combines them at 70/30 ML/heuristic, which the team chose because the heuristic catches edge cases the model misses and vice versa.

The **Infrastructure Classifier** deserves special mention. It identifies whether an entity is regular, ESP, cloud, CDN, or hosting infrastructure. Entities with high infrastructure scores are suppressed from spam lists entirely. This prevents the embarrassing false positive of flagging Gmail or SendGrid as spam -- a practical decision driven by the fact that high-traffic legitimate senders share network signatures with spammers.
