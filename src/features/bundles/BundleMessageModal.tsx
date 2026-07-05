import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery } from "convex/react";
import { useSession } from "@descope/react-sdk";
import { toast } from "sonner";
import { X, PaperPlaneRight, CircleNotch } from "@phosphor-icons/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useUserSync } from "../../context/UserSyncContext";
import { AuthModal } from "../auth/AuthModal";

interface BundleMessageModalProps {
  bundleId: Id<"saleBundles">;
  sellerName: string | null;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Bundle-level message thread — mirrors SaleMessageModal minus the item
 * chips (a bundle IS the package, so the conversation is about the deal
 * itself). One conversation per buyer per bundle; also surfaces in the
 * unified inbox. Reuses the app's AuthModal for the Descope sign-in gate.
 */
export function BundleMessageModal({
  bundleId,
  sellerName,
  isOpen,
  onClose,
}: BundleMessageModalProps) {
  const { isAuthenticated, isSessionLoading } = useSession();
  const { isUserSynced } = useUserSync();
  const ready = isAuthenticated && !isSessionLoading && isUserSynced;

  const thread = useQuery(
    api.bundleChats.getBundleThread,
    isOpen && ready ? { bundleId } : "skip"
  );
  const sendMessage = useMutation(api.bundleChats.sendBundleMessage);

  const [text, setText] = useState("");
  const [showAuth, setShowAuth] = useState(false);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const sellerFirst = (sellerName ?? "the seller").split(" ")[0];

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

  async function handleSend() {
    const content = text.trim();
    if (!content) return;
    if (!ready) {
      setShowAuth(true);
      return;
    }
    setSending(true);
    try {
      await sendMessage({ bundleId, content });
      setText("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't send your message.");
    } finally {
      setSending(false);
    }
  }

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
            <p className="text-xs text-muted-foreground">About this bundle</p>
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
                Sign in to message {sellerFirst} about this bundle.
              </p>
              <button
                type="button"
                onClick={() => setShowAuth(true)}
                className="mt-3 rounded-xl bg-bundle px-5 py-2.5 text-sm font-semibold text-bundle-foreground"
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
                      ? "bg-bundle text-bundle-foreground"
                      : "bg-muted text-foreground"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))
          ) : (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <p className="text-sm text-muted-foreground">
                Start the conversation — take the deal or make an offer on the set.
              </p>
            </div>
          )}
        </div>

        {/* Composer */}
        {ready && (
          <div className="border-t border-border p-3">
            <div className="flex items-end gap-2">
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
                className="max-h-28 min-h-[44px] flex-1 resize-none rounded-xl border border-border bg-card px-3 py-3 text-sm text-foreground outline-none focus:ring-bundle/20! focus:border-bundle!"
              />
              <button
                type="button"
                onClick={() => { void handleSend(); }}
                disabled={sending || !text.trim()}
                aria-label="Send"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-bundle text-bundle-foreground disabled:opacity-50"
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
