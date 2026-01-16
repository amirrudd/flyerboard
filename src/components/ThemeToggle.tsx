import { Moon, Sun, Laptop } from "lucide-react";
import { useTheme } from "./ThemeProvider";
import { useState, useRef, useEffect } from "react";

type Theme = "dark" | "light" | "system";

const themeConfig: Record<Theme, { icon: typeof Sun; label: string }> = {
    light: { icon: Sun, label: "Light Mode" },
    system: { icon: Laptop, label: "System Preference" },
    dark: { icon: Moon, label: "Dark Mode" },
};

const themeOrder: Theme[] = ["light", "system", "dark"];

export function ThemeToggle() {
    const { theme, setTheme } = useTheme();
    const [isExpanded, setIsExpanded] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsExpanded(false);
            }
        }
        if (isExpanded) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isExpanded]);

    const handleThemeSelect = (newTheme: Theme) => {
        setTheme(newTheme);
        setIsExpanded(false);
    };

    // Get ordered themes with current theme first
    const orderedThemes = [theme, ...themeOrder.filter(t => t !== theme)];

    return (
        <>
            {/* Desktop: Horizontal toggle */}
            <div className="hidden sm:flex items-center gap-1 p-1 bg-muted/50 rounded-full border border-border">
                {themeOrder.map((t) => {
                    const Icon = themeConfig[t].icon;
                    return (
                        <button
                            key={t}
                            onClick={() => setTheme(t)}
                            className={`p-1.5 rounded-full transition-all ${theme === t
                                ? "bg-background text-primary shadow-sm"
                                : "text-muted-foreground hover:text-foreground"
                                }`}
                            title={themeConfig[t].label}
                        >
                            <Icon size={16} />
                        </button>
                    );
                })}
            </div>

            {/* Mobile: Unified vertical toggle that morphs from plain icon to vertical pill */}
            <div className="sm:hidden w-10 h-10 relative">
                <div
                    ref={containerRef}
                    onClick={() => !isExpanded && setIsExpanded(true)}
                    className={`absolute top-0 left-0 w-10 flex flex-col items-center transition-all duration-300 ease-out cursor-pointer origin-top z-50 ${isExpanded
                        ? "bg-muted/90 backdrop-blur-md border border-border p-1 gap-1.5 rounded-[20px] shadow-xl text-foreground"
                        : "bg-transparent border-transparent p-1 gap-0 rounded-lg hover:bg-muted text-foreground/70"
                        }`}
                    style={{
                        height: isExpanded ? "128px" : "40px",
                    }}
                    role="group"
                    aria-label="Theme selector"
                >
                    {orderedThemes.map((t, index) => {
                        const Icon = themeConfig[t].icon;
                        const isSelected = theme === t;
                        const isFirst = index === 0;

                        // In collapsed state, only show the first item (current theme)
                        const isVisible = isExpanded || isFirst;

                        return (
                            <button
                                key={t}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (isExpanded) {
                                        handleThemeSelect(t);
                                    } else {
                                        setIsExpanded(true);
                                    }
                                }}
                                className={`flex items-center justify-center w-8 h-8 transition-all duration-300 ${isSelected && isExpanded
                                    ? "bg-background text-primary shadow-sm rounded-full"
                                    : isSelected && !isExpanded
                                        ? "text-inherit"
                                        : "text-muted-foreground hover:text-foreground hover:bg-background/30 rounded-full"
                                    } ${!isVisible && "hidden"}`}
                                style={{
                                    opacity: isVisible ? 1 : 0,
                                    transform: isVisible ? "scale(1)" : "scale(0.8)",
                                    transitionDelay: isExpanded && !isFirst ? `${index * 40}ms` : "0ms",
                                }}
                                title={themeConfig[t].label}
                                aria-pressed={isSelected}
                            >
                                <Icon size={20} />
                            </button>
                        );
                    })}
                </div>
            </div>
        </>
    );
}
