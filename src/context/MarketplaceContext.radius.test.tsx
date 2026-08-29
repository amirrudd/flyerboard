import { describe, expect, test, beforeEach, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import Cookies from "js-cookie";
import { DEFAULT_NEAR_RADIUS_KM } from "../../convex/lib/appConfig";

// The provider only needs to MOUNT for this — the data hooks are stubbed so the
// test is about the stored preference, not about fetching a feed. `capture`
// records the args the feed query was called with, which is how the "only a
// real pick is sent up" half is asserted.
const capture: { radiusKm?: number }[] = [];
/** The args the feed query was last called with. */
const lastArgs = () => capture[capture.length - 1];
vi.mock("convex/react", () => ({
    useQuery: () => undefined,
    useConvex: () => ({ query: vi.fn() }),
}));
vi.mock("convex-helpers/react", () => ({
    usePaginatedQuery: (_fn: unknown, args: unknown) => {
        if (args !== "skip") capture.push(args as { radiusKm?: number });
        return { results: [], status: "Exhausted", loadMore: vi.fn() };
    },
}));
vi.mock("../hooks/useDeviceInfo", () => ({ useDeviceInfo: () => ({ isMobile: false }) }));

const { MarketplaceProvider, useMarketplace } = await import("./MarketplaceContext");

function RadiusProbe() {
    const { selectedRadiusKm, setSelectedRadiusKm } = useMarketplace();
    return (
        <button data-testid="radius" onClick={() => setSelectedRadiusKm(50)}>
            {selectedRadiusKm}
        </button>
    );
}

const mount = () =>
    render(
        <MarketplaceProvider>
            <RadiusProbe />
        </MarketplaceProvider>
    );

describe("the saved distance preference", () => {
    beforeEach(() => {
        Cookies.remove("selectedRadiusKm");
        capture.length = 0;
    });

    test("a chosen distance survives a remount", () => {
        const first = mount();
        act(() => screen.getByTestId("radius").click());
        expect(screen.getByTestId("radius")).toHaveTextContent("50");
        first.unmount();

        // A new session: the provider re-reads the cookie from scratch.
        mount();
        expect(screen.getByTestId("radius")).toHaveTextContent("50");
        expect(lastArgs()?.radiusKm).toBe(50);
    });

    test("never chosen: the default shows, and nothing is sent up", () => {
        mount();
        // A blank or NaN here would be the bug — a buyer with a saved suburb but
        // no saved distance must still see a real number.
        expect(screen.getByTestId("radius")).toHaveTextContent(String(DEFAULT_NEAR_RADIUS_KM));
        // Left off the query on purpose, so the server falls back to the
        // admin-tuned appSettings value rather than to this label.
        expect(lastArgs()?.radiusKm).toBeUndefined();
    });

    test("a junk cookie falls back to the default rather than NaN", () => {
        Cookies.set("selectedRadiusKm", "not-a-number");
        mount();
        expect(screen.getByTestId("radius")).toHaveTextContent(String(DEFAULT_NEAR_RADIUS_KM));
        expect(lastArgs()?.radiusKm).toBeUndefined();
    });
});
