import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery } from "convex/react";
import { useSession } from "@descope/react-sdk";
import { X, CircleNotch } from "@phosphor-icons/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useUserSync } from "../../context/UserSyncContext";
import { useScrollLock } from "../../hooks/useScrollLock";
import { AuthModal } from "../auth/AuthModal";
import { MessageBubble, MessageComposer } from "../messages";

interface BundleMessageModalProps {
  bundleId: Id<"saleBundles">;
  sellerName: string | null;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Bundle-level message thread. The modal shell mirrors SaleMessageModal, but
 * unlike it there are no item chips (a bundle IS the package — the
 * conversation is about the deal itself), so the body composes directly from
 * the shared chat library (`MessageBubble` + `MessageComposer`) instead of
 * hand-rolling bubbles and a composer. One conversation per buyer per bundle;
 * also surfaces in the unified inbox.
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

  const [showAuth, setShowAuth] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { lockScroll, unlockScroll } = useScrollLock();

  const sellerFirst = (sellerName ?? "the seller").split(" ")[0];

  // Keep the thread scrolled to the latest message.
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [thread]);

  // Body scroll lock + Esc.
  useEffect(() => {
    if (!isOpen) return;
    lockScroll();
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onEsc);
    return () => {
      unlockScroll();
      document.removeEventListener("keydown", onEsc);
    };
  }, [isOpen, onClose, lockScroll, unlockScroll]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-foreground/40 backdrop-blur-sm sm:items-center"
      onClick={onClose}
      role="presentation"
    >
      <section
        className="flex h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl bg-card shadow-2xl ring-1 ring-border/70 sm:h-[600px] sm:rounded-2xl"
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
              <MessageBubble
                key={m._id}
                content={m.content}
                timestamp={m.timestamp}
                isOwn={m.mine}
              />
            ))
          ) : (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <p className="text-sm text-muted-foreground">
                Start the conversation — take the deal or make an offer on the set.
              </p>
            </div>
          )}
        </div>

        {/* Composer — the shared one, so send semantics can't drift from the inbox. */}
        {ready && (
          <MessageComposer
            onSend={async (content) => {
              await sendMessage({ bundleId, content });
            }}
            placeholder={`Message ${sellerFirst}…`}
          />
        )}
      </section>

      <AuthModal showAuthModal={showAuth} setShowAuthModal={setShowAuth} />
    </div>,
    document.body
  );
}
