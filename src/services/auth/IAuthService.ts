/**
 * Authentication service interface
 * 
 * This interface defines the contract for authentication operations.
 * Implementations can be swapped easily (e.g., MockAuthService → DescopeAuthService)
 * without changing consuming code.
 */
export interface IAuthService {
    /**
     * Send an OTP code to the specified phone number
     * @param phoneNumber - The phone number to send OTP to
     * @throws Error if sending fails
     */
    sendOTP(phoneNumber: string): Promise<void>;

    /**
     * Verify an OTP code for a phone number
     * @param phoneNumber - The phone number that received the OTP
     * @param code - The OTP code to verify
     * @returns Result object with success status and optional error message
     */
    verifyOTP(phoneNumber: string, code: string): Promise<{
        success: boolean;
        error?: string;
    }>;
}
