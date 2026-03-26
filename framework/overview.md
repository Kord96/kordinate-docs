# Overview

## Problem

Dividing work across specialized agents keeps each one focused — but an agent's work can depend on another agent's domain knowledge.

**Sauron** is responsible for monitoring. Each time it sets up monitoring, it needs answers to key questions:

1. **What infrastructure do we have?**

        System runs on Kubernetes.
        Grafana at 198.128.3.100:9000, credentials: xxx
        Loki at 198.128.3.100:9001, Prometheus at 198.128.3.100:9002
        Shipping via Alloy, configured at master-alloy.yml

2. **What design patterns does this app use?**

        Stream-to-store pattern — reads from Kafka, writes to S3.
        Typical metrics: message throughput, storage growth.

These are **Deployer's** and **Designer's** domains, not **Sauron's**. Without delegation, **Sauron** would have to maintain its own infrastructure scanning and pattern detection skills — duplicating work and expanding beyond its scope.

The alternative is re-invoking **Deployer** and **Designer** every time, but that's expensive. The natural solution is to cache their answers — but how does **Sauron** detect a stale cache when Grafana moves to a new machine? Enter **kords**.

## What is a Kord

A **kord** is a contract between two agents. It defines who provides what, the expected response format, and the criteria for cache invalidation. When an agent needs another agent's knowledge, it consults through a kord — the result is cached and reused until the provider's state changes.

See [Kords](kords.md) for examples, cache freshness, and structure.
