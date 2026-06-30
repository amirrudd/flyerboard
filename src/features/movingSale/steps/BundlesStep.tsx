import { useMemo, useState } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { Plus, X, Sparkle, CircleNotch, Stack } from "@phosphor-icons/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { ImageDisplay } from "../../../components/ui/ImageDisplay";
import { formatAUD } from "../saleHelpers";
import type { SaleItem } from "../types";

interface BundlesStepProps {
  saleEventId: Id<"saleEvents">;
  items: SaleItem[];
  categories: { _id: Id<"categories">; name: string }[];
  onComplete: () => void;
  onBack: () => void;
}

interface BundleDraft {
  localId: string;
  label: string;
  adIds: Id<"ads">[];
  price: number;
}

function roundTo5(n: number): number {
  return Math.max(5, Math.round(n / 5) * 5);
}

let localCounter = 0;
function nextLocalId(): string {
  localCounter += 1;
  return `b${localCounter}`;
}

export function BundlesStep({
  saleEventId,
  items,
  categories,
  onComplete,
  onBack,
}: BundlesStepProps) {
  const setBundles = useMutation(api.saleEvents.setBundles);
  const [bundles, setBundlesState] = useState<BundleDraft[]>([]);
  const [building, setBuilding] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const itemById = useMemo(() => {
    const map = new Map<string, SaleItem>();
    for (const i of items) map.set(i._id, i);
    return map;
  }, [items]);

  const usedIds = useMemo(() => {
    const set = new Set<string>();
    for (const b of bundles) for (const id of b.adIds) set.add(id);
    return set;
  }, [bundles]);

  // Suggestions: categories with 2+ not-yet-bundled items.
  const suggestions = useMemo<BundleDraft[]>(() => {
    const byCategory = new Map<string, SaleItem[]>();
    for (const item of items) {
      if (usedIds.has(item._id)) continue;
      const list = byCategory.get(item.categoryId) ?? [];
      list.push(item);
      byCategory.set(item.categoryId, list);
    }
    const out: BundleDraft[] = [];
    for (const [categoryId, group] of byCategory) {
      if (group.length < 2) continue;
      const sum = group.reduce((s, i) => s + (i.price ?? 0), 0);
      const name = categories.find((c) => c._id === categoryId)?.name ?? "Bundle";
      out.push({
        localId: `sugg-${categoryId}`,
        label: `${name} bundle`,
        adIds: group.map((i) => i._id),
        price: roundTo5(sum * 0.85) || 5,
      });
    }
    return out;
  }, [items, usedIds, categories]);

  function priceSum(adIds: Id<"ads">[]): number {
    return adIds.reduce((s, id) => s + (itemById.get(id)?.price ?? 0), 0);
  }

  function addBundle(draft: BundleDraft) {
    setBundlesState((prev) => [...prev, { ...draft, localId: nextLocalId() }]);
  }

  function removeBundle(localId: string) {
    setBundlesState((prev) => prev.filter((b) => b.localId !== localId));
  }

  function setBundlePrice(localId: string, price: number) {
    setBundlesState((prev) =>
      prev.map((b) => (b.localId === localId ? { ...b, price: Math.max(0, price) } : b))
    );
  }

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function commitCustomBundle() {
    const adIds = Array.from(selected) as Id<"ads">[];
    if (adIds.length < 2) {
      toast.error("Pick at least two items for a bundle.");
      return;
    }
    addBundle({
      localId: nextLocalId(),
      label: "Bundle",
      adIds,
      price: roundTo5(priceSum(adIds) * 0.85),
    });
    setSelected(new Set());
    setBuilding(false);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await setBundles({
        saleEventId,
        bundles: bundles.map((b) => ({
          label: b.label,
          bundlePrice: b.price,
          adIds: b.adIds,
        })),
      });
      onComplete();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save bundles.");
      setSaving(false);
    }
  }

  const availableForBuilder = items.filter((i) => !usedIds.has(i._id));

  return (
    <div className="mx-auto w-full max-w-md px-4 py-6">
      <div className="flex items-center gap-2">
        <Stack size={24} weight="fill" className="text-primary" />
        <h2 className="font-display text-2xl font-semibold text-foreground">Bundles</h2>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Group items so buyers take more in one trip. Bundles go live on your sale page
        once you publish.
      </p>

      {/* Suggested bundles */}
      {suggestions.length > 0 && (
        <div className="mt-6">
          <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <Sparkle size={16} weight="fill" className="text-primary" /> Suggested for you
          </p>
          <div className="space-y-2">
            {suggestions.map((s) => {
              const sum = priceSum(s.adIds);
              return (
                <div
                  key={s.localId}
                  className="flex items-center gap-3 rounded-2xl border border-dashed border-border bg-card p-3"
                >
                  <BundleThumbs adIds={s.adIds} itemById={itemById} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {s.label}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {s.adIds.length} items · {formatAUD(sum)} →{" "}
                      <span className="font-semibold text-foreground">
                        {formatAUD(s.price)}
                      </span>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => addBundle(s)}
                    className="rounded-lg bg-primary/10 px-3 py-2 text-sm font-semibold text-primary active:scale-95"
                  >
                    Add
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Accepted bundles */}
      {bundles.length > 0 && (
        <div className="mt-6">
          <p className="mb-2 text-sm font-semibold text-foreground">Your bundles</p>
          <div className="space-y-2">
            {bundles.map((b) => {
              const sum = priceSum(b.adIds);
              const saving = sum - b.price;
              return (
                <div
                  key={b.localId}
                  className="rounded-2xl border border-border bg-card p-3"
                >
                  <div className="flex items-center gap-3">
                    <BundleThumbs adIds={b.adIds} itemById={itemById} />
                    <input
                      value={b.label}
                      onChange={(e) =>
                        setBundlesState((prev) =>
                          prev.map((x) =>
                            x.localId === b.localId ? { ...x, label: e.target.value } : x
                          )
                        )
                      }
                      className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-1 py-1 text-sm font-semibold text-foreground focus:border-border focus:bg-card focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => removeBundle(b.localId)}
                      aria-label="Remove bundle"
                      className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
                    >
                      <X size={16} />
                    </button>
                  </div>
                  <div className="mt-2 flex items-center justify-between pl-1">
                    <span className="text-xs text-muted-foreground line-through">
                      {formatAUD(sum)}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">$</span>
                      <input
                        type="number"
                        min={0}
                        value={b.price}
                        onChange={(e) => setBundlePrice(b.localId, Number(e.target.value))}
                        className="w-20 rounded-lg border border-border bg-card px-2 py-1.5 text-right font-semibold text-foreground focus:border-primary focus:outline-none"
                      />
                      {saving > 0 && (
                        <span className="text-xs font-semibold text-emerald-600">
                          save {formatAUD(saving)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Custom builder */}
      {building ? (
        <div className="mt-6 rounded-2xl border border-border bg-card p-3">
          <p className="mb-2 text-sm font-semibold text-foreground">Pick items to bundle</p>
          {availableForBuilder.length < 2 ? (
            <p className="py-3 text-center text-sm text-muted-foreground">
              Not enough free items left to make another bundle.
            </p>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              {availableForBuilder.map((item) => {
                const on = selected.has(item._id);
                return (
                  <button
                    type="button"
                    key={item._id}
                    onClick={() => toggleSelected(item._id)}
                    className={`relative aspect-square overflow-hidden rounded-lg border-2 ${
                      on ? "border-primary" : "border-transparent"
                    }`}
                  >
                    <ImageDisplay
                      imageRef={item.images[0]}
                      alt={item.title}
                      className="h-full w-full object-cover"
                    />
                    {on && (
                      <span className="absolute inset-0 flex items-center justify-center bg-primary/30" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => {
                setBuilding(false);
                setSelected(new Set());
              }}
              className="flex-1 rounded-xl border border-border bg-card px-3 py-2.5 text-sm font-medium text-foreground"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={commitCustomBundle}
              className="flex-1 rounded-xl bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground"
            >
              Add bundle ({selected.size})
            </button>
          </div>
        </div>
      ) : (
        availableForBuilder.length >= 2 && (
          <button
            type="button"
            onClick={() => setBuilding(true)}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border px-4 py-3 text-sm font-medium text-muted-foreground transition hover:border-primary/50 hover:text-primary"
          >
            <Plus size={18} /> Create your own bundle
          </button>
        )
      )}

      {/* Footer */}
      <div className="mt-8 flex gap-2">
        <button
          type="button"
          onClick={onBack}
          className="rounded-xl border border-border bg-card px-4 py-3.5 text-sm font-medium text-foreground"
        >
          Back
        </button>
        <button
          type="button"
          onClick={() => { void handleSave(); }}
          disabled={saving}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3.5 font-semibold text-primary-foreground active:scale-[0.99] disabled:opacity-60"
        >
          {saving && <CircleNotch size={18} className="animate-spin" />}
          {bundles.length > 0 ? "Save bundles & continue" : "Skip bundles & continue"}
        </button>
      </div>
    </div>
  );
}

function BundleThumbs({
  adIds,
  itemById,
}: {
  adIds: Id<"ads">[];
  itemById: Map<string, SaleItem>;
}) {
  return (
    <div className="flex -space-x-3">
      {adIds.slice(0, 3).map((id) => {
        const item = itemById.get(id);
        if (!item) return null;
        return (
          <div
            key={id}
            className="h-11 w-11 overflow-hidden rounded-lg border-2 border-card bg-muted"
          >
            <ImageDisplay
              imageRef={item.images[0]}
              alt={item.title}
              className="h-full w-full object-cover"
            />
          </div>
        );
      })}
    </div>
  );
}
