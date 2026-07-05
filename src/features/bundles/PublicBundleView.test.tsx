import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PublicBundleView, type PublicBundleData } from "./PublicBundleView";

// Presentational test — mock everything with external dependencies so no real
// Convex client / Descope session / motion runtime is needed.
vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => undefined),
  useMutation: vi.fn(() => vi.fn()),
}));

vi.mock("@descope/react-sdk", () => ({
  useSession: () => ({ isAuthenticated: false, isSessionLoading: false }),
}));

vi.mock("framer-motion", async () => {
  const React = await import("react");
  const passthrough = (tag: string) =>
    React.forwardRef(({ children, ...props }: any, ref: any) => {
      const { initial, animate, exit, transition, whileInView, viewport, whileTap, ...rest } = props;
      void initial; void animate; void exit; void transition; void whileInView; void viewport; void whileTap;
      return React.createElement(tag, { ref, ...rest }, children);
    });
  return {
    AnimatePresence: ({ children }: any) => React.createElement(React.Fragment, null, children),
    motion: new Proxy({}, { get: (_t, tag: string) => passthrough(tag) }),
    useReducedMotion: () => true,
    useAnimation: () => ({ start: vi.fn() }),
  };
});

vi.mock("../../components/ui/ImageDisplay", () => ({
  ImageDisplay: ({ alt }: { alt: string }) => <img alt={alt} src="mock-image.jpg" />,
}));

const activeBundle: PublicBundleData = {
  _id: "bundle-1",
  label: "Living room set",
  status: "active",
  bundlePrice: 530,
  separatelyTotal: 630,
  savings: 100,
  savingsPct: 16,
  location: "Coogee, NSW",
  isOwner: false,
  seller: { _id: "user-1", name: "Sarah M.", image: null, isVerified: true },
  items: [
    { adId: "ad-1", title: "Sofa", image: "r2:x/1.jpg", price: 350, isSold: false },
    { adId: "ad-2", title: "Table", image: "r2:x/2.jpg", price: 280, isSold: false },
  ],
};

function renderView(bundle: PublicBundleData, overrides: Partial<Parameters<typeof PublicBundleView>[0]> = {}) {
  const onMessageSeller = vi.fn();
  const onItemClick = vi.fn();
  const onManage = vi.fn();
  const onShare = vi.fn();
  render(
    <PublicBundleView
      bundle={bundle}
      onMessageSeller={onMessageSeller}
      onItemClick={onItemClick}
      onManage={onManage}
      onShare={onShare}
      {...overrides}
    />
  );
  return { onMessageSeller, onItemClick, onManage, onShare };
}

describe("PublicBundleView — active (the Deal Ticket)", () => {
  it("renders the offer math: line items, separately total, bundle price, save stamp", () => {
    renderView(activeBundle);
    expect(screen.getByText("Living room set")).toBeInTheDocument();
    // Line items with individual prices (also in the image strip captions).
    expect(screen.getAllByText(/Sofa/).length).toBeGreaterThan(0);
    expect(screen.getByText("Separately")).toBeInTheDocument();
    expect(screen.getAllByText(/\$630/).length).toBeGreaterThan(0);
    expect(screen.getByText("Bundle price")).toBeInTheDocument();
    expect(screen.getAllByText(/\$530/).length).toBeGreaterThan(0);
    expect(screen.getByLabelText(/Save \$100 \(16% off\)/)).toBeInTheDocument();
  });

  it("CTA messages the seller by first name", () => {
    const { onMessageSeller } = renderView(activeBundle);
    const cta = screen.getByRole("button", { name: /take the deal — message Sarah/i });
    fireEvent.click(cta);
    expect(onMessageSeller).toHaveBeenCalledOnce();
  });

  it("image strip taps through to the member ad", () => {
    const { onItemClick } = renderView(activeBundle);
    fireEvent.click(screen.getByTitle("Table"));
    expect(onItemClick).toHaveBeenCalledWith("ad-2");
  });
});

describe("PublicBundleView — partial", () => {
  const partialBundle: PublicBundleData = {
    ...activeBundle,
    status: "partial",
    items: [
      activeBundle.items[0],
      { ...activeBundle.items[1], isSold: true },
    ],
  };

  it("shows the no-longer-available notice naming the sold item", () => {
    renderView(partialBundle);
    expect(screen.getByText(/no longer available/i)).toBeInTheDocument();
    expect(screen.getByText("Sold")).toBeInTheDocument();
  });

  it("offers buy links for the remaining items instead of the deal block", () => {
    const { onItemClick } = renderView(partialBundle);
    expect(screen.queryByText("Bundle price")).not.toBeInTheDocument();
    const buyLink = screen.getByRole("button", { name: /buy Sofa for \$350/i });
    fireEvent.click(buyLink);
    expect(onItemClick).toHaveBeenCalledWith("ad-1");
  });
});

describe("PublicBundleView — sold and owner states", () => {
  it("sold bundle shows a sold notice and no message CTA", () => {
    renderView({ ...activeBundle, status: "sold" });
    expect(screen.getAllByText(/has been sold/i).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /message/i })).not.toBeInTheDocument();
  });

  it("owner sees the manage CTA instead of messaging themselves", () => {
    const { onManage, onMessageSeller } = renderView({ ...activeBundle, isOwner: true });
    const manage = screen.getByRole("button", { name: /your bundle — manage/i });
    fireEvent.click(manage);
    expect(onManage).toHaveBeenCalledOnce();
    expect(onMessageSeller).not.toHaveBeenCalled();
  });
});
