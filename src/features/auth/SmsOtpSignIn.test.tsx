import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SmsOtpSignIn } from './SmsOtpSignIn';
import { authService } from '../../services/auth/authService';
import * as otpTimerStorage from '../../lib/otpTimerStorage';

// Mock dependencies
vi.mock('@convex-dev/auth/react', () => ({
    useAuthActions: vi.fn(() => ({
        signIn: vi.fn(),
    })),
}));

vi.mock('sonner', () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
    },
}));

vi.mock('../../services/auth/authService', () => ({
    authService: {
        sendOTP: vi.fn(),
        verifyOTP: vi.fn(),
    },
}));

vi.mock('../../lib/otpTimerStorage', () => ({
    getTimerState: vi.fn(),
    setTimerState: vi.fn(),
    clearTimerState: vi.fn(),
}));

describe('SmsOtpSignIn', () => {
    const mockOnClose = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(otpTimerStorage.getTimerState).mockReturnValue(0);
    });

    describe('Component Rendering', () => {
        it('should render phone number input and send button', () => {
            render(<SmsOtpSignIn />);

            expect(screen.getByPlaceholderText(/mobile number/i)).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /send verification code/i })).toBeInTheDocument();
        });

        it('should not show OTP input initially', () => {
            render(<SmsOtpSignIn />);

            expect(screen.queryByPlaceholderText(/enter 6-digit code/i)).not.toBeInTheDocument();
        });

        it('should show helper text', () => {
            render(<SmsOtpSignIn />);

            expect(screen.getByText(/enter your mobile number to receive a verification code/i)).toBeInTheDocument();
        });
    });

    describe('Phone Number Validation', () => {
        it('should enable send button for valid Australian mobile number', async () => {
            render(<SmsOtpSignIn />);

            const phoneInput = screen.getByPlaceholderText(/mobile number/i);
            fireEvent.change(phoneInput, { target: { value: '0412345678' } });

            const sendButton = screen.getByRole('button', { name: /send verification code/i });
            expect(sendButton).not.toBeDisabled();
        });

        it('should disable send button for invalid phone number', () => {
            render(<SmsOtpSignIn />);

            const phoneInput = screen.getByPlaceholderText(/mobile number/i);
            fireEvent.change(phoneInput, { target: { value: '123' } });

            const sendButton = screen.getByRole('button', { name: /send verification code/i });
            expect(sendButton).toBeDisabled();
        });

        it('should accept phone number with spaces', () => {
            render(<SmsOtpSignIn />);

            const phoneInput = screen.getByPlaceholderText(/mobile number/i);
            fireEvent.change(phoneInput, { target: { value: '0412 345 678' } });

            const sendButton = screen.getByRole('button', { name: /send verification code/i });
            expect(sendButton).not.toBeDisabled();
        });
    });

    describe('Send OTP Functionality', () => {
        it('should call authService.sendOTP when send button is clicked', async () => {
            vi.mocked(authService.sendOTP).mockResolvedValue();
            render(<SmsOtpSignIn />);

            const phoneInput = screen.getByPlaceholderText(/mobile number/i);
            fireEvent.change(phoneInput, { target: { value: '0412345678' } });

            const sendButton = screen.getByRole('button', { name: /send verification code/i });
            fireEvent.click(sendButton);

            await waitFor(() => {
                expect(authService.sendOTP).toHaveBeenCalledWith('0412345678');
            });
        });

        it('should show OTP input after sending code', async () => {
            vi.mocked(authService.sendOTP).mockResolvedValue();
            render(<SmsOtpSignIn />);

            const phoneInput = screen.getByPlaceholderText(/mobile number/i);
            fireEvent.change(phoneInput, { target: { value: '0412345678' } });

            const sendButton = screen.getByRole('button', { name: /send verification code/i });
            fireEvent.click(sendButton);

            await waitFor(() => {
                expect(screen.getByPlaceholderText(/enter 6-digit code/i)).toBeInTheDocument();
            });
        });

        it('should start timer after sending code', async () => {
            vi.mocked(authService.sendOTP).mockResolvedValue();
            render(<SmsOtpSignIn />);

            const phoneInput = screen.getByPlaceholderText(/mobile number/i);
            fireEvent.change(phoneInput, { target: { value: '0412345678' } });

            const sendButton = screen.getByRole('button', { name: /send verification code/i });
            fireEvent.click(sendButton);

            await waitFor(() => {
                expect(otpTimerStorage.setTimerState).toHaveBeenCalledWith('0412345678', 60);
            });
        });

        it('should show error toast on send failure', async () => {
            const { toast } = await import('sonner');
            vi.mocked(authService.sendOTP).mockRejectedValue(new Error('Network error'));
            render(<SmsOtpSignIn />);

            const phoneInput = screen.getByPlaceholderText(/mobile number/i);
            fireEvent.change(phoneInput, { target: { value: '0412345678' } });

            const sendButton = screen.getByRole('button', { name: /send verification code/i });
            fireEvent.click(sendButton);

            await waitFor(() => {
                expect(toast.error).toHaveBeenCalled();
            });
        });
    });

    describe('Timer Functionality', () => {
        it('should initialize timer from localStorage', () => {
            vi.mocked(otpTimerStorage.getTimerState).mockReturnValue(45);
            render(<SmsOtpSignIn />);

            const phoneInput = screen.getByPlaceholderText(/mobile number/i);
            fireEvent.change(phoneInput, { target: { value: '0412345678' } });

            expect(otpTimerStorage.getTimerState).toHaveBeenCalledWith('0412345678');
        });

        it('should disable send button while timer is active', () => {
            vi.mocked(otpTimerStorage.getTimerState).mockReturnValue(30);
            render(<SmsOtpSignIn />);

            const phoneInput = screen.getByPlaceholderText(/mobile number/i);
            fireEvent.change(phoneInput, { target: { value: '0412345678' } });

            const sendButton = screen.getByRole('button', { name: /resend code in/i });
            expect(sendButton).toBeDisabled();
        });

        it('should show remaining time on button', async () => {
            vi.mocked(authService.sendOTP).mockResolvedValue();
            render(<SmsOtpSignIn />);

            const phoneInput = screen.getByPlaceholderText(/mobile number/i);
            fireEvent.change(phoneInput, { target: { value: '0412345678' } });

            const sendButton = screen.getByRole('button', { name: /send verification code/i });
            fireEvent.click(sendButton);

            await waitFor(() => {
                expect(screen.getByRole('button', { name: /resend code in/i })).toBeInTheDocument();
            });
        });
    });

    describe('Phone Number Change Detection', () => {
        it('should reset OTP sent state when phone number changes', async () => {
            vi.mocked(authService.sendOTP).mockResolvedValue();
            render(<SmsOtpSignIn />);

            const phoneInput = screen.getByPlaceholderText(/mobile number/i);

            // Send code for first number
            fireEvent.change(phoneInput, { target: { value: '0412345678' } });
            const sendButton = screen.getByRole('button', { name: /send verification code/i });
            fireEvent.click(sendButton);

            await waitFor(() => {
                expect(screen.getByPlaceholderText(/enter 6-digit code/i)).toBeInTheDocument();
            });

            // Change phone number
            fireEvent.change(phoneInput, { target: { value: '0487654321' } });

            // OTP input should be hidden
            await waitFor(() => {
                expect(screen.queryByPlaceholderText(/enter 6-digit code/i)).not.toBeInTheDocument();
            });
        });

        it('should clear OTP code when phone number changes', async () => {
            vi.mocked(authService.sendOTP).mockResolvedValue();
            render(<SmsOtpSignIn />);

            const phoneInput = screen.getByPlaceholderText(/mobile number/i);
            fireEvent.change(phoneInput, { target: { value: '0412345678' } });

            const sendButton = screen.getByRole('button', { name: /send verification code/i });
            fireEvent.click(sendButton);

            await waitFor(() => {
                const otpInput = screen.getByPlaceholderText(/enter 6-digit code/i);
                fireEvent.change(otpInput, { target: { value: '123456' } });
            });

            // Change phone number
            fireEvent.change(phoneInput, { target: { value: '0487654321' } });

            // Send code again
            const newSendButton = screen.getByRole('button', { name: /send verification code/i });
            fireEvent.click(newSendButton);

            await waitFor(() => {
                const otpInput = screen.getByPlaceholderText(/enter 6-digit code/i);
                expect(otpInput).toHaveValue('');
            });
        });
    });

    describe('OTP Input and Verification', () => {
        it('should only allow numeric input in OTP field', async () => {
            vi.mocked(authService.sendOTP).mockResolvedValue();
            render(<SmsOtpSignIn />);

            const phoneInput = screen.getByPlaceholderText(/mobile number/i);
            fireEvent.change(phoneInput, { target: { value: '0412345678' } });

            const sendButton = screen.getByRole('button', { name: /send verification code/i });
            fireEvent.click(sendButton);

            await waitFor(() => {
                const otpInput = screen.getByPlaceholderText(/enter 6-digit code/i);
                fireEvent.change(otpInput, { target: { value: 'abc123def' } });
                expect(otpInput).toHaveValue('123');
            });
        });

        it('should limit OTP input to 6 digits', async () => {
            vi.mocked(authService.sendOTP).mockResolvedValue();
            render(<SmsOtpSignIn />);

            const phoneInput = screen.getByPlaceholderText(/mobile number/i);
            fireEvent.change(phoneInput, { target: { value: '0412345678' } });

            const sendButton = screen.getByRole('button', { name: /send verification code/i });
            fireEvent.click(sendButton);

            await waitFor(() => {
                const otpInput = screen.getByPlaceholderText(/enter 6-digit code/i);
                fireEvent.change(otpInput, { target: { value: '12345678' } });
                expect(otpInput).toHaveValue('123456');
            });
        });

        it('should enable verify button when OTP is 6 digits', async () => {
            vi.mocked(authService.sendOTP).mockResolvedValue();
            render(<SmsOtpSignIn />);

            const phoneInput = screen.getByPlaceholderText(/mobile number/i);
            fireEvent.change(phoneInput, { target: { value: '0412345678' } });

            const sendButton = screen.getByRole('button', { name: /send verification code/i });
            fireEvent.click(sendButton);

            await waitFor(() => {
                const otpInput = screen.getByPlaceholderText(/enter 6-digit code/i);
                fireEvent.change(otpInput, { target: { value: '123456' } });
            });

            const verifyButton = screen.getByRole('button', { name: /verify and sign in/i });
            expect(verifyButton).not.toBeDisabled();
        });

        it('should call authService.verifyOTP on form submit', async () => {
            vi.mocked(authService.sendOTP).mockResolvedValue();
            vi.mocked(authService.verifyOTP).mockResolvedValue({ success: true });

            render(<SmsOtpSignIn onClose={mockOnClose} />);

            const phoneInput = screen.getByPlaceholderText(/mobile number/i);
            fireEvent.change(phoneInput, { target: { value: '0412345678' } });

            const sendButton = screen.getByRole('button', { name: /send verification code/i });
            fireEvent.click(sendButton);

            await waitFor(() => {
                const otpInput = screen.getByPlaceholderText(/enter 6-digit code/i);
                fireEvent.change(otpInput, { target: { value: '123456' } });
            });

            const verifyButton = screen.getByRole('button', { name: /verify and sign in/i });
            fireEvent.click(verifyButton);

            await waitFor(() => {
                expect(authService.verifyOTP).toHaveBeenCalledWith('0412345678', '123456');
            });
        });

        it('should call onClose on successful verification', async () => {
            vi.mocked(authService.sendOTP).mockResolvedValue();
            vi.mocked(authService.verifyOTP).mockResolvedValue({ success: true });

            render(<SmsOtpSignIn onClose={mockOnClose} />);

            const phoneInput = screen.getByPlaceholderText(/mobile number/i);
            fireEvent.change(phoneInput, { target: { value: '0412345678' } });

            const sendButton = screen.getByRole('button', { name: /send verification code/i });
            fireEvent.click(sendButton);

            await waitFor(() => {
                const otpInput = screen.getByPlaceholderText(/enter 6-digit code/i);
                fireEvent.change(otpInput, { target: { value: '123456' } });
            });

            const verifyButton = screen.getByRole('button', { name: /verify and sign in/i });
            fireEvent.click(verifyButton);

            await waitFor(() => {
                expect(mockOnClose).toHaveBeenCalled();
            });
        });

        it('should show error toast on verification failure', async () => {
            const { toast } = await import('sonner');
            vi.mocked(authService.sendOTP).mockResolvedValue();
            vi.mocked(authService.verifyOTP).mockResolvedValue({
                success: false,
                error: 'Invalid code',
            });

            render(<SmsOtpSignIn />);

            const phoneInput = screen.getByPlaceholderText(/mobile number/i);
            fireEvent.change(phoneInput, { target: { value: '0412345678' } });

            const sendButton = screen.getByRole('button', { name: /send verification code/i });
            fireEvent.click(sendButton);

            await waitFor(() => {
                const otpInput = screen.getByPlaceholderText(/enter 6-digit code/i);
                fireEvent.change(otpInput, { target: { value: '999999' } });
            });

            const verifyButton = screen.getByRole('button', { name: /verify and sign in/i });
            fireEvent.click(verifyButton);

            await waitFor(() => {
                expect(toast.error).toHaveBeenCalledWith('Invalid code');
            });
        });

        it('should clear timer on successful verification', async () => {
            vi.mocked(authService.sendOTP).mockResolvedValue();
            vi.mocked(authService.verifyOTP).mockResolvedValue({ success: true });

            render(<SmsOtpSignIn onClose={mockOnClose} />);

            const phoneInput = screen.getByPlaceholderText(/mobile number/i);
            fireEvent.change(phoneInput, { target: { value: '0412345678' } });

            const sendButton = screen.getByRole('button', { name: /send verification code/i });
            fireEvent.click(sendButton);

            await waitFor(() => {
                const otpInput = screen.getByPlaceholderText(/enter 6-digit code/i);
                fireEvent.change(otpInput, { target: { value: '123456' } });
            });

            const verifyButton = screen.getByRole('button', { name: /verify and sign in/i });
            fireEvent.click(verifyButton);

            await waitFor(() => {
                expect(otpTimerStorage.clearTimerState).toHaveBeenCalledWith('0412345678');
            });
        });
    });

    describe('Loading States', () => {
        it('should show loading state while sending OTP', async () => {
            vi.mocked(authService.sendOTP).mockImplementation(
                () => new Promise((resolve) => setTimeout(resolve, 100))
            );

            render(<SmsOtpSignIn />);

            const phoneInput = screen.getByPlaceholderText(/mobile number/i);
            fireEvent.change(phoneInput, { target: { value: '0412345678' } });

            const sendButton = screen.getByRole('button', { name: /send verification code/i });
            fireEvent.click(sendButton);

            // Should show loading state
            await waitFor(() => {
                const loadingButton = screen.getByRole('button');
                expect(loadingButton).toBeDisabled();
            });
        });
    });
});
