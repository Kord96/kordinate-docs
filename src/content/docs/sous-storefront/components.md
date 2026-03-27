---
title: Components
---

Component reference organized by architectural layer. Each component's source file, exports, and role are listed below.

## Core

Foundation modules that wire together the application shell, routing, API access, types, utilities, and styles.

| Component | File | Description |
|---|---|---|
| App (Root Module) | `app/root.tsx` | Root component. Creates QueryClient, wraps Outlet in QueryClientProvider. Applies persisted theme class on mount. Exports `Layout`, `App`, and `ErrorBoundary`. |
| Route Config | `app/routes.ts` | Declarative route tree. Root layout at `/` wraps home and products. Checkout and success are standalone routes. |
| API Client | `app/api.ts` | ky HTTP client with `prefixUrl` set to `https://dummyjson.com`. |
| Type Definitions | `app/types.ts` | Shared domain types: `Category`, `Product`, `CartItem`. |
| Utility Functions | `app/utils.ts` | `cn()` for Tailwind class merging (clsx + tailwind-merge), `fromSlugToTitle()` for URL slug conversion. |
| Global Styles | `app/app.css` | TailwindCSS v4 entry point. Custom dark variant, slide-down/slide-up animations, oklch color tokens for light/dark themes. |

## Stores (Zustand)

Client-side state managed by Zustand with localStorage persistence.

| Store | File | Exports | Description |
|---|---|---|---|
| Cart Store | `app/hooks/cart-store.tsx` | `useCartStore` | Cart items, computed total, successfulOrder flag. Actions: `addItem`, `removeItem`, `incrementItem`, `decrementItem`, `clear`. Persisted to `cart-storage` key. |
| Theme Store | `app/hooks/theme-store.tsx` | `useThemeStore` | Theme as `"dark" \| "light" \| "system"`. `setTheme` mutates `document.documentElement.classList` directly. Persisted to `theme-storage` key. |

## Queries (TanStack Query)

Server-state management via TanStack Query. Each query exports both `queryOptions` (for SSR prefetch) and a React hook.

| Query | File | Key | Description |
|---|---|---|---|
| Categories | `app/hooks/categories-query.tsx` | `["categories"]` | Fetches `GET /products/categories`. Returns `Category[]`. Used in root-layout SSR prefetch and nav-menu. |
| Category Sections | `app/routes/home/hooks/category-sections-infinte-query.tsx` | `["category-sections"]` | Infinite query. Pages through categories in batches of 4, fetching 4 products each. Includes 800ms delay for loading UX. Depends on categories query. |
| Products | `app/routes/products/hooks/products-infinite-query.tsx` | `["products", category]` | Infinite query. Fetches `GET /products` or `/products/category/:slug` with `limit=8` and cursor pagination via `skip`. |

## Shared Components

Reusable components used across multiple routes.

| Component | File | Exports | Description |
|---|---|---|---|
| ProductCard | `app/components/product-card.tsx` | `ProductCard`, `ProductCardSkeleton` | Product display card with image, title, price, "Add to cart" button. Fires `onAddToCart` callback and shows sonner toast. `data-testid="product-card"`. |
| ThemeToggle | `app/components/theme-toggle.tsx` | `ThemeToggle` | Dark/light toggle button with Sun/Moon icons and CSS transitions. Binary toggle (dark to light). |

## UI Primitives (shadcn/ui)

Low-level UI components from shadcn/ui built on Radix UI primitives. Used as building blocks by route and shared components.

| Primitive | File | Key Exports | Description |
|---|---|---|---|
| Breadcrumb | `app/components/ui/breadcrumb.tsx` | `Breadcrumb`, `BreadcrumbList`, `BreadcrumbItem`, `BreadcrumbLink`, `BreadcrumbPage` | Accessible breadcrumb navigation with Radix Slot for composition. |
| Button | `app/components/ui/button.tsx` | `Button`, `buttonVariants` | 6 variants (default, destructive, outline, secondary, ghost, link), 4 sizes. CVA styling, Radix Slot for `asChild`. |
| Collapsible | `app/components/ui/collapsible.tsx` | `Collapsible`, `CollapsibleTrigger`, `CollapsibleContent` | Animated expand/collapse using Radix Collapsible with CSS slide animations. |
| Input | `app/components/ui/input.tsx` | `Input` | Styled text input with focus ring, validation states, dark mode support. |
| NavigationMenu | `app/components/ui/navigation-menu.tsx` | `NavigationMenu`, `NavigationMenuList`, `NavigationMenuTrigger`, `NavigationMenuLink` | Full Radix NavigationMenu with viewport and indicator sub-components. |
| Sheet | `app/components/ui/sheet.tsx` | `Sheet`, `SheetTrigger`, `SheetContent`, `SheetHeader`, `SheetTitle` | Slide-over panel (4 sides) built on Radix Dialog. Overlay, portal, header/footer. |
| Toaster | `app/components/ui/sonner.tsx` | `Toaster` | Sonner toast notifications themed via theme store and CSS variables. |

## Route: Root Layout

Layout route at `/` providing the shared header, navigation, and cart drawer for home and products pages.

| Component | File | Description |
|---|---|---|
| Root Layout | `app/routes/root-layout/index.tsx` | Server-side loader prefetches categories query and dehydrates for SSR. Renders Header + Outlet in HydrationBoundary. |
| Header | `app/routes/root-layout/components/header.tsx` | Sticky top header with backdrop blur. NavMenu (left), Logo (center), Cart + ThemeToggle (right). |
| Logo | `app/routes/root-layout/components/logo.tsx` | "ShopHub" brand logo linking to home. |
| NavMenu | `app/routes/root-layout/components/nav-menu.tsx` | Sheet drawer navigation. Lists "All Products" and categories from query. First 10 shown, rest in Collapsible. Auto-closes on navigation. |
| Cart Sheet | `app/routes/root-layout/components/cart/index.tsx` | Right-side Sheet with cart items, quantity controls, total, "Checkout" link. `data-testid="cart-button"`. |
| CartItem | `app/routes/root-layout/components/cart/cart-item.tsx` | Single cart line item with image, title, price, quantity controls, remove button. |
| Cart EmptyState | `app/routes/root-layout/components/cart/empty-state.tsx` | Empty cart placeholder with icon and instructional text. |

## Route: Home

Index route at `/` with infinite-scroll category sections.

| Component | File | Description |
|---|---|---|
| Home Page | `app/routes/home/index.tsx` | SSR loader prefetches first page of category sections. Infinite scroll via `react-intersection-observer`. |
| CategorySection | `app/routes/home/components/CategorySection.tsx` | Horizontal scrollable row of ProductCards for one category. Includes "See More" link to category page. |

## Route: Products

Products listing at `/products/:category?` with load-more pagination.

| Component | File | Description |
|---|---|---|
| Products Page | `app/routes/products/index.tsx` | SSR loader prefetches first page. Responsive grid of ProductCards with "Load more" button. Dynamic meta title from category slug. |
| CategoryBreadcrumb | `app/routes/products/components/category-breadcrumb.tsx` | Breadcrumb showing "Featured Categories > {category}" with link back to home. |

## Route: Checkout

Checkout page at `/checkout` with order summary and forms. Standalone (no shared header).

| Component | File | Description |
|---|---|---|
| Checkout Page | `app/routes/checkout/index.tsx` | Client-side loader redirects to `/products` if cart empty. `clientAction` simulates order (1s delay), clears cart, redirects to `/success`. Two-column layout. |
| OrderSummary | `app/routes/checkout/components/order-summary.tsx` | Lists OrderItems with subtotal, VAT (20%), and total. |
| OrderItem | `app/routes/checkout/components/order-item.tsx` | Read-only cart item display: image, title, quantity, line total. |
| ShippingForm | `app/routes/checkout/components/shipping-form.tsx` | Name, email, address, city, postal code fields. |
| PaymentForm | `app/routes/checkout/components/payment-form.tsx` | Card number, expiry date, CVV fields. |

## Route: Success

Order confirmation at `/success`. Standalone (no shared header).

| Component | File | Description |
|---|---|---|
| Success Page | `app/routes/success.tsx` | Client-side loader redirects to `/products` unless `successfulOrder` flag set. Fires confetti animation. Shows order number and "Continue Shopping" link. |

## Tests

| Test | File | Description |
|---|---|---|
| Products E2E | `e2e/products.spec.ts` | 3 tests: product display by category, add to cart flow, category navigation via nav menu. |
| Checkout E2E | `e2e/checkout.spec.ts` | 1 test: full checkout flow from add-to-cart through form submission to success page. |
