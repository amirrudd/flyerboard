import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BundleManageModal } from "./BundleManageModal";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("../../components/ui/ImageDisplay", () => ({
  ImageDisplay: ({ alt }: { alt: string }) => <img alt={alt} />,
}));

// Identify each mutation by a stable string reference on the mocked api object.
vi.mock("../../../convex/_generated/api", () => ({
  api: {
    bundles: {
      getBundle: "getBundle",
      updateBundlePrice: "updateBundlePrice",
      removeBundleItem: "removeBundleItem",
      cancelBundle: "cancelBundle",
      markBundleSold: "markBundleSold",
    },
  },
}));

const bundle = {
  _id: "bundle-1",
  label: "Living room set",
  status: "active" as const,
  bundlePrice: 530,
  separatelyTotal: 630,
  savings: 100,
  items: [
    { adId: "ad1", title: "Sofa", image: "r2:a.jpg", price: 350, isSold: false },
    { adId: "ad2", title: "Dining Table", image: null, price: 280, isSold: false },
  ],
};

const spies: Record<string, ReturnType<typeof vi.fn>> = {
  updateBundlePrice: vi.fn(),
  removeBundleItem: vi.fn(),
  cancelBundle: vi.fn().mockResolvedValue("bundle-1"),
  markBundleSold: vi.fn(),
};

vi.mock("convex/react", () => ({
  useQuery: () => bundle,
  useMutation: (ref: string) => spies[ref] ?? vi.fn(),
}));

describe("BundleManageModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the label and both item titles", () => {
    render(<BundleManageModal bundleId="bundle-1" onClose={vi.fn()} />);
    expect(screen.getByText("Living room set")).toBeInTheDocument();
    expect(screen.getByText("Sofa")).toBeInTheDocument();
    expect(screen.getByText("Dining Table")).toBeInTheDocument();
  });

  it("cancels the bundle after confirmation", async () => {
    const onClose = vi.fn();
    render(<BundleManageModal bundleId="bundle-1" onClose={onClose} />);

    // First click reveals the destructive confirm prompt.
    fireEvent.click(screen.getByRole("button", { name: "Cancel bundle" }));
    // The confirm button (inside the revealed block) is the last matching one.
    const confirmBtn = screen.getAllByRole("button", { name: "Cancel bundle" }).pop()!;
    fireEvent.click(confirmBtn);

    await Promise.resolve();
    expect(spies.cancelBundle).toHaveBeenCalledWith({ bundleId: "bundle-1" });
  });
});
