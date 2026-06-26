import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useMotionPrefs } from "../hooks/useMotionPrefs";
import { MarkdownContent } from "../components/MarkdownContent";
import { Header } from "../features/layout/Header";
import { ChevronLeft } from 'lucide-react';
import termsContent from "../content/terms-and-conditions.md?raw";
import privacyContent from "../content/privacy-policy.md?raw";

export function TermsPage() {
    const { hash } = useLocation();
    const navigate = useNavigate();
    const { whileInView } = useMotionPrefs();

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
                    <span className="font-display text-lg md:text-xl font-semibold tracking-tight text-foreground truncate">Terms & Privacy</span>
                }
                rightNode={<div />}
            />
            <section className="min-h-screen bg-background py-12 pb-bottom-nav md:pb-12">
                <div className="content-max-width mx-auto container-padding">
                    <article className="content-width-reading mx-auto">

                        <motion.header {...whileInView()} className="mb-10">
                            <h1 className="font-display text-4xl sm:text-5xl font-semibold tracking-[-0.02em] leading-[1.05] text-foreground">
                                Terms & Privacy
                            </h1>
                            <p className="mt-3 text-muted-foreground text-[15px] max-w-prose">
                                Our terms of service and how we handle your data.
                            </p>
                        </motion.header>

                        <motion.nav {...whileInView(0.05)}
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
                        </motion.nav>

                        <motion.section {...whileInView(0.05)} id="terms" className="mb-16 scroll-mt-24">
                            <MarkdownContent content={termsContent} headingShift={1} />
                        </motion.section>

                        <motion.section {...whileInView(0.05)} id="privacy" className="scroll-mt-24">
                            <MarkdownContent content={privacyContent} headingShift={1} />
                        </motion.section>
                    </article>
                </div>
            </section>
        </>
    );
}

export default TermsPage;
