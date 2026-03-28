## SSR Home Page Prefetch {#route.root-layout}

When a shopper types the URL and hits enter, the request reaches the React Router SSR server. Two loaders execute in sequence. The **Root Layout** loader creates a fresh QueryClient and calls `prefetchQuery(categoriesQueryOptions)`, which sends `GET /products/categories` to DummyJSON through the **API Client**. This populates the query cache with the full category list so that the nav menu can render server-side.

Then the **Home Page** loader runs. It creates its own QueryClient, calls `fetchQuery` for categories (a cache hit if root-layout already fetched, but each loader creates an independent client -- they do not share cache). It takes the first four categories, fires a `prefetchInfiniteQuery` that issues four parallel `GET /products/category/:slug` requests through Promise.all, and waits for all of them plus an 800ms artificial delay.

Once all data is in hand, each loader calls `dehydrate(queryClient)` to serialize the cache into a transferable object. React Router embeds this in the HTML payload. The browser receives fully-rendered HTML with product content visible on first paint.

On the client, the **App (Root Module)** creates a browser-side QueryClient. The **Root Layout** wraps its children in a `HydrationBoundary` that pours the dehydrated state into this new cache. When the **Home Page** calls `useCategorySectionsInfiniteQuery`, the hook finds warm data and returns it instantly -- no loading spinner, no fetch, no flicker.

The weakness in this flow is the lack of error handling. If DummyJSON is slow or down, the loaders await their promises indefinitely -- no timeout is configured on the ky client, and React Router has no loader timeout either. The SSR server blocks until the response arrives or the browser's own connection timeout fires.

## Infinite Scroll Category Sections {#query.category-sections}

After the initial four category sections render, a sentinel `div` sits at the bottom of the page. React-intersection-observer watches it. When the shopper scrolls far enough that the sentinel enters the viewport, `useInView` flips `inView` to true. A guard checks `!isFetchingNextPage` to avoid duplicate requests, then calls `fetchNextPage()`.

The **Category Sections Infinite Query** takes over. It slices the next four categories from the master list (using `pageParam * 4` as the offset), fires parallel product fetches for each via the **API Client**, and waits. The 800ms artificial delay fires here too -- every page of scroll pagination pays this cost.

DummyJSON returns the product arrays. The query function maps them into `{ categoryProducts, nextCursor }` and TanStack Query appends the new page to the infinite cache. The **Home Page** re-renders, `data.pages.flatMap` produces the full list of sections, and new **CategorySection** components appear below the existing ones. If `hasNextPage` is still true, the sentinel re-renders for the next trigger.

The user experience is smooth: skeleton cards shimmer during the fetch, then snap into real content. But that 800ms padding means the skeletons always show for at least 800ms even when the API responds in 50ms.

## Add Product to Cart {#store.cart}

Sarah is browsing the home page. She sees a wireless headphone in the Electronics section and clicks "Add to cart." The **ProductCard** fires its `onAddToCart` callback with the product's `{ id, title, price, images }` and immediately calls `toast.success('Product added to cart')`.

The callback (passed down from the **Home Page** or **Products Page**) calls `useCartStore.getState().addItem(product)`. The **Cart Store** checks whether this product ID already exists in the items array. If it does, it increments the count. If not, it appends `{ product, count: 1 }`. Either way, it recomputes the total by reducing across all items.

Zustand's persist middleware serializes the updated state to **Browser localStorage** under `cart-storage`. Simultaneously, any component subscribed to the store re-renders. The **Cart Sheet** badge updates its count. If the drawer happens to be open, the **CartItem** list reflects the change in real time.

The sonner **Toaster** (rendered at the App Shell level) picks up the toast call and displays a success notification that auto-dismisses after a few seconds. The entire flow -- click to visual feedback -- is synchronous and client-only. No network request, no server involvement.

## Checkout and Order Placement {#route.checkout}

After adding a few items, the shopper opens the **Cart Sheet** and clicks "Checkout." React Router navigates to `/checkout`, which lives outside the root layout -- the header, nav menu, and cart drawer all disappear, replaced by a focused checkout experience.

The **Checkout Page** clientLoader fires first. It reads the cart store directly via `useCartStore.getState().items.length`. If zero, it redirects to `/products` -- preventing someone from bookmarking the checkout URL and landing on an empty page.

The page renders three sections: **OrderSummary** lists each item with quantity and line total, plus subtotal, 20% VAT, and grand total. **ShippingForm** collects name, email, address, city, and postal code. **PaymentForm** collects card number, expiry, and CVV. None of these fields have client-side validation beyond the HTML `required` attribute -- a shopper could submit "abc" as a card number and the form would accept it.

When the shopper clicks "Place Order," React Router's form submission triggers the clientAction. The button shows a spinner and "Placing order..." text while `navigation.state` is `'submitting'`. The clientAction awaits a 1-second setTimeout (simulating a backend call that does not exist), then calls `cart.clear()` to empty the store, sets `successfulOrder: true` in the store state, fires a success toast, and returns `redirect('/success')`.

The **Success Page** clientLoader checks `successfulOrder`. If false (direct navigation, browser back), it redirects to `/products`. If true, it resets the flag to `false` (preventing refresh from showing the page again) and allows the render. The page shows a CheckCircle icon, a hardcoded order number (#134145), and a "Continue Shopping" link. A `useEffect` creates a JSConfetti instance and fires `addConfetti()`, with cleanup calling `clearCanvas()` on unmount.

## Theme Toggle {#component.theme-toggle}

The shopper notices the site is in dark mode and clicks the moon icon in the header. The **ThemeToggle** reads the current theme from the **Theme Store**. If it is `'dark'`, it calls `setTheme('light')`; if `'light'` or `'system'`, it calls `setTheme('dark')`. Note that the toggle is binary -- the `'system'` option exists in the store schema but the toggle never sets it, so once a shopper manually toggles, they leave system-preference mode permanently.

The store's `setTheme` action does three things in sequence: removes both `'light'` and `'dark'` classes from `document.documentElement`, resolves the final class (if `'system'`, it checks `matchMedia('prefers-color-scheme: dark')`), and adds the resolved class. This direct DOM mutation is deliberate -- it bypasses React's render cycle so the color change is instantaneous.

Zustand persist middleware writes the new theme to **Browser localStorage** under `theme-storage`. On the next page load, the **App (Root Module)** reads the theme imperatively in a `useEffect` and applies the class after hydration. Since `useEffect` runs after the first paint, there can be a brief flash if the stored theme differs from the server-rendered default -- a known SSR theming tradeoff discussed in the resilience section.

The Sun/Moon icons in the toggle button swap via CSS transitions (`rotate` and `scale`), not conditional rendering. Both icons are always in the DOM; Tailwind's `dark:` variants control which one is visible. This gives a smooth rotation animation that would not be possible with mount/unmount.
