import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LocationPicker } from "./LocationPicker";
import {
  searchLocations,
  fetchLocations,
  locationsUnavailable,
} from "../../lib/locationService";

// Mock only the dataset access; formatLocation stays real so the emitted
// string is byte-identical to what the location filter compares on.
vi.mock("../../lib/locationService", async () => ({
  ...(await vi.importActual<typeof import("../../lib/locationService")>(
    "../../lib/locationService"
  )),
  searchLocations: vi.fn(),
  fetchLocations: vi.fn(),
  locationsUnavailable: vi.fn(() => false),
}));

const RICHMOND = { id: 1, locality: "RICHMOND", state: "VIC", postcode: "3121", lat: 0, long: 0 };
const RICHLANDS = { id: 2, locality: "RICHLANDS", state: "QLD", postcode: "4077", lat: 0, long: 0 };

function setup(onChange = vi.fn()) {
  render(<LocationPicker value="" onChange={onChange} />);
  const input = screen.getByPlaceholderText("Enter suburb or postcode");
  return { input, onChange };
}

async function typeAndOpen(input: HTMLElement, text = "Rich") {
  fireEvent.change(input, { target: { value: text } });
  await waitFor(() => expect(screen.getByRole("listbox")).toBeInTheDocument());
}

describe("LocationPicker — combobox semantics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(searchLocations).mockResolvedValue([RICHMOND, RICHLANDS]);
    vi.mocked(fetchLocations).mockResolvedValue([RICHMOND, RICHLANDS]);
  });

  it("exposes a combobox whose aria-expanded/aria-controls track the listbox", async () => {
    const { input } = setup();
    expect(input).toHaveAttribute("role", "combobox");
    expect(input).toHaveAttribute("aria-expanded", "false");
    expect(input).toHaveAttribute("aria-autocomplete", "list");

    await typeAndOpen(input);
    expect(input).toHaveAttribute("aria-expanded", "true");
    expect(input.getAttribute("aria-controls")).toBe(screen.getByRole("listbox").id);
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(2);
    options.forEach((o) => expect(o).toHaveAttribute("aria-selected", "false"));
  });

  it("ArrowDown/ArrowUp move the active option and aria-activedescendant follows", async () => {
    const { input } = setup();
    await typeAndOpen(input);

    fireEvent.keyDown(input, { key: "ArrowDown" });
    let options = screen.getAllByRole("option");
    expect(options[0]).toHaveAttribute("aria-selected", "true");
    expect(input).toHaveAttribute("aria-activedescendant", options[0].id);

    fireEvent.keyDown(input, { key: "ArrowDown" });
    options = screen.getAllByRole("option");
    expect(options[1]).toHaveAttribute("aria-selected", "true");
    expect(input).toHaveAttribute("aria-activedescendant", options[1].id);

    fireEvent.keyDown(input, { key: "ArrowUp" });
    options = screen.getAllByRole("option");
    expect(options[0]).toHaveAttribute("aria-selected", "true");
  });

  it("Enter picks the active option and emits the canonical formatLocation() string", async () => {
    const { input, onChange } = setup();
    await typeAndOpen(input);

    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });

    // The whole dataset row travels with the string: suburb names are not unique
    // (726 duplicated locality+state pairs), so the caller needs the row id.
    expect(onChange).toHaveBeenCalledWith("RICHMOND, VIC 3121", RICHMOND);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("clearing the confirmed value passes no row", async () => {
    const onChange = vi.fn();
    render(<LocationPicker value="RICHMOND, VIC 3121" onChange={onChange} />);
    const input = screen.getByPlaceholderText("Enter suburb or postcode");
    fireEvent.change(input, { target: { value: "RICHMOND, VIC 312" } });
    expect(onChange).toHaveBeenCalledWith("");
  });

  it("Escape closes the listbox without picking", async () => {
    const { input, onChange } = setup();
    await typeAndOpen(input);

    fireEvent.keyDown(input, { key: "Escape" });
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(input).toHaveAttribute("aria-expanded", "false");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("suggestion touch targets are at least 44px tall", async () => {
    const { input } = setup();
    await typeAndOpen(input);
    for (const option of screen.getAllByRole("option")) {
      expect(option.className).toContain("min-h-[44px]");
    }
  });
});

describe("LocationPicker — offline fallback (dataset fetch failed)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(searchLocations).mockResolvedValue([]);
    vi.mocked(fetchLocations).mockResolvedValue([]);
    vi.mocked(locationsUnavailable).mockReturnValue(true);
  });

  it("commits the typed text as the value and shows the inline note", async () => {
    const { input, onChange } = setup();
    fireEvent.change(input, { target: { value: "Richmond" } });

    await waitFor(() =>
      expect(screen.getByText(/suggestions unavailable/i)).toBeInTheDocument()
    );
    // No second argument: there is no dataset row behind free text, so the
    // caller stores `locationSource: "unresolved"` and NO coordinates. A guessed
    // coordinate here would be indistinguishable from a real one forever after.
    expect(onChange).toHaveBeenCalledWith("Richmond");
    expect(vi.mocked(onChange).mock.calls[0][1]).toBeUndefined();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("shows no note while the dataset is available (no match is not a failure)", async () => {
    vi.mocked(locationsUnavailable).mockReturnValue(false);
    const { input, onChange } = setup();
    fireEvent.change(input, { target: { value: "Xyzzy" } });

    await waitFor(() => expect(searchLocations).toHaveBeenCalled());
    await waitFor(() =>
      expect(screen.queryByText(/suggestions unavailable/i)).not.toBeInTheDocument()
    );
    expect(onChange).not.toHaveBeenCalled();
  });
});
