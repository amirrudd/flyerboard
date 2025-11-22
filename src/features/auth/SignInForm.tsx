"use client";
import { useAuthActions } from "@convex-dev/auth/react";
import { useState } from "react";
import { toast } from "sonner";
import { Mail, Lock, ArrowRight, Loader2 } from "lucide-react";

interface SignInFormProps {
  flow: "signIn" | "signUp";
  setFlow: (flow: "signIn" | "signUp") => void;
}

export function SignInForm({ flow, setFlow }: SignInFormProps) {
  const { signIn } = useAuthActions();
  const [submitting, setSubmitting] = useState(false);

  return (
    <div className="w-full">
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          setSubmitting(true);
          const formData = new FormData(e.target as HTMLFormElement);
          formData.set("flow", flow);
          void signIn("password", formData).catch((error) => {
            console.error("Sign in/up error:", error);
            let toastTitle = "";
            if (error.message.includes("A user with this email already exists")) {
              toastTitle = "A user with this email already exists. Please sign in.";
            } else if (error.message.includes("Invalid password")) {
              if (flow === "signUp") {
                toastTitle = "Account may already exist. Please try signing in.";
              } else {
                toastTitle = "Invalid password. Please try again.";
              }
            } else {
              toastTitle =
                flow === "signIn"
                  ? "Incorrect email or password. Please try again."
                  : "Could not sign up, did you mean to sign in?";
            }
            toast.error(toastTitle);
            setSubmitting(false);
          });
        }}
      >
        <div className="space-y-4">
          <div className="relative group">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400 group-focus-within:text-primary-500 transition-colors" />
            <input
              className="auth-input-field pl-12"
              type="email"
              name="email"
              placeholder="Email address"
              required
            />
          </div>
          <div className="relative group">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400 group-focus-within:text-primary-500 transition-colors" />
            <input
              className="auth-input-field pl-12"
              type="password"
              name="password"
              placeholder="Password"
              required
            />
          </div>
        </div>

        <button
          className="auth-button flex items-center justify-center gap-2 mt-2 group"
          type="submit"
          disabled={submitting}
        >
          {submitting ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              {flow === "signIn" ? "Sign in" : "Create account"}
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </>
          )}
        </button>

        <div className="text-center text-sm text-neutral-500 mt-4">
          <span>
            {flow === "signIn"
              ? "Don't have an account? "
              : "Already have an account? "}
          </span>
          <button
            type="button"
            className="text-primary-600 hover:text-primary-700 font-semibold hover:underline cursor-pointer transition-colors ml-1"
            onClick={() => setFlow(flow === "signIn" ? "signUp" : "signIn")}
          >
            {flow === "signIn" ? "Sign up" : "Sign in"}
          </button>
        </div>
        {flow === "signUp" && (
          <p className="text-xs text-neutral-500 mt-2">
            By signing up you agree to our <a href="/terms" className="text-primary-600 hover:underline">Terms &amp; Conditions</a> and <a href="/terms#privacy" className="text-primary-600 hover:underline">Privacy Policy</a>.
          </p>
        )}
      </form>

    </div>
  );
}
