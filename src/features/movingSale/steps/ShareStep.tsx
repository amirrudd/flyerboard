import { useState } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import {
  CheckCircle,
  Copy,
  ShareNetwork,
  Printer,
  FacebookLogo,
  WhatsappLogo,
  ArrowSquareOut,
  QrCode as QrIcon,
  Sparkle,
  PushPin,
  Lock,
  Check,
} from "@phosphor-icons/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { QrCode } from "../QrCode";
import { formatAUD, formatPickupRange, formatPickupShort } from "../saleHelpers";
import type { SaleEventCore, SaleItem } from "../types";

interface ShareStepProps {
  saleEventId: Id<"saleEvents">;
  slug: string;
  sale: SaleEventCore;
  items: SaleItem[];
  itemCount: number;
  unlockedAddons: string[];
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Build a self-contained printable A4 flyer (no external assets except the QR data URL). */
function buildFlyerHtml(
  sale: SaleEventCore,
  items: SaleItem[],
  url: string,
  qrDataUrl: string,
  itemCount: number
): string {
  const top = [...items].sort((a, b) => (b.price ?? 0) - (a.price ?? 0)).slice(0, 4);
  const rows = top
    .map(
      (i) =>
        `<tr><td class="i">${escapeHtml(i.title)}</td><td class="d"></td><td class="p">${formatAUD(i.price)}</td></tr>`
    )
    .join("");
  const more = itemCount > top.length ? `+ ${itemCount - top.length} more items online` : "";

  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(sale.title)} — flyer</title>
<style>
@page { size: A4; margin: 18mm; }
* { box-sizing: border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; color: #242428; margin: 0; }
.eyebrow { letter-spacing: .25em; font-size: 13px; font-weight: 700; color: #dc3626; text-transform: uppercase; }
h1 { font-size: 40px; margin: 6px 0 2px; }
.suburb { font-size: 20px; color: #52525B; margin: 0 0 22px; }
.top { display: flex; justify-content: space-between; align-items: flex-start; }
.qr { text-align: center; font-size: 12px; color: #52525B; }
.qr img { width: 120px; height: 120px; display: block; }
.section { margin-top: 20px; }
.label { font-size: 12px; letter-spacing: .12em; text-transform: uppercase; color: #71717A; margin-bottom: 4px; }
.big { font-size: 22px; font-weight: 600; }
table { width: 100%; border-collapse: collapse; margin-top: 6px; }
td { padding: 6px 0; font-size: 18px; vertical-align: bottom; }
td.d { width: 100%; border-bottom: 2px dotted #C4C4D0; }
td.i { white-space: nowrap; padding-right: 8px; }
td.p { white-space: nowrap; padding-left: 8px; font-weight: 600; }
.more { margin-top: 8px; font-size: 16px; color: #52525B; }
hr { border: none; border-top: 2px solid #242428; margin: 26px 0 10px; }
.foot { font-size: 14px; color: #52525B; }
.brand { font-weight: 700; color: #242428; }
</style></head>
<body>
  <div class="top">
    <div>
      <div class="eyebrow">Moving Sale</div>
      <h1>${escapeHtml(sale.title)}</h1>
      <p class="suburb">${escapeHtml(sale.suburb)}</p>
    </div>
    <div class="qr"><img src="${qrDataUrl}" alt="QR"/>Scan to see<br/>all items</div>
  </div>
  <div class="section"><div class="label">Pickup</div><div class="big">${escapeHtml(formatPickupRange(sale.pickupWindowStart, sale.pickupWindowEnd))}</div></div>
  <div class="section"><div class="label">Location</div><div class="big">${escapeHtml(sale.suburb)}</div><div class="more">Address on request</div></div>
  <div class="section"><div class="label">Items include</div><table>${rows}</table>${more ? `<div class="more">${more}</div>` : ""}</div>
  <hr/>
  <div class="foot">${escapeHtml(url)}<br/><span class="brand">Powered by FlyerBoard</span></div>
  <script>window.onload = function(){ setTimeout(function(){ window.print(); }, 250); };</script>
</body></html>`;
}

export function ShareStep({
  saleEventId,
  slug,
  sale,
  items,
  itemCount,
  unlockedAddons,
}: ShareStepProps) {
  const url = `${window.location.origin}/sale/${slug}`;
  const purchaseAddon = useMutation(api.saleEvents.purchaseAddon);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [buying, setBuying] = useState<string | null>(null);

  const flyerUnlocked = unlockedAddons.includes("flyer");
  const pinned = unlockedAddons.includes("pin");

  const shareText = `🏠 ${sale.title} — ${sale.suburb}. ${itemCount} items, pickup ${formatPickupShort(
    sale.pickupWindowStart
  )}. See everything: ${url}`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch {
      toast.error("Couldn't copy — long-press the link to copy it.");
    }
  }

  async function nativeShare() {
    if (navigator.share) {
      try {
        await navigator.share({ title: sale.title, text: shareText, url });
      } catch {
        /* cancelled */
      }
    } else {
      void copyLink();
    }
  }

  async function buy(addon: "flyer" | "pin") {
    setBuying(addon);
    try {
      // STUB: real flow opens Stripe Checkout for this add-on.
      await purchaseAddon({ saleEventId, addon });
      toast.success(addon === "flyer" ? "QR + flyer unlocked" : "Sale pinned for 7 days");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't complete that.");
    } finally {
      setBuying(null);
    }
  }

  function printFlyer() {
    if (!qrDataUrl) {
      toast.info("Preparing your flyer — try again in a second.");
      return;
    }
    const win = window.open("", "_blank");
    if (!win) {
      toast.error("Allow pop-ups to download the flyer.");
      return;
    }
    win.document.write(buildFlyerHtml(sale, items, url, qrDataUrl, itemCount));
    win.document.close();
  }

  function saveQr() {
    if (!qrDataUrl) return;
    const a = document.createElement("a");
    a.href = qrDataUrl;
    a.download = `${slug}-qr.png`;
    a.click();
  }

  return (
    <div className="mx-auto w-full max-w-md px-4 py-8">
      <div className="text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
          <CheckCircle size={36} weight="fill" />
        </div>
        <h2 className="mt-4 font-display text-2xl font-semibold text-foreground">
          {sale.title} is live
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {itemCount} items · {sale.suburb} · {formatPickupShort(sale.pickupWindowStart)}
        </p>
      </div>

      {/* Free share — always available */}
      <div className="mt-6 rounded-2xl border border-border bg-card p-5">
        <button
          type="button"
          onClick={() => { void copyLink(); }}
          className="mx-auto block max-w-full truncate text-sm font-medium text-primary underline-offset-2 hover:underline"
        >
          {url.replace(/^https?:\/\//, "")}
        </button>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <ActionButton icon={<Copy size={18} />} label="Copy link" onClick={() => { void copyLink(); }} />
          <ActionButton icon={<ShareNetwork size={18} />} label="Share" onClick={() => { void nativeShare(); }} />
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <a
            href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm font-medium text-foreground"
          >
            <FacebookLogo size={18} weight="fill" className="text-[#1877F2]" /> Facebook
          </a>
          <a
            href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm font-medium text-foreground"
          >
            <WhatsappLogo size={18} weight="fill" className="text-[#25D366]" /> WhatsApp
          </a>
        </div>
      </div>

      {/* Optional upgrades — never a blocker */}
      <h3 className="mb-2 mt-7 text-sm font-semibold text-foreground">
        Reach more people faster
      </h3>
      <p className="mb-3 text-xs text-muted-foreground">
        Optional add-ons. Test mode — no charge yet.
      </p>

      {/* QR + printable flyer */}
      {flyerUnlocked ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
            <Check size={16} weight="bold" /> QR + printable flyer
          </div>
          <div className="mt-3 flex items-center gap-4">
            <QrCode value={url} size={96} onReady={setQrDataUrl} />
            <div className="flex flex-1 flex-col gap-2">
              <button
                type="button"
                onClick={printFlyer}
                className="flex items-center justify-center gap-2 rounded-xl bg-neutral-800 px-3 py-2.5 text-sm font-semibold text-white active:scale-[0.99]"
              >
                <Printer size={16} weight="fill" /> Printable A4 flyer
              </button>
              <button
                type="button"
                onClick={saveQr}
                className="flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 text-sm font-medium text-foreground"
              >
                <ArrowSquareOut size={16} /> Save QR
              </button>
            </div>
          </div>
        </div>
      ) : (
        <UpgradeCard
          icon={<QrIcon size={20} weight="fill" />}
          title="QR code + printable flyer"
          desc="A4 PDF with a QR code for letterboxes & noticeboards."
          cta="Add"
          busy={buying === "flyer"}
          onClick={() => { void buy("flyer"); }}
        />
      )}

      {/* 7-day search pin */}
      <div className="mt-3">
        {pinned ? (
          <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 text-sm font-semibold text-emerald-700">
            <Check size={16} weight="bold" /> Pinned to the top of search for 7 days
          </div>
        ) : (
          <UpgradeCard
            icon={<PushPin size={20} weight="fill" />}
            title="7-day search pin"
            desc="Featured at the top of relevant searches for 7 days."
            cta="Add"
            busy={buying === "pin"}
            onClick={() => { void buy("pin"); }}
          />
        )}
      </div>

      {/* AI bulk listing — fully stubbed for now */}
      <div className="mt-3">
        <UpgradeCard
          icon={<Sparkle size={20} weight="fill" />}
          title="AI bulk listing"
          desc="Snap photos — AI drafts every listing & bundle for you."
          cta="Coming soon"
          disabled
        />
      </div>

      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="mt-6 block text-center text-sm font-medium text-primary hover:underline"
      >
        View your live sale page →
      </a>
    </div>
  );
}

function UpgradeCard({
  icon,
  title,
  desc,
  cta,
  onClick,
  busy = false,
  disabled = false,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  cta: string;
  onClick?: () => void;
  busy?: boolean;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="truncate text-xs text-muted-foreground">{desc}</p>
      </div>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled || busy}
        className={`shrink-0 rounded-lg px-3 py-2 text-sm font-semibold active:scale-95 ${
          disabled
            ? "cursor-default bg-muted text-muted-foreground"
            : "bg-primary/10 text-primary"
        }`}
      >
        {busy ? "…" : disabled ? <span className="inline-flex items-center gap-1"><Lock size={12} /> {cta}</span> : cta}
      </button>
    </div>
  );
}

function ActionButton({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-2 py-3 text-sm font-medium text-foreground active:scale-[0.98]"
    >
      {icon}
      {label}
    </button>
  );
}
