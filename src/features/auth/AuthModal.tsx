import { SignInForm } from "./SignInForm";

import { useState } from "react";

interface AuthModalProps {
  showAuthModal: boolean;
  setShowAuthModal: (show: boolean) => void;
}

export function AuthModal({ showAuthModal, setShowAuthModal }: AuthModalProps) {
  const [flow, setFlow] = useState<"signIn" | "signUp">("signIn");

  if (!showAuthModal) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-foreground/40 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in overflow-y-auto"
      onClick={() => setShowAuthModal(false)}
      role="presentation"
    >
      <section
        className="bg-card ring-1 ring-border/70 rounded-2xl shadow-card-hover shadow-2xl p-8 w-full max-w-md transform transition-all my-8 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
      >
        <header className="flex justify-between items-start mb-8 gap-4">
          <div>
            <h2
              id="auth-modal-title"
              className="font-display text-2xl font-semibold tracking-tight text-foreground"
            >
              Welcome
            </h2>
            <p className="text-muted-foreground text-sm mt-1">
              {flow === "signIn"
                ? "Please sign in to continue"
                : "Create an account to get started"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowAuthModal(false)}
            aria-label="Close sign in"
            className="p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors active:scale-[0.98]"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </header>
        <SignInForm flow={flow} setFlow={setFlow} />
      </section>
    </div>
  );
}
