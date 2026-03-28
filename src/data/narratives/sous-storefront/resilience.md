## DummyJSON Goes Down {#external.dummyjson}

It is 2am and the **DummyJSON API** starts returning 503 Service Unavailable. This is the worst-case scenario for sous-storefront, because DummyJSON is the sole data source and the **API Client** has no resilience configuration -- no timeout, no retry policy, no circuit breaker, no fallback cache. The ky HTTP client instance is created with just a `prefixUrl` and nothing else.

The failure cascades through the system in two phases.

**Phase 1: SSR loaders block.** The **Root Layout** loader calls `prefetchQuery` for categories. The ky request fires and either fails immediately (connection refused) or hangs (if the API is slow-responding). There is no timeout configured -- not on ky, not on TanStack Query's prefetch, not on React Router's loader. If the API is returning errors quickly, the loader rejects with an HTTP error. If the API is slow, the SSR server blocks indefinitely for that request.

If the loader throws, React Router's **ErrorBoundary** (exported from **App (Root Module)**) catches it and renders a generic "Oops! An unexpected error occurred" page. In development mode, it shows the stack trace. In production, the shopper sees a dead end with no retry button.

**Phase 2: TanStack Query retries.** If the SSR somehow succeeds with partial data (or if the shopper loaded the page before the outage and is now navigating client-side), TanStack Query's default retry behavior kicks in. It retries failed queries three times with exponential backoff. The **Categories Query**, **Category Sections Infinite Query**, and **Products Infinite Query** all enter error state. But here is the gap: none of the consuming components render an error UI. The **Home Page** shows skeleton cards that shimmer indefinitely. The **Products Page** shows empty space. The **NavMenu** shows no category links. There is no "Something went wrong, try again" message anywhere in the UI.

The **Cart Sheet** and **Checkout Page** continue to work normally. Cart state is in **Browser localStorage**, completely independent of the API. A shopper who added items before the outage can still view their cart, adjust quantities, and even complete the (simulated) checkout flow. The failure is contained to catalog browsing.

**Recovery** is passive: when DummyJSON comes back, TanStack Query's refetch-on-focus behavior triggers a refresh. The shopper switches to another tab and back, and the data loads. There is no active health-check endpoint, no circuit breaker to prevent hammering a failing API, and no cached fallback to serve stale data while the API recovers.

## Slow API Responses {#app.api}

A more insidious failure mode: DummyJSON responds, but slowly. Every request takes 5-10 seconds instead of the usual 200ms. The SSR Server is the first victim. The **Home Page** loader first fetches categories sequentially, then fires four category product requests in parallel via Promise.all, plus the 800ms artificial delay. At 5 seconds per call, that is still 10+ seconds of TTFB (categories fetch + slowest of the four parallel fetches + 800ms padding). The shopper stares at a blank browser tab with a spinning favicon.

There is no streaming SSR configured -- React Router waits for all loaders to resolve before sending any HTML. The shopper cannot even see a loading skeleton, because the HTML has not been sent yet.

On the client side, the **Category Sections Infinite Query** adds its own damage: the 800ms artificial delay fires on top of already-slow API responses. A 5-second API call becomes 5.8 seconds per scroll page. Infinite scroll becomes a patience test.

The recommended mitigations are clear: configure a ky timeout (5 seconds is reasonable), enable ky retry with backoff for transient failures, and consider adding a React Router loader timeout or streaming SSR to get partial content to the browser faster.

## localStorage Unavailable {#external.localstorage}

In Safari private browsing (older versions), or when the user has disabled storage, or when the quota is exceeded, localStorage throws on write. The **Cart Store** and **Theme Store** both use Zustand's persist middleware, which catches storage errors silently. The stores fall back to in-memory operation.

The shopper will not notice anything wrong during their session. They can browse, add items, toggle the theme, and check out. But when they close the tab, everything resets. The next visit starts with an empty cart and the default `"system"` theme.

The theme fallback is actually graceful: `"system"` respects the OS dark mode preference via `matchMedia`, so the shopper gets a reasonable default. The cart fallback is less graceful -- there is no indication that the cart will not persist, so a shopper might add items, leave, and return expecting to find them.

There is no detection of this failure mode. The stores do not expose a "persistence healthy" flag, and no UI warning tells the shopper their cart is ephemeral. Adding a small banner ("Your cart will not be saved in this browser mode") would be a low-effort improvement.

## SSR Hydration Mismatch {#app.root}

If the server-rendered HTML and the client-side React tree disagree -- because the DummyJSON API returned different data between server render time and client hydration time, or because a time-sensitive component renders differently -- React 19 logs a hydration mismatch warning in the console.

In practice, this is rare and harmless for this storefront. TanStack Query's `HydrationBoundary` ensures the client starts with exactly the data the server used. The mismatch risk is limited to the theme class: the server renders without knowledge of the shopper's localStorage theme preference, so the initial HTML is always in the default state. The **App (Root Module)** applies the correct theme class in a `useEffect` after hydration, causing a brief flash on first load if the stored theme differs from the default.

This flash is a known tradeoff of the SSR + client-side theme pattern. The alternatives -- a blocking `<script>` in `<head>` to read localStorage before React hydrates, or a cookie-based theme that the server can read -- would eliminate the flash but add complexity.
