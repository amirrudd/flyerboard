import { createPortal } from "react-dom";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { ImageDisplay } from "./ImageDisplay";
import { useEffect } from "react";

interface ImageLightboxProps {
    images: string[];
    currentIndex: number;
    isOpen: boolean;
    onClose: () => void;
    onNavigate: (index: number) => void;
    altPrefix?: string;
}

export function ImageLightbox({
    images,
    currentIndex,
    isOpen,
    onClose,
    onNavigate,
    altPrefix = "Image",
}: ImageLightboxProps) {
    // Handle keyboard navigation
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                onClose();
            } else if (e.key === "ArrowLeft" && currentIndex > 0) {
                onNavigate(currentIndex - 1);
            } else if (e.key === "ArrowRight" && currentIndex < images.length - 1) {
                onNavigate(currentIndex + 1);
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, currentIndex, images.length, onClose, onNavigate]);

    // Prevent body scroll when lightbox is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "";
        }
        return () => {
            document.body.style.overflow = "";
        };
    }, [isOpen]);

    if (!isOpen) return null;

    const handlePrevious = () => {
        if (currentIndex > 0) {
            onNavigate(currentIndex - 1);
        }
    };

    const handleNext = () => {
        if (currentIndex < images.length - 1) {
            onNavigate(currentIndex + 1);
        }
    };

    return createPortal(
        <div
            className="fixed inset-0 bg-black/95 backdrop-blur-sm z-50 flex items-center justify-center"
            onClick={onClose}
        >
            {/* Close button */}
            <button
                onClick={onClose}
                className="absolute top-4 right-4 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-all shadow-lg border border-white/20 backdrop-blur-sm z-10"
                aria-label="Close lightbox"
            >
                <X className="w-6 h-6" />
            </button>

            {/* Image counter */}
            {images.length > 1 && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/50 text-white px-4 py-2 rounded-full text-sm font-medium">
                    {currentIndex + 1} / {images.length}
                </div>
            )}

            {/* Main image container */}
            <div
                className="relative w-full h-full flex items-center justify-center px-4 sm:px-8 pt-16 pb-28 sm:pb-32"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="relative w-full h-full flex items-center justify-center">
                    <ImageDisplay
                        imageRef={images[currentIndex]}
                        alt={`${altPrefix} ${currentIndex + 1}`}
                        className="w-full h-full object-contain"
                    />
                </div>

                {/* Navigation buttons */}
                {images.length > 1 && (
                    <>
                        <button
                            onClick={handlePrevious}
                            disabled={currentIndex === 0}
                            className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/50 text-white hover:bg-black/70 transition-all shadow-lg border border-white/20 backdrop-blur-sm disabled:opacity-30 disabled:cursor-not-allowed"
                            aria-label="Previous image"
                        >
                            <ChevronLeft className="w-6 h-6" />
                        </button>
                        <button
                            onClick={handleNext}
                            disabled={currentIndex === images.length - 1}
                            className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/50 text-white hover:bg-black/70 transition-all shadow-lg border border-white/20 backdrop-blur-sm disabled:opacity-30 disabled:cursor-not-allowed"
                            aria-label="Next image"
                        >
                            <ChevronRight className="w-6 h-6" />
                        </button>
                    </>
                )}
            </div>

            {/* Thumbnail strip */}
            {images.length > 1 && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 max-w-full px-4">
                    <div className="flex gap-2 overflow-x-auto pb-2 max-w-screen-lg">
                        {images.map((image, index) => (
                            <button
                                key={index}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onNavigate(index);
                                }}
                                className={`flex-shrink-0 w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden border-2 transition-all ${index === currentIndex
                                    ? "border-primary-600 ring-2 ring-primary-600 ring-opacity-50"
                                    : "border-white/30 hover:border-white/60"
                                    }`}
                            >
                                <ImageDisplay
                                    imageRef={image}
                                    alt={`Thumbnail ${index + 1}`}
                                    className="w-full h-full object-cover"
                                />
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>,
        document.body
    );
}
