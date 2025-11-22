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
    <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
      <div
        className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl transform transition-all border border-white/20"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-2xl font-bold text-neutral-900">Welcome</h2>
            <p className="text-neutral-500 text-sm mt-1">
              {flow === "signIn"
                ? "Please sign in to continue"
                : "Create an account to get started"}
            </p>
          </div>
          <button
            onClick={() => setShowAuthModal(false)}
            className="p-2 rounded-full hover:bg-neutral-100 text-neutral-400 hover:text-neutral-600 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <SignInForm flow={flow} setFlow={setFlow} />
      </div>
    </div>
  );
}
