import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { MarkdownContent } from "../components/MarkdownContent";
import { Header } from "../features/layout/Header";
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
                        onClick={() => navigate(-1)}
                        className="flex items-center gap-2 text-gray-700 hover:text-gray-900 transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        <span className="hidden md:inline">Back</span>
                    </button>
                }
                centerNode={
                    <h1 className="text-lg md:text-xl font-bold text-gray-900 truncate">Terms & Privacy</h1>
                }
                rightNode={<div />}
            />
            <div className="min-h-screen bg-white py-12 px-4 sm:px-6 lg:px-8">
                <div className="max-w-3xl mx-auto">

                    <div className="bg-neutral-50 p-6 rounded-xl border border-neutral-200 mb-12">
                        <h2 className="text-xl font-semibold mb-4 mt-0">Table of Contents</h2>
                        <ul className="list-none pl-0 space-y-2">
                            <li><a href="#terms" className="text-primary-600 hover:underline">Terms and Conditions</a></li>
                            <li><a href="#privacy" className="text-primary-600 hover:underline">Privacy Policy</a></li>
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
        </>
    );
}

export default TermsPage;
