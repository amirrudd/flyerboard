import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SetupStep } from "./SetupStep";
import { searchLocations } from "../../../lib/locationService";

// Same shape as the real service: searchLocations returns dataset rows,
// formatLocation turns one into the canonical string the filter matches on.
vi.mock("../../../lib/locationService", () => ({
  searchLocations: vi.fn(),
  fetchLocations: vi.fn(),
  formatLocation: (loc: { locality: string; state: string; postcode: string }) =>
    `${loc.locality}, ${loc.state} ${loc.postcode}`,
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
