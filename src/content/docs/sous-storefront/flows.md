---
title: Data Flows
---

[Open interactive architecture viewer](/sous-storefront/architecture/)

## SSR Prefetch & Hydration

```mermaid
sequenceDiagram
    participant Browser
    participant Server as Server (loader)
    participant QC as QueryClient
    participant API as DummyJSON API

    Browser->>Server: GET / or /products
    Server->>QC: new QueryClient()
    Server->>QC: prefetchQuery(categoriesQueryOptions)
    QC->>API: GET /products/categories
    API-->>QC: Category[]
    Server->>QC: prefetchInfiniteQuery(...)
    QC->>API: GET /products/category/:slug
    API-->>QC: products data
    Server->>Server: dehydrate(queryClient)
    Server->>Browser: HTML + dehydrated state
    Browser->>Browser: HydrationBoundary rehydrates cache
    Browser->>Browser: useQuery reads from warm cache
```

Route loaders in `root-layout`, `home`, and `products` create a QueryClient, prefetch queries against the DummyJSON API, then dehydrate the cache into the HTML response. On the client, `HydrationBoundary` rehydrates the TanStack Query cache so hooks read from warm data without refetching.

**Routes that prefetch:**

| Route | Prefetches | Query Key |
|---|---|---|
| Root Layout | Categories | `["categories"]` |
| Home | Categories + first 4 category sections | `["categories"]`, `["category-sections"]` |
| Products | First page of products | `["products", category]` |

## Client-Side Data Fetching

```mermaid
flowchart LR
    NavMenu["NavMenu"] -->|useCategoriesQuery| CQ["Categories Query"]
    Home["Home Page"] -->|useCategorySectionsInfiniteQuery| CSQ["Category Sections Query"]
    Products["Products Page"] -->|useProductsInfiniteQuery| PQ["Products Query"]
    CSQ -->|depends on| CQ
    CQ -->|GET /products/categories| API["ky API Client"]
    CSQ -->|GET /products/category/:slug| API
    PQ -->|GET /products or /products/category/:slug| API
    API -->|prefixUrl| DummyJSON["DummyJSON API"]
```

After hydration, TanStack Query hooks manage ongoing data fetching through the shared `api` client (ky with `prefixUrl: https://dummyjson.com`). Infinite queries support pagination -- home uses intersection observer for auto-loading, products uses a manual "Load more" button.

| Query | Key | Pagination | Trigger |
|---|---|---|---|
| Categories | `["categories"]` | None | SSR prefetch, nav-menu mount |
| Category Sections | `["category-sections"]` | Infinite (batch of 4 categories) | Intersection observer |
| Products | `["products", category]` | Infinite (8 per page, skip-based) | "Load more" button |

## Cart Lifecycle

```mermaid
sequenceDiagram
    participant User
    participant ProductCard
    participant CartStore as Cart Store
    participant LS as localStorage
    participant CartSheet as Cart Sheet
    participant Checkout
    participant Success

    User->>ProductCard: Click "Add to cart"
    ProductCard->>CartStore: addItem(product)
    CartStore->>LS: persist (cart-storage)
    ProductCard->>User: Sonner toast notification

    User->>CartSheet: Open cart drawer
    CartSheet->>CartStore: read items, total
    User->>CartSheet: Adjust quantity / remove
    CartSheet->>CartStore: incrementItem / decrementItem / removeItem
    CartStore->>LS: persist

    User->>CartSheet: Click "Checkout"
    CartSheet->>Checkout: Navigate to /checkout

    Note over Checkout: clientLoader checks cart
    alt Cart empty
        Checkout-->>User: Redirect to /products
    end

    User->>Checkout: Fill forms, submit
    Note over Checkout: clientAction (1s delay)
    Checkout->>CartStore: clear() + set successfulOrder
    CartStore->>LS: persist
    Checkout->>Success: Redirect to /success

    Note over Success: clientLoader checks successfulOrder
    alt No successfulOrder flag
        Success-->>User: Redirect to /products
    end
    Success->>CartStore: clear successfulOrder flag
    Success->>User: Confetti + order confirmation
```

The cart spans four routes with a Zustand store (persisted to localStorage) as single source of truth. ProductCard fires `addItem`, the Cart Sheet provides quantity controls, Checkout clears the cart on submission, and Success verifies the `successfulOrder` flag before showing confirmation.

```mermaid
flowchart LR
    subgraph Actions
        A1["addItem\n(upsert)"]
        A2["removeItem"]
        A3["incrementItem"]
        A4["decrementItem"]
        A5["clear"]
    end

    subgraph State
        S1["items: CartItem[]"]
        S2["total: number"]
        S3["successfulOrder: boolean"]
    end

    A1 --> S1
    A2 --> S1
    A3 --> S1
    A4 --> S1
    A5 --> S1
    A5 --> S3
    S1 -->|"reduce"| S2
```

## Theme Toggle

```mermaid
sequenceDiagram
    participant User
    participant Toggle as ThemeToggle
    participant Store as Theme Store
    participant LS as localStorage
    participant DOM as document.documentElement
    participant Sonner as Toaster

    Note over DOM: Page load
    Store->>LS: Read persisted theme (theme-storage)
    Store->>DOM: Apply dark class (useEffect in root)

    User->>Toggle: Click toggle
    Toggle->>Store: setTheme(dark <-> light)
    Store->>DOM: Add/remove "dark" class
    Store->>LS: Persist new theme
    Sonner->>Store: Read theme for toast styling
```

Theme state persisted in localStorage via Zustand. On mount, the root component reads the theme imperatively and applies the `dark` class. The toggle switches between dark and light. `setTheme` directly mutates `documentElement.classList` for instant CSS variable switching. The Sonner Toaster reads the theme store for toast styling.

| Value | Effect |
|---|---|
| `"dark"` | `dark` class on `<html>`, dark oklch tokens active |
| `"light"` | No `dark` class, light oklch tokens active |
| `"system"` | Follows `prefers-color-scheme` media query |

## Route Navigation

```mermaid
flowchart TD
    Root["App Root"]
    Root -->|Outlet| RL["Root Layout\n(header, nav, cart)"]
    Root -->|Outlet| CO["Checkout Page"]
    Root -->|Outlet| SU["Success Page"]

    RL -->|index| Home["Home Page\n(/)"]
    RL -->|child| Products["Products Page\n(/products/:category?)"]

    CO -->|"clientAction: order placed"| SU
    CO -->|"clientLoader: cart empty"| Products
    SU -->|"clientLoader: no flag"| Products

    NavMenu["Nav Menu"] -->|"category link"| Products
    Cart["Cart Sheet"] -->|"Checkout link"| CO
    SU -->|"Continue Shopping"| Products

    style RL fill:#2563eb,color:#fff
    style CO fill:#7c3aed,color:#fff
    style SU fill:#059669,color:#fff
```

React Router v7 manages all transitions. Root Layout wraps `/` and `/products` with shared chrome. Checkout and Success are standalone. Client-side loaders act as redirect guards:

| Route | Guard | Condition | Redirect |
|---|---|---|---|
| `/checkout` | `clientLoader` | Cart has no items | `/products` |
| `/success` | `clientLoader` | `successfulOrder` flag not set | `/products` |
