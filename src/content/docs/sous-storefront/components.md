---
title: Components
---

[Open interactive architecture viewer](/sous-storefront/architecture/)

## Component Hierarchy

```mermaid
graph TD
    Root["App Root\napp/root.tsx"]

    Root --> RL["Root Layout"]
    Root --> CO["Checkout Page"]
    Root --> SU["Success Page"]
    Root --> Toaster["Toaster"]

    RL --> Header
    Header --> NavMenu
    Header --> Logo
    Header --> Cart["Cart Sheet"]
    Header --> Toggle["ThemeToggle"]

    NavMenu --> Logo2["Logo"]
    NavMenu --> SheetUI["Sheet"]
    NavMenu --> Collapsible
    NavMenu --> BtnUI1["Button"]

    Cart --> CartItem
    Cart --> EmptyState
    Cart --> SheetUI2["Sheet"]
    Cart --> BtnUI2["Button"]

    CartItem --> BtnUI3["Button"]

    RL --> Home["Home Page"]
    RL --> Products["Products Page"]

    Home --> CatSection["CategorySection"]
    CatSection --> ProductCard

    Products --> ProductCard2["ProductCard"]
    Products --> Breadcrumb["CategoryBreadcrumb"]
    Breadcrumb --> BreadcrumbUI["Breadcrumb (ui)"]

    CO --> OrderSummary
    CO --> ShippingForm
    CO --> PaymentForm
    OrderSummary --> OrderItem

    ShippingForm --> InputUI["Input"]
    PaymentForm --> InputUI2["Input"]

    ProductCard --> BtnUI4["Button"]
    Toggle --> BtnUI5["Button"]

    style Root fill:#1a1a2e,color:#fff
    style RL fill:#2563eb,color:#fff
    style CO fill:#7c3aed,color:#fff
    style SU fill:#059669,color:#fff
    style Home fill:#2563eb,color:#fff
    style Products fill:#2563eb,color:#fff
```

Every parent-child rendering relationship in the app. App Root is the outermost shell (QueryClientProvider, theme init, Toaster). Root Layout wraps browsing routes with the shared Header. Checkout and Success render directly from the Root Outlet without shared chrome.

## Core

```mermaid
flowchart LR
    Root["App Root"] -->|provides| QC["QueryClientProvider"]
    Root -->|reads| TS["Theme Store"]
    Root -->|renders| Toaster
    Routes["app/routes.ts"] -->|declares| RT["Route Tree"]
    API["API Client (ky)"] -->|prefixUrl| DJ["dummyjson.com"]
    Types["app/types.ts"] -->|exports| T1["Category"]
    Types -->|exports| T2["Product"]
    Types -->|exports| T3["CartItem"]
    Utils["app/utils.ts"] -->|exports| CN["cn()"]
    Utils -->|exports| FST["fromSlugToTitle()"]
```

| Component | File | Key Exports |
|---|---|---|
| App (Root Module) | `app/root.tsx` | `Layout`, `App`, `ErrorBoundary` |
| Route Config | `app/routes.ts` | `default (RouteConfig[])` |
| API Client | `app/api.ts` | `api` |
| Type Definitions | `app/types.ts` | `Category`, `Product`, `CartItem` |
| Utility Functions | `app/utils.ts` | `cn`, `fromSlugToTitle` |
| Global Styles | `app/app.css` | TailwindCSS v4 entry point |

## Stores (Zustand)

```mermaid
flowchart LR
    CS["Cart Store"] -->|persist| LS1["localStorage\ncart-storage"]
    CS -->|actions| A1["addItem\nremoveItem\nincrementItem\ndecrementItem\nclear"]
    CS -->|state| S1["items[]\ntotal\nsuccessfulOrder"]

    TS["Theme Store"] -->|persist| LS2["localStorage\ntheme-storage"]
    TS -->|action| A2["setTheme"]
    TS -->|mutates| DOM["document.documentElement\nclassList"]
    TS -->|state| S2["theme:\ndark | light | system"]
```

Cart Store manages items, computed total, and the `successfulOrder` flag (redirect guard for the success page). Theme Store persists theme preference and directly mutates the DOM classList for instant CSS variable switching.

| Store | File | Exports |
|---|---|---|
| Cart Store | `app/hooks/cart-store.tsx` | `useCartStore` |
| Theme Store | `app/hooks/theme-store.tsx` | `useThemeStore` |

## Queries (TanStack Query)

```mermaid
flowchart TD
    CQ["Categories Query\n['categories']"] -->|GET /products/categories| API["ky API Client"]
    CSQ["Category Sections\n['category-sections']"] -->|GET /products/category/:slug| API
    CSQ -->|depends on| CQ
    PQ["Products Query\n['products', category]"] -->|"GET /products{/category/:slug}"| API
    API -->|prefixUrl| DJ["DummyJSON API"]

    RL["Root Layout loader"] -.->|prefetch| CQ
    HL["Home loader"] -.->|prefetch| CSQ
    PL["Products loader"] -.->|prefetch| PQ

    NM["NavMenu"] -->|useCategoriesQuery| CQ
    HP["Home Page"] -->|useInfiniteQuery| CSQ
    PP["Products Page"] -->|useInfiniteQuery| PQ
```

Each query exports a `queryOptions` object (for SSR prefetch in loaders, dashed lines) and a React hook (for client-side consumption, solid lines). Category Sections depends on Categories for pagination bounds.

| Query | File | Key | Pagination |
|---|---|---|---|
| Categories | `app/hooks/categories-query.tsx` | `["categories"]` | None |
| Category Sections | `app/routes/home/hooks/category-sections-infinte-query.tsx` | `["category-sections"]` | Infinite (batches of 4 categories) |
| Products | `app/routes/products/hooks/products-infinite-query.tsx` | `["products", category]` | Infinite (8 per page, skip-based) |

## Root Layout

```mermaid
flowchart LR
    RL["Root Layout"] --> Header
    Header --> NM["NavMenu\n(left Sheet)"]
    Header --> Logo["Logo\n(center)"]
    Header --> Cart["Cart Sheet\n(right Sheet)"]
    Header --> TT["ThemeToggle"]

    NM -->|useCategoriesQuery| CQ["Categories\nQuery"]
    Cart --> CI["CartItem"]
    Cart --> ES["EmptyState"]
    Cart -->|reads| CS["Cart Store"]
```

Root Layout renders the sticky Header, which composes four children: NavMenu (left Sheet drawer, categories from query), Logo (centered), Cart Sheet (right Sheet, reads from Cart Store), and ThemeToggle.

| Component | File | Exports |
|---|---|---|
| Root Layout | `app/routes/root-layout/index.tsx` | `loader`, `RootLayout` |
| Header | `app/routes/root-layout/components/header.tsx` | `default` |
| Logo | `app/routes/root-layout/components/logo.tsx` | `Logo` |
| NavMenu | `app/routes/root-layout/components/nav-menu.tsx` | `NavMenu` |
| Cart Sheet | `app/routes/root-layout/components/cart/index.tsx` | `Cart` |
| CartItem | `app/routes/root-layout/components/cart/cart-item.tsx` | `CartItem` |
| Cart EmptyState | `app/routes/root-layout/components/cart/empty-state.tsx` | `EmptyState` |

## Route Components

```mermaid
flowchart TD
    subgraph HomeRoute["Home (/)"]
        H["Home Page"] --> CS["CategorySection"]
        CS --> PC1["ProductCard"]
    end

    subgraph ProductsRoute["Products (/products/:category?)"]
        P["Products Page"] --> PC2["ProductCard"]
        P --> CB["CategoryBreadcrumb"]
    end

    subgraph CheckoutRoute["Checkout (/checkout)"]
        C["Checkout Page"] --> OS["OrderSummary"]
        C --> SF["ShippingForm"]
        C --> PF["PaymentForm"]
        OS --> OI["OrderItem"]
    end

    subgraph SuccessRoute["Success (/success)"]
        S["Success Page\n(confetti + confirmation)"]
    end

    C -->|"clientAction"| S
    C -.->|"cart empty"| P
    S -.->|"no flag"| P
```

**Home** renders CategorySection rows via infinite scroll (intersection observer). Each section is a horizontal scrollable row of ProductCards with a "See More" link.

**Products** renders a responsive ProductCard grid with "Load more" button. CategoryBreadcrumb appears when a category filter is active.

**Checkout** has two-column layout: OrderSummary (OrderItems with subtotal, VAT 20%, total) and ShippingForm + PaymentForm. Client-side loader guards empty cart.

**Success** fires js-confetti on mount, shows order number and "Continue Shopping" link. Client-side loader guards against direct access.

## Shared Components

| Component | File | Exports |
|---|---|---|
| ProductCard | `app/components/product-card.tsx` | `ProductCard`, `ProductCardSkeleton` |
| ThemeToggle | `app/components/theme-toggle.tsx` | `ThemeToggle` |

## UI Primitives (shadcn/ui)

| Primitive | File | Key Exports |
|---|---|---|
| Breadcrumb | `app/components/ui/breadcrumb.tsx` | `Breadcrumb`, `BreadcrumbList`, `BreadcrumbItem`, `BreadcrumbLink` |
| Button | `app/components/ui/button.tsx` | `Button`, `buttonVariants` |
| Collapsible | `app/components/ui/collapsible.tsx` | `Collapsible`, `CollapsibleTrigger`, `CollapsibleContent` |
| Input | `app/components/ui/input.tsx` | `Input` |
| NavigationMenu | `app/components/ui/navigation-menu.tsx` | `NavigationMenu`, `NavigationMenuList`, `NavigationMenuTrigger` |
| Sheet | `app/components/ui/sheet.tsx` | `Sheet`, `SheetTrigger`, `SheetContent`, `SheetHeader` |
| Toaster | `app/components/ui/sonner.tsx` | `Toaster` |

All primitives are built on Radix UI and use `cn()` from utils for Tailwind class merging.

## Tests

```mermaid
flowchart LR
    TP["Products E2E\n3 tests"] -->|tests| Products["Products Page"]
    TP -->|tests| Cart["Cart Sheet"]
    TP -->|tests| NavMenu

    TC["Checkout E2E\n1 test"] -->|starts| Products
    TC -->|opens| Cart
    TC -->|fills| Checkout["Checkout Page"]
    TC -->|verifies| Success["Success Page"]
```

| Test Suite | File | Coverage |
|---|---|---|
| Products E2E | `e2e/products.spec.ts` | Product display, add-to-cart, category navigation |
| Checkout E2E | `e2e/checkout.spec.ts` | Full checkout flow from cart to success page |
