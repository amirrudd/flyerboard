import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery } from "convex/react";
import { useSession } from "@descope/react-sdk";
import { toast } from "sonner";
import { X, PaperPlaneRight, CircleNotch, Check, Plus } from "@phosphor-icons/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useUserSync } from "../../context/UserSyncContext";
import { AuthModal } from "../auth/AuthModal";
import { ImageDisplay } from "../../components/ui/ImageDisplay";
import { formatAUD } from "./saleHelpers";
import type { SaleItem } from "./types";

interface SaleMessageModalProps {
  saleEventId: Id<"saleEvents">;
  sellerName: string | null;
  items: SaleItem[];
  isOpen: boolean;
  preselectedAdId?: Id<"ads"> | null;
  onClose: () => void;
}

/**
 * Sale-level message thread (v2). One conversation per buyer per Sale; items are
 * attached as chips (referencedAdIds) so a buyer can ask about several at once.
 * Reuses the app's AuthModal for the Descope sign-in gate.
 */
export function SaleMessageModal({
  saleEventId,
  sellerName,
  items,
  isOpen,
  preselectedAdId,
  onClose,
}: SaleMessageModalProps) {
  const { isAuthenticated, isSessionLoading } = useSession();
  const { isUserSynced } = useUserSync();
  const ready = isAuthenticated && !isSessionLoading && isUserSynced;

  const thread = useQuery(
    api.saleChats.getSaleThread,
    isOpen && ready ? { saleEventId } : "skip"
  );
  const sendMessage = useMutation(api.saleChats.sendSaleMessage);

  const [text, setText] = useState("");
  const [chips, setChips] = useState<Set<string>>(new Set());
  const [showAuth, setShowAuth] = useState(false);
  const [sending, setSending] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [seedKey, setSeedKey] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const sellerFirst = (sellerName ?? "the seller").split(" ")[0];
  const itemById = useMemo(() => {
    const map = new Map<string, SaleItem>();
    for (const i of items) map.set(i._id, i);
    return map;
  }, [items]);

  // Seed the preselected chip / reset composer when the modal opens for a specific
  // item — adjusted during render (guarded by seedKey), not in an effect.
  const currentKey = isOpen ? String(preselectedAdId ?? "none") : null;
  if (currentKey !== seedKey) {
    setSeedKey(currentKey);
    if (isOpen) {
      setChips(preselectedAdId ? new Set([preselectedAdId]) : new Set());
      setText("");
      setShowPicker(false);
    }
  }

  // Keep the thread scrolled to the latest message.
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [thread]);

  // Body scroll lock + Esc.
  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = "hidden";
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onEsc);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onEsc);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  function toggleChip(id: string) {
    setChips((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSend() {
    const content = text.trim();
    if (!content) return;
    if (!ready) {
      setShowAuth(true);
      return;
    }
    setSending(true);
    try {
      await sendMessage({
        saleEventId,
        content,
        referencedAdIds: chips.size > 0 ? (Array.from(chips) as Id<"ads">[]) : undefined,
      });
      setText("");
      // Keep chips for follow-up context but collapse the picker.
      setShowPicker(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't send your message.");
    } finally {
      setSending(false);
    }
  }

  const availableItems = items.filter((i) => !i.isSold);

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-foreground/40 backdrop-blur-sm sm:items-center"
      onClick={onClose}
      role="presentation"
    >
      <section
        className="flex h-[80vh] w-full max-w-md flex-col rounded-t-2xl bg-card shadow-2xl ring-1 ring-border/70 sm:h-[600px] sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        style={{ paddingBottom: "var(--safe-area-inset-bottom)" }}
      >
        {/* Header */}
        <header className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <h2 className="font-display text-lg font-semibold text-foreground">
              Message {sellerFirst}
            </h2>
            <p className="text-xs text-muted-foreground">About this moving sale</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
          >
            <X size={20} />
          </button>
        </header>

        {/* Thread / states */}
        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
          {!ready ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <p className="text-sm text-muted-foreground">
                Sign in to message {sellerFirst} about this sale.
              </p>
              <button
                type="button"
                onClick={() => setShowAuth(true)}
                className="mt-3 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
              >
                Sign in
              </button>
            </div>
          ) : thread === undefined ? (
            <div className="flex h-full items-center justify-center">
              <CircleNotch size={22} className="animate-spin text-muted-foreground" />
            </div>
          ) : thread && thread.messages.length > 0 ? (
            thread.messages.map((m) => (
              <div key={m._id} className={`flex ${m.mine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                    m.mine
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground"
                  }`}
                >
                  {m.referencedAdIds.length > 0 && (
                    <div className="mb-1 flex flex-wrap gap-1">
                      {m.referencedAdIds.map((id) => {
                        const item = itemById.get(id);
                        if (!item) return null;
                        return (
                          <span
                            key={id}
                            className={`rounded-md px-1.5 py-0.5 text-[0.7rem] font-medium ${
                              m.mine ? "bg-white/20" : "bg-card"
                            }`}
                          >
                            {item.title} · {formatAUD(item.price)}
                          </span>
                        );
                      })}
                    </div>
                  )}
                  {m.content}
                </div>
              </div>
            ))
          ) : (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <p className="text-sm text-muted-foreground">
                Start the conversation — ask about an item, a bundle, or pickup.
              </p>
            </div>
          )}
        </div>

        {/* Composer */}
        {ready && (
          <div className="border-t border-border p-3">
            {/* Selected item chips */}
            {chips.size > 0 && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {Array.from(chips).map((id) => {
                  const item = itemById.get(id);
                  if (!item) return null;
                  return (
                    <span
                      key={id}
                      className="inline-flex items-center gap-1 rounded-full bg-primary/10 py-1 pl-2 pr-1 text-xs font-medium text-primary"
                    >
                      {item.title}
                      <button
                        type="button"
                        onClick={() => toggleChip(id)}
                        aria-label={`Remove ${item.title}`}
                        className="flex h-4 w-4 items-center justify-center rounded-full hover:bg-primary/20"
                      >
                        <X size={11} weight="bold" />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}

            {/* Item picker */}
            {showPicker && availableItems.length > 0 && (
              <div className="mb-2 flex gap-2 overflow-x-auto pb-1">
                {availableItems.map((item) => {
                  const on = chips.has(item._id);
                  return (
                    <button
                      type="button"
                      key={item._id}
                      onClick={() => toggleChip(item._id)}
                      className={`relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2 ${
                        on ? "border-primary" : "border-transparent"
                      }`}
                    >
                      <ImageDisplay
                        imageRef={item.images[0]}
                        alt={item.title}
                        className="h-full w-full object-cover"
                      />
                      {on && (
                        <span className="absolute inset-0 flex items-center justify-center bg-primary/40 text-white">
                          <Check size={16} weight="bold" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="flex items-end gap-2">
              {availableItems.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowPicker((s) => !s)}
                  aria-label="Reference items"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground"
                >
                  <Plus size={20} />
                </button>
              )}
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void handleSend();
                  }
                }}
                rows={1}
                placeholder={`Message ${sellerFirst}…`}
                className="max-h-28 min-h-[44px] flex-1 resize-none rounded-xl border border-border bg-card px-3 py-3 text-sm text-foreground outline-none focus:border-primary"
              />
              <button
                type="button"
                onClick={() => { void handleSend(); }}
                disabled={sending || !text.trim()}
                aria-label="Send"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground disabled:opacity-50"
              >
                {sending ? (
                  <CircleNotch size={18} className="animate-spin" />
                ) : (
                  <PaperPlaneRight size={18} weight="fill" />
                )}
              </button>
            </div>
          </div>
        )}
      </section>

      <AuthModal showAuthModal={showAuth} setShowAuthModal={setShowAuth} />
    </div>,
    document.body
  );
}
