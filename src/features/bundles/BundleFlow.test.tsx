import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BundleFlow } from "./BundleFlow";

// Descope session + user-sync gate — always ready in these tests.
vi.mock("@descope/react-sdk", () => ({
  useSession: () => ({ isAuthenticated: true, isSessionLoading: false }),
}));
vi.mock("../../context/UserSyncContext", () => ({
  useUserSync: () => ({ isUserSynced: true }),
}));

// Router navigate spy.
const mockNavigate = vi.fn();
vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
}));

// Toast.
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// ImageDisplay pulls in convex/lazy-load — stub it.
vi.mock("../../components/ui/ImageDisplay", () => ({
  ImageDisplay: ({ alt }: { alt: string }) => <img alt={alt} />,
}));

// framer-motion: render steps synchronously (no enter/exit animation timing in
// jsdom). AnimatePresence with mode="wait" otherwise keeps the previous step
// mounted until an exit transition that never completes here.
vi.mock("framer-motion", async () => {
  const React = await import("react");
  const passthrough = (tag: string) =>
    React.forwardRef(({ children, ...props }: any, ref: any) => {
      // Drop motion-only props so React doesn't warn.
      const { initial, animate, exit, transition, whileInView, viewport, whileTap, ...rest } = props;
      void initial; void animate; void exit; void transition; void whileInView; void viewport; void whileTap;
      return React.createElement(tag, { ref, ...rest }, children);
    });
  return {
    AnimatePresence: ({ children }: any) => React.createElement(React.Fragment, null, children),
    m: new Proxy({}, { get: (_t, tag: string) => passthrough(tag) }),
    useReducedMotion: () => true,
  };
});

// PageLoader — trivial stub.
vi.mock("../../components/PageLoader", () => ({
  PageLoader: () => <div>loading</div>,
}));

// bundleMaxItems app setting — missing row, so the component falls back to the
// static default (4). Mocked so the extra useQuery below stays single-purpose.
vi.mock("../../hooks/useAppSetting", () => ({
  useAppSetting: () => undefined,
}));

// Convex hooks. getEligibleAdsForBundle returns our fixture; createBundle is a spy.
const mockCreateBundle = vi.fn().mockResolvedValue("bundle-new");
const eligibleAds = [
  { _id: "ad1", title: "Sofa", price: 350, image: "r2:a.jpg", eligible: true, reason: null },
  { _id: "ad2", title: "Dining Table", price: 280, image: "r2:b.jpg", eligible: true, reason: null },
  { _id: "ad3", title: "Old Lamp", price: 40, image: null, eligible: false, reason: "In another bundle" },
];
vi.mock("convex/react", () => ({
  useQuery: () => eligibleAds,
  useMutation: () => mockCreateBundle,
}));

describe("BundleFlow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("gates Next until at least 2 items are selected (min-2)", () => {
    render(<BundleFlow />);
    // Next button disabled with nothing selected.
    const next = screen.getByRole("button", { name: /Select at least 2/i });
    expect(next).toBeDisabled();

    // Select one — still disabled.
    fireEvent.click(screen.getByRole("button", { name: "Sofa" }));
    expect(screen.getByRole("button", { name: /Select at least 2/i })).toBeDisabled();
  });

  it("greys out ineligible ads with their reason and blocks selection", () => {
    render(<BundleFlow />);
    const lamp = screen.getByRole("button", { name: "Old Lamp" });
    expect(lamp).toBeDisabled();
    expect(screen.getByText("In another bundle")).toBeInTheDocument();
  });

  it("shows live savings math on the price step and passes selection to createBundle", async () => {
    render(<BundleFlow />);

    // Select two eligible items (separately total = 630).
    fireEvent.click(screen.getByRole("button", { name: "Sofa" }));
    fireEvent.click(screen.getByRole("button", { name: "Dining Table" }));
    expect(screen.getByText("2 of 4 selected")).toBeInTheDocument();

    // Proceed to price step.
    fireEvent.click(screen.getByRole("button", { name: /Set a bundle price/i }));
    expect(screen.getByText("Set your bundle price")).toBeInTheDocument();
    // Separately total shown.
    expect(screen.getByText("$630")).toBeInTheDocument();

    // Enter a bundle price of 530 → save $100 (16%).
    const priceInput = screen.getByLabelText("Bundle price");
    fireEvent.change(priceInput, { target: { value: "530" } });
    expect(screen.getByText(/Buyers save \$100 \(16%\)/)).toBeInTheDocument();

    // Review → confirm.
    fireEvent.click(screen.getByRole("button", { name: /Review bundle/i }));
    expect(screen.getByText("Confirm your bundle")).toBeInTheDocument();

    // Create.
    fireEvent.click(screen.getByRole("button", { name: /Create bundle/i }));
    // Await the microtask so the mutation resolves.
    await Promise.resolve();

    expect(mockCreateBundle).toHaveBeenCalledTimes(1);
    expect(mockCreateBundle).toHaveBeenCalledWith({
      adIds: ["ad1", "ad2"],
      bundlePrice: 530,
      label: undefined,
    });
  });

  it("warns (no saving) when the bundle price is at or above the separate total", () => {
    render(<BundleFlow />);
    fireEvent.click(screen.getByRole("button", { name: "Sofa" }));
    fireEvent.click(screen.getByRole("button", { name: "Dining Table" }));
    fireEvent.click(screen.getByRole("button", { name: /Set a bundle price/i }));

    fireEvent.change(screen.getByLabelText("Bundle price"), { target: { value: "700" } });
    expect(screen.getByText(/buyers get no saving/i)).toBeInTheDocument();
  });

  // The app disables body scroll at <=768px (src/index.css), so the step content
  // — including the primary CTA — must live inside its own scroll container or it
  // becomes unreachable on narrow viewports. jsdom can't measure overflow, so this
  // guards the structure that makes scrolling possible rather than the scroll itself.
  it("keeps the primary CTA inside a dedicated scroll container (narrow-viewport reachability)", () => {
    const { container } = render(<BundleFlow />);

    const scroller = container.querySelector(".mobile-scroll-container");
    expect(scroller).not.toBeNull();

    // The step's primary button must be inside the scroller, not in a body-scroll region.
    const cta = screen.getByRole("button", { name: /Select at least 2/i });
    expect(scroller).toContainElement(cta);

    // Root must be a fixed-height flex column, not min-height document flow.
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain("h-[100dvh]");
    expect(root.className).toContain("flex-col");
  });
});
