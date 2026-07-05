import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MessageComposer } from './MessageComposer';
import { toast } from 'sonner';

vi.mock('sonner', () => ({
    toast: {
        error: vi.fn(),
    },
}));

describe('MessageComposer', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const getTextarea = () =>
        screen.getByLabelText<HTMLTextAreaElement>('Type your message');
    const getSendButton = () =>
        screen.getByRole<HTMLButtonElement>('button', { name: 'Send message' });

    it('sends the trimmed message on Enter', async () => {
        const onSend = vi.fn().mockResolvedValue(undefined);
        render(<MessageComposer onSend={onSend} />);

        fireEvent.change(getTextarea(), { target: { value: '  Hello seller  ' } });
        fireEvent.keyDown(getTextarea(), { key: 'Enter', shiftKey: false });

        await waitFor(() => {
            expect(onSend).toHaveBeenCalledTimes(1);
            expect(onSend).toHaveBeenCalledWith('Hello seller');
        });
    });

    it('does NOT send on Shift+Enter (newline instead)', () => {
        const onSend = vi.fn().mockResolvedValue(undefined);
        render(<MessageComposer onSend={onSend} />);

        fireEvent.change(getTextarea(), { target: { value: 'Multi-line draft' } });
        fireEvent.keyDown(getTextarea(), { key: 'Enter', shiftKey: true });

        expect(onSend).not.toHaveBeenCalled();
        expect(getTextarea().value).toBe('Multi-line draft');
    });

    it('disables the send button while the input is empty or whitespace-only', () => {
        const onSend = vi.fn().mockResolvedValue(undefined);
        render(<MessageComposer onSend={onSend} />);

        expect(getSendButton().disabled).toBe(true);

        fireEvent.change(getTextarea(), { target: { value: '   ' } });
        expect(getSendButton().disabled).toBe(true);

        fireEvent.change(getTextarea(), { target: { value: 'x' } });
        expect(getSendButton().disabled).toBe(false);
    });

    it('does not call onSend when Enter is pressed with an empty input', () => {
        const onSend = vi.fn().mockResolvedValue(undefined);
        render(<MessageComposer onSend={onSend} />);

        fireEvent.keyDown(getTextarea(), { key: 'Enter', shiftKey: false });
        expect(onSend).not.toHaveBeenCalled();
    });

    it('clears the input after a successful send', async () => {
        const onSend = vi.fn().mockResolvedValue(undefined);
        render(<MessageComposer onSend={onSend} />);

        fireEvent.change(getTextarea(), { target: { value: 'On its way' } });
        fireEvent.keyDown(getTextarea(), { key: 'Enter', shiftKey: false });

        await waitFor(() => {
            expect(getTextarea().value).toBe('');
        });
    });

    it('keeps the draft and shows a toast when sending fails', async () => {
        const onSend = vi.fn().mockRejectedValue(new Error('Rate limited'));
        render(<MessageComposer onSend={onSend} />);

        fireEvent.change(getTextarea(), { target: { value: 'Please keep me' } });
        fireEvent.keyDown(getTextarea(), { key: 'Enter', shiftKey: false });

        await waitFor(() => {
            expect(toast.error).toHaveBeenCalledWith('Rate limited');
        });
        expect(getTextarea().value).toBe('Please keep me');
    });

    it('respects the disabled prop and shows the disabled reason', () => {
        const onSend = vi.fn().mockResolvedValue(undefined);
        render(
            <MessageComposer
                onSend={onSend}
                disabled
                disabledReason="Cannot send messages - flyer is inactive or deleted"
            />
        );

        expect(getTextarea().disabled).toBe(true);
        expect(getSendButton().disabled).toBe(true);
        expect(
            screen.getByText('Cannot send messages - flyer is inactive or deleted')
        ).toBeInTheDocument();

        fireEvent.change(getTextarea(), { target: { value: 'blocked' } });
        fireEvent.keyDown(getTextarea(), { key: 'Enter', shiftKey: false });
        expect(onSend).not.toHaveBeenCalled();
    });

    it('has a minimum 44px touch-target textarea that auto-grows', () => {
        render(<MessageComposer onSend={vi.fn().mockResolvedValue(undefined)} />);
        const textarea = getTextarea();
        expect(textarea.className).toContain('min-h-[44px]');
        expect(textarea.className).toContain('max-h-32');
        expect(textarea.className).toContain('resize-none');
    });
});
