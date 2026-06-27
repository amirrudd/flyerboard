import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useMotionPrefs } from "../hooks/useMotionPrefs";
import { MarkdownContent } from "../components/MarkdownContent";
import { Header } from "../features/layout/Header";
import { CaretLeft } from '@phosphor-icons/react';
import guidelinesContent from "../content/community-guidelines.md?raw";

export function CommunityGuidelinesPage() {
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
                        <CaretLeft className="w-5 h-5" />
                        <span className="hidden sm:inline">Back</span>
                    </button>
                }
                centerNode={
                    <span className="font-display text-lg md:text-xl font-semibold tracking-tight text-foreground truncate">Community Guidelines</span>
                }
                rightNode={<div />}
            />
            <section className="min-h-screen bg-background py-12 pb-bottom-nav md:pb-12">
                <div className="content-max-width mx-auto container-padding">
                    <article className="content-width-reading mx-auto">
                        <motion.div {...whileInView()}>
                            <MarkdownContent content={guidelinesContent} />
                        </motion.div>
                    </article>
                </div>
            </section>
        </>
    );
}

export default CommunityGuidelinesPage;
