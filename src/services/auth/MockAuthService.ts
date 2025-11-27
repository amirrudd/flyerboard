import type { IAuthService } from './IAuthService';

/**
 * Mock implementation of the auth service for development and testing
 * 
 * This mock service:
 * - Simulates SMS sending with a console log
 * - Always accepts '123456' as a valid OTP
 * - Returns appropriate error messages for invalid codes
 * 
 * Replace this with DescopeAuthService when integrating the real provider.
 */
export class MockAuthService implements IAuthService {
    /**
     * Simulates sending an OTP code
     * In a real implementation, this would call the SMS provider API
     */
    async sendOTP(phoneNumber: string): Promise<void> {
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 500));

        console.log(`[Mock SMS] Sending OTP to ${phoneNumber}. Use code: 123456`);

        // In production, this would make an actual API call
        // throw new Error('Failed to send SMS') to simulate errors
    }

    /**
     * Simulates verifying an OTP code
     * In a real implementation, this would call the verification API
     */
    async verifyOTP(phoneNumber: string, code: string): Promise<{
        success: boolean;
        error?: string;
    }> {
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 300));

        console.log(`[Mock SMS] Verifying OTP for ${phoneNumber}: ${code}`);

        // Mock validation - accept only '123456'
        if (code === '123456') {
            return { success: true };
        }

        return {
            success: false,
            error: 'Invalid verification code. Please try again.',
        };
    }
}
