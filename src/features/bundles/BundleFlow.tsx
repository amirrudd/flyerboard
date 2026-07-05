import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useNavigate } from "react-router-dom";
import { useSession } from "@descope/react-sdk";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { Package, Check } from "@phosphor-icons/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useUserSync } from "../../context/UserSyncContext";
import { useMotionPrefs } from "../../hooks/useMotionPrefs";
import { PageLoader } from "../../components/PageLoader";
import { WizardShell } from "../../components/WizardShell";
import { ItemThumb } from "./ItemThumb";
import { formatPrice } from "../../lib/priceFormatter";

// Keep in sync with BUNDLE_MIN_ITEMS/BUNDLE_MAX_ITEMS in convex/bundles.ts. Not imported
// directly — that file pulls in server-only Convex modules (mutation/query, auth, rate
// limiting) that shouldn't end up in the client bundle.
const MIN_ITEMS = 2;
const MAX_ITEMS = 4;

/** Auto-generated bundle name from the first two item titles (shared by the price + confirm steps). */
function autoBundleLabel(items: { title: string }[]): string {
  return items.map((i) => i.title).slice(0, 2).join(" + ") || "My bundle";
}

type Step = "pick" | "price" | "confirm";
const STEPS: Step[] = ["pick", "price", "confirm"];

interface BundleFlowProps {
  /** Ad to start the picker with pre-selected (secondary entry point). */
  preselectAdId?: string;
}

export function BundleFlow({ preselectAdId }: BundleFlowProps) {
  const navigate = useNavigate();
  const { isAuthenticated, isSessionLoading } = useSession();
  const { isUserSynced } = useUserSync();
  const ready = isAuthenticated && !isSessionLoading && isUserSynced;
  const { slideStep } = useMotionPrefs();

  const eligibleAds = useQuery(
    api.bundles.getEligibleAdsForBundle,
    ready ? {} : "skip"
  );
  const createBundle = useMutation(api.bundles.createBundle);

  const [step, setStep] = useState<Step>("pick");
  const [selected, setSelected] = useState<string[]>(
    preselectAdId ? [preselectAdId] : []
  );
  const [priceInput, setPriceInput] = useState<string>("");
  const [label, setLabel] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  const adsById = useMemo(() => {
    const map = new Map<string, NonNullable<typeof eligibleAds>[number]>();
    for (const ad of eligibleAds ?? []) map.set(ad._id, ad);
    return map;
  }, [eligibleAds]);

  const selectedAds = useMemo(
    () => selected.map((id) => adsById.get(id)).filter((a): a is NonNullable<typeof a> => Boolean(a)),
    [selected, adsById]
  );

  const separatelyTotal = useMemo(
    () => selectedAds.reduce((sum, a) => sum + (a.price || 0), 0),
    [selectedAds]
  );

  const bundlePrice = Number(priceInput) || 0;
  const savings = Math.max(0, separatelyTotal - bundlePrice);
  const savingsPct =
    separatelyTotal > 0 ? Math.round((savings / separatelyTotal) * 100) : 0;
  const noSaving = bundlePrice > 0 && bundlePrice >= separatelyTotal;

  const canProceedFromPick = selected.length >= MIN_ITEMS && selected.length <= MAX_ITEMS;
  const canCreate = canProceedFromPick && bundlePrice > 0;

  function toggle(adId: string, eligible: boolean) {
    if (!eligible) return;
    setSelected((prev) => {
      if (prev.includes(adId)) return prev.filter((id) => id !== adId);
      if (prev.length >= MAX_ITEMS) return prev;
      return [...prev, adId];
    });
  }

  function handleBack() {
    if (step === "price") setStep("pick");
    else if (step === "confirm") setStep("price");
    else void navigate("/dashboard?tab=ads");
  }

  async function handleCreate() {
    if (!canCreate) return;
    setSubmitting(true);
    try {
      await createBundle({
        adIds: selected as Id<"ads">[],
        bundlePrice,
        label: label.trim() || undefined,
      });
      toast.success("Bundle created");
      void navigate("/dashboard?tab=ads");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't create the bundle");
      setSubmitting(false);
    }
  }

  if (!ready || eligibleAds === undefined) return <PageLoader />;

  const stepIndex = STEPS.indexOf(step);
  const slide = slideStep();

  return (
    <WizardShell
      currentStep={stepIndex}
      totalSteps={STEPS.length}
      onBack={handleBack}
      onExit={() => { void navigate("/dashboard?tab=ads"); }}
      accentClassName="bg-bundle"
    >
      <div className="mx-auto w-full max-w-md px-5 py-6">
        <AnimatePresence mode="wait">
          {step === "pick" && (
            <motion.div key="pick" {...slide}>
              <PickStep
                ads={eligibleAds}
                selected={selected}
                onToggle={toggle}
                maxItems={MAX_ITEMS}
                canProceed={canProceedFromPick}
                onNext={() => setStep("price")}
              />
            </motion.div>
          )}

          {step === "price" && (
            <motion.div key="price" {...slide}>
              <PriceStep
                items={selectedAds}
                separatelyTotal={separatelyTotal}
                priceInput={priceInput}
                onPriceChange={setPriceInput}
                label={label}
                onLabelChange={setLabel}
                savings={savings}
                savingsPct={savingsPct}
                noSaving={noSaving}
                bundlePrice={bundlePrice}
                canProceed={canCreate}
                onNext={() => setStep("confirm")}
              />
            </motion.div>
          )}

          {step === "confirm" && (
            <motion.div key="confirm" {...slide}>
              <ConfirmStep
                items={selectedAds}
                label={label}
                separatelyTotal={separatelyTotal}
                bundlePrice={bundlePrice}
                savings={savings}
                savingsPct={savingsPct}
                submitting={submitting}
                onCreate={() => { void handleCreate(); }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </WizardShell>
  );
}

/* ---------------- Step 1: Picker ---------------- */

type EligibleAd = {
  _id: string;
  title: string;
  price: number;
  image: string | null;
  eligible: boolean;
  reason: string | null;
};

function PickStep({
  ads,
  selected,
  onToggle,
  maxItems,
  canProceed,
  onNext,
}: {
  ads: EligibleAd[];
  selected: string[];
  onToggle: (adId: string, eligible: boolean) => void;
  maxItems: number;
  canProceed: boolean;
  onNext: () => void;
}) {
  const eligibleCount = ads.filter((a) => a.eligible).length;

  return (
    <div>
      <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-bundle mb-1">
        Step 1 of 3
      </span>
      <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">
        Pick items to bundle
      </h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Choose {MIN_ITEMS}–{maxItems} of your listings. Buyers get a better deal when they take the set.
      </p>

      <div className="mt-4 flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-bundle/10 px-3 py-1 text-sm font-semibold text-bundle-emphasis">
          <Package size={16} weight="fill" />
          {selected.length} of {maxItems} selected
        </span>
      </div>

      {eligibleCount === 0 ? (
        <div className="mt-8 rounded-2xl border border-border/70 bg-card p-6 text-center">
          <div className="flex justify-center mb-3 text-muted-foreground/40">
            <Package size={40} weight="light" />
          </div>
          <p className="text-sm text-muted-foreground">
            You need at least two available listings that aren&apos;t already in a bundle or moving sale.
          </p>
        </div>
      ) : (
        <div className="mt-5 grid grid-cols-3 gap-3">
          {ads.map((ad) => {
            const isSelected = selected.includes(ad._id);
            return (
              <motion.button
                key={ad._id}
                type="button"
                disabled={!ad.eligible}
                onClick={() => onToggle(ad._id, ad.eligible)}
                animate={{ scale: isSelected ? 0.97 : 1 }}
                transition={{ type: "spring", stiffness: 400, damping: 28 }}
                className={`relative aspect-square overflow-hidden rounded-xl text-left ring-1 transition ${
                  isSelected
                    ? "ring-2 ring-bundle"
                    : "ring-border/70 hover:ring-foreground/20"
                } ${ad.eligible ? "" : "cursor-not-allowed opacity-45"}`}
                aria-pressed={isSelected}
                aria-label={ad.title}
              >
                <ItemThumb image={ad.image} title={ad.title} iconSize={24} />

                {isSelected && (
                  <span className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-bundle text-white shadow-sm">
                    <Check size={14} weight="bold" />
                  </span>
                )}

                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-1.5 pb-1 pt-4">
                  <span className="block truncate text-[11px] font-semibold text-white">
                    {formatPrice(ad.price)}
                  </span>
                </span>

                {!ad.eligible && ad.reason && (
                  <span className="absolute inset-x-1 top-1 rounded-md bg-foreground/80 px-1 py-0.5 text-center text-[9px] font-medium leading-tight text-background">
                    {ad.reason}
                  </span>
                )}
              </motion.button>
            );
          })}
        </div>
      )}

      <button
        type="button"
        disabled={!canProceed}
        onClick={onNext}
        className="mt-8 w-full rounded-xl bg-bundle px-4 py-4 text-base font-semibold text-white transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
      >
        {canProceed ? "Set a bundle price" : `Select at least ${MIN_ITEMS}`}
      </button>
    </div>
  );
}

/* ---------------- Step 2: Price ---------------- */

function PriceStep({
  items,
  separatelyTotal,
  priceInput,
  onPriceChange,
  label,
  onLabelChange,
  savings,
  savingsPct,
  noSaving,
  bundlePrice,
  canProceed,
  onNext,
}: {
  items: EligibleAd[];
  separatelyTotal: number;
  priceInput: string;
  onPriceChange: (v: string) => void;
  label: string;
  onLabelChange: (v: string) => void;
  savings: number;
  savingsPct: number;
  noSaving: boolean;
  bundlePrice: number;
  canProceed: boolean;
  onNext: () => void;
}) {
  const autoName = autoBundleLabel(items);

  return (
    <div>
      <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-bundle mb-1">
        Step 2 of 3
      </span>
      <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">
        Set your bundle price
      </h1>

      <ul className="mt-5 space-y-2">
        {items.map((it) => (
          <li
            key={it._id}
            className="flex items-center gap-3 rounded-xl ring-1 ring-border/70 bg-card p-2"
          >
            <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg ring-1 ring-border/60">
              <ItemThumb image={it.image} title={it.title} />
            </div>
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{it.title}</span>
            <span className="text-sm font-semibold tabular-nums text-muted-foreground">{formatPrice(it.price)}</span>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
        <span className="text-sm text-muted-foreground">Separately</span>
        <span className="font-display text-base font-semibold tabular-nums text-foreground">
          {formatPrice(separatelyTotal)}
        </span>
      </div>

      <div className="mt-6">
        <label htmlFor="bundle-price" className="block text-sm font-medium text-foreground">
          Bundle price
        </label>
        <div className="mt-1.5 flex items-center rounded-xl ring-1 ring-border focus-within:ring-2 focus-within:ring-bundle">
          <span className="pl-3.5 text-lg font-semibold text-muted-foreground">$</span>
          <input
            id="bundle-price"
            type="number"
            inputMode="numeric"
            min={0}
            value={priceInput}
            onChange={(e) => onPriceChange(e.target.value)}
            placeholder="0"
            className="w-full rounded-xl bg-transparent px-2 py-3 text-lg font-semibold tabular-nums text-foreground outline-none focus:ring-0! focus:border-transparent! [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
        </div>
      </div>

      <div className="mt-4">
        <label htmlFor="bundle-label" className="block text-sm font-medium text-foreground">
          Bundle name <span className="font-normal text-muted-foreground">(optional)</span>
        </label>
        <input
          id="bundle-label"
          type="text"
          value={label}
          maxLength={80}
          onChange={(e) => onLabelChange(e.target.value)}
          placeholder={autoName}
          className="mt-1.5 w-full rounded-xl bg-transparent px-3.5 py-3 text-sm text-foreground ring-1 ring-border outline-none focus:ring-2! focus:ring-bundle! focus:border-transparent!"
        />
      </div>

      <div className="mt-5 min-h-[2.75rem]">
        <AnimatePresence mode="wait">
          {bundlePrice > 0 && !noSaving && (
            <motion.p
              key="save"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="flex items-center gap-1.5 rounded-xl bg-bundle/10 px-3.5 py-3 text-sm font-semibold text-bundle-emphasis"
            >
              <Check size={16} weight="bold" />
              Buyers save {formatPrice(savings)} ({savingsPct}%)
            </motion.p>
          )}
          {noSaving && (
            <motion.p
              key="nosave"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="rounded-xl bg-amber-500/10 px-3.5 py-3 text-sm font-medium text-amber-700 dark:text-amber-400"
            >
              This price is at or above the separate total — buyers get no saving.
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      <button
        type="button"
        disabled={!canProceed}
        onClick={onNext}
        className="mt-6 w-full rounded-xl bg-bundle px-4 py-4 text-base font-semibold text-white transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
      >
        Review bundle
      </button>
    </div>
  );
}

/* ---------------- Step 3: Confirm ---------------- */

function ConfirmStep({
  items,
  label,
  separatelyTotal,
  bundlePrice,
  savings,
  savingsPct,
  submitting,
  onCreate,
}: {
  items: EligibleAd[];
  label: string;
  separatelyTotal: number;
  bundlePrice: number;
  savings: number;
  savingsPct: number;
  submitting: boolean;
  onCreate: () => void;
}) {
  const name = label.trim() || autoBundleLabel(items);

  return (
    <div>
      <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-bundle mb-1">
        Step 3 of 3
      </span>
      <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">
        Confirm your bundle
      </h1>

      <div className="mt-5 rounded-2xl ring-1 ring-bundle/25 bg-bundle/[0.04] p-4">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-bundle text-white">
            <Package size={18} weight="fill" />
          </span>
          <h2 className="font-display text-lg font-semibold text-foreground">{name}</h2>
        </div>

        <div className="mt-4 flex gap-2">
          {items.map((it) => (
            <div key={it._id} className="h-16 w-16 shrink-0 overflow-hidden rounded-lg ring-1 ring-border/60">
              <ItemThumb image={it.image} title={it.title} />
            </div>
          ))}
        </div>

        <dl className="mt-4 space-y-1.5 border-t border-bundle/15 pt-4 text-sm">
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Separately</dt>
            <dd className="tabular-nums text-muted-foreground line-through">{formatPrice(separatelyTotal)}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="font-semibold text-foreground">Bundle price</dt>
            <dd className="font-display text-lg font-semibold tabular-nums text-bundle-emphasis">
              {formatPrice(bundlePrice)}
            </dd>
          </div>
          {savings > 0 && (
            <div className="flex items-center justify-between">
              <dt className="text-bundle-emphasis">Buyers save</dt>
              <dd className="font-semibold tabular-nums text-bundle-emphasis">
                {formatPrice(savings)} ({savingsPct}%)
              </dd>
            </div>
          )}
        </dl>
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        Each item stays listed and searchable on its own — buyers just see the bundle deal too.
      </p>

      <button
        type="button"
        disabled={submitting}
        onClick={onCreate}
        className="mt-6 w-full rounded-xl bg-bundle px-4 py-4 text-base font-semibold text-white transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? "Creating…" : "Create bundle"}
      </button>
    </div>
  );
}

export default BundleFlow;
