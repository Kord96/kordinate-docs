## The System in Context {#external}

Sous-storefront is a server-rendered React e-commerce storefront built on **React Router v7** with TypeScript 5.8. A shopper opens the site in their browser, browses a product catalog, adds items to a cart, and checks out -- all without creating an account. The product catalog comes from a single external dependency: the **DummyJSON API**, a public REST service at dummyjson.com that provides categories, product listings, images, and prices. The storefront has no application backend -- no database, no authentication service, no payment processor. The Node.js SSR server acts as a thin rendering layer (a Backend-for-Frontend) that prefetches data and serves pre-rendered HTML, but all business logic runs in the browser. Cart state lives entirely in the browser via localStorage.

This simplicity is the defining architectural fact. The system boundary is narrow: one Node.js SSR server, one browser application, and one external API. Everything else -- state, routing, theming -- is handled client-side with no server involvement after the initial page load. The UI is built on **shadcn/ui** components (New York style, Radix primitives underneath) with **TailwindCSS v4** for styling, giving the storefront a polished component library without a heavy runtime cost.

## Server and Browser: The Two Runtime Boundaries {#server}

The **SSR Server** runs on Node 20 Alpine inside a Docker container. It exists for one reason: to prefetch product data at request time so that shoppers see content immediately rather than waiting for client-side JavaScript to load, parse, and fetch. Three loaders run server-side -- the **Root Layout** loader prefetches category navigation data, the **Home Page** loader fetches the full category list and then prefetches the first batch of category product sections (4 categories, 4 products each), and the **Products Page** loader fetches the first page of a product listing. Each creates its own independent TanStack Query client, calls the DummyJSON API through the **API Client**, and serializes the result via `dehydrate()` into the HTML payload. Notably, the root-layout and home loaders both fetch categories independently -- each has its own QueryClient, so there is no shared cache on the server side, meaning categories are fetched twice during SSR of the home page.

The **Browser** receives this pre-filled HTML and rehydrates it. The **App (Root Module)** creates a fresh QueryClient and wraps everything in QueryClientProvider. It also renders a global **Toaster** (Sonner) for toast notifications and exports an **ErrorBoundary** that catches loader failures -- showing a "404 Not Found" for missing routes or a generic "Oops! An unexpected error occurred" (with stack trace in development) for unhandled errors. The **Root Layout** then wraps its children in a HydrationBoundary, pouring the dehydrated state into the client-side cache so that TanStack Query starts warm rather than empty. From that point on, the browser takes over entirely -- subsequent data fetching, navigation, cart management, and theming all happen client-side.

The team chose SSR-with-hydration over a pure SPA for two reasons: first, shoppers see product content on first paint without waiting for JavaScript bundles; second, the `/` and `/products` routes are statically prerendered at build time via React Router's `prerender` config, meaning build-time HTML snapshots can be served from a CDN. At runtime, pages that were not prerendered (like `/products/:category` with a specific slug) still go through the SSR path -- loaders execute on each request, fetch fresh data from DummyJSON, and serve rendered HTML. The tradeoff is loader complexity -- each page that needs data must duplicate the prefetch-dehydrate pattern.

## Root Layout and Navigation {#browser.layout}

The **Root Layout** wraps every browsing page (`/` and `/products/:category?`) in a shared chrome. It renders the **Header**, which in turn composes four pieces: the **NavMenu** on the left, a centered **Logo**, the **Cart Sheet** on the right, and the **ThemeToggle** beside it.

The **NavMenu** is a Radix Sheet that slides in from the left. It fetches the category list from the **Categories Query** -- the same query the SSR loader already prefetched, so it resolves instantly from cache. The first 10 categories display as links; the rest hide behind a Collapsible "See All" toggle. When a shopper taps a category, React Router navigates to `/products/:slug`, and the Sheet auto-closes by watching `useNavigation().state`.

The **Cart Sheet** is the mirror image: a Sheet on the right. It reads from the **Cart Store** via Zustand subscription, rendering a **CartItem** per entry with increment, decrement, and remove controls. A badge on the trigger button shows the current item count. When the cart is empty, a **Cart EmptyState** placeholder appears instead.

## Pages: Home and Products {#browser.home}

When a shopper lands on the home page, the **Home Page** renders a "Featured Categories" heading and begins showing **CategorySection** rows. Each row is a horizontal-scroll strip of four **ProductCard** components plus a "See More" link. The data comes from the **Category Sections Infinite Query**, an infinite query that pages through categories in batches of four. As the shopper scrolls, an IntersectionObserver sentinel at the bottom triggers `fetchNextPage()`, loading the next four categories.

There is a deliberate 800ms artificial delay baked into the category sections query function. The team added it for loading-UX polish -- they wanted the skeleton shimmer to be visible rather than flash imperceptibly. This is an anti-pattern in production: it adds nearly a full second of latency to every page of category data, and it compounds with any real API slowness. The skeletons would still flash briefly with real network latency; the artificial delay is a candidate for removal before production traffic.

The **Products Page** at `/products/:category?` takes a different pagination approach: a "Load more" button instead of infinite scroll. It uses the **Products Infinite Query**, an infinite query with cursor-based skip/limit pagination (8 products per page). A **CategoryBreadcrumb** shows the current category with a link back to home.

Both pages connect to the **Cart Store** by passing `addItem` as the `onAddToCart` prop to **ProductCard**. The `addItem` action is an upsert: if the product already exists in the cart, it increments the quantity; otherwise it adds it as a new entry. When a shopper clicks "Add to cart", the card fires the callback and triggers a sonner toast confirmation. **ProductCard** also exports a **ProductCardSkeleton** variant used as the loading placeholder during data fetches.

## Checkout and Success {#browser.checkout}

The checkout flow deliberately lives outside the root layout -- there is no header, no navigation, no distractions. The **Checkout Page** uses a client-side loader guard: it reads `useCartStore.getState().items.length` directly (not via a hook, since this runs outside React rendering), and redirects to `/products` if the cart is empty.

The page renders an **OrderSummary** (items, subtotal, 20% VAT, total), a **ShippingForm**, and a **PaymentForm**. Neither form has schema validation -- only HTML `required` attributes. This is a significant gap: the clientAction processes whatever the browser submits with no sanitization or structural checks. In a production storefront, Zod or a similar schema library would validate before submission.

The clientAction itself is simulated: a 1-second `setTimeout`, then `cart.clear()`, `successfulOrder = true`, a toast, and a redirect to `/success`. There is no backend call. The **Success Page** checks the `successfulOrder` flag in its own clientLoader guard (redirecting to `/products` if false), resets the flag to prevent revisiting, and fires a js-confetti canvas animation with a hardcoded order number.

## Data Layer: Stores and Queries {#browser.stores}

Two Zustand stores manage client-side state. The **Cart Store** holds the items array, a computed total, and the `successfulOrder` flag, all persisted to localStorage under the `cart-storage` key. Every mutation (add, remove, increment, decrement, clear) recomputes the total via `reduce` -- a minor inefficiency that would only matter with very large carts.

The **Theme Store** persists a `"dark" | "light" | "system"` preference under `theme-storage`. Its `setTheme` action mutates `document.documentElement.classList` directly for instant CSS variable switching, bypassing React's render cycle entirely. This is pragmatic: waiting for a React re-render to toggle a body class would cause a visible flash.

Server state flows through three TanStack Query hooks: **Categories Query** (shared across nav and home), **Category Sections Infinite Query** (home page infinite scroll), and **Products Infinite Query** (products page pagination). All three funnel through the **API Client**, a ky instance pointed at `https://dummyjson.com` with no timeout, retry, or error handling configured beyond ky's defaults. This is the largest resilience gap in the system.

## External Dependencies {#external.dummyjson}

The **DummyJSON API** is the sole data source. It serves categories, product listings, and product images over public REST endpoints with no authentication. The storefront hits three endpoints: `GET /products/categories`, `GET /products`, and `GET /products/category/:slug`, all with query params for field selection and pagination.

**Browser localStorage** persists cart and theme state across sessions. If localStorage is unavailable (private browsing, quota exceeded), Zustand's persist middleware fails silently and the stores fall back to in-memory operation -- functional but ephemeral.

The **Document DOM** is touched directly by the theme store for class toggling. This is the only place the application bypasses React's virtual DOM.
