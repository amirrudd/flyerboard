import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useNavigate } from "react-router-dom";
import { useSession } from "@descope/react-sdk";
import { motion } from "framer-motion";
import { CaretLeft, X, Package, Sparkle, Tag, Lightning } from "@phosphor-icons/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useUserSync } from "../../context/UserSyncContext";
import { PageLoader } from "../../components/PageLoader";
import { SetupStep, type SetupValues } from "./steps/SetupStep";
import { UploadStep } from "./steps/UploadStep";
import { ReviewStep } from "./steps/ReviewStep";
import { BundlesStep } from "./steps/BundlesStep";
import { PaywallStep } from "./steps/PaywallStep";
import { ShareStep } from "./steps/ShareStep";
import type { FlowStep, SaleEventCore, SaleItem } from "./types";

const PROGRESS_STEPS: FlowStep[] = ["setup", "upload", "review", "bundles", "paywall"];

interface MovingSaleFlowProps {
  /** Resume an existing draft (from the dashboard). */
  initialSaleId?: Id<"saleEvents"> | null;
}

export function MovingSaleFlow({ initialSaleId = null }: MovingSaleFlowProps) {
  const navigate = useNavigate();
  const { isAuthenticated, isSessionLoading } = useSession();
  const { isUserSynced } = useUserSync();
  const ready = isAuthenticated && !isSessionLoading && isUserSynced;

  const [step, setStep] = useState<FlowStep>(initialSaleId ? "review" : "intro");
  const [saleEventId, setSaleEventId] = useState<Id<"saleEvents"> | null>(initialSaleId);
  const [publishedSlug, setPublishedSlug] = useState<string | null>(null);
  const [resumeHandled, setResumeHandled] = useState(!initialSaleId);

  const currentUser = useQuery(api.descopeAuth.getCurrentUser, ready ? {} : "skip");
  const categories = useQuery(api.categories.getCategories, {}) ?? [];
  const editor = useQuery(
    api.saleEvents.getSaleEditor,
    ready && saleEventId ? { saleEventId } : "skip"
  );

  const createSaleEvent = useMutation(api.saleEvents.createSaleEvent);
  const updateSaleEvent = useMutation(api.saleEvents.updateSaleEvent);
  const [submittingSetup, setSubmittingSetup] = useState(false);

  // When resuming a draft, jump to the right step once data loads. Adjusting state
  // during render (guarded by `resumeHandled` so it runs once) is the React-endorsed
  // "adjust state when inputs change" pattern — no effect, no ref access in render.
  if (!resumeHandled && editor) {
    setResumeHandled(true);
    if (editor.sale.isPaid && editor.sale.slug) {
      setPublishedSlug(editor.sale.slug);
      setStep("share");
    } else {
      setStep(editor.items.length === 0 ? "upload" : "review");
    }
  }

  const categoriesById = useMemo(() => {
    const map: Record<string, { name: string }> = {};
    for (const c of categories) map[c._id] = { name: c.name };
    return map;
  }, [categories]);

  const firstName = (currentUser?.name ?? "").trim().split(" ")[0] || "My";
  const items = (editor?.items ?? []) as SaleItem[];
  const bundles = editor?.bundles ?? [];
  const itemCap = editor?.itemCap ?? 10;
  const saleCore: SaleEventCore | null = editor
    ? {
        title: editor.sale.title,
        suburb: editor.sale.suburb,
        note: editor.sale.note,
        pickupWindowStart: editor.sale.pickupWindowStart,
        pickupWindowEnd: editor.sale.pickupWindowEnd,
        slug: editor.sale.slug,
      }
    : null;

  async function handleSetupSubmit(values: SetupValues) {
    setSubmittingSetup(true);
    try {
      if (saleEventId) {
        await updateSaleEvent({ saleEventId, ...values });
      } else {
        const id = await createSaleEvent(values);
        setSaleEventId(id);
      }
      setStep("upload");
    } finally {
      setSubmittingSetup(false);
    }
  }

  function handleBack() {
    switch (step) {
      case "setup":
        setStep("intro");
        break;
      case "upload":
        setStep("setup");
        break;
      case "review":
        setStep("upload");
        break;
      case "bundles":
        setStep("review");
        break;
      case "paywall":
        setStep("bundles");
        break;
      default:
        void navigate("/dashboard");
    }
  }

  if (!ready) return <PageLoader />;
  // Resuming but data not yet loaded.
  if (saleEventId && step !== "intro" && step !== "setup" && !editor) {
    return <PageLoader />;
  }

  const progressIndex = PROGRESS_STEPS.indexOf(step);

  return (
    <div className="min-h-[100dvh] bg-background">
      {/* Chrome */}
      {step !== "intro" && step !== "share" && (
        <header
          className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur"
          style={{ paddingTop: "var(--safe-area-inset-top)" }}
        >
          <div className="mx-auto flex max-w-md items-center gap-3 px-3 py-3">
            <button
              type="button"
              onClick={handleBack}
              aria-label="Back"
              className="flex h-9 w-9 items-center justify-center rounded-full text-foreground hover:bg-muted"
            >
              <CaretLeft size={20} />
            </button>
            <div className="flex flex-1 items-center gap-1.5">
              {PROGRESS_STEPS.map((s, i) => (
                <span
                  key={s}
                  className={`h-1.5 flex-1 rounded-full ${
                    i <= progressIndex ? "bg-primary" : "bg-muted"
                  }`}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={() => { void navigate("/dashboard"); }}
              aria-label="Exit"
              className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
            >
              <X size={20} />
            </button>
          </div>
        </header>
      )}

      {step === "intro" && (
        <IntroStep onStart={() => setStep("setup")} onExit={() => { void navigate("/dashboard"); }} />
      )}

      {step === "setup" && (
        <SetupStep
          defaultFirstName={firstName}
          initial={saleCore ?? undefined}
          submitting={submittingSetup}
          onSubmit={(values) => { void handleSetupSubmit(values); }}
        />
      )}

      {step === "upload" && saleEventId && (
        <UploadStep
          saleEventId={saleEventId}
          itemCap={itemCap}
          existingCount={items.length}
          onDone={() => setStep("review")}
        />
      )}

      {step === "review" && (
        <ReviewStep
          items={items}
          categories={categories}
          onComplete={() => setStep("bundles")}
        />
      )}

      {step === "bundles" && saleEventId && (
        <BundlesStep
          saleEventId={saleEventId}
          items={items}
          categories={categories}
          onComplete={() => setStep("paywall")}
          onBack={() => setStep("review")}
        />
      )}

      {step === "paywall" && saleEventId && saleCore && (
        <PaywallStep
          saleEventId={saleEventId}
          sale={saleCore}
          sellerName={currentUser?.name ?? null}
          items={items}
          bundles={bundles}
          categoriesById={categoriesById}
          itemCount={items.length}
          bundleCount={bundles.length}
          onPublished={(slug) => {
            setPublishedSlug(slug);
            setStep("share");
          }}
          onBack={() => setStep("bundles")}
        />
      )}

      {step === "share" && saleCore && publishedSlug && (
        <ShareStep
          slug={publishedSlug}
          sale={{ ...saleCore, slug: publishedSlug }}
          items={items}
          itemCount={items.length}
        />
      )}
    </div>
  );
}

function IntroStep({ onStart, onExit }: { onStart: () => void; onExit: () => void }) {
  const points = [
    { icon: <Sparkle size={20} weight="fill" />, text: "Snap your stuff — we draft every listing for you" },
    { icon: <Tag size={20} weight="fill" />, text: "Smart bundle pricing to clear more, faster" },
    { icon: <Lightning size={20} weight="fill" />, text: "One shareable page, QR code & printable flyer" },
  ];
  return (
    <div className="relative mx-auto flex min-h-[100dvh] w-full max-w-md flex-col px-5 py-6">
      <button
        type="button"
        onClick={onExit}
        aria-label="Close"
        className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
      >
        <X size={20} />
      </button>
      <div className="flex flex-1 flex-col justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground"
        >
          <Package size={32} weight="fill" />
        </motion.div>
        <h1 className="mt-5 font-display text-3xl font-semibold leading-tight text-foreground">
          Run your whole moving sale in one go
        </h1>
        <p className="mt-2 text-base text-muted-foreground">
          Selling everything before you move? List it all in minutes — not one painful
          listing at a time.
        </p>
        <ul className="mt-7 space-y-4">
          {points.map((p, i) => (
            <motion.li
              key={i}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 + i * 0.07 }}
              className="flex items-center gap-3"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                {p.icon}
              </span>
              <span className="text-sm text-foreground">{p.text}</span>
            </motion.li>
          ))}
        </ul>
      </div>
      <button
        type="button"
        onClick={onStart}
        className="mt-6 w-full rounded-xl bg-primary px-4 py-4 text-base font-semibold text-primary-foreground transition active:scale-[0.99]"
      >
        Start my moving sale
      </button>
      <p className="mt-2 text-center text-xs text-muted-foreground">
        Free to build · $9 to publish & share
      </p>
    </div>
  );
}
