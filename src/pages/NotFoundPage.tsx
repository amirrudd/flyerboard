import { useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Header } from "../features/layout/Header";
import { ChevronLeft, Compass, ArrowRight } from "lucide-react";

export function NotFoundPage() {
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

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
                        <ChevronLeft className="w-5 h-5" aria-hidden="true" />
                        <span className="hidden sm:inline">Back</span>
                    </button>
                }
                centerNode={
                    <span className="font-display text-lg md:text-xl font-semibold tracking-tight text-foreground truncate">
                        Not Found
                    </span>
                }
                rightNode={<div />}
            />
            <section className="min-h-screen bg-background flex items-center justify-center py-12 pb-bottom-nav md:pb-12">
                <div className="content-max-width mx-auto container-padding w-full">
                    <article className="content-width-reading mx-auto text-center">
                        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-muted/60 ring-1 ring-border/60 mb-8">
                            <Compass className="w-9 h-9 text-muted-foreground/70" strokeWidth={1.5} aria-hidden="true" />
                        </div>

                        <p className="kicker mb-3">Error 404</p>
                        <h1 className="font-display text-4xl sm:text-5xl font-semibold tracking-[-0.02em] leading-[1.05] text-foreground mb-4">
                            We can't find that page
                        </h1>
                        <p className="text-[15px] leading-relaxed text-foreground/80 max-w-prose mx-auto mb-10">
                            The flyer may have been removed, the link may be broken, or the
                            URL might have a typo. Here's how to get back on track.
                        </p>

                        {location.pathname !== '/' && (
                            <p className="kicker text-muted-foreground/70 mb-8 tabular">
                                Requested: {location.pathname}
                            </p>
                        )}

                        <div className="flex flex-col sm:flex-row gap-3 items-center justify-center">
                            <button
                                type="button"
                                onClick={() => navigate('/')}
                                className="inline-flex items-center justify-center gap-2 h-11 px-6 rounded-full bg-primary text-primary-foreground font-semibold shadow-sm shadow-primary/25 hover:bg-primary/90 active:scale-[0.98] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                            >
                                Back to all flyers
                                <ArrowRight className="w-4 h-4" strokeWidth={2.25} aria-hidden="true" />
                            </button>
                            <Link
                                to="/support"
                                className="inline-flex items-center justify-center h-11 px-5 rounded-full bg-muted/40 text-foreground ring-1 ring-border hover:bg-muted/70 hover:ring-foreground/15 active:scale-[0.98] transition-all font-medium text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                            >
                                Contact support
                            </Link>
                        </div>
                    </article>
                </div>
            </section>
        </>
    );
}

export default NotFoundPage;
