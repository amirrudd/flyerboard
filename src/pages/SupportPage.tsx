import { useState, useEffect } from "react";
import { Link, useNavigate, useOutletContext } from "react-router-dom";
import { useSession } from "@descope/react-sdk";
import { useQuery, useMutation } from "convex/react";
import { Envelope, ChatText, FileText, CaretLeft, CheckCircle } from '@phosphor-icons/react';
import { api } from "../../convex/_generated/api";
import { useUserSync } from "../context/UserSyncContext";
import { useHeaderSlots } from "../features/layout/HeaderSlots";

export default function SupportPage() {
    const navigate = useNavigate();
    const { isAuthenticated, isSessionLoading } = useSession();
    const { isUserSynced } = useUserSync();
    const ready = isAuthenticated && !isSessionLoading && isUserSynced;
    const currentUser = useQuery(api.descopeAuth.getCurrentUser, ready ? {} : "skip");
    const submitSupportRequest = useMutation(api.support.submitSupportRequest);
    // Layout owns the single SmsOtpSignIn modal; null when rendered outside the router (tests).
    const layoutCtx = useOutletContext<{ setShowAuthModal: (show: boolean) => void } | null>();

    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    const [formData, setFormData] = useState({
        email: "",
        title: "",
        body: "",
    });
    const [sending, setSending] = useState(false);
    const [sent, setSent] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Account email (SMS OTP signups may not have one — then we ask inline).
    const accountEmail = currentUser?.email?.trim() || "";
    const needsEmailField = ready && currentUser !== undefined && !accountEmail;
    const replyTo = accountEmail || formData.email.trim();

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!isAuthenticated) {
            layoutCtx?.setShowAuthModal(true);
            return;
        }
        if (formData.body.trim().length < 10) {
            setError("Please add a bit more detail so we can help.");
            return;
        }
        setError(null);
        setSending(true);
        submitSupportRequest({
            subject: formData.title.trim(),
            body: formData.body.trim(),
            email: needsEmailField ? formData.email.trim() : undefined,
        })
            .then(() => setSent(true))
            .catch((err: unknown) => {
                const msg = err instanceof Error ? err.message : "";
                setError(
                    /rate limit/i.test(msg)
                        ? "You've sent a few requests recently. Please wait a bit before sending another, or email support@flyerboard.com.au."
                        : "Something went wrong and your request wasn't sent. Please try again, or email us directly at support@flyerboard.com.au."
                );
            })
            .finally(() => setSending(false));
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    // Customise the persistent Layout header (config rebuilt every render by design)
    useHeaderSlots({
        leftNode: (
            <button
                type="button"
                onClick={() => { void navigate('/'); }}
                aria-label="Go back to home"
                className="flex items-center gap-2 h-10 px-3 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/60 active:scale-[0.98] transition-all"
            >
                <CaretLeft className="w-5 h-5" />
                <span className="hidden sm:inline">Back</span>
            </button>
        ),
        centerNode: (
            <span className="font-display text-lg md:text-xl font-semibold tracking-tight text-foreground truncate">Support Center</span>
        ),
        rightNode: <div />,
    });

    return (
        <>
            <section className="min-h-screen bg-background py-12 pb-bottom-nav md:pb-12">
                <div className="content-max-width mx-auto container-padding">
                    <article className="content-width-reading mx-auto space-y-10">
                        <header className="text-center space-y-4">
                            <h1 className="font-display text-4xl sm:text-5xl font-semibold tracking-[-0.02em] leading-[1.05] text-foreground">
                                Support Center
                            </h1>
                            <p className="text-[15px] leading-relaxed text-foreground/80 max-w-xl mx-auto">
                                We're here to help. If you have any issues or questions, please reach out to us directly or fill out the form below.
                            </p>
                        </header>

                        {/* Contact Email Section */}
                        <section
                            aria-labelledby="contact-email-heading"
                            className="bg-card ring-1 ring-border/70 rounded-2xl p-8 text-center shadow-sm"
                        >
                            <div className="flex flex-col items-center gap-4">
                                <div className="p-4 bg-muted/50 ring-1 ring-border/70 rounded-full">
                                    <Envelope className="w-6 h-6 text-primary" aria-hidden="true" />
                                </div>
                                <h2
                                    id="contact-email-heading"
                                    className="font-display text-xl sm:text-2xl font-semibold tracking-tight text-foreground"
                                >
                                    Direct Email
                                </h2>
                                <p className="text-[15px] leading-relaxed text-foreground/80">
                                    For general inquiries, you can email us at:
                                </p>
                                <a
                                    href="mailto:support@flyerboard.com.au"
                                    className="inline-flex items-center gap-2 h-11 px-5 rounded-full bg-primary text-primary-foreground font-semibold shadow-sm shadow-primary/25 hover:bg-primary/90 active:scale-[0.98] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                                >
                                    <Envelope className="w-4 h-4" aria-hidden="true" />
                                    support@flyerboard.com.au
                                </a>
                            </div>
                        </section>

                        {/* Support Form */}
                        <section
                            aria-labelledby="enquiry-heading"
                            className="bg-card ring-1 ring-border/70 rounded-2xl shadow-sm overflow-hidden"
                        >
                            <header className="p-6 border-b border-border">
                                <h2
                                    id="enquiry-heading"
                                    className="font-display text-xl sm:text-2xl font-semibold tracking-tight text-foreground flex items-center gap-2"
                                >
                                    <ChatText className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
                                    Submit an Enquiry
                                </h2>
                            </header>

                            {sent ? (
                                <div className="p-8 flex flex-col items-center text-center gap-3">
                                    <CheckCircle size={32} weight="fill" className="text-primary" aria-hidden="true" />
                                    <h3 tabIndex={-1} className="font-display text-xl font-semibold text-foreground">
                                        Request sent
                                    </h3>
                                    <p className="text-sm text-foreground/80 max-w-sm">
                                        We've got it — expect a reply at {replyTo} within 1–2 business days.
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => { setSent(false); setFormData({ email: "", title: "", body: "" }); }}
                                        className="mt-2 inline-flex items-center justify-center h-11 px-5 rounded-full bg-muted/40 ring-1 ring-border text-foreground font-medium hover:bg-muted/70 active:scale-[0.98] transition-all"
                                    >
                                        Send another request
                                    </button>
                                </div>
                            ) : (
                            <form onSubmit={handleSubmit} className="p-6 space-y-6">
                                {isAuthenticated && accountEmail && (
                                    <p className="text-xs text-muted-foreground">We'll reply to {accountEmail}</p>
                                )}
                                {needsEmailField && (
                                    <div className="space-y-2">
                                        <label htmlFor="email" className="text-sm font-medium text-foreground/80 flex items-center gap-2">
                                            <Envelope className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                                            Email <span className="text-destructive" aria-hidden="true">*</span>
                                        </label>
                                        <input
                                            type="email"
                                            id="email"
                                            name="email"
                                            required
                                            disabled={sending}
                                            value={formData.email}
                                            onChange={handleChange}
                                            className="w-full h-11 px-4 bg-muted/50 rounded-full ring-1 ring-transparent focus:ring-ring focus:bg-card focus:outline-none transition-all text-foreground placeholder:text-muted-foreground/70"
                                            placeholder="your@email.com"
                                        />
                                    </div>
                                )}

                                <div className="space-y-2">
                                    <label htmlFor="title" className="text-sm font-medium text-foreground/80 flex items-center gap-2">
                                        <FileText className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                                        Subject <span className="text-destructive" aria-hidden="true">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        id="title"
                                        name="title"
                                        required
                                        disabled={sending}
                                        value={formData.title}
                                        onChange={handleChange}
                                        className="w-full h-11 px-4 bg-muted/50 rounded-full ring-1 ring-transparent focus:ring-ring focus:bg-card focus:outline-none transition-all text-foreground placeholder:text-muted-foreground/70"
                                        placeholder="Brief summary of your issue"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label htmlFor="body" className="text-sm font-medium text-foreground/80">
                                        Message <span className="text-destructive" aria-hidden="true">*</span>
                                    </label>
                                    <textarea
                                        id="body"
                                        name="body"
                                        required
                                        disabled={sending}
                                        rows={5}
                                        value={formData.body}
                                        onChange={handleChange}
                                        className="w-full px-4 py-3 bg-muted/50 rounded-2xl ring-1 ring-transparent focus:ring-ring focus:bg-card focus:outline-none transition-all resize-none text-foreground placeholder:text-muted-foreground/70"
                                        placeholder="Please describe your issue in detail..."
                                    />
                                </div>

                                {error && (
                                    <p role="alert" className="bg-destructive/10 text-destructive rounded-xl p-3 text-sm">
                                        {error}
                                    </p>
                                )}

                                <div className="pt-2">
                                    <button
                                        type="submit"
                                        disabled={sending}
                                        aria-busy={sending}
                                        className="w-full h-11 px-4 rounded-full bg-primary text-primary-foreground font-semibold shadow-sm shadow-primary/25 hover:bg-primary/90 active:scale-[0.98] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50"
                                    >
                                        {sending ? "Sending…" : isAuthenticated ? "Submit Request" : "Sign in to send"}
                                    </button>
                                    {!isAuthenticated && (
                                        <p className="mt-2 text-center text-xs text-muted-foreground">
                                            No account? Email us at support@flyerboard.com.au instead.
                                        </p>
                                    )}
                                </div>
                            </form>
                            )}
                        </section>

                        {/* Footer Links */}
                        <footer className="pt-8 border-t border-border text-center space-y-4">
                            <p className="text-sm text-muted-foreground">
                                By submitting this form, you agree to our policies.
                            </p>
                            <nav
                                aria-label="Policy links"
                                className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground/70"
                            >
                                <Link to="/community-guidelines" className="hover:text-foreground hover:underline transition-colors">
                                    Community Guidelines
                                </Link>
                                <Link to="/terms" className="hover:text-foreground hover:underline transition-colors">
                                    Terms & Conditions
                                </Link>
                                <Link to="/terms#privacy" className="hover:text-foreground hover:underline transition-colors">
                                    Privacy Policy
                                </Link>
                            </nav>
                        </footer>
                    </article>
                </div>
            </section>
        </>
    );
};
