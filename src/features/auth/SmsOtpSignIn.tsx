"use client";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Smartphone, ArrowRight, Loader2, ArrowLeft, User } from "lucide-react";
import { useDescope } from "@descope/react-sdk";
import { Link } from "react-router-dom";
import { useMutation, useConvex } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { logDebug, logError } from "../../lib/logger";
import {
    getTimerState,
    setTimerState,
    clearTimerState,
} from "../../lib/otpTimerStorage";

interface SmsOtpSignInProps {
    onClose?: () => void;
    onDismissableChange?: (isDismissable: boolean) => void;
}

export function SmsOtpSignIn({ onClose, onDismissableChange }: SmsOtpSignInProps) {
    const [phoneNumber, setPhoneNumber] = useState("");
    const [otpDigits, setOtpDigits] = useState<string[]>(["", "", "", "", "", ""]);
    const [userName, setUserName] = useState("");
    const [isSendingOtp, setIsSendingOtp] = useState(false);
    const [isVerifying, setIsVerifying] = useState(false);
    const [isCompletingSignup, setIsCompletingSignup] = useState(false);
    const [remainingTime, setRemainingTime] = useState(0);
    const [step, setStep] = useState<1 | 2 | 3>(1); // 1 = phone, 2 = OTP, 3 = name (for new users)
    const intervalRef = useRef<number | null>(null);
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
    const nameInputRef = useRef<HTMLInputElement | null>(null);

    const sdk = useDescope();
    const convex = useConvex();
    const syncDescopeUser = useMutation(api.descopeAuth.syncDescopeUser);

    // Initialize timer state from localStorage
    useEffect(() => {
        if (phoneNumber) {
            const remaining = getTimerState(phoneNumber);
            setRemainingTime(remaining);
        }
    }, [phoneNumber]);

    // Timer countdown
    useEffect(() => {
        if (remainingTime > 0) {
            intervalRef.current = window.setInterval(() => {
                setRemainingTime((prev) => {
                    if (prev <= 1) {
                        if (intervalRef.current) {
                            clearInterval(intervalRef.current);
                        }
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);

            return () => {
                if (intervalRef.current) {
                    clearInterval(intervalRef.current);
                }
            };
        }
    }, [remainingTime]);

    // Focus first input when entering step 2
    useEffect(() => {
        if (step === 2 && inputRefs.current[0]) {
            setTimeout(() => inputRefs.current[0]?.focus(), 300);
        }
    }, [step]);

    // Focus name input when entering step 3
    useEffect(() => {
        if (step === 3 && nameInputRef.current) {
            setTimeout(() => nameInputRef.current?.focus(), 300);
        }
    }, [step]);

    // Notify parent about dismissable state when step changes
    useEffect(() => {
        // Step 3 is not dismissable - user must complete name collection
        onDismissableChange?.(step !== 3);
    }, [step, onDismissableChange]);

    // Validate Australian mobile numbers
    const isValidPhoneNumber = (phone: string): boolean => {
        const cleaned = phone.replace(/\s/g, "");
        const australianMobileRegex = /^04\d{8}$/;
        return australianMobileRegex.test(cleaned);
    };

    const formatPhoneNumber = (phone: string): string => {
        // Convert local format (0466666666) to international format (+61466666666) for Descope API
        const cleaned = phone.replace(/\s/g, "");
        if (cleaned.startsWith("0")) {
            return `+61${cleaned.substring(1)}`;
        }
        return `+61${cleaned}`;
    };

    const handleSendOtp = async () => {
        if (!isValidPhoneNumber(phoneNumber)) {
            toast.error("Please enter a valid Australian mobile number");
            return;
        }

        setIsSendingOtp(true);

        try {
            // Convert to international format for Descope API
            const formattedPhone = formatPhoneNumber(phoneNumber);
            const resp = await sdk?.otp.signUpOrIn.sms(formattedPhone);

            if (!resp?.ok) {
                throw new Error(resp?.error?.errorMessage || "Failed to send OTP");
            }

            setTimerState(phoneNumber, 60);
            setRemainingTime(60);
            toast.success("Verification code sent!");
            setStep(2); // Slide to OTP input
        } catch (error: any) {
            logError("Error sending OTP", error);
            toast.error(error.message || "Failed to send verification code. Please try again.");
        } finally {
            setIsSendingOtp(false);
        }
    };

    const handleResendCode = async () => {
        if (remainingTime > 0) return;

        setIsSendingOtp(true);
        try {
            const formattedPhone = formatPhoneNumber(phoneNumber);
            const resp = await sdk?.otp.signUpOrIn.sms(formattedPhone);

            if (!resp?.ok) {
                throw new Error(resp?.error?.errorMessage || "Failed to resend OTP");
            }

            setTimerState(phoneNumber, 60);
            setRemainingTime(60);
            toast.success("Code resent!");
        } catch (error: any) {
            logError("Error resending OTP", error);
            toast.error(error.message || "Failed to resend code. Please try again.");
        } finally {
            setIsSendingOtp(false);
        }
    };

    const handleOtpChange = (index: number, value: string) => {
        // Only allow numeric input
        const numericValue = value.replace(/\D/g, "");

        if (numericValue.length > 1) {
            // Handle paste
            const digits = numericValue.slice(0, 6).split("");
            const newOtpDigits = [...otpDigits];
            digits.forEach((digit, i) => {
                if (index + i < 6) {
                    newOtpDigits[index + i] = digit;
                }
            });
            setOtpDigits(newOtpDigits);

            // Focus the next empty box or last box
            const nextIndex = Math.min(index + digits.length, 5);
            inputRefs.current[nextIndex]?.focus();
        } else {
            // Single digit input
            const newOtpDigits = [...otpDigits];
            newOtpDigits[index] = numericValue;
            setOtpDigits(newOtpDigits);

            // Auto-focus next input
            if (numericValue && index < 5) {
                inputRefs.current[index + 1]?.focus();
            }
        }
    };

    const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Backspace" && !otpDigits[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
    };

    const handleVerifyOtp = async (e: React.FormEvent) => {
        e.preventDefault();

        const otpCode = otpDigits.join("");
        if (otpCode.length !== 6) {
            toast.error("Please enter all 6 digits");
            return;
        }

        setIsVerifying(true);

        try {
            const formattedPhone = formatPhoneNumber(phoneNumber);
            logDebug("Verifying OTP for:", formattedPhone);

            const resp = await sdk?.otp.verify.sms(formattedPhone, otpCode);

            if (!resp?.ok) {
                throw new Error(resp?.error?.errorMessage || "Invalid verification code");
            }

            logDebug("OTP verified successfully");

            // Check if this is a new user from Descope's firstSeen flag
            const isNew = resp?.data?.firstSeen === true;
            logDebug("User is new (from Descope firstSeen):", isNew);

            toast.success("Phone number verified!");
            clearTimerState(phoneNumber);

            // Decide whether to show name collection or complete sign-in
            if (isNew) {
                // New user - show name collection step
                logDebug("New user detected, showing name collection step");
                setStep(3);
            } else {
                // Existing user - complete sign-in directly
                logDebug("Existing user, completing sign-in");
                await completeSignIn();
            }
        } catch (error: any) {
            logError("Error verifying OTP", error);
            toast.error(error.message || "Failed to verify code. Please try again.");
            // Clear the inputs on error
            setOtpDigits(["", "", "", "", "", ""]);
            inputRefs.current[0]?.focus();
        } finally {
            setIsVerifying(false);
        }
    };

    const handleCompleteSignup = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!userName.trim()) {
            toast.error("Please enter your name");
            return;
        }

        if (userName.trim().length < 2) {
            toast.error("Name must be at least 2 characters");
            return;
        }

        if (userName.trim().length > 50) {
            toast.error("Name must be less than 50 characters");
            return;
        }

        setIsCompletingSignup(true);

        try {
            // Sync user with the provided name
            await syncDescopeUser({ name: userName.trim() });
            logDebug("User synced with name:", userName.trim());

            await completeSignIn();
        } catch (error: any) {
            logError("Error completing signup", error);
            toast.error("Failed to complete signup. Please try again.");
        } finally {
            setIsCompletingSignup(false);
        }
    };

    const completeSignIn = async () => {
        // Close the modal - authentication is already established
        // The Layout's authKey will trigger a re-render to show authenticated features
        if (onClose) {
            onClose();
        }
    };

    const handleBackToPhone = () => {
        setStep(1);
        setOtpDigits(["", "", "", "", "", ""]);
    };

    const handleBackToOtp = () => {
        setStep(2);
        setUserName("");
    };

    const canSubmit = step === 1
        ? phoneNumber && isValidPhoneNumber(phoneNumber)
        : step === 2
            ? otpDigits.every(d => d !== "")
            : userName.trim().length >= 2;

    return (
        <div className="w-full relative">
            {/* Back button - positioned to align with close button in parent */}
            {step === 2 && (
                <button
                    type="button"
                    onClick={handleBackToPhone}
                    className="absolute -top-[3.25rem] left-0 p-2 rounded-full hover:bg-neutral-100 text-neutral-400 hover:text-neutral-600 transition-colors z-50"
                    aria-label="Go back to phone number"
                >
                    <ArrowLeft className="w-6 h-6" />
                </button>
            )}
            {/* Step 3 has no back button - user must complete name collection */}
            {step === 3 && false && (
                <button
                    type="button"
                    onClick={handleBackToOtp}
                    className="absolute -top-[3.25rem] left-0 p-2 rounded-full hover:bg-neutral-100 text-neutral-400 hover:text-neutral-600 transition-colors z-50"
                    aria-label="Go back to verification code"
                >
                    <ArrowLeft className="w-6 h-6" />
                </button>
            )}

            <form onSubmit={step === 1 ? (e) => { e.preventDefault(); handleSendOtp(); } : step === 2 ? handleVerifyOtp : handleCompleteSignup} className="flex flex-col gap-3">
                {/* Sliding content container - needs overflow hidden for the slide effect */}
                <div className="relative h-[215px] overflow-hidden">
                    {/* Step 1: Phone Number */}
                    <div
                        className={`absolute inset-0 transition-all duration-300 ease-in-out ${step === 1
                            ? 'translate-x-0 opacity-100'
                            : '-translate-x-full opacity-0 pointer-events-none'
                            }`}
                    >
                        <div className="space-y-3">
                            <div>
                                <h3 className="text-lg sm:text-xl font-semibold text-neutral-900 mb-1">
                                    Verify Your Australian Phone Number
                                </h3>
                                <p className="text-xs sm:text-sm text-neutral-500 leading-relaxed">
                                    We verify users to keep the Board <span className="font-semibold">scam-free.</span> Your number remains private.
                                </p>
                            </div>

                            <div className="space-y-2">
                                <label htmlFor="phoneNumber" className="text-xs sm:text-sm font-medium text-neutral-700">
                                    Your Mobile Number (Australia only)
                                </label>
                                <div className="relative group">
                                    <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400 group-focus-within:text-primary-500 transition-colors z-10" />
                                    <input
                                        id="phoneNumber"
                                        className="auth-input-field pl-12"
                                        type="tel"
                                        name="phoneNumber"
                                        placeholder="0412 345 678"
                                        inputMode="numeric"
                                        pattern="04\d{8}"
                                        maxLength={10}
                                        value={phoneNumber}
                                        onChange={(e) => {
                                            const value = e.target.value.replace(/\D/g, "");
                                            setPhoneNumber(value);
                                        }}
                                        required={step === 1}
                                    />
                                </div>
                                <p className="text-xs text-neutral-500">
                                    By continuing you agree to our <Link to="/terms" className="text-primary-600 hover:underline">Terms &amp; Conditions</Link> and <Link to="/terms#privacy" className="text-primary-600 hover:underline">Privacy Policy</Link>.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Step 2: OTP Input */}
                    <div
                        className={`absolute inset-0 transition-all duration-300 ease-in-out ${step === 2
                            ? 'translate-x-0 opacity-100'
                            : 'translate-x-full opacity-0 pointer-events-none'
                            }`}
                    >
                        <div className="space-y-3">
                            <div>
                                <h3 className="text-lg sm:text-xl font-semibold text-neutral-900 mb-1">
                                    Enter Your Verification Code
                                </h3>
                                <p className="text-xs sm:text-sm text-neutral-500 leading-relaxed">
                                    We just sent a 6-digit code to {phoneNumber}.
                                </p>
                            </div>

                            {/* 6-digit OTP boxes */}
                            <div className="flex gap-1.5 sm:gap-2 justify-center py-2">
                                {otpDigits.map((digit, index) => (
                                    <input
                                        key={index}
                                        ref={(el) => { inputRefs.current[index] = el; }}
                                        type="text"
                                        inputMode="numeric"
                                        maxLength={6}
                                        value={digit}
                                        onChange={(e) => handleOtpChange(index, e.target.value)}
                                        onKeyDown={(e) => handleKeyDown(index, e)}
                                        className="w-10 h-12 sm:w-12 sm:h-14 text-center text-xl sm:text-2xl font-semibold border-2 border-neutral-300 rounded-lg sm:rounded-xl focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 outline-none transition-all bg-white"
                                    />
                                ))}
                            </div>

                            {/* Resend Code */}
                            <div className="text-center">
                                <button
                                    type="button"
                                    onClick={handleResendCode}
                                    disabled={remainingTime > 0 || isSendingOtp}
                                    className="text-sm text-primary-600 hover:text-primary-700 font-medium disabled:text-neutral-400 disabled:cursor-not-allowed transition-colors"
                                >
                                    {remainingTime > 0
                                        ? `Resend Code (${remainingTime}s)`
                                        : isSendingOtp
                                            ? "Sending..."
                                            : "Resend Code"}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Step 3: Name Collection (New Users Only) */}
                    <div
                        className={`absolute inset-0 transition-all duration-300 ease-in-out ${step === 3
                            ? 'translate-x-0 opacity-100'
                            : 'translate-x-full opacity-0 pointer-events-none'
                            }`}
                    >
                        <div className="space-y-3" style={{ transform: 'translateZ(0)' }}>
                            <div>
                                <h3 className="text-lg sm:text-xl font-semibold text-neutral-900 mb-1">
                                    What's Your Name?
                                </h3>
                                <p className="text-xs sm:text-sm text-neutral-500 leading-relaxed">
                                    Help others recognize you on the Board.
                                </p>
                            </div>

                            <div className="space-y-2">
                                <div className="relative group">
                                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400 group-focus-within:text-primary-500 transition-colors z-10" />
                                    <input
                                        id="userName"
                                        ref={nameInputRef}
                                        className="auth-input-field pl-12"
                                        type="text"
                                        name="userName"
                                        placeholder="John Smith"
                                        maxLength={50}
                                        value={userName}
                                        onChange={(e) => {
                                            // Only allow letters (including accented), spaces, hyphens, apostrophes, and periods
                                            const value = e.target.value.replace(/[^a-zA-Z\u00C0-\u017F\s'-\.]/g, '');
                                            setUserName(value);
                                        }}
                                        required={step === 3}
                                    />
                                </div>
                                <p className="text-xs text-neutral-500">
                                    This will be displayed on your flyers and profile.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Fixed button - only label changes */}
                <button
                    className="auth-button flex items-center justify-center gap-2 group relative"
                    type="submit"
                    disabled={!canSubmit || isSendingOtp || isVerifying || isCompletingSignup}
                >
                    {(isSendingOtp || isVerifying || isCompletingSignup) ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                        <>
                            <span className="transition-all duration-300">
                                {step === 1 ? "Get Verification Code" : step === 2 ? "Complete Verification" : "Complete Sign Up"}
                            </span>
                            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                        </>
                    )}
                </button>
            </form>
        </div>
    );
}
