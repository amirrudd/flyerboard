import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { MarkdownContent } from "../components/MarkdownContent";
import { Header } from "../features/layout/Header";
import { ChevronLeft } from 'lucide-react';
import termsContent from "../content/terms-and-conditions.md?raw";
import privacyContent from "../content/privacy-policy.md?raw";

export function TermsPage() {
    const { hash } = useLocation();
    const navigate = useNavigate();

    useEffect(() => {
        if (hash) {
            const element = document.getElementById(hash.replace("#", ""));
            if (element) {
                element.scrollIntoView({ behavior: "smooth" });
            }
        } else {
            window.scrollTo(0, 0);
        }
    }, [hash]);

    return (
        <>
            <Header
                leftNode={
                    <button
                        type="button"
                        onClick={() => navigate('/')}
                        aria-label="Go back to home"
                        className="flex items-center gap-2 h-10 px-3 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/60 active:scale-[0.98] transition-all"
                    >
                        <ChevronLeft className="w-5 h-5" />
                        <span className="hidden sm:inline">Back</span>
                    </button>
                }
                centerNode={
                    <h1 className="font-display text-lg md:text-xl font-semibold tracking-tight text-foreground truncate">Terms & Privacy</h1>
                }
                rightNode={<div />}
            />
            <main className="min-h-screen bg-background py-12 pb-bottom-nav md:pb-12">
                <div className="content-max-width mx-auto container-padding">
                    <article className="content-width-reading mx-auto">

                        <nav
                            aria-label="Table of contents"
                            className="bg-card ring-1 ring-border/70 rounded-2xl p-6 mb-12 shadow-sm"
                        >
                            <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-4">
                                Table of Contents
                            </h2>
                            <ul className="list-none pl-0 space-y-2">
                                <li>
                                    <a
                                        href="#terms"
                                        className="text-primary font-medium hover:underline underline-offset-2"
                                    >
                                        Terms and Conditions
                                    </a>
                                </li>
                                <li>
                                    <a
                                        href="#privacy"
                                        className="text-primary font-medium hover:underline underline-offset-2"
                                    >
                                        Privacy Policy
                                    </a>
                                </li>
                            </ul>
                        </nav>

                        <section id="terms" className="mb-16 scroll-mt-24">
                            <MarkdownContent content={termsContent} />
                        </section>

                        <section id="privacy" className="scroll-mt-24">
                            <MarkdownContent content={privacyContent} />
                        </section>
                    </article>
                </div>
            </main>
        </>
    );
}

export default TermsPage;
