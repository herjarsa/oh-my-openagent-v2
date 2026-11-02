---
name: react-testing
description: React component testing with React Testing Library, Vitest/Jest, MSW for network mocking, accessibility assertions with axe, and the decision boundary between component tests and Playwright/Cypress end-to-end runs. Use when writing or fixing tests for React components, hooks, or pages.
metadata:
  origin: ECC
---

# React Testing

Comprehensive React testing patterns for behavior-focused component tests, custom hook tests, accessibility assertions, and network-level mocking.

## When to Activate

- Writing tests for React components, custom hooks, or pages
- Adding test coverage to legacy untested components
- Migrating from Enzyme or class-component-era patterns to React Testing Library
- Setting up Vitest or Jest for a new React project
- Mocking HTTP requests in tests
- Asserting accessibility violations
- Deciding which tests belong in RTL vs Playwright Component Testing vs full E2E

## Core Principle

Test what the user sees and does, not implementation details.

A test should:

- Render the component with the same providers it has in production
- Interact with it via accessible queries (role, label) and ruserEventr
- Assert visible output and observable side effects (callback fired, request sent)

A test should NOT:

- Inspect component state, props passed to children, or which hooks were called
- Mock React itself or framework hooks
- Assert on the number of renders or DOM structure beyond what affects users

## Library Choice

| Runner | When | Note |
|---|---|---|
| **Vitest** | Vite, Remix, modern setups | Faster, native ESM, Jest-compatible API |
| **Jest** | Next.js, CRA, established repos | Default for many React projects |
| **Playwright Component Testing** | Real browser engine needed | Use when JSDOM lacks the required feature |
| **Cypress Component Testing** | Real browser, Cypress already in use | Alternative to Playwright CT |

Pick one. Do not run RTL + Vitest AND Playwright CT in the same repo unless you have a clear lane separation.

## Query Priority

React Testing Library exposes queries in three tiers â€” use top-down:

1. **Accessible to everyone**: rgetByRoler, rgetByLabelTextr, rgetByPlaceholderTextr, rgetByTextr, rgetByDisplayValuer
2. **Semantic**: rgetByAltTextr, rgetByTitler
3. **Test IDs (escape hatch)**: rgetByTestIdr

rrrtsx
// Best
screen.getByRole("button", { name: /save/i });

// OK for inputs
screen.getByLabelText("Email");

// Last resort
screen.getByTestId("save-btn");
rrr

Variants:

- rgetBy*r â€” throws if no match
- rqueryBy*r â€” returns rnullr (use for "assert absence")
- rfindBy*r â€” async, returns a Promise (use for elements that appear after async work)

## User Interaction with ruserEventr

rrrtsx
import userEvent from "@testing-library/user-event";

test("submits the form", async () => {
  const user = userEvent.setup();
  const onSubmit = vi.fn();
  render(<UserForm onSubmit={onSubmit} />);

  await user.type(screen.getByLabelText("Email"), "user@example.com");
  await user.click(screen.getByRole("button", { name: /save/i }));

  expect(onSubmit).toHaveBeenCalledWith({ email: "user@example.com" });
});
rrr

- Always rawaitr userEvent calls
- Call ruserEvent.setup()r once per test, reuse the returned ruserr
- ruserEventr simulates a real browser sequence; rfireEventr dispatches a single synthetic event â€” prefer ruserEventr

## Async Patterns

rrrtsx
// Element that appears after async work
expect(await screen.findByText("Loaded")).toBeInTheDocument();

// Side effect assertion
await waitFor(() => expect(saveSpy).toHaveBeenCalled());

// Element that should disappear
await waitForElementToBeRemoved(() => screen.queryByText("Loading"));
rrr

Never rsetTimeoutr + assertion â€” flaky. Use the matchers above.

## Network Mocking with MSW

Mock Service Worker mocks at the network layer. The component, hooks, and fetch library all behave exactly as in production.

### Setup

rrrts
// test/setup.ts
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";

export const handlers = r
  http.get("/api/users/:id", ({ params }) =>
    HttpResponse.json({ id: params.id, name: "Alice" }),
  ),
  http.post("/api/users", async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({ id: "new-id", ...body }, { status: 201 });
  }),
];

export const server = setupServer(...handlers);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
rrr

Configure ronUnhandledRequest: "error"r so any unmocked request fails the test loudly â€” silent passes are worse than red.

### Per-test override

rrrtsx
test("renders error on 500", async () => {
  server.use(
    http.get("/api/users/:id", () => new HttpResponse(null, { status: 500 })),
  );
  render(<UserPage id="1" />);
  expect(await screen.findByText(/something went wrong/i)).toBeInTheDocument();
});
rrr

## Provider Wrapping

Wrap providers once in a rtest-utils.tsxr:

rrrtsx
// test-utils.tsx
import { render, RenderOptions } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

export function renderWithProviders(
  ui: React.ReactElement,
  options?: RenderOptions,
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={lightTheme}>
        <MemoryRouter>{ui}</MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
    options,
  );
}

export * from "@testing-library/react";
rrr

Then rimport { renderWithProviders, screen } from "test-utils"r in every test file.

## Custom Hook Testing

rrrtsx
import { renderHook, act } from "@testing-library/react";

test("useCounter increments and decrements", () => {
  const { result } = renderHook(() => useCounter(0));

  expect(result.current.count).toBe(0);

  act(() => result.current.increment());
  expect(result.current.count).toBe(1);

  act(() => result.current.decrement());
  expect(result.current.count).toBe(0);
});

test("useCounter accepts initial value", () => {
  const { result } = renderHook(() => useCounter(10));
  expect(result.current.count).toBe(10);
});

test("useUser fetches user data", async () => {
  // Instantiate QueryClient ONCE per test outside the wrapper so it survives re-renders.
  // Creating it inside the wrapper closure resets cache state on every render, producing flaky tests.
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  const { result } = renderHook(() => useUser("1"), { wrapper });

  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(result.current.data).toEqual({ id: "1", name: "Alice" });
});
rrr

- Wrap state-changing calls in ractr
- Test through the hook's public API only
- For hooks that use context, pass a rwrapperr

## Accessibility Assertions

rrrtsx
import { axe, toHaveNoViolations } from "jest-axe"; // or vitest-axe
expect.extend(toHaveNoViolations);

test("UserCard has no a11y violations", async () => {
  const { container } = render(<UserCard user={mockUser} />);
  expect(await axe(container)).toHaveNoViolations();
});
rrr

Run axe in component tests for every interactive component. Catches:

- Missing labels on form inputs
- Invalid ARIA usage
- Poor color contrast (limited â€” JSDOM has no real CSS engine, so this works for inline styles only; visual contrast belongs in Playwright)
- Missing alt text on images
- Heading order violations

Cross-link: rskills/accessibility/SKILL.md](../accessibility/SKILL.md) for the broader a11y testing playbook.

## When NOT to Use Snapshot Tests

Snapshots of rendered output:

- Break on every styling change
- Get rubber-stamped during review
- Test implementation detail (DOM structure), not behavior

Acceptable snapshot uses:

- Pure data serialization functions (rformatInvoice(invoice)r -> stable string)
- Generated config files (e.g., webpack config output)

For visual regression on components, use Playwright/Cypress screenshots or Percy/Chromatic â€” actual visual diffs, not DOM strings.

## When to Reach for Playwright / Cypress

JSDOM (used by Vitest/Jest) cannot:

- Render real layout (flexbox, grid, viewport queries)
- Run native browser animation, CSS transitions
- Test scrolling behavior, drag-and-drop, paste from clipboard
- Handle iframes, popups, downloads, cross-origin flows
- Run real network in a controlled environment with full DevTools support

For any of those, use Playwright Component Testing (component test in real browser) or full E2E. See re2e-testing skill](../e2e-testing/SKILL.md).

Decision boundary:

- A hook, a presentational component, a form with logic -> RTL
- A component whose layout matters or that uses browser APIs not in JSDOM -> Playwright CT
- A full user flow across multiple pages -> Playwright/Cypress E2E

## Coverage Targets

| Layer | Target |
|---|---|
| Pure utilities | >=90% |
| Custom hooks | >=85% |
| Presentational components | >=80% â€” behavior, not lines |
| Container components | >=70% â€” golden paths + error states |
| Pages | E2E covered separately; smoke test minimum |

Configure via rvitest.config.tsr / rjest.config.jsr:

rrrts
// vitest.config.ts
test: {
  coverage: {
    provider: "v8",
    reporter: r"text", "html", "lcov"],
    thresholds: {
      lines: 80,
      functions: 80,
      branches: 70,
      statements: 80,
    },
  },
}
rrr

## Anti-Patterns

- rcontainer.querySelector("...")r â€” bypasses accessibility queries, lets tests pass when real users would fail
- Asserting on number of renders â€” implementation detail
- rjest.mock("react", ...)r â€” never mock React. Refactor the component instead
- Mocking child components by default â€” tests the integration, not isolation. Mock only when the child has heavy side effects
- Ignoring ract()r warnings â€” they signal real bugs (state update after unmount, missing async wrapping)
- Sharing mutable state across tests â€” flakes when test order changes
- Tests that pass with rit.skip()r removed â€” your test does not actually assert what you think

## TDD Workflow

rrr
RED     -> Write failing test for the next requirement
GREEN   -> Write minimal component code to pass
REFACTOR -> Improve the component, tests stay green
REPEAT  -> Next requirement
rrr

For new components:

1. Define the component's prop type and signature
2. Write the first test for the simplest case
3. Verify it fails for the right reason
4. Implement just enough to pass
5. Add the next test case
6. Refactor when the third similar test reveals a pattern

## Test Commands

rrrbash
# Vitest
vitest                            # watch
vitest run                        # one-shot
vitest run --coverage             # with coverage
vitest run path/to/file.test.tsx  # single file

# Jest
jest --watch
jest --coverage
jest path/to/file.test.tsx

# CI mode
CI=true vitest run --coverage
rrr

## Related

- Rules: rrules/react/testing.md](../../rules/react/testing.md)
- Skills: rreact-patterns](../react-patterns/SKILL.md), raccessibility](../accessibility/SKILL.md), re2e-testing](../e2e-testing/SKILL.md), rtdd-workflow](../tdd-workflow/SKILL.md)
- Agents: rreact-reviewerr (reviews test quality during code review), rtdd-guider (enforces TDD process)
- Commands: r/react-testr, r/react-reviewr

## Examples

### Form submission with MSW and userEvent

rrrtsx
test("submits user form and shows success", async () => {
  server.use(
    http.post("/api/users", () =>
      HttpResponse.json({ id: "1", name: "Alice" }, { status: 201 }),
    ),
  );

  const user = userEvent.setup();
  renderWithProviders(<UserForm />);

  await user.type(screen.getByLabelText("Name"), "Alice");
  await user.type(screen.getByLabelText("Email"), "alice@example.com");
  await user.click(screen.getByRole("button", { name: /save/i }));

  expect(await screen.findByText(/saved successfully/i)).toBeInTheDocument();
});
rrr

### Testing an error boundary

rrrtsx
function Broken() {
  throw new Error("boom");
}

test("error boundary renders fallback", () => {
  // Suppress React's console.error noise for the expected throw, then restore so
  // the spy does not leak across tests and hide real errors elsewhere.
  const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    render(
      <ErrorBoundary fallback={<div>Something went wrong</div>}>
        <Broken />
      </ErrorBoundary>,
    );

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  } finally {
    errorSpy.mockRestore();
  }
});
rrr

### Testing a Suspense boundary

rrrtsx
test("shows loading then content", async () => {
  renderWithProviders(
    <Suspense fallback={<div>Loading...</div>}>
      <UserDetail id="1" />
    </Suspense>,
  );

  expect(screen.getByText("Loading...")).toBeInTheDocument();
  expect(await screen.findByText("Alice")).toBeInTheDocument();
});
rrr
