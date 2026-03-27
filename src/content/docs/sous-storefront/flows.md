---
title: Data Flows
---

Documentation of the key data flows through the application. Each flow traces data from origin to destination, covering both server and client execution contexts.

## SSR Prefetch and Hydration

Server-side loaders in `root-layout`, `home`, and `products` routes prefetch data before rendering. The dehydrated query cache is serialized into the HTML response, then rehydrated on the client so TanStack Query hooks read from a warm cache without refetching.

**Routes that prefetch:**
- **Root Layout** -- prefetches categories query
- **Home** -- prefetches categories + first page of category sections (4 categories x 4 products)
- **Products** -- prefetches first page of products infinite query

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

## Client-Side Data Fetching

After hydration, TanStack Query hooks manage ongoing data fetching. Infinite queries support pagination -- the home page uses intersection observer for auto-loading, while the products page uses a manual "Load more" button.

All queries flow through the shared `api` client (ky instance with `prefixUrl: https://dummyjson.com`).

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

**Query keys and caching:**

| Query | Key | Pagination | Trigger |
|---|---|---|---|
| Categories | `["categories"]` | None | SSR prefetch, nav-menu mount |
| Category Sections | `["category-sections"]` | Infinite (batch of 4 categories) | Intersection observer |
| Products | `["products", category]` | Infinite (8 per page, skip-based) | "Load more" button |

## Cart Flow

The cart lifecycle spans four routes and uses a Zustand store persisted to localStorage as the single source of truth.

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

**Cart store actions:**

| Action | Behavior |
|---|---|
| `addItem(product)` | Upsert: increment quantity if exists, otherwise add with quantity 1 |
| `removeItem(id)` | Remove item from cart |
| `incrementItem(id)` | Increase quantity by 1 |
| `decrementItem(id)` | Decrease quantity by 1, remove if reaches 0 |
| `clear()` | Empty the cart, reset total |

## Theme Toggle

Theme state is persisted in localStorage and applied via CSS class on `document.documentElement`. The toggle is a binary switch between dark and light modes.

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
    Toggle->>Store: setTheme(dark ↔ light)
    Store->>DOM: Add/remove "dark" class
    Store->>LS: Persist new theme
    Sonner->>Store: Read theme for toast styling
```

**Theme values:**

| Value | Effect |
|---|---|
| `"dark"` | `dark` class on `<html>`, dark oklch color tokens active |
| `"light"` | No `dark` class, light oklch color tokens active |
| `"system"` | Follows `prefers-color-scheme` media query |

## Navigation

React Router v7 manages all route transitions. The root layout wraps browsing routes (home, products) with a shared header, nav menu, and cart. Checkout and success are standalone routes without the shared chrome.

Client-side loaders on checkout and success act as redirect guards based on cart state.

```mermaid
flowchart TD
    Root["App Root"]
    Root -->|Outlet| RL["Root Layout<br/>(header, nav, cart)"]
    Root -->|Outlet| CO["Checkout Page"]
    Root -->|Outlet| SU["Success Page"]

    RL -->|index| Home["Home Page<br/>(/)"]
    RL -->|child| Products["Products Page<br/>(/products/:category?)"]

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

**Route guards:**

| Route | Guard | Condition | Redirect |
|---|---|---|---|
| `/checkout` | `clientLoader` | Cart has no items | `/products` |
| `/success` | `clientLoader` | `successfulOrder` flag not set | `/products` |
