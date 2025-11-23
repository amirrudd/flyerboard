import { useState } from "react";
import { toast } from "sonner";

export function ComingSoon() {
    const [email, setEmail] = useState("");

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!email) {
            toast.error("Please enter your email address");
            return;
        }
        // Simulate API call
        setTimeout(() => {
            toast.success("Thank you! We'll notify you when we launch.");
            setEmail("");
        }, 1000);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col items-center justify-center p-4 text-center">
            <div className="max-w-2xl w-full space-y-8 animate-in fade-in zoom-in duration-700">
                {/* Logo or Brand Placeholder */}
                <div className="mx-auto w-20 h-20 bg-primary/10 rounded-2xl flex items-center justify-center mb-8 rotate-3 hover:rotate-6 transition-transform duration-300">
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="w-10 h-10 text-primary"
                    >
                        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                    </svg>
                </div>

                <div className="space-y-4">
                    <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-gray-900 font-display">
                        Coming Soon
                    </h1>
                    <p className="text-lg md:text-xl text-gray-600 max-w-lg mx-auto leading-relaxed">
                        We're crafting something extraordinary. Be the first to know when we launch.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="max-w-md mx-auto w-full flex flex-col sm:flex-row gap-3">
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Enter your email address"
                        className="flex-1 px-5 py-3 rounded-xl border border-gray-200 bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm"
                    />
                    <button
                        type="submit"
                        className="px-8 py-3 rounded-xl bg-primary text-white font-medium hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all shadow-lg shadow-primary/20 active:scale-95"
                    >
                        Notify Me
                    </button>
                </form>

                <div className="pt-12 flex items-center justify-center gap-6 text-gray-400">
                    <div className="h-px w-12 bg-gray-200"></div>
                    <span className="text-sm uppercase tracking-widest font-medium">Stay Tuned</span>
                    <div className="h-px w-12 bg-gray-200"></div>
                </div>
            </div>
        </div>
    );
}
