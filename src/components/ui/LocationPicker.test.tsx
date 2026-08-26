import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LocationPicker } from "./LocationPicker";
import { searchLocations, fetchLocations } from "../../lib/locationService";

// Mock only the dataset access; formatLocation stays real so the emitted
// string is byte-identical to what the location filter compares on.
vi.mock("../../lib/locationService", async () => ({
  ...(await vi.importActual<typeof import("../../lib/locationService")>(
    "../../lib/locationService"
  )),
  searchLocations: vi.fn(),
  fetchLocations: vi.fn(),
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

    expect(onChange).toHaveBeenCalledWith("RICHMOND, VIC 3121");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
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
    // fetchLocations swallows its own failure and resolves [] — the dataset is
    // never legitimately empty, so [] is the failure signal.
    vi.mocked(searchLocations).mockResolvedValue([]);
    vi.mocked(fetchLocations).mockResolvedValue([]);
  });

  it("commits the typed text as the value and shows the inline note", async () => {
    const { input, onChange } = setup();
    fireEvent.change(input, { target: { value: "Richmond" } });

    await waitFor(() =>
      expect(screen.getByText(/suggestions unavailable/i)).toBeInTheDocument()
    );
    expect(onChange).toHaveBeenCalledWith("Richmond");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("shows no note while the dataset is available (no match is not a failure)", async () => {
    vi.mocked(fetchLocations).mockResolvedValue([RICHMOND]);
    const { input, onChange } = setup();
    fireEvent.change(input, { target: { value: "Xyzzy" } });

    await waitFor(() => expect(searchLocations).toHaveBeenCalled());
    await waitFor(() =>
      expect(screen.queryByText(/suggestions unavailable/i)).not.toBeInTheDocument()
    );
    expect(onChange).not.toHaveBeenCalled();
  });
});
