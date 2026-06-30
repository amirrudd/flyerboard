import { useRef, useState } from "react";
import { useAction, useMutation } from "convex/react";
import { toast } from "sonner";
import { Camera, CircleNotch, Sparkle, Plus, X } from "@phosphor-icons/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { uploadImageToR2 } from "../../../lib/uploadToR2";

interface UploadStepProps {
  saleEventId: Id<"saleEvents">;
  itemCap: number;
  existingCount: number;
  onDone: () => void;
}

interface Pending {
  file: File;
  previewUrl: string;
}

export function UploadStep({
  saleEventId,
  itemCap,
  existingCount,
  onDone,
}: UploadStepProps) {
  const generateUploadUrl = useAction(api.upload_urls.generateListingUploadUrl);
  const addSaleItems = useMutation(api.saleEvents.addSaleItems);
  const inputRef = useRef<HTMLInputElement>(null);

  const [pending, setPending] = useState<Pending[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const remaining = itemCap - existingCount;

  function addFiles(files: FileList | null) {
    if (!files) return;
    const incoming = Array.from(files);
    const room = remaining - pending.length;
    if (room <= 0) {
      toast.error(`This sale is limited to ${itemCap} items.`);
      return;
    }
    const accepted = incoming.slice(0, room);
    if (accepted.length < incoming.length) {
      toast.info(`Added ${accepted.length} — you've hit the ${itemCap}-item limit.`);
    }
    setPending((prev) => [
      ...prev,
      ...accepted.map((file) => ({ file, previewUrl: URL.createObjectURL(file) })),
    ]);
  }

  function removePending(index: number) {
    setPending((prev) => {
      URL.revokeObjectURL(prev[index].previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  }

  async function handleGenerate() {
    if (pending.length === 0) {
      inputRef.current?.click();
      return;
    }
    setBusy(true);
    setProgress({ done: 0, total: pending.length });
    const keys: string[] = [];
    try {
      for (let i = 0; i < pending.length; i++) {
        const { url, key } = await generateUploadUrl({ postId: saleEventId });
        await uploadImageToR2(pending[i].file, async () => url, async () => null);
        keys.push(key);
        setProgress({ done: i + 1, total: pending.length });
      }
      await addSaleItems({
        saleEventId,
        items: keys.map((imageKey) => ({ imageKey })),
      });
      pending.forEach((p) => URL.revokeObjectURL(p.previewUrl));
      onDone();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Something went wrong uploading your photos."
      );
      setBusy(false);
      setProgress(null);
    }
  }

  return (
    <div className="mx-auto w-full max-w-md px-4 py-6">
      <h2 className="font-display text-2xl font-semibold text-foreground">
        Snap everything you're selling
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        One photo per item. We'll turn each into a listing in seconds — you just check
        them.
      </p>
      <p className="mt-2 text-xs font-medium text-muted-foreground">
        {existingCount > 0 && `${existingCount} already added · `}
        {Math.max(0, remaining - pending.length)} of {itemCap} slots left
      </p>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        capture="environment"
        className="hidden"
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {pending.length === 0 ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="mt-6 flex h-44 w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border bg-card text-muted-foreground transition hover:border-primary/50 hover:text-primary"
        >
          <Camera size={32} />
          <span className="font-medium">Add photos</span>
          <span className="text-xs">Take new or pick from your camera roll</span>
        </button>
      ) : (
        <div className="mt-6 grid grid-cols-3 gap-2">
          {pending.map((p, i) => (
            <div
              key={p.previewUrl}
              className="relative aspect-square overflow-hidden rounded-xl border border-border bg-muted"
            >
              <img
                src={p.previewUrl}
                alt={`Item ${i + 1}`}
                className="h-full w-full object-cover"
              />
              {!busy && (
                <button
                  type="button"
                  onClick={() => removePending(i)}
                  aria-label="Remove photo"
                  className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-neutral-900/70 text-white"
                >
                  <X size={14} weight="bold" />
                </button>
              )}
            </div>
          ))}
          {!busy && remaining - pending.length > 0 && (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-border text-muted-foreground transition hover:border-primary/50 hover:text-primary"
            >
              <Plus size={22} />
              <span className="text-xs">More</span>
            </button>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => { void handleGenerate(); }}
        disabled={busy}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3.5 font-semibold text-primary-foreground transition active:scale-[0.99] disabled:opacity-60"
      >
        {busy ? (
          <>
            <CircleNotch size={18} className="animate-spin" />
            {progress
              ? `Creating listings… ${progress.done}/${progress.total}`
              : "Working…"}
          </>
        ) : (
          <>
            <Sparkle size={18} weight="fill" />
            {pending.length > 0
              ? `Create ${pending.length} ${pending.length === 1 ? "listing" : "listings"}`
              : "Add photos"}
          </>
        )}
      </button>
    </div>
  );
}
