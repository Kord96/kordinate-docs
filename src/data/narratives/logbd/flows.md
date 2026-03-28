# Data Flows {#flows}

## Log Ingestion: From Raw Files to Graph Events {#log-ingestion}

Every 60 seconds, the **Message Producer** runs a scan cycle. It checks today's and yesterday's directories on the NFS mount, where the log server writes gzipped files named `{server}.{slot_id}.gz`. A slot represents a time window of email processing on one server.

When the producer discovers an unprocessed slot, it fires up a multiprocess worker pool. Each worker decompresses and parses raw log files, extracting email metadata: sender (MailFrom and HeaderFrom), recipients, subject lines, SPF/DKIM/DMARC authentication results, IP addresses, and embedded content references. The parsed messages are serialized and published to Kafka. Progress tracking lives in a local DuckDB file (`message_producer_progress.duckdb`) so restarts resume exactly where they left off.

Every 10 minutes, a broader inventory scan sweeps all days on the NFS mount. This full scan is separate from the ingestion cycle because NFS directory listing on hundreds of days is slow -- the team separated inventory from processing so ingestion is not blocked by filesystem latency.

The **Entity Extraction** consumer picks up the raw messages and fans them out. A single email might produce events on 8 different topics: `node.domain` for the sender domain, `etl.email_address` for all addresses, `etl.uri` for embedded URLs, `node.text_content` for body fingerprints, `node.image` for attached images, `node.subnet` for the sending IP's subnet, `edge.emailed_with` for co-occurrence relationships, and `other.ehlo_hostname` for the SMTP greeting. Avro serialization through the **Schema Registry** ensures all 27 downstream consumers can evolve their schemas independently.

## Entity Processing: The Consumer Chorus {#entity-processing}

Each entity type has a dedicated consumer that follows the stream-to-store pattern. Take the **Domain Consumer** as the canonical example.

When a domain event arrives, the consumer checks its in-memory known-key cache (up to 200K entries) to decide if this is a new entity or a traffic update for an existing one. New domains get full processing: the consumer calls `parse_message` to extract domain properties, adds the record to a PyArrow buffer, and when the buffer reaches threshold (default 10K records or 30 seconds), flushes a batch to DuckDB via `upsert_batch()`.

But the domain consumer does something the others do not: it triggers enrichment. After staging the domain, it publishes an `enrichment.domain` event. The **Domain Enrichment** subsystem picks this up and orchestrates five enrichment stages: DNS resolution (A, MX, NS, TXT, SOA), WHOIS registration data, UCLT classification (is this a URL shortener? a parking page? a legitimate site?), Certificate Transparency log queries, and HTTP reachability checks.

These enrichments are asynchronous by design. DNS queries use an asyncio semaphore-bounded pool (500 concurrent). WHOIS lookups go through Redis result queues because they are slow and bursty. The results flow back to the domain's DuckDB row, enriching it with registration age, MX presence, SPF policy, and reachability status -- all signals that feed into classification.

The **URI Download** service represents the most adventurous part of the pipeline. When a URI is flagged as interesting, the download service fetches the page. For JavaScript-heavy sites, it spins up a Playwright headless browser for server-side rendering. The downloaded content gets classified (phishing page? malware distribution? benign?), and extracted signals are written back. Timeouts are aggressive: 5 seconds for HTTP connect, 10 seconds for read, 600 seconds for the worker pool overall.

## Derived Computation: Building Intelligence {#derived-computation}

Raw entity data is necessary but not sufficient for threat detection. The **Derived Refresh** engine transforms raw data into intelligence through materialized views computed in 7 tiers:

- **Tier A** (every 5 min): Traffic history aggregation -- how many messages, spam ratio, time-series patterns
- **Tier B** (every 10 min): Cross-database joins -- neighbor signals, message-level context
- **Tier C** (every 1 hour): Reputation lookups -- 2-hop network signals, external score correlation
- **Tier D** (every 6 hours): Multi-hop graph traversals -- deep relationship analysis
- **Tier E** (every 24 hours): Per-group aggregations -- TLD-level and ASN-level statistics
- **Tier F** (once): Static properties computed on entity creation -- domain age, TLD category
- **Tier G** (every 6 hours, separate batch): Graph algorithms -- PageRank, community detection, centrality

The engine picks the stalest batch of entities, creates a temporary `_batch_keys` table, runs applicable tiers against the batch, and bulk-upserts results using PyArrow table registration for performance. When more than 80% of a batch are new entities (backfill mode), it skips the expensive tiers (B through E) and runs only A and F, prioritizing throughput over completeness.

After computation, the engine exports updated DuckDB tables as Parquet files to MinIO. This snapshot mechanism is what makes the read path work: the **FlightSQL Server** and **EdgePool** read Parquet snapshots, not the live writer databases, avoiding lock contention between the write and read paths.

## Classification: Scoring the Graph {#classification-flow}

The classification pipeline runs on its own schedule, reading from the graph to produce scores that flow back into it.

First, the **Infrastructure Classifier** runs. It uses known lists of ESPs (SendGrid, Mailchimp), CDNs (Cloudflare, Akamai), and hosting providers as training labels, then builds a LightGBM multiclass model that can generalize to unlabeled entities. An entity scored as infrastructure gets suppressed from spam classification -- this is the system's mechanism for preventing mass false positives on legitimate high-volume senders.

Next, the **Dataset Pipeline** exports entity views from FlightSQL with graduated training labels. Labels come from multiple sources: Spamhaus lists provide strong positive labels (+1.0), curated clean lists provide strong negatives (-1.0), the log server's own 1-9 scoring provides a linear gradient, and heuristic fallback labels fill gaps where other signals are absent.

The **Spam Classifier** trains one model per entity type. Each model sees all numeric features from the entity's derived view -- traffic patterns, neighborhood signals, graph algorithm outputs, and crucially, the infrastructure class as a categorical feature. The **Weighted Sum Scorer** runs in parallel on domains only, computing a heuristic from 16 hand-selected signals with manually tuned weights.

Finally, the **Verdict Merger** reads both sub-scores and produces the final `logbd` score at 70% ML / 30% heuristic. This merged score is published to Kafka on the `score.signal` topic, where the **Score Consumer** picks it up and writes it to the graph. The circle closes: scores computed from the graph flow back into it, available for the next derived refresh cycle.

## Query Path: Investigating Threats {#query-flow}

When a security analyst wants to investigate a suspicious domain, they typically start with the **Client CLI**: `logbd node domain suspicious-example.com`. This hits the **REST API**, which routes to the nodes router.

The API does not query FlightSQL for this. Instead, it uses the **EdgePool** -- a pool of direct DuckDB connections to Parquet snapshot files. For the 259M-row emailed_with table, this difference matters: 2ms direct versus 150-400ms through Flight SQL. The EdgePool refreshes connections when snapshot file modification times change, so data stays reasonably fresh without full reconnection cycles.

For deeper investigation, the analyst might request a subgraph: all entities within 2 hops of the target. The API traverses edges across multiple DuckDB connections, assembling the neighborhood. If the analyst wants messages, the API queries the message role table to find all emails where this domain appeared as MailFrom, HeaderFrom, or ReplyTo.

For AI-assisted investigation, an **LLM Agent** connects through the **MCP Server**, which translates natural language tool calls into REST API requests. The agent can follow the same investigation flow: lookup, neighbors, path finding, and search -- with the graph's structure guiding the conversation.
