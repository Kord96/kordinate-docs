---
title: Overview
---

[Open interactive architecture viewer](/sous-storefront/architecture/)

## System Layers

```mermaid
graph TB
    subgraph Server["Server / SSR"]
        Loader["Route Loaders"]
        Prefetch["TanStack Query Prefetch"]
        Dehydrate["Dehydrate & Serialize"]
    end

    subgraph Client["Browser / Client"]
        Hydration["HydrationBoundary"]
        subgraph State["State Management"]
            TQ["TanStack Query Cache"]
            CartStore["Cart Store (Zustand)"]
            ThemeStore["Theme Store (Zustand)"]
        end
        subgraph UI["UI Layer"]
            Routes["Route Components"]
            Shared["Shared Components"]
            Primitives["shadcn/ui Primitives"]
        end
    end

    subgraph External["External Boundaries"]
        API["DummyJSON API"]
        LS["localStorage"]
        DOM["Document DOM"]
    end

    Loader --> Prefetch
    Prefetch --> API
    Prefetch --> Dehydrate
    Dehydrate --> Hydration
    Hydration --> TQ
    TQ --> API
    CartStore --> LS
    ThemeStore --> LS
    ThemeStore --> DOM
    Routes --> Shared
    Shared --> Primitives
    Routes --> TQ
    Routes --> CartStore
```

Four layers. **Server** runs route loaders that prefetch data via TanStack Query, dehydrate it, and embed it in the HTML response. **Client state** splits into TanStack Query (server-derived product/category data) and Zustand stores (client-only cart and theme), both persisted to localStorage. The **UI layer** composes route pages from shared components and shadcn/ui primitives. **External boundaries** are the DummyJSON API, localStorage, and the DOM (for theme class toggling).

## Route Map

```mermaid
flowchart LR
    Root["App Root"]
    Root -->|Outlet| RL["Root Layout\n/ (header, nav, cart)"]
    Root -->|Outlet| CO["Checkout\n/checkout"]
    Root -->|Outlet| SU["Success\n/success"]

    RL -->|index| Home["Home\n/"]
    RL -->|child| Products["Products\n/products/:category?"]

    CO -->|"order placed"| SU
    CO -.->|"cart empty"| Products
    SU -.->|"no flag"| Products

    style RL fill:#2563eb,color:#fff
    style CO fill:#7c3aed,color:#fff
    style SU fill:#059669,color:#fff
```

Root Layout wraps browsing routes (`/` and `/products`) with shared header, nav drawer, and cart drawer. Checkout and Success are standalone (no shared chrome). Dashed lines are client-side redirect guards based on cart state.

## State Architecture

```mermaid
flowchart TD
    subgraph ServerState["Server State (TanStack Query)"]
        CQ["Categories\n['categories']"]
        CSQ["Category Sections\n['category-sections']"]
        PQ["Products\n['products', category]"]
    end

    subgraph ClientState["Client State (Zustand)"]
        Cart["Cart Store\nitems[], total, successfulOrder"]
        Theme["Theme Store\ndark | light | system"]
    end

    subgraph Persistence
        LS1["localStorage\ncart-storage"]
        LS2["localStorage\ntheme-storage"]
        DJ["DummyJSON API"]
        DOM["document.documentElement"]
    end

    CQ -->|"GET /products/categories"| DJ
    CSQ -->|"GET /products/category/:slug"| DJ
    PQ -->|"GET /products"| DJ
    CSQ -.->|depends on| CQ

    Cart --> LS1
    Theme --> LS2
    Theme -->|"classList.toggle('dark')"| DOM
```

Server state (product data) flows through TanStack Query with SSR prefetch. Client state (cart, theme) lives in Zustand stores persisted to localStorage. The theme store also writes directly to the DOM for instant CSS variable switching.

## Routes

| Path | Route | Prerendered | Layout |
|---|---|---|---|
| `/` | Home | Yes | Root Layout (header, nav, cart) |
| `/products/:category?` | Products | `/products` only | Root Layout |
| `/checkout` | Checkout | No | Standalone (no header) |
| `/success` | Success | No | Standalone (no header) |

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React Router v7 (SSR + prerendering) |
| Language | TypeScript 5.8 |
| Styling | TailwindCSS v4 |
| UI Library | shadcn/ui (new-york style) on Radix UI primitives |
| Server State | TanStack Query v5 |
| Client State | Zustand v5 (localStorage persistence) |
| HTTP Client | ky |
| Bundler | Vite 6 |
| Testing | Playwright (E2E) |
| CI | GitHub Actions |
| Runtime | Node 20 Alpine (Docker) |
