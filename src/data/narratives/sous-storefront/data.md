## Where Does Truth Live? {#browser.stores}

This storefront has a clean separation between two kinds of state: server data (product catalog from DummyJSON) and client data (cart contents and theme preference). Server data is treated as a read-only cache that can go stale and be refetched. Client data is the source of truth -- there is no server-side copy.

This split is not accidental. The team chose to keep cart and theme state entirely in the browser because the storefront has no backend. There is no user account system, no server session, no database. A shopper's cart exists only in their browser's localStorage. Close the tab, and the data persists. Switch to a different browser, and it does not.

## Cart State {#store.cart}

The **Cart Store** is the most-connected piece of state in the system. Five components read it (**Cart Sheet**, **Checkout Page**, **Success Page**, **Home Page**, **Products Page**), and three write to it (**ProductCard** via addItem, **Cart Sheet** via increment/decrement/remove, **Checkout Page** via clear).

The store holds three values: `items` (an array of `{ product, count }` objects), `total` (a number recomputed on every mutation), and `successfulOrder` (a boolean flag used as a cross-route signal between checkout and success). All three are persisted to **Browser localStorage** under the key `cart-storage` via Zustand's persist middleware.

The `successfulOrder` flag deserves attention. It is a workaround for the lack of server-side session state. After the checkout clientAction "completes" the order, it sets this flag to `true`. The **Success Page** clientLoader reads it, renders the confirmation, and immediately resets it to `false`. This one-time-read pattern prevents the success page from being revisitable via browser back or bookmark. It works, but it means cart state doubles as a routing signal -- a mixing of concerns that would not exist if the checkout had a real backend returning an order ID.

Every mutation to the cart triggers a full `reduce` across all items to recompute the total. With a typical shopping cart of 5-15 items, this is negligible. But it is worth noting as an incremental-update candidate if the cart ever grows large (e.g., wholesale ordering).

## Theme Preference {#store.theme}

The **Theme Store** holds a single value: `theme`, which is `"dark"`, `"light"`, or `"system"`. It persists to **Browser localStorage** under `theme-storage`. Two components read it (**ThemeToggle** and **App (Root Module)**), and one writes (**ThemeToggle**). The **Toaster** also reads the theme for toast styling.

What makes this store unusual is that `setTheme` has a side effect: it directly mutates the **Document DOM**. Most Zustand stores are pure state containers that let React handle rendering. The theme store reaches outside React to toggle classes on `document.documentElement`. This is the right call for theming -- a React re-render cycle to toggle a CSS class would cause a visible flash, especially on page load.

On mount, the **App (Root Module)** reads the theme imperatively via `useThemeStore.getState().theme` and applies the class in a `useEffect`. This is a deliberate choice over reading it during render: it avoids hydration mismatches between the server (which does not have access to localStorage) and the client (which does).

## TanStack Query Cache {#browser.queries}

Product catalog data lives in the TanStack Query in-memory cache. This is ephemeral -- it exists only for the lifetime of the browser tab and is never written to localStorage. Three query keys partition the cache:

- `['categories']` -- the full category list. Shared between the **NavMenu** and the **Home Page** loader. This is the most-read query in the system: fetched during SSR, rehydrated on the client, and consumed by every page that shows navigation.

- `['category-sections']` -- the infinite query for home page category rows. Each "page" contains four categories with four products each. Pages accumulate as the shopper scrolls, and TanStack Query keeps them all in memory.

- `['products', category]` -- the infinite query for the products grid. Keyed by category slug (or undefined for "all products"). Each page contains eight products.

The cache is warm from SSR -- the dehydrated state from the server loader populates it before any client-side fetch fires. TanStack Query's default behavior refetches on window focus, so stale data gets replaced transparently. There is no explicit cache invalidation because the product catalog is read-only from the storefront's perspective.

## Dehydrated SSR State {#server.ssr}

The dehydrated state is a one-time transfer mechanism. Server loaders serialize their QueryClient caches via `dehydrate()`, embed the result in the HTML payload as loader data, and the client-side `HydrationBoundary` component pours it into the browser's QueryClient.

This transfer happens per-route: the **Root Layout** dehydrates categories, the **Home Page** loader dehydrates categories plus category sections, and the **Products Page** loader dehydrates the first page of products. Each loader creates its own QueryClient -- they do not share state on the server. This means categories are fetched twice during SSR of the home page (once by root-layout, once by home), though the second call may be deduped by the runtime if they happen close enough together.

After hydration, the dehydrated state is consumed and discarded. It is not a persistent store -- it is a bridge between server and client rendering.
