import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { MarkdownContent } from "../components/MarkdownContent";
import guidelinesContent from "../content/community-guidelines.md?raw";

export function CommunityGuidelinesPage() {
    const { hash } = useLocation();

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
        <div className="min-h-screen bg-white py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mx-auto">
                <MarkdownContent content={guidelinesContent} />
            </div>
        </div>
    );
}
