import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { useBoostAction, type BoostableAd } from '../../hooks/useBoostAction';
import { BoostConfirmModal } from './BoostConfirmModal';
import { toast } from 'sonner';

// ── Mocks ──────────────────────────────────────────────────────────────────
const mockBoostAd = vi.fn();
const mockRefreshAds = vi.fn();
// `cooldownDays` is what useAppSetting (→ useQuery) reports; drives all the math.
const mocks = vi.hoisted((): { cooldownDays: number | undefined } => ({ cooldownDays: 7 }));

vi.mock('convex/react', () => ({
    useMutation: () => mockBoostAd,
    useQuery: () => mocks.cooldownDays,
}));

vi.mock('../../context/MarketplaceContext', () => ({
    useMarketplace: () => ({ refreshAds: mockRefreshAds }),
}));

vi.mock('sonner', () => ({
    toast: { success: vi.fn(), error: vi.fn() },
}));

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

function Harness({ ad }: { ad: BoostableAd }) {
    const boost = useBoostAction(ad);
    return (
        <div>
            <span data-testid="state">{boost.state}</span>
            {boost.state !== 'ineligible' && (
                <button
                    data-testid="boost-btn"
                    disabled={boost.state === 'cooldown'}
                    aria-label={boost.state === 'cooldown' ? boost.cooldownAria : 'Boost to top'}
                    onClick={() => boost.openConfirm()}
                >
                    {boost.state === 'cooldown' ? boost.cooldownLabel : 'Boost to top'}
                </button>
            )}
            <BoostConfirmModal
                open={boost.isConfirmOpen}
                cooldownDays={boost.cooldownDays}
                isBoosting={boost.isBoosting}
                onConfirm={() => void boost.confirmBoost()}
                onCancel={boost.closeConfirm}
            />
        </div>
    );
}

const makeAd = (over: Partial<BoostableAd> = {}): BoostableAd => ({
    _id: 'ad1' as unknown as BoostableAd['_id'],
    bumpedAt: Date.now() - 30 * DAY,
    isActive: true,
    isSold: false,
    ...over,
});

describe('useBoostAction — display states', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.cooldownDays = 7;
        mockBoostAd.mockResolvedValue(null);
    });

    it('eligible: an aged ad past cooldown shows the "Boost to top" button', () => {
        render(<Harness ad={makeAd()} />);
        expect(screen.getByTestId('state')).toHaveTextContent('eligible');
        const btn = screen.getByTestId('boost-btn');
        expect(btn).toHaveTextContent('Boost to top');
        expect(btn).not.toBeDisabled();
    });

    it('cooldown: shows "Boost in Xd" (days) and a disabled button when ≥24h remain', () => {
        render(<Harness ad={makeAd({ bumpedAt: Date.now() - 2 * DAY })} />);
        expect(screen.getByTestId('state')).toHaveTextContent('cooldown');
        const btn = screen.getByTestId('boost-btn');
        expect(btn).toHaveTextContent('Boost in 5d');
        expect(btn).toBeDisabled();
        expect(btn).toHaveAttribute('aria-label', 'You can boost this flyer again in 5 days.');
    });

    it('cooldown: shows hours ("Boost in 3h") in the final day, never a stale "1d"', () => {
        render(<Harness ad={makeAd({ bumpedAt: Date.now() - (7 * DAY - 3 * HOUR) })} />);
        const btn = screen.getByTestId('boost-btn');
        expect(btn).toHaveTextContent('Boost in 3h');
        expect(btn).toHaveAttribute('aria-label', 'You can boost this flyer again in 3 hours.');
    });

    it('ineligible: a sold ad renders no button', () => {
        render(<Harness ad={makeAd({ isSold: true })} />);
        expect(screen.getByTestId('state')).toHaveTextContent('ineligible');
        expect(screen.queryByTestId('boost-btn')).not.toBeInTheDocument();
    });

    it('ineligible: a bundled ad renders no button', () => {
        render(<Harness ad={makeAd({ bundleId: 'b1' })} />);
        expect(screen.getByTestId('state')).toHaveTextContent('ineligible');
        expect(screen.queryByTestId('boost-btn')).not.toBeInTheDocument();
    });

    it('ineligible: an inactive ad renders no button', () => {
        render(<Harness ad={makeAd({ isActive: false })} />);
        expect(screen.queryByTestId('boost-btn')).not.toBeInTheDocument();
    });

    it('countdown uses the reactive config value, not a hardcoded 7', () => {
        mocks.cooldownDays = 3; // admin shortened the cooldown
        render(<Harness ad={makeAd({ bumpedAt: Date.now() - 1 * DAY })} />);
        // 3-day cooldown, 1 day elapsed → 2 days left (would be 6d if hardcoded to 7).
        expect(screen.getByTestId('boost-btn')).toHaveTextContent('Boost in 2d');
    });

    it('falls back to the 7-day default while the setting is loading/missing', () => {
        mocks.cooldownDays = undefined; // useAppSetting loading
        render(<Harness ad={makeAd({ bumpedAt: Date.now() - 2 * DAY })} />);
        expect(screen.getByTestId('boost-btn')).toHaveTextContent('Boost in 5d');
    });
});

describe('useBoostAction — confirm modal + flow', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.cooldownDays = 7;
        mockBoostAd.mockResolvedValue(null);
    });

    it('renders the exact confirm copy with the reactive N', () => {
        mocks.cooldownDays = 3;
        render(<Harness ad={makeAd()} />);
        fireEvent.click(screen.getByTestId('boost-btn'));

        const dialog = screen.getByRole('dialog');
        expect(within(dialog).getByText('Boost this flyer?')).toBeInTheDocument();
        expect(
            within(dialog).getByText(/It's free — you can boost again in 3 days\./)
        ).toBeInTheDocument();
        expect(within(dialog).getByRole('button', { name: 'Boost to top' })).toBeInTheDocument();
        expect(within(dialog).getByRole('button', { name: 'Not now' })).toBeInTheDocument();
    });

    it('success: awaits boostAd, then forces a feed refresh and toasts success', async () => {
        render(<Harness ad={makeAd()} />);
        fireEvent.click(screen.getByTestId('boost-btn'));
        fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Boost to top' }));

        await waitFor(() => expect(mockBoostAd).toHaveBeenCalledWith({ adId: 'ad1' }));
        await waitFor(() => expect(mockRefreshAds).toHaveBeenCalledWith(true));
        expect(toast.success).toHaveBeenCalledWith("You're back on top of the board 🎉");
        expect(toast.error).not.toHaveBeenCalled();
    });

    it('error: toasts the server message, no refresh, no celebration', async () => {
        mockBoostAd.mockRejectedValue(new Error('You can boost this flyer again in 5 days'));
        render(<Harness ad={makeAd()} />);
        fireEvent.click(screen.getByTestId('boost-btn'));
        fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Boost to top' }));

        await waitFor(() =>
            expect(toast.error).toHaveBeenCalledWith('You can boost this flyer again in 5 days')
        );
        expect(mockRefreshAds).not.toHaveBeenCalled();
        expect(toast.success).not.toHaveBeenCalled();
    });
});
