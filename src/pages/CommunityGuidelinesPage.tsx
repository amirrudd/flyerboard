import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { MarkdownContent } from "../components/MarkdownContent";
import { Header } from "../features/layout/Header";
import { ChevronLeft } from 'lucide-react';
import guidelinesContent from "../content/community-guidelines.md?raw";

export function CommunityGuidelinesPage() {
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
                    <h1 className="font-display text-lg md:text-xl font-semibold tracking-tight text-foreground truncate">Community Guidelines</h1>
                }
                rightNode={<div />}
            />
            <main className="min-h-screen bg-background py-12 pb-bottom-nav md:pb-12">
                <div className="content-max-width mx-auto container-padding">
                    <article className="content-width-reading mx-auto">
                        <MarkdownContent content={guidelinesContent} />
                    </article>
                </div>
            </main>
        </>
    );
}

export default CommunityGuidelinesPage;
