import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SmsOtpSignIn } from './SmsOtpSignIn';
import * as otpTimerStorage from '../../lib/otpTimerStorage';

// Mock Descope SDK
const mockDescopeSDK = {
    otp: {
        signUpOrIn: {
            sms: vi.fn(),
        },
        verify: {
            sms: vi.fn(),
        },
    },
};

vi.mock('@descope/react-sdk', () => ({
    useDescope: vi.fn(() => mockDescopeSDK),
}));

vi.mock('sonner', () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
    },
}));

vi.mock('../../lib/otpTimerStorage', () => ({
    getTimerState: vi.fn(),
    setTimerState: vi.fn(),
    clearTimerState: vi.fn(),
}));

// Helper function to render with Router
const renderWithRouter = (component: React.ReactElement) => {
    return render(<MemoryRouter>{component}</MemoryRouter>);
};

describe('SmsOtpSignIn', () => {
    const mockOnClose = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(otpTimerStorage.getTimerState).mockReturnValue(0);
    });

    describe('Component Rendering', () => {
        it('should render phone number input in step 1', () => {
            renderWithRouter(<SmsOtpSignIn />);

            expect(screen.getByLabelText(/Your Mobile Number/i)).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /Get Verification Code/i })).toBeInTheDocument();
        });

        it('should show step 1 initially', () => {
            renderWithRouter(<SmsOtpSignIn />);

            // Step 1 heading should be visible
            expect(screen.getByText(/Verify Your Australian Phone Number/i)).toBeInTheDocument();
        });
    });

    describe('Phone Number Validation', () => {
        it('should enable send button for valid Australian mobile number', async () => {
            renderWithRouter(<SmsOtpSignIn />);

            const phoneInput = screen.getByPlaceholderText(/0412 345 678/i);
            fireEvent.change(phoneInput, { target: { value: '0412345678' } });

            const sendButton = screen.getByRole('button', { name: /Get Verification Code/i });
            expect(sendButton).not.toBeDisabled();
        });

        it('should disable send button for invalid phone number', () => {
            renderWithRouter(<SmsOtpSignIn />);

            const phoneInput = screen.getByPlaceholderText(/0412 345 678/i);
            fireEvent.change(phoneInput, { target: { value: '123' } });

            const sendButton = screen.getByRole('button', { name: /Get Verification Code/i });
            expect(sendButton).toBeDisabled();
        });

        it('should strip non-numeric characters', () => {
            renderWithRouter(<SmsOtpSignIn />);

            const phoneInput = screen.getByPlaceholderText(/0412 345 678/i);
            fireEvent.change(phoneInput, { target: { value: '0412abc345def678' } });

            expect(phoneInput).toHaveValue('0412345678');
        });
    });

    describe('Send OTP Functionality', () => {
        it('should call Descope SDK sendOTP when send button is clicked', async () => {
            mockDescopeSDK.otp.signUpOrIn.sms.mockResolvedValue({ ok: true });
            renderWithRouter(<SmsOtpSignIn />);

            const phoneInput = screen.getByPlaceholderText(/0412 345 678/i);
            fireEvent.change(phoneInput, { target: { value: '0412345678' } });

            const sendButton = screen.getByRole('button', { name: /Get Verification Code/i });
            fireEvent.click(sendButton);

            await waitFor(() => {
                // Expect international format (+61412345678)
                expect(mockDescopeSDK.otp.signUpOrIn.sms).toHaveBeenCalledWith('+61412345678');
            });
        });

        it('should transition to step 2 after sending code', async () => {
            mockDescopeSDK.otp.signUpOrIn.sms.mockResolvedValue({ ok: true });
            renderWithRouter(<SmsOtpSignIn />);

            const phoneInput = screen.getByPlaceholderText(/0412 345 678/i);
            fireEvent.change(phoneInput, { target: { value: '0412345678' } });

            const sendButton = screen.getByRole('button', { name: /Get Verification Code/i });
            fireEvent.click(sendButton);

            await waitFor(() => {
                expect(screen.getByText(/Enter Your Verification Code/i)).toBeInTheDocument();
            });
        });

        it('should start timer after sending code', async () => {
            mockDescopeSDK.otp.signUpOrIn.sms.mockResolvedValue({ ok: true });
            renderWithRouter(<SmsOtpSignIn />);

            const phoneInput = screen.getByPlaceholderText(/0412 345 678/i);
            fireEvent.change(phoneInput, { target: { value: '0412345678' } });

            const sendButton = screen.getByRole('button', { name: /Get Verification Code/i });
            fireEvent.click(sendButton);

            await waitFor(() => {
                expect(otpTimerStorage.setTimerState).toHaveBeenCalledWith('0412345678', 60);
            });
        });

        it('should show error toast on send failure', async () => {
            const { toast } = await import('sonner');
            mockDescopeSDK.otp.signUpOrIn.sms.mockResolvedValue({
                ok: false,
                error: { errorMessage: 'Network error' }
            });
            renderWithRouter(<SmsOtpSignIn />);

            const phoneInput = screen.getByPlaceholderText(/0412 345 678/i);
            fireEvent.change(phoneInput, { target: { value: '0412345678' } });

            const sendButton = screen.getByRole('button', { name: /Get Verification Code/i });
            fireEvent.click(sendButton);

            await waitFor(() => {
                expect(toast.error).toHaveBeenCalled();
            });
        });
    });

    describe('OTP Input and Verification', () => {
        beforeEach(async () => {
            mockDescopeSDK.otp.signUpOrIn.sms.mockResolvedValue({ ok: true });
        });

        it('should render 6 OTP input boxes in step 2', async () => {
            renderWithRouter(<SmsOtpSignIn />);

            const phoneInput = screen.getByPlaceholderText(/0412 345 678/i);
            fireEvent.change(phoneInput, { target: { value: '0412345678' } });

            const sendButton = screen.getByRole('button', { name: /Get Verification Code/i });
            fireEvent.click(sendButton);

            await waitFor(() => {
                const otpInputs = screen.getAllByRole('textbox');
                // Expect 7 textboxes: 1 phone input + 6 OTP inputs
                expect(otpInputs.length).toBe(7);
            });
        });

        it('should call Descope SDK verifyOTP when all 6 digits are entered', async () => {
            mockDescopeSDK.otp.verify.sms.mockResolvedValue({ ok: true });

            renderWithRouter(<SmsOtpSignIn onClose={mockOnClose} />);

            // Send OTP
            const phoneInput = screen.getByPlaceholderText(/0412 345 678/i);
            fireEvent.change(phoneInput, { target: { value: '0412345678' } });
            const sendButton = screen.getByRole('button', { name: /Get Verification Code/i });
            fireEvent.click(sendButton);

            await waitFor(() => {
                expect(screen.getByText(/Enter Your Verification Code/i)).toBeInTheDocument();
            });

            // Fill OTP by pasting the whole code into first OTP box (index 1, after phone input)
            const otpInputs = screen.getAllByRole('textbox');
            fireEvent.change(otpInputs[1], { target: { value: '123456' } });

            // Submit
            const verifyButton = screen.getByRole('button', { name: /Complete Verification/i });
            fireEvent.click(verifyButton);

            await waitFor(() => {
                // Expect international format (+61412345678)
                expect(mockDescopeSDK.otp.verify.sms).toHaveBeenCalledWith('+61412345678', '123456');
            });
        });

        it('should call onClose on successful verification', async () => {
            mockDescopeSDK.otp.verify.sms.mockResolvedValue({ ok: true });

            renderWithRouter(<SmsOtpSignIn onClose={mockOnClose} />);

            // Send OTP
            const phoneInput = screen.getByPlaceholderText(/0412 345 678/i);
            fireEvent.change(phoneInput, { target: { value: '0412345678' } });
            const sendButton = screen.getByRole('button', { name: /Get Verification Code/i });
            fireEvent.click(sendButton);

            await waitFor(() => {
                expect(screen.getByText(/Enter Your Verification Code/i)).toBeInTheDocument();
            });

            // Fill OTP by pasting into first OTP box (index 1, after phone input)
            const otpInputs = screen.getAllByRole('textbox');
            fireEvent.change(otpInputs[1], { target: { value: '123456' } });

            // Submit
            const verifyButton = screen.getByRole('button', { name: /Complete Verification/i });
            fireEvent.click(verifyButton);

            await waitFor(() => {
                expect(mockOnClose).toHaveBeenCalled();
            });
        });

        it('should show error toast on verification failure', async () => {
            const { toast } = await import('sonner');
            mockDescopeSDK.otp.verify.sms.mockResolvedValue({
                ok: false,
                error: { errorMessage: 'Invalid code' },
            });

            renderWithRouter(<SmsOtpSignIn />);

            // Send OTP
            const phoneInput = screen.getByPlaceholderText(/0412 345 678/i);
            fireEvent.change(phoneInput, { target: { value: '0412345678' } });
            const sendButton = screen.getByRole('button', { name: /Get Verification Code/i });
            fireEvent.click(sendButton);

            await waitFor(() => {
                expect(screen.getByText(/Enter Your Verification Code/i)).toBeInTheDocument();
            });

            // Fill OTP by pasting into first OTP box (index 1, after phone input)
            const otpInputs = screen.getAllByRole('textbox');
            fireEvent.change(otpInputs[1], { target: { value: '999999' } });

            // Submit
            const verifyButton = screen.getByRole('button', { name: /Complete Verification/i });
            fireEvent.click(verifyButton);

            await waitFor(() => {
                expect(toast.error).toHaveBeenCalled();
            });
        });

        it('should clear timer on successful verification', async () => {
            mockDescopeSDK.otp.verify.sms.mockResolvedValue({ ok: true });

            renderWithRouter(<SmsOtpSignIn onClose={mockOnClose} />);

            // Send OTP
            const phoneInput = screen.getByPlaceholderText(/0412 345 678/i);
            fireEvent.change(phoneInput, { target: { value: '0412345678' } });
            const sendButton = screen.getByRole('button', { name: /Get Verification Code/i });
            fireEvent.click(sendButton);

            await waitFor(() => {
                expect(screen.getByText(/Enter Your Verification Code/i)).toBeInTheDocument();
            });

            // Fill OTP by pasting into first OTP box (index 1, after phone input)
            const otpInputs = screen.getAllByRole('textbox');
            fireEvent.change(otpInputs[1], { target: { value: '123456' } });

            // Submit
            const verifyButton = screen.getByRole('button', { name: /Complete Verification/i });
            fireEvent.click(verifyButton);

            await waitFor(() => {
                expect(otpTimerStorage.clearTimerState).toHaveBeenCalledWith('0412345678');
            });
        });
    });

    describe('Back Button', () => {
        it('should show back button in step 2', async () => {
            mockDescopeSDK.otp.signUpOrIn.sms.mockResolvedValue({ ok: true });
            renderWithRouter(<SmsOtpSignIn />);

            const phoneInput = screen.getByPlaceholderText(/0412 345 678/i);
            fireEvent.change(phoneInput, { target: { value: '0412345678' } });

            const sendButton = screen.getByRole('button', { name: /Get Verification Code/i });
            fireEvent.click(sendButton);

            await waitFor(() => {
                const backButton = screen.getByLabelText(/Go back to phone number/i);
                expect(backButton).toBeInTheDocument();
            });
        });

        it('should return to step 1 when back button is clicked', async () => {
            mockDescopeSDK.otp.signUpOrIn.sms.mockResolvedValue({ ok: true });
            renderWithRouter(<SmsOtpSignIn />);

            // Go to step 2
            const phoneInput = screen.getByPlaceholderText(/0412 345 678/i);
            fireEvent.change(phoneInput, { target: { value: '0412345678' } });
            const sendButton = screen.getByRole('button', { name: /Get Verification Code/i });
            fireEvent.click(sendButton);

            await waitFor(() => {
                expect(screen.getByText(/Enter Your Verification Code/i)).toBeInTheDocument();
            });

            // Click back
            const backButton = screen.getByLabelText(/Go back to phone number/i);
            fireEvent.click(backButton);

            await waitFor(() => {
                expect(screen.getByText(/Verify Your Australian Phone Number/i)).toBeInTheDocument();
            });
        });
    });
});
