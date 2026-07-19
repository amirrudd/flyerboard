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

        // Description comes from the REGISTRY, not the stale DB row.
        expect(screen.getByText(/How many boosts one user can use per day/)).toBeInTheDocument();
        expect(screen.queryByText('Max boosts per day.')).not.toBeInTheDocument();

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

    it('renders group headings and the total settings count', () => {
        render(<SettingsTab />);

        for (const heading of ['Boost', 'Bundles', 'Moving Sales', 'Feed', 'Rate limits']) {
            expect(screen.getByText(heading)).toBeInTheDocument();
        }
        // 7 seeded knobs + 11 overridable rate-limit ops.
        expect(screen.getByText('18 settings')).toBeInTheDocument();
    });

    it('shows the built-in limit for a rate-limit field with no row and saves an override', async () => {
        render(<SettingsTab />); // SEEDED has no rateLimitMax_* rows

        const input = screen.getByLabelText('Post new flyers');
        expect(input).toHaveValue(10); // built-in limit from RATE_LIMITS.createAd
        expect(input).toBeEnabled(); // sparse — editable despite the missing row
        // Raw op name stays visible as a monospace hint for log correlation.
        expect(screen.getByText('createAd')).toBeInTheDocument();
        // Plain-language description + unset-state copy (scoped to the card —
        // submitRating shares the 10/hour limit, so the copy repeats).
        const card = input.closest('article')!;
        expect(card).toHaveTextContent('How many flyers one user can post per hour.');
        expect(card).toHaveTextContent(
            'Built-in limit: 10 per user per hour. It applies as-is — save a different number only if you want to change it.',
        );

        fireEvent.change(input, { target: { value: '20' } });
        const save = card.querySelector('button')!;
        expect(save).toBeEnabled();
        fireEvent.click(save);

        await waitFor(() => {
            expect(mockUpdateSetting).toHaveBeenCalledWith({ key: 'rateLimitMax_createAd', value: 20 });
        });
    });

    it('shows the override note once a rate-limit row exists', () => {
        mockUseQuery.mockReturnValue([
            ...SEEDED,
            {
                _id: 'setting_rl_chat' as any,
                _creationTime: 4,
                key: 'rateLimitMax_createChat',
                value: 30,
                description: 'stale stored text',
            },
        ]);
        render(<SettingsTab />);

        const input = screen.getByLabelText('Start new chats');
        expect(input).toHaveValue(30);
        expect(screen.getByText('Overrides the built-in limit of 20 per hour.')).toBeInTheDocument();
        expect(screen.getByText('chats per user / hour')).toBeInTheDocument();
        expect(screen.queryByText('stale stored text')).not.toBeInTheDocument();
    });

    it('rejects an over-clamp rate-limit value client-side (max 4× the built-in limit)', () => {
        render(<SettingsTab />);
        const input = screen.getByLabelText('Post new flyers');

        fireEvent.change(input, { target: { value: '41' } }); // createAd built-in 10 → max 40

        expect(screen.getByText('Enter 1–40 flyers')).toBeInTheDocument();
        const save = input.closest('article')!.querySelector('button')!;
        expect(save).toBeDisabled();
    });

    it('renders a grouped non-boost field with its seeded value and registry description', () => {
        mockUseQuery.mockReturnValue([
            ...SEEDED,
            {
                _id: 'setting_bundle_max' as any,
                _creationTime: 3,
                key: 'bundleMaxItems',
                value: 4,
                description: 'Max ads in one bundle.',
            },
        ]);
        render(<SettingsTab />);

        const input = screen.getByLabelText('Bundle max items');
        expect(input).toHaveValue(4);
        // Registry description wins over the stored row's stale text.
        expect(
            screen.getByText('The most flyers a seller can group into a single bundle.'),
        ).toBeInTheDocument();
        expect(screen.queryByText('Max ads in one bundle.')).not.toBeInTheDocument();
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
