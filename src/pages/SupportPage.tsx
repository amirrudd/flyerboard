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
                        className="flex items-center gap-2 text-neutral-600 hover:text-neutral-900 transition-colors"
                    >
                        <ChevronLeft className="w-5 h-5" />
                        <span className="hidden sm:inline">Back</span>
                    </button>
                }
                centerNode={
                    <h1 className="text-lg md:text-xl font-bold text-gray-900 truncate">Support Center</h1>
                }
                rightNode={<div />}
            />
            <div className="min-h-screen bg-white py-12 px-4 sm:px-6 lg:px-8 pb-bottom-nav md:pb-12">
                <div className="max-w-3xl mx-auto space-y-8">
                    <div className="text-center space-y-4">
                        <p className="text-gray-600 max-w-xl mx-auto">
                            We're here to help. If you have any issues or questions, please reach out to us directly or fill out the form below.
                        </p>
                    </div>

                    {/* Contact Email Section */}
                    <div className="bg-primary-50 border border-primary-100 rounded-xl p-6 text-center">
                        <div className="flex flex-col items-center gap-3">
                            <div className="p-3 bg-white rounded-full shadow-sm">
                                <Mail className="w-6 h-6 text-primary-600" />
                            </div>
                            <h2 className="text-lg font-semibold text-gray-900">Direct Email</h2>
                            <p className="text-gray-600">
                                For general inquiries, you can email us at:
                            </p>
                            <a
                                href="mailto:support@flyerboard.com.au"
                                className="text-primary-600 font-medium hover:text-primary-700 hover:underline text-lg"
                            >
                                support@flyerboard.com.au
                            </a>
                        </div>
                    </div>

                    {/* Support Form */}
                    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                        <div className="p-6 border-b border-gray-100">
                            <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                                <MessageSquare className="w-5 h-5 text-gray-500" />
                                Submit an Enquiry
                            </h2>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label htmlFor="name" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                                        <User className="w-4 h-4 text-gray-400" />
                                        Name <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        id="name"
                                        name="name"
                                        required
                                        value={formData.name}
                                        onChange={handleChange}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                                        placeholder="Your full name"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label htmlFor="email" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                                        <Mail className="w-4 h-4 text-gray-400" />
                                        Email <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="email"
                                        id="email"
                                        name="email"
                                        required
                                        value={formData.email}
                                        onChange={handleChange}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                                        placeholder="your@email.com"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label htmlFor="title" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                                    <FileText className="w-4 h-4 text-gray-400" />
                                    Subject <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    id="title"
                                    name="title"
                                    required
                                    value={formData.title}
                                    onChange={handleChange}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                                    placeholder="Brief summary of your issue"
                                />
                            </div>

                            <div className="space-y-2">
                                <label htmlFor="body" className="text-sm font-medium text-gray-700">
                                    Message <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    id="body"
                                    name="body"
                                    required
                                    rows={5}
                                    value={formData.body}
                                    onChange={handleChange}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all resize-none"
                                    placeholder="Please describe your issue in detail..."
                                />
                            </div>

                            <div className="pt-2">
                                <button
                                    type="submit"
                                    className="w-full bg-primary-600 text-white font-medium py-2.5 px-4 rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors shadow-sm"
                                >
                                    Submit Request
                                </button>
                            </div>
                        </form>
                    </div>

                    {/* Footer Links */}
                    <div className="pt-8 border-t border-gray-100 text-center space-y-4">
                        <p className="text-sm text-gray-500">
                            By submitting this form, you agree to our policies.
                        </p>
                        <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs text-gray-400">
                            <Link to="/community-guidelines" className="hover:text-gray-600 hover:underline transition-colors">
                                Community Guidelines
                            </Link>
                            <Link to="/terms" className="hover:text-gray-600 hover:underline transition-colors">
                                Terms & Conditions
                            </Link>
                            <Link to="/terms#privacy" className="hover:text-gray-600 hover:underline transition-colors">
                                Privacy Policy
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};
