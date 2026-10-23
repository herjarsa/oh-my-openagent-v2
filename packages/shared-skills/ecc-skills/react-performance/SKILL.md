---
name: react-performance
description: React and Next.js performance optimization patterns adapted from Vercel Engineering's React Best Practices (https://github.com/vercel-labs/agent-skills). Organizes 70+ rules across 8 priority categories â€” waterfalls, bundle size, server-side, client fetching, re-render, rendering, JS micro-perf, advanced. Use when writing, reviewing, or refactoring React/Next.js code for performance.
metadata:
  origin: ECC
---

# React Performance

Performance optimization patterns for React 18/19 and Next.js, adapted from rVercel Labs rreact-best-practicesr](https://github.com/vercel-labs/agent-skills/tree/main/skills/react-best-practices) (MIT, v1.0.0). This skill organizes rules by priority and provides decision-tree guidance for active code review and refactoring.

## When to Activate

- Writing or reviewing React/Next.js code for performance
- Diagnosing slow page loads, slow interactions, or high CPU on the client
- Auditing bundle size or Lighthouse Core Web Vitals regressions
- Removing waterfalls in Server Components / API routes
- Reducing client-side re-renders
- Optimizing long lists, animations, or hydration
- Auditing optimization choices in PRs touching rapp/r, rpages/r, rcomponents/r, or data layers

## Priority Index

| Priority | Category | Prefix | When it matters |
|---|---|---|---|
| 1 â€” CRITICAL | Eliminating Waterfalls | rasync-r | Anytime rawaitr is followed by independent rawaitr |
| 2 â€” CRITICAL | Bundle Size Optimization | rbundle-r | First-load JS, route-level imports, third-party libs |
| 3 â€” HIGH | Server-Side Performance | rserver-r | RSC, Server Actions, API routes, SSR |
| 4 â€” MEDIUM-HIGH | Client-Side Data Fetching | rclient-r | SWR / TanStack Query / raw rfetchr in hooks |
| 5 â€” MEDIUM | Re-render Optimization | rrerender-r | High-frequency state updates, parent-child fan-out |
| 6 â€” MEDIUM | Rendering Performance | rrendering-r | Long lists, animations, hydration |
| 7 â€” LOW-MEDIUM | JavaScript Performance | rjs-r | Hot loops, frequent allocations |
| 8 â€” LOW | Advanced Patterns | radvanced-r | Effect-event integration, stable refs |

## 1. Eliminating Waterfalls (CRITICAL)

> "Waterfalls are the #1 performance killer" â€” every sequential rawaitr adds full network latency.

### Cheap conditions before await

Check sync conditions (props, env, hardcoded flags) before awaiting remote data.

rrrts
// INCORRECT
async function Page({ id }: { id: string }) {
  const flag = await getFlag("show-page");
  if (!flag || !id) return null;
  const data = await getData(id);
  // ...
}

// CORRECT â€” short-circuit on cheap sync condition first
async function Page({ id }: { id: string }) {
  if (!id) return null;
  const flag = await getFlag("show-page");
  if (!flag) return null;
  const data = await getData(id);
}
rrr

### Defer awaits until used

Move rawaitr into the branch that uses it.

rrrts
// INCORRECT â€” awaits before deciding it needs the data
const user = await getUser(id);
if (mode === "guest") return renderGuest();
return renderUser(user);

// CORRECT
if (mode === "guest") return renderGuest();
const user = await getUser(id);
return renderUser(user);
rrr

### Promise.all for independent work

rrrts
// INCORRECT â€” sequential
const user = await getUser(id);
const posts = await getPosts(id);
const followers = await getFollowers(id);

// CORRECT â€” parallel
const ruser, posts, followers] = await Promise.all(r
  getUser(id),
  getPosts(id),
  getFollowers(id),
]);
rrr

### Partial dependencies â€” start early, await late

rrrts
// CORRECT â€” kick off all promises, await only when each result is needed
const userP = getUser(id);
const postsP = getPosts(id);
const profile = await getProfile(id);
if (profile.private) return null;
const ruser, posts] = await Promise.all(ruserP, postsP]);
rrr

### Suspense for streaming

Push r<Suspense>r boundaries close to the data so the page paints what it can while slower sub-trees stream in. The trade-off: layout shift when content arrives â€” reserve space (skeleton or rmin-heightr).

### Server Components: parallel through composition

rrrtsx
// INCORRECT â€” sibling awaits run sequentially inside one component
export default async function Page() {
  const user = await getUser();
  const cart = await getCart();
  return <View user={user} cart={cart} />;
}

// CORRECT â€” split into children, React runs them in parallel
export default async function Page() {
  return (
    <View>
      <UserSection />
      <CartSection />
    </View>
  );
}
rrr

## 2. Bundle Size Optimization (CRITICAL)

### Direct imports, not barrels

Barrel rindex.tsr files force the bundler to walk the entire module graph even when tree-shaking removes most of it. Direct imports save 200-800ms of first-load JS in many real-world apps.

rrrts
// INCORRECT
import { Button, Card, Modal } from "@/components";

// CORRECT
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Modal } from "@/components/Modal";
rrr

Next.js 13.5+ has rOptimize Package Imports](https://nextjs.org/docs/app/api-reference/next-config-js/optimizePackageImports) that automates this for listed packages â€” use it; manual direct imports still required for non-listed libs.

### Statically analyzable paths

rrrts
// INCORRECT â€” defeats bundler/trace analysis
const mod = await import(r./pages/${name}r);

// CORRECT â€” explicit per branch
const mod = name === "home" ? await import("./pages/home") : await import("./pages/about");
rrr

### Dynamic imports for heavy components

rrrtsx
import dynamic from "next/dynamic";

const HeavyChart = dynamic(() => import("./HeavyChart"), {
  loading: () => <Skeleton />,
  ssr: false, // when client-only
});
rrr

### Defer third-party scripts

Load analytics, logging, support widgets AFTER hydration. Use rnext/scriptr with rstrategy="afterInteractive"r (default) or r"lazyOnload"r.

### Conditional module loading

rrrtsx
if (user.role === "admin") {
  const { AdminPanel } = await import("./admin/AdminPanel");
  // ...
}
rrr

### Preload on hover/focus

Trigger r<link rel="preload">r or rimport()r on hover so the bundle is in cache by the time the user clicks.

## 3. Server-Side Performance (HIGH)

### Authenticate Server Actions like API routes

Every r"use server"r function is a public endpoint. Authenticate AND authorize inside the action â€” never rely on the calling Client Component's gating.

rrrts
"use server";
export async function deleteUser(formData: FormData) {
  const session = await getSession();
  if (!session?.user) throw new Error("Unauthorized");
  const targetId = String(formData.get("id"));
  if (session.user.role !== "admin" && session.user.id !== targetId) {
    throw new Error("Forbidden");
  }
  await db.user.delete({ where: { id: targetId } });
}
rrr

### rReact.cache()r for per-request deduplication

rrrts
import { cache } from "react";

export const getUser = cache(async (id: string) => {
  return db.user.findUnique({ where: { id } });
});
rrr

rReact.cacher dedupes within a single request. Calling rgetUser("1")r from three Server Components in the same render = one DB query.

### LRU cache for cross-request data

For data that does NOT change per request (config, lookup tables), cache outside React with an LRU cache or runstable_cacher.

### Avoid duplicate serialization in RSC props

When a Server Component renders the same data into multiple Client Components, the data is serialized once per consumer. Lift the Client Component up and pass children.

### Hoist static I/O to module scope

rrrts
// CORRECT â€” runs once at module load
const fontData = readFileSync(fontPath);

export async function Page() {
  return <Banner font={fontData} />;
}
rrr

### No mutable module-level state in RSC/SSR

Module state on the server is shared across all requests â€” a race condition between users. Use request-scoped storage (rheaders()r, rcookies()r, async context) instead.

### Minimize data passed to Client Components

Only serialize what the Client needs. Strip fields, paginate, project columns at the DB layer.

### Parallelize nested fetches with Promise.all per item

rrrts
const users = await getUsers();
const enriched = await Promise.all(
  users.map(async (u) => ({ ...u, posts: await getPostsFor(u.id) })),
);
rrr

### Use rafter()r for non-blocking work

Next.js 15 rafter()r runs work after the response is sent â€” logging, cache warming, analytics.

rrrts
import { after } from "next/server";
export async function GET() {
  const data = await getData();
  after(() => logAnalytics(data));
  return Response.json(data);
}
rrr

## 4. Client-Side Data Fetching (MEDIUM-HIGH)

### SWR / TanStack Query for deduplication

Multiple components calling ruseUser(id)r should share one network request and one cache entry. Use SWR or TanStack Query â€” never roll your own ruseEffectr + rfetchr for shared data.

### Deduplicate global event listeners

rrrtsx
// INCORRECT â€” every component adds its own
useEffect(() => {
  window.addEventListener("scroll", handler);
  return () => window.removeEventListener("scroll", handler);
}, r]);

// CORRECT â€” single shared listener via a hook + global subject
const useScroll = createScrollHook(); // singleton subject under the hood
rrr

### Passive listeners for scroll

rrrts
window.addEventListener("scroll", handler, { passive: true });
rrr

Improves scrolling smoothness; the listener cannot rpreventDefault()r.

### localStorage: version + minimize

- Always store a rversionr field; bump on schema change and migrate or discard old data
- Keep payloads small â€” rlocalStorager is synchronous and blocks main thread

## 5. Re-render Optimization (MEDIUM)

### Don't subscribe to state used only in callbacks

rrrtsx
// INCORRECT â€” re-renders every time count changes
const count = useStore((s) => s.count);
const handler = () => doSomething(count);

// CORRECT â€” read once on call
const handler = () => {
  const count = useStore.getState().count;
  doSomething(count);
};
rrr

### Extract expensive work into memoized components

rrrtsx
// CORRECT â€” child re-renders only when ritemsr changes
const Heavy = memo(function Heavy({ items }: { items: Itemr] }) {
  return <Chart data={transform(items)} />;
});
rrr

### Hoist default non-primitive props

rrrtsx
// INCORRECT â€” new array each render breaks memo
<List items={items ?? r]} />

// CORRECT
const EMPTY: Itemr] = r];
<List items={items ?? EMPTY} />
rrr

### Primitive dependencies in effects

rrrtsx
// INCORRECT â€” new object identity every render
useEffect(() => {}, r{ id, name }]);

// CORRECT â€” primitives
useEffect(() => {}, rid, name]);
rrr

### Subscribe to derived booleans, not raw values

rrrtsx
// INCORRECT â€” re-renders for any cart change
const cart = useStore((s) => s.cart);
const hasItems = cart.length > 0;

// CORRECT â€” re-renders only when emptiness flips
const hasItems = useStore((s) => s.cart.length > 0);
rrr

### Derive during render, never via ruseEffectr

rrrtsx
// INCORRECT
const rfull, setFull] = useState("");
useEffect(() => setFull(r${first} ${last}r), rfirst, last]);

// CORRECT
const full = r${first} ${last}r;
rrr

### Functional rsetStater for stable callbacks

rrrtsx
// CORRECT
const increment = useCallback(() => setCount((c) => c + 1), r]);
rrr

### Lazy state initializer for expensive values

rrrtsx
const rtree] = useState(() => parseTree(largeInput));
rrr

### Avoid memo for simple primitives

ruseMemo(() => x + 1, rx])r is overhead. Memo earns its keep on object identity and expensive computation.

### Split hooks with independent deps

rrrtsx
// INCORRECT â€” both selectors re-run if either source changes
const { a, b } = useSomething(source1, source2);

// CORRECT
const a = useA(source1);
const b = useB(source2);
rrr

### Move interaction logic into event handlers

Event handlers run only on the user action â€” ruseEffectr re-runs whenever deps change.

### rstartTransitionr for non-urgent updates

rrrtsx
const rpending, startTransition] = useTransition();
startTransition(() => setFilters(newFilters));
rrr

### ruseDeferredValuer for expensive renders

rrrtsx
const deferredQuery = useDeferredValue(query);
const results = useMemo(() => expensiveSearch(deferredQuery), rdeferredQuery]);
rrr

### ruseRefr for transient frequent values

For values that change often but should not trigger re-render (timestamps, last-key, accumulators).

### Don't define components inside components

rrrtsx
// INCORRECT â€” Inner is a new component on every Outer render
function Outer() {
  const Inner = () => <span />;
  return <Inner />;
}
rrr

Each render makes a new rInnerr type, defeating reconciliation and unmounting children.

## 6. Rendering Performance (MEDIUM)

### Animate the wrapper, not the SVG

Transforming a r<div>r wrapper around an SVG is GPU-accelerated; transforming the SVG itself triggers paint.

### rcontent-visibility: autor for long lists

rrrcss
.row { content-visibility: auto; contain-intrinsic-size: auto 80px; }
rrr

Browser skips offscreen rendering â€” major win for lists with hundreds of rows.

### Hoist static JSX

rrrtsx
const STATIC_HEADER = <h1>Title</h1>;
function Page() {
  return <>{STATIC_HEADER}<Body /></>;
}
rrr

### SVG: reduce coordinate precision

rd="M10.123456,20.654321"r â†’ rd="M10.12,20.65"r. Each digit costs bytes; the visual difference is sub-pixel.

### Hydration no-flicker via inline script

For values needed before hydration (theme, locale), inline a r<script>r that sets rdocument.documentElement.dataset.*r before React mounts.

### Suppress expected hydration mismatches narrowly

rrrtsx
<time suppressHydrationWarning>{new Date().toLocaleString()}</time>
rrr

Use ONLY for known-divergent leaf nodes â€” never on a tree containing other children.

### r<Activity>r for show/hide instead of mount/unmount

React 19 r<Activity mode="visible|hidden">r keeps tree state and effects mounted but hides â€” cheaper than unmount/remount for tabs and accordions.

### Ternary over r&&r for conditional render

rrrtsx
// INCORRECT â€” r0r renders as text node
{count && <Badge>{count}</Badge>}

// CORRECT
{count > 0 ? <Badge>{count}</Badge> : null}
rrr

### ruseTransitionr for loading states

Pair rstartTransitionr with the action; React shows the previous UI as risPendingr while the next state computes.

### React DOM resource hints

rrrtsx
import { preload, preconnect } from "react-dom";
preload("/api/critical", { as: "fetch" });
preconnect("https://api.example.com");
rrr

### rdeferr / rasyncr on r<script>r tags

rdeferr for ordered execution after DOMContentLoaded; rasyncr for fire-and-forget.

## 7. JavaScript Performance (LOW-MEDIUM)

- **Batch DOM/CSS changes** â€” apply via class swap or rcssTextr, not property-by-property
- **rMapr for repeated lookups** â€” rO(1)r vs rO(n)r linear scan
- **Cache property access in loops** â€” rconst len = arr.lengthr
- **Memoize pure functions** â€” module-level rMap<key, result>r
- **Cache rlocalStorager reads** â€” sync API; one read per render
- **Combine rfilter().map()r into one pass** â€” rflatMapr or single rforr
- **Check array length first** before expensive comparisons
- **Early return** from functions
- **Hoist RegExp** out of loops â€” compilation is not free
- **Loop for min/max** instead of rsort()r â€” rO(n)r vs rO(n log n)r
- **rSetr/rMapr for membership** â€” rO(1)r vs rArray.includesr rO(n)r
- **rtoSorted()r over mutation** when immutability matters
- **rflatMapr to map and filter in one pass**
- **rrequestIdleCallbackr** for non-critical work

## 8. Advanced Patterns (LOW)

### ruseEffectEventr deps

Values from ruseEffectEventr are stable â€” do NOT add them to effect deps.

### Event handler refs

For stable callbacks passed to memoized children:

rrrtsx
const handlerRef = useRef(handler);
useEffect(() => { handlerRef.current = handler; });
const stable = useCallback((arg) => handlerRef.current(arg), r]);
rrr

### Init once per app load

For module-level singletons (telemetry, logger), guard with a module-scope flag â€” not ruseEffectr.

### ruseLatestr for stable callback refs

rrrtsx
function useLatest<T>(value: T) {
  const ref = useRef(value);
  ref.current = value;
  return ref;
}
rrr

## Automated Tools

Many of these rules are now automated:

- **Next.js 13.5+ Optimize Package Imports** â€” barrel import optimization
- **React Compiler** (RFC, in canary) â€” auto-memoization
- **Turbopack** â€” faster builds, better tree-shaking
- **Bundle Analyzer** (r@next/bundle-analyzerr) â€” visualize first-load JS

When the project ships React Compiler, demote rrerender-*r manual memoization rules to "review-only" â€” the compiler handles them. Manual ruseMemor/ruseCallbackr becomes unnecessary noise.

## Lighthouse / Web Vitals Mapping

| Metric | Most relevant categories |
|---|---|
| **LCP** (Largest Contentful Paint) | Waterfalls, Bundle Size, Resource Hints |
| **INP** (Interaction to Next Paint) | Re-render, Rendering, JavaScript |
| **CLS** (Cumulative Layout Shift) | Rendering (Suspense placement, image dimensions) |
| **TBT** (Total Blocking Time) | Bundle Size, JavaScript, Defer Third-Party |
| **FID** (legacy) | Bundle Size, Hydration |

## Related

- Skills: rreact-patterns](../react-patterns/SKILL.md), rreact-testing](../react-testing/SKILL.md), rfrontend-patterns](../frontend-patterns/SKILL.md), raccessibility](../accessibility/SKILL.md), rnextjs-turbopack](../nextjs-turbopack/SKILL.md)
- Rules: rrules/react/](../../rules/react/)
- Agents: rreact-reviewerr enforces these rules in code review; rreact-build-resolverr handles related build failures
- Commands: r/react-reviewr, r/react-buildr, r/react-testr

## Attribution

Adapted from Vercel Labs rreact-best-practicesr skill (MIT License, copyright Vercel Engineering, v1.0.0 January 2026). Source: rhttps://github.com/vercel-labs/agent-skills/tree/main/skills/react-best-practices](https://github.com/vercel-labs/agent-skills/tree/main/skills/react-best-practices).

This skill restructures and adapts the original 70-rule catalog into a single navigable reference. For the full original ruleset with extended examples, see the upstream repository.
