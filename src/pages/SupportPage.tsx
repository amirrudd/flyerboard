import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Mail, MessageSquare, User, FileText, ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { Header } from "../features/layout/Header";
import { logDebug } from "../lib/logger";

export default function SupportPage() {
    const navigate = useNavigate();

    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    const [formData, setFormData] = useState({
        name: "",
        email: "",
        title: "",
        body: "",
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // In a real app, this would send data to a backend
        logDebug("Support request submitted:", formData);
        toast.success("Support request submitted successfully! We'll get back to you soon.");
        setFormData({ name: "", email: "", title: "", body: "" });
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

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
                    <h1 className="font-display text-lg md:text-xl font-semibold tracking-tight text-foreground truncate">Support Center</h1>
                }
                rightNode={<div />}
            />
            <main className="min-h-screen bg-background py-12 pb-bottom-nav md:pb-12">
                <div className="content-max-width mx-auto container-padding">
                    <article className="content-width-reading mx-auto space-y-10">
                        <header className="text-center space-y-4">
                            <p className="text-[15px] leading-relaxed text-foreground/80 max-w-xl mx-auto">
                                We're here to help. If you have any issues or questions, please reach out to us directly or fill out the form below.
                            </p>
                        </header>

                        {/* Contact Email Section */}
                        <section
                            aria-labelledby="contact-email-heading"
                            className="bg-card ring-1 ring-border/70 rounded-2xl p-8 text-center shadow-sm"
                        >
                            <div className="flex flex-col items-center gap-4">
                                <div className="p-4 bg-muted/50 ring-1 ring-border/70 rounded-full">
                                    <Mail className="w-6 h-6 text-primary" aria-hidden="true" />
                                </div>
                                <h2
                                    id="contact-email-heading"
                                    className="font-display text-xl sm:text-2xl font-semibold tracking-tight text-foreground"
                                >
                                    Direct Email
                                </h2>
                                <p className="text-[15px] leading-relaxed text-foreground/80">
                                    For general inquiries, you can email us at:
                                </p>
                                <a
                                    href="mailto:support@flyerboard.com.au"
                                    className="inline-flex items-center gap-2 h-11 px-5 rounded-full bg-primary text-primary-foreground font-semibold shadow-sm shadow-primary/25 hover:bg-primary/90 active:scale-[0.98] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                                >
                                    <Mail className="w-4 h-4" aria-hidden="true" />
                                    support@flyerboard.com.au
                                </a>
                            </div>
                        </section>

                        {/* Support Form */}
                        <section
                            aria-labelledby="enquiry-heading"
                            className="bg-card ring-1 ring-border/70 rounded-2xl shadow-sm overflow-hidden"
                        >
                            <header className="p-6 border-b border-border">
                                <h2
                                    id="enquiry-heading"
                                    className="font-display text-xl sm:text-2xl font-semibold tracking-tight text-foreground flex items-center gap-2"
                                >
                                    <MessageSquare className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
                                    Submit an Enquiry
                                </h2>
                            </header>

                            <form onSubmit={handleSubmit} className="p-6 space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label htmlFor="name" className="text-sm font-medium text-foreground/80 flex items-center gap-2">
                                            <User className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                                            Name <span className="text-destructive" aria-hidden="true">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            id="name"
                                            name="name"
                                            required
                                            value={formData.name}
                                            onChange={handleChange}
                                            className="w-full h-11 px-4 bg-muted/50 rounded-full ring-1 ring-transparent focus:ring-ring focus:bg-card focus:outline-none transition-all text-foreground placeholder:text-muted-foreground/70"
                                            placeholder="Your full name"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label htmlFor="email" className="text-sm font-medium text-foreground/80 flex items-center gap-2">
                                            <Mail className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                                            Email <span className="text-destructive" aria-hidden="true">*</span>
                                        </label>
                                        <input
                                            type="email"
                                            id="email"
                                            name="email"
                                            required
                                            value={formData.email}
                                            onChange={handleChange}
                                            className="w-full h-11 px-4 bg-muted/50 rounded-full ring-1 ring-transparent focus:ring-ring focus:bg-card focus:outline-none transition-all text-foreground placeholder:text-muted-foreground/70"
                                            placeholder="your@email.com"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label htmlFor="title" className="text-sm font-medium text-foreground/80 flex items-center gap-2">
                                        <FileText className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                                        Subject <span className="text-destructive" aria-hidden="true">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        id="title"
                                        name="title"
                                        required
                                        value={formData.title}
                                        onChange={handleChange}
                                        className="w-full h-11 px-4 bg-muted/50 rounded-full ring-1 ring-transparent focus:ring-ring focus:bg-card focus:outline-none transition-all text-foreground placeholder:text-muted-foreground/70"
                                        placeholder="Brief summary of your issue"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label htmlFor="body" className="text-sm font-medium text-foreground/80">
                                        Message <span className="text-destructive" aria-hidden="true">*</span>
                                    </label>
                                    <textarea
                                        id="body"
                                        name="body"
                                        required
                                        rows={5}
                                        value={formData.body}
                                        onChange={handleChange}
                                        className="w-full px-4 py-3 bg-muted/50 rounded-2xl ring-1 ring-transparent focus:ring-ring focus:bg-card focus:outline-none transition-all resize-none text-foreground placeholder:text-muted-foreground/70"
                                        placeholder="Please describe your issue in detail..."
                                    />
                                </div>

                                <div className="pt-2">
                                    <button
                                        type="submit"
                                        className="w-full h-11 px-4 rounded-full bg-primary text-primary-foreground font-semibold shadow-sm shadow-primary/25 hover:bg-primary/90 active:scale-[0.98] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                                    >
                                        Submit Request
                                    </button>
                                </div>
                            </form>
                        </section>

                        {/* Footer Links */}
                        <footer className="pt-8 border-t border-border text-center space-y-4">
                            <p className="text-sm text-muted-foreground">
                                By submitting this form, you agree to our policies.
                            </p>
                            <nav
                                aria-label="Policy links"
                                className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground/70"
                            >
                                <Link to="/community-guidelines" className="hover:text-foreground hover:underline transition-colors">
                                    Community Guidelines
                                </Link>
                                <Link to="/terms" className="hover:text-foreground hover:underline transition-colors">
                                    Terms & Conditions
                                </Link>
                                <Link to="/terms#privacy" className="hover:text-foreground hover:underline transition-colors">
                                    Privacy Policy
                                </Link>
                            </nav>
                        </footer>
                    </article>
                </div>
            </main>
        </>
    );
};
