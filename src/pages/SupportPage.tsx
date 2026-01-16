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
                        onClick={() => navigate('/')}
                        className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <ChevronLeft className="w-5 h-5" />
                        <span className="hidden sm:inline">Back</span>
                    </button>
                }
                centerNode={
                    <h1 className="text-lg md:text-xl font-bold text-foreground truncate">Support Center</h1>
                }
                rightNode={<div />}
            />
            <div className="min-h-screen bg-background py-12 pb-bottom-nav md:pb-12">
                <div className="content-max-width mx-auto container-padding">
                    <div className="content-width-reading mx-auto space-y-8">
                        <div className="text-center space-y-4">
                            <p className="text-muted-foreground max-w-xl mx-auto">
                                We're here to help. If you have any issues or questions, please reach out to us directly or fill out the form below.
                            </p>
                        </div>

                        {/* Contact Email Section */}
                        <div className="bg-muted/50 border border-border rounded-xl p-6 text-center">
                            <div className="flex flex-col items-center gap-3">
                                <div className="p-3 bg-card rounded-full shadow-sm">
                                    <Mail className="w-6 h-6 text-primary" />
                                </div>
                                <h2 className="text-lg font-semibold text-foreground">Direct Email</h2>
                                <p className="text-muted-foreground">
                                    For general inquiries, you can email us at:
                                </p>
                                <a
                                    href="mailto:support@flyerboard.com.au"
                                    className="text-primary-bright font-medium hover:opacity-80 hover:underline text-lg"
                                >
                                    support@flyerboard.com.au
                                </a>
                            </div>
                        </div>

                        {/* Support Form */}
                        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
                            <div className="p-6 border-b border-border">
                                <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
                                    <MessageSquare className="w-5 h-5 text-muted-foreground" />
                                    Submit an Enquiry
                                </h2>
                            </div>

                            <form onSubmit={handleSubmit} className="p-6 space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label htmlFor="name" className="text-sm font-medium text-foreground/80 flex items-center gap-2">
                                            <User className="w-4 h-4 text-muted-foreground" />
                                            Name <span className="text-destructive">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            id="name"
                                            name="name"
                                            required
                                            value={formData.name}
                                            onChange={handleChange}
                                            className="w-full px-3 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all bg-background text-foreground placeholder:text-muted-foreground"
                                            placeholder="Your full name"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label htmlFor="email" className="text-sm font-medium text-foreground/80 flex items-center gap-2">
                                            <Mail className="w-4 h-4 text-muted-foreground" />
                                            Email <span className="text-destructive">*</span>
                                        </label>
                                        <input
                                            type="email"
                                            id="email"
                                            name="email"
                                            required
                                            value={formData.email}
                                            onChange={handleChange}
                                            className="w-full px-3 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all bg-background text-foreground placeholder:text-muted-foreground"
                                            placeholder="your@email.com"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label htmlFor="title" className="text-sm font-medium text-foreground/80 flex items-center gap-2">
                                        <FileText className="w-4 h-4 text-muted-foreground" />
                                        Subject <span className="text-destructive">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        id="title"
                                        name="title"
                                        required
                                        value={formData.title}
                                        onChange={handleChange}
                                        className="w-full px-3 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all bg-background text-foreground placeholder:text-muted-foreground"
                                        placeholder="Brief summary of your issue"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label htmlFor="body" className="text-sm font-medium text-foreground/80">
                                        Message <span className="text-destructive">*</span>
                                    </label>
                                    <textarea
                                        id="body"
                                        name="body"
                                        required
                                        rows={5}
                                        value={formData.body}
                                        onChange={handleChange}
                                        className="w-full px-3 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all resize-none bg-background text-foreground placeholder:text-muted-foreground"
                                        placeholder="Please describe your issue in detail..."
                                    />
                                </div>

                                <div className="pt-2">
                                    <button
                                        type="submit"
                                        className="w-full bg-primary text-white font-medium py-2.5 px-4 rounded-lg hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-colors shadow-sm"
                                    >
                                        Submit Request
                                    </button>
                                </div>
                            </form>
                        </div>

                        {/* Footer Links */}
                        <div className="pt-8 border-t border-border text-center space-y-4">
                            <p className="text-sm text-muted-foreground">
                                By submitting this form, you agree to our policies.
                            </p>
                            <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground/60">
                                <Link to="/community-guidelines" className="hover:text-foreground hover:underline transition-colors">
                                    Community Guidelines
                                </Link>
                                <Link to="/terms" className="hover:text-foreground hover:underline transition-colors">
                                    Terms & Conditions
                                </Link>
                                <Link to="/terms#privacy" className="hover:text-foreground hover:underline transition-colors">
                                    Privacy Policy
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};
