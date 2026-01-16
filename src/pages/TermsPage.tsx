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
                        onClick={() => navigate('/')}
                        className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <ChevronLeft className="w-5 h-5" />
                        <span className="hidden sm:inline">Back</span>
                    </button>
                }
                centerNode={
                    <h1 className="text-lg md:text-xl font-bold text-foreground truncate">Terms & Privacy</h1>
                }
                rightNode={<div />}
            />
            <div className="min-h-screen bg-background py-12 pb-bottom-nav md:pb-12">
                <div className="content-max-width mx-auto container-padding">
                    <div className="content-width-reading mx-auto">

                        <div className="bg-muted/50 p-6 rounded-xl border border-border mb-12">
                            <h2 className="text-xl font-semibold mb-4 mt-0 text-foreground">Table of Contents</h2>
                            <ul className="list-none pl-0 space-y-2">
                                <li><a href="#terms" className="text-primary-bright hover:underline">Terms and Conditions</a></li>
                                <li><a href="#privacy" className="text-primary-bright hover:underline">Privacy Policy</a></li>
                            </ul>
                        </div>

                        <section id="terms" className="mb-16 scroll-mt-24">
                            <MarkdownContent content={termsContent} />
                        </section>

                        <section id="privacy" className="scroll-mt-24">
                            <MarkdownContent content={privacyContent} />
                        </section>
                    </div>
                </div>
            </div>
        </>
    );
}

export default TermsPage;
