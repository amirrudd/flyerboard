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
                        onClick={() => navigate('/')}
                        className="flex items-center gap-2 text-neutral-600 hover:text-neutral-900 transition-colors"
                    >
                        <ChevronLeft className="w-5 h-5" />
                        <span>Back</span>
                    </button>
                }
                centerNode={
                    <h1 className="text-lg md:text-xl font-bold text-gray-900 truncate">Community Guidelines</h1>
                }
                rightNode={<div />}
            />
            <div className="min-h-screen bg-white py-12 px-4 sm:px-6 lg:px-8">
                <div className="max-w-3xl mx-auto">
                    <MarkdownContent content={guidelinesContent} />
                </div>
            </div>
        </>
    );
}

export default CommunityGuidelinesPage;
