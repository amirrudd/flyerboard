import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SetupStep } from "./SetupStep";
import { searchLocations } from "../../../lib/locationService";

// Mock ONLY the dataset fetch. `formatLocation` and `isCanonicalLocation` are
// the real implementations on purpose: the whole point of this change is that a
// sale's suburb is byte-identical to an ad's `location`. A hand-written copy of
// formatLocation here would keep these tests green while the real one drifted
// and every Moving Sale went invisible to the location filter again.
vi.mock("../../../lib/locationService", async () => ({
  ...(await vi.importActual<typeof import("../../../lib/locationService")>(
    "../../../lib/locationService"
  )),
  searchLocations: vi.fn(),
  fetchLocations: vi.fn(),
}));

const RICHMOND = { id: 1, locality: "RICHMOND", state: "VIC", postcode: "3121", lat: 0, long: 0 };

describe("SetupStep — the sale's suburb is a canonical location (rule 4)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(searchLocations).mockResolvedValue([RICHMOND]);
  });

  it("submits the picker's formatLocation() string, not what was typed", async () => {
    const onSubmit = vi.fn();
    render(
      <SetupStep defaultFirstName="Amir" submitting={false} onSubmit={onSubmit} />
    );

    const input = screen.getByPlaceholderText("Enter suburb or postcode");
    fireEvent.change(input, { target: { value: "Rich" } });
    fireEvent.focus(input);
    await waitFor(() => expect(screen.getByText("RICHMOND")).toBeInTheDocument());
    fireEvent.click(screen.getByText("RICHMOND"));

    fireEvent.click(screen.getByText("Continue to photos"));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    // "Richmond, VIC" typed free-hand would never equal an ad's location string,
    // which is what made every Moving Sale invisible to the location filter.
    expect(onSubmit.mock.calls[0][0].suburb).toBe("RICHMOND, VIC 3121");
  });

  it("refuses free text that was never picked from the list", async () => {
    const onSubmit = vi.fn();
    render(
      <SetupStep defaultFirstName="Amir" submitting={false} onSubmit={onSubmit} />
    );

    fireEvent.change(screen.getByPlaceholderText("Enter suburb or postcode"), {
      target: { value: "Richmond, VIC" },
    });
    fireEvent.click(screen.getByText("Continue to photos"));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/pick the suburb from the list/i)).toBeInTheDocument();
  });
});

describe("resuming a draft saved before the picker existed", () => {
    // The bug: a legacy free-text suburb was seeded as a CONFIRMED value, so the
    // picker short-circuited (query === value), the field looked valid, and the
    // seller republished a sale that still matched no location filter — the exact
    // failure this whole change exists to close.
    it("does not accept a legacy free-text suburb as an already-made pick", async () => {
        const onSubmit = vi.fn();
        render(
            <SetupStep
                defaultFirstName="Sarah"
                initial={{ title: "Sarah's Moving Sale", suburb: "Richmond, VIC" }}
                submitting={false}
                onSubmit={onSubmit}
            />
        );

        // The old text is shown so the seller knows what to replace...
        expect(screen.getByDisplayValue("Richmond, VIC")).toBeInTheDocument();

        // ...but it is not a confirmed choice, so submitting is refused.
        fireEvent.click(screen.getByRole("button", { name: /continue/i }));
        expect(onSubmit).not.toHaveBeenCalled();
        expect(screen.getByText(/pick the suburb from the list/i)).toBeInTheDocument();
    });

    it("accepts a canonical suburb from an existing sale without re-picking", () => {
        const onSubmit = vi.fn();
        render(
            <SetupStep
                defaultFirstName="Sarah"
                initial={{ title: "Sarah's Moving Sale", suburb: "RICHMOND, VIC 3121" }}
                submitting={false}
                onSubmit={onSubmit}
            />
        );

        fireEvent.click(screen.getByRole("button", { name: /continue/i }));
        expect(onSubmit).toHaveBeenCalledWith(
            expect.objectContaining({ suburb: "RICHMOND, VIC 3121" })
        );
    });
});
