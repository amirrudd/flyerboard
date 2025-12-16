import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { MarkdownContent } from "../components/MarkdownContent";
import { Header } from "../features/layout/Header";
import { ChevronLeft } from 'lucide-react';
import aboutContent from "../content/about-us.md?raw";

export function AboutUsPage() {
    const navigate = useNavigate();

    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    return (
        <>
            <Header
                leftNode={
                    <button
                        onClick={() => navigate('/')}
                        className="flex items-center gap-2 text-neutral-600 hover:text-neutral-900 transition-colors"
                    >
                        <ChevronLeft className="w-5 h-5" />
                        <span className="hidden sm:inline">Back</span>
                    </button>
                }
                centerNode={
                    <h1 className="text-lg md:text-xl font-bold text-gray-900 truncate">About Us</h1>
                }
                rightNode={<div />}
            />
            <div className="min-h-screen bg-white py-12 px-4 sm:px-6 lg:px-8">
                <div className="max-w-3xl mx-auto">
                    {/* Logo Hero */}
                    <div className="flex justify-center mb-8">
                        <img
                            src="/icons/icon-512x512.png"
                            alt="FlyerBoard Logo"
                            className="w-32 h-32"
                        />
                    </div>
                    <MarkdownContent content={aboutContent} />
                </div>
            </div>
        </>
    );
}

export default AboutUsPage;
