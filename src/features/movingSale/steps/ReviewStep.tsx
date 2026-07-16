import { useMemo, useState } from "react";
import { useMutation } from "convex/react";
import { AnimatePresence, m } from "framer-motion";
import {
  Check,
  Clock,
  PencilSimple,
  Minus,
  Plus,
  Trash,
  CircleNotch,
} from "@phosphor-icons/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { ImageDisplay } from "../../../components/ui/ImageDisplay";
import { BottomSheet } from "../../../components/ui/BottomSheet";
import { CONFIDENCE_META, formatAUD, isPlaceholderTitle, itemConfidence } from "../saleHelpers";
import type { SaleItem } from "../types";

const CONDITIONS = ["New", "Like new", "Good", "Fair", "For parts"];
const PRICE_STEP = 5;

interface ReviewStepProps {
  items: SaleItem[];
  categories: { _id: Id<"categories">; name: string }[];
  onComplete: () => void;
}

export function ReviewStep({ items, categories, onComplete }: ReviewStepProps) {
  const updateSaleItem = useMutation(api.saleEvents.updateSaleItem);
  const removeSaleItem = useMutation(api.saleEvents.removeSaleItem);

  // Decisions keyed by adId; absence = still pending. Deriving the active item
  // from `items` + decisions (rather than syncing an `order` array in an effect)
  // keeps this effect-free and naturally handles item removals.
  const [decided, setDecided] = useState<Record<string, "approved" | "skipped">>({});
  const [drafts, setDrafts] = useState<Record<string, Partial<SaleItem>>>({});
  const [editing, setEditing] = useState<Id<"ads"> | null>(null);

  const itemById = useMemo(() => {
    const map = new Map<string, SaleItem>();
    for (const item of items) map.set(item._id, item);
    return map;
  }, [items]);

  /** Merge live item with any unsaved local draft. */
  function view(id: Id<"ads">): SaleItem | undefined {
    const base = itemById.get(id);
    if (!base) return undefined;
    return { ...base, ...drafts[id] };
  }

  // Pending items first; once those are gone, revisit skipped ones for a 2nd pass.
  const activeId =
    items.find((i) => !decided[i._id])?._id ??
    items.find((i) => decided[i._id] === "skipped")?._id ??
    null;
  const approvedCount = items.filter((i) => decided[i._id] === "approved").length;
  const allApproved = items.length > 0 && approvedCount === items.length;

  async function persist(id: Id<"ads">) {
    const draft = drafts[id];
    if (!draft) return;
    await updateSaleItem({
      adId: id,
      ...(draft.title !== undefined ? { title: draft.title } : {}),
      ...(draft.price !== undefined ? { price: draft.price } : {}),
      ...(draft.condition !== undefined ? { condition: draft.condition } : {}),
      ...(draft.categoryId !== undefined ? { categoryId: draft.categoryId } : {}),
    });
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  async function approve(id: Id<"ads">) {
    await persist(id);
    setDecided((prev) => ({ ...prev, [id]: "approved" }));
  }

  function skip(id: Id<"ads">) {
    setDecided((prev) => ({ ...prev, [id]: "skipped" }));
  }

  function bumpPrice(id: Id<"ads">, delta: number) {
    const current = view(id)?.price ?? 0;
    const next = Math.max(0, current + delta);
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], price: next } }));
  }

  if (allApproved) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col items-center px-4 py-16 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
          <Check size={32} weight="bold" />
        </div>
        <h2 className="mt-4 font-display text-2xl font-semibold text-foreground">
          All {items.length} items reviewed
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Nice work. Next we'll suggest a few bundles to help things move faster.
        </p>
        <button
          type="button"
          onClick={onComplete}
          className="mt-6 w-full rounded-xl bg-primary px-4 py-3.5 font-semibold text-primary-foreground transition active:scale-[0.99]"
        >
          Continue to bundles
        </button>
      </div>
    );
  }

  const active = activeId ? view(activeId) : undefined;
  const editingItem = editing ? view(editing) : undefined;

  return (
    <div className="mx-auto w-full max-w-md px-4 py-6">
      {/* Progress chips */}
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="font-medium text-foreground">
          {approvedCount} of {items.length} done
        </span>
      </div>
      <div className="mb-5 flex flex-wrap gap-1.5">
        {items.map((item) => {
          const id = item._id;
          const status = decided[id];
          const isActive = id === activeId;
          const color =
            status === "approved"
              ? "bg-emerald-500"
              : status === "skipped"
                ? "bg-amber-400"
                : isActive
                  ? "bg-primary"
                  : "bg-muted";
          return (
            <span
              key={id}
              className={`h-2.5 w-2.5 rounded-sm ${color} ${isActive ? "ring-2 ring-primary/30" : ""}`}
            />
          );
        })}
      </div>

      {/* Active card */}
      <AnimatePresence mode="wait">
        {active && activeId && (
          <m.div
            key={activeId}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden rounded-2xl border border-border bg-card"
          >
            <div className="relative aspect-[4/3] bg-muted">
              <ImageDisplay
                imageRef={active.images[0]}
                alt={active.title}
                backdrop
                className="h-full w-full object-cover"
                size="card"
              />
              <ConfidenceBadge item={active} />
              {decided[activeId] === "skipped" && (
                <span className="absolute right-3 top-3 rounded-full bg-amber-400 px-2 py-0.5 text-xs font-semibold text-neutral-900">
                  Back for a 2nd look
                </span>
              )}
            </div>

            <div className="p-4">
              <p className="font-display text-lg font-semibold text-foreground">
                {isPlaceholderTitle(active.title) ? (
                  <span className="text-muted-foreground">Add a title</span>
                ) : (
                  active.title
                )}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {categories.find((c) => c._id === active.categoryId)?.name ?? "Uncategorised"}
                {active.condition ? ` · ${active.condition}` : ""}
              </p>

              {/* Inline price stepper — the only inline field */}
              <div className="mt-4 flex items-center justify-between rounded-xl bg-muted/60 p-2">
                <span className="pl-2 text-sm font-medium text-muted-foreground">Price</span>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    aria-label="Lower price"
                    onClick={() => bumpPrice(activeId, -PRICE_STEP)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-foreground active:scale-95"
                  >
                    <Minus size={16} weight="bold" />
                  </button>
                  <span className="min-w-[4.5rem] text-center font-display text-xl font-semibold text-foreground">
                    {formatAUD(active.price ?? 0)}
                  </span>
                  <button
                    type="button"
                    aria-label="Raise price"
                    onClick={() => bumpPrice(activeId, PRICE_STEP)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-foreground active:scale-95"
                  >
                    <Plus size={16} weight="bold" />
                  </button>
                </div>
              </div>
            </div>

            {/* Thumb-zone actions: Later (left) · Edit (centre) · Looks good (right) */}
            <div className="grid grid-cols-[auto_auto_1fr] gap-2 border-t border-border p-3">
              <button
                type="button"
                onClick={() => skip(activeId)}
                className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-3 text-sm font-medium text-muted-foreground active:scale-[0.98]"
              >
                <Clock size={18} /> Later
              </button>
              <button
                type="button"
                onClick={() => setEditing(activeId)}
                className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-3 text-sm font-medium text-foreground active:scale-[0.98]"
              >
                <PencilSimple size={18} /> Edit
              </button>
              <button
                type="button"
                onClick={() => void approve(activeId)}
                className="flex items-center justify-center gap-1.5 rounded-xl bg-primary px-3 py-3 text-sm font-semibold text-primary-foreground active:scale-[0.98]"
              >
                <Check size={18} weight="bold" /> Looks good
              </button>
            </div>
          </m.div>
        )}
      </AnimatePresence>

      {/* Edit bottom sheet — card stays visible behind it */}
      <BottomSheet
        isOpen={editing !== null}
        onClose={() => setEditing(null)}
        title="Edit item"
        showOnDesktop
      >
        {editing && editingItem && (
          <EditItemForm
            key={editing}
            item={editingItem}
            categories={categories}
            onChange={(patch) =>
              setDrafts((prev) => ({ ...prev, [editing]: { ...prev[editing], ...patch } }))
            }
            onSave={async () => {
              await persist(editing);
              setEditing(null);
            }}
            onDelete={async () => {
              await removeSaleItem({ adId: editing });
              setEditing(null);
            }}
          />
        )}
      </BottomSheet>
    </div>
  );
}

function ConfidenceBadge({ item }: { item: SaleItem }) {
  const meta = CONFIDENCE_META[itemConfidence(item)];
  return (
    <span
      className={`absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-card/95 px-2.5 py-1 text-xs font-semibold shadow-sm ring-1 ${meta.ring} ${meta.text}`}
    >
      <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  );
}

function EditItemForm({
  item,
  categories,
  onChange,
  onSave,
  onDelete,
}: {
  item: SaleItem;
  categories: { _id: Id<"categories">; name: string }[];
  onChange: (patch: Partial<SaleItem>) => void;
  onSave: () => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const inputClass =
    "w-full rounded-xl border border-border bg-card px-3.5 py-3 text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

  return (
    <div className="space-y-4 px-4 pt-2">
      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">Title</label>
        <input
          className={inputClass}
          value={isPlaceholderTitle(item.title) ? "" : item.title}
          placeholder="e.g. Standing desk"
          onChange={(e) => onChange({ title: e.target.value })}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">Price</label>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            className={inputClass}
            value={item.price ?? ""}
            placeholder="0"
            onChange={(e) =>
              onChange({ price: e.target.value === "" ? undefined : Number(e.target.value) })
            }
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">Condition</label>
          <select
            className={inputClass}
            value={item.condition ?? ""}
            onChange={(e) => onChange({ condition: e.target.value || undefined })}
          >
            <option value="">—</option>
            {CONDITIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">Category</label>
        <select
          className={inputClass}
          value={item.categoryId}
          onChange={(e) => onChange({ categoryId: e.target.value as Id<"categories"> })}
        >
          {categories.map((c) => (
            <option key={c._id} value={c._id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <button
        type="button"
        disabled={saving}
        onClick={() => {
          void (async () => {
            setSaving(true);
            try {
              await onSave();
            } finally {
              setSaving(false);
            }
          })();
        }}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3.5 font-semibold text-primary-foreground active:scale-[0.99] disabled:opacity-60"
      >
        {saving && <CircleNotch size={18} className="animate-spin" />}
        Save
      </button>
      <button
        type="button"
        disabled={deleting}
        onClick={() => {
          void (async () => {
            setDeleting(true);
            try {
              await onDelete();
            } finally {
              setDeleting(false);
            }
          })();
        }}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm font-medium text-primary active:scale-[0.99] disabled:opacity-60"
      >
        <Trash size={16} /> Remove from sale
      </button>
    </div>
  );
}
