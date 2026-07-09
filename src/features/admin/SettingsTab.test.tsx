import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SettingsTab } from './SettingsTab';

// useQuery → getAllSettings result; useMutation → updateSetting.
const mockUseQuery = vi.fn();
const mockUpdateSetting = vi.fn();
vi.mock('convex/react', () => ({
    useQuery: (...args: any[]) => mockUseQuery(...args),
    useMutation: () => mockUpdateSetting,
}));

const mockToast = { success: vi.fn(), error: vi.fn() };
vi.mock('sonner', () => ({
    toast: { success: (m: string) => mockToast.success(m), error: (m: string) => mockToast.error(m) },
}));

// Two seeded settings mirroring migrations:seedAppSettings.
const SEEDED = [
    {
        _id: 'setting_cooldown' as any,
        _creationTime: 1,
        key: 'boostCooldownDays',
        value: 7,
        description: 'Days between boosts.',
    },
    {
        _id: 'setting_cap' as any,
        _creationTime: 2,
        key: 'boostDailyCap',
        value: 3,
        description: 'Max boosts per day.',
    },
];

describe('SettingsTab', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockUseQuery.mockReturnValue(SEEDED);
        mockUpdateSetting.mockResolvedValue({ success: true });
    });

    it('shows a loading spinner while settings are undefined', () => {
        mockUseQuery.mockReturnValue(undefined);
        const { container } = render(<SettingsTab />);
        expect(container.querySelector('.animate-spin')).toBeInTheDocument();
        expect(screen.queryByText('Boost cooldown')).not.toBeInTheDocument();
    });

    it('renders both boost settings with their current values', () => {
        render(<SettingsTab />);

        expect(screen.getByText('Boost cooldown')).toBeInTheDocument();
        expect(screen.getByText('Daily boost cap')).toBeInTheDocument();

        const cooldown = screen.getByLabelText('Boost cooldown');
        const cap = screen.getByLabelText('Daily boost cap');
        expect(cooldown).toHaveValue(7);
        expect(cap).toHaveValue(3);

        // Unit suffixes and the "applies immediately" note.
        expect(screen.getByText('days')).toBeInTheDocument();
        expect(screen.getByText('boosts per user / day')).toBeInTheDocument();
        expect(
            screen.getByText(/Changes apply immediately — in-progress countdowns recompute live\./),
        ).toBeInTheDocument();
    });

    it('disables Save until the value changes', () => {
        render(<SettingsTab />);
        const saveButtons = screen.getAllByRole('button', { name: 'Save' });
        // Unchanged → disabled.
        expect(saveButtons[0]).toBeDisabled();

        const cooldown = screen.getByLabelText('Boost cooldown');
        fireEvent.change(cooldown, { target: { value: '10' } });
        expect(screen.getAllByRole('button', { name: 'Save' })[0]).toBeEnabled();
    });

    it('shows an out-of-range helper and disables Save for an over-max value', () => {
        render(<SettingsTab />);
        const cooldown = screen.getByLabelText('Boost cooldown');

        fireEvent.change(cooldown, { target: { value: '99' } });

        expect(screen.getByText('Enter 1–30 days')).toBeInTheDocument();
        expect(screen.getAllByRole('button', { name: 'Save' })[0]).toBeDisabled();
    });

    it('shows an out-of-range helper for a below-min value on the daily cap', () => {
        render(<SettingsTab />);
        const cap = screen.getByLabelText('Daily boost cap');

        fireEvent.change(cap, { target: { value: '0' } });

        expect(screen.getByText('Enter 1–20 boosts')).toBeInTheDocument();
        // The cap's Save button (second one) is disabled.
        expect(screen.getAllByRole('button', { name: 'Save' })[1]).toBeDisabled();
    });

    it('saves a valid change with the right args and toasts success', async () => {
        render(<SettingsTab />);
        const cooldown = screen.getByLabelText('Boost cooldown');

        fireEvent.change(cooldown, { target: { value: '14' } });
        fireEvent.click(screen.getAllByRole('button', { name: 'Save' })[0]);

        await waitFor(() => {
            expect(mockUpdateSetting).toHaveBeenCalledWith({ key: 'boostCooldownDays', value: 14 });
        });
        expect(mockToast.success).toHaveBeenCalledWith('Boost cooldown updated');
    });

    it('toasts an error when the mutation rejects', async () => {
        mockUpdateSetting.mockRejectedValue(new Error('Value 14 is out of range'));
        render(<SettingsTab />);
        const cap = screen.getByLabelText('Daily boost cap');

        fireEvent.change(cap, { target: { value: '5' } });
        fireEvent.click(screen.getAllByRole('button', { name: 'Save' })[1]);

        await waitFor(() => {
            expect(mockToast.error).toHaveBeenCalledWith('Value 14 is out of range');
        });
    });

    it('degrades gracefully when a setting has not been seeded', () => {
        mockUseQuery.mockReturnValue([]);
        render(<SettingsTab />);

        // Both fields still render (from defaults), Save disabled, seed hint shown.
        expect(screen.getByText('Boost cooldown')).toBeInTheDocument();
        expect(screen.getAllByRole('button', { name: 'Save' })[0]).toBeDisabled();
        expect(screen.getAllByText(/seedAppSettings/).length).toBeGreaterThan(0);
    });
});
