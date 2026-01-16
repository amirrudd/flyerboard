import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface BottomSheetProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
}

export function BottomSheet({ isOpen, onClose, title, children }: BottomSheetProps) {
    const sheetRef = useRef<HTMLDivElement>(null);

    // Prevent body scroll when sheet is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    // Close on escape key
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };
        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    // Use Portal to render at document body level, ensuring proper z-index stacking
    return createPortal(
        <div className="fixed inset-0 z-[100] lg:hidden">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 animate-fade-in"
                onClick={onClose}
            />

            {/* Sheet */}
            <div
                ref={sheetRef}
                className="absolute bottom-0 left-0 right-0 bg-card rounded-t-2xl shadow-xl animate-slide-up max-h-[85vh] flex flex-col"
                style={{ paddingBottom: 'calc(var(--safe-area-inset-bottom) + 16px)' }}
            >
                {/* Handle bar */}
                <div className="flex justify-center pt-3 pb-2">
                    <div className="w-12 h-1.5 bg-muted rounded-full" />
                </div>

                {/* Header */}
                <div className="flex items-center justify-between px-4 pb-3 border-b border-border">
                    <h3 className="text-lg font-semibold text-foreground">{title}</h3>
                    <button
                        onClick={onClose}
                        className="p-2 -mr-2 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto overscroll-contain">
                    {children}
                </div>
            </div>
        </div>,
        document.body
    );
}
