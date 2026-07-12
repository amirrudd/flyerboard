import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SaleMessageModal } from './SaleMessageModal';
import type { SaleItem } from './types';

// Descope session — controlled per test.
const mockUseSession = vi.fn();
vi.mock('@descope/react-sdk', () => ({
    useSession: () => mockUseSession(),
}));

// User-sync gate — controlled per test.
const mockUseUserSync = vi.fn();
vi.mock('../../context/UserSyncContext', () => ({
    useUserSync: () => mockUseUserSync(),
}));

// Convex hooks — no real backend in jsdom.
const mockSendMessage = vi.fn();
vi.mock('convex/react', () => ({
    useQuery: () => undefined,
    useMutation: () => mockSendMessage,
}));

// ImageDisplay pulls in convex/lazy-load — stub it.
vi.mock('../../components/ui/ImageDisplay', () => ({
    ImageDisplay: ({ alt }: any) => <img alt={alt} />,
}));

const items: SaleItem[] = [
    {
        _id: 'ad1' as any,
        title: 'Vintage Lamp',
        price: 40,
        images: ['r2:flyers/ad1/x.jpg'],
        categoryId: 'cat1' as any,
        isSold: false,
    },
];

const baseProps = {
    saleEventId: 'sale1' as any,
    sellerName: 'Jane Doe',
    items,
    isOpen: true,
    preselectedAdId: null,
    onClose: vi.fn(),
};

describe('SaleMessageModal - auth gate', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('shows the sign-in gate and hides the composer when unauthenticated', () => {
        mockUseSession.mockReturnValue({ isAuthenticated: false, isSessionLoading: false });
        mockUseUserSync.mockReturnValue({ isUserSynced: false });

        render(<SaleMessageModal {...baseProps} />);

        // The gate copy + the Sign in button are present.
        expect(screen.getByText(/Sign in to message/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();

        // The composer textarea must NOT be rendered for unauthenticated users.
        expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
        expect(screen.queryByLabelText('Send')).not.toBeInTheDocument();
    });

    it('shows the composer textarea when authenticated and synced', () => {
        mockUseSession.mockReturnValue({ isAuthenticated: true, isSessionLoading: false });
        mockUseUserSync.mockReturnValue({ isUserSynced: true });

        render(<SaleMessageModal {...baseProps} />);

        // Composer is present; the sign-in gate is not.
        expect(screen.getByRole('textbox')).toBeInTheDocument();
        expect(screen.getByLabelText('Send')).toBeInTheDocument();
        expect(screen.queryByText(/Sign in to message/i)).not.toBeInTheDocument();
    });

    it('renders nothing when closed', () => {
        mockUseSession.mockReturnValue({ isAuthenticated: false, isSessionLoading: false });
        mockUseUserSync.mockReturnValue({ isUserSynced: false });

        const { container } = render(<SaleMessageModal {...baseProps} isOpen={false} />);

        expect(container).toBeEmptyDOMElement();
        expect(screen.queryByText(/Sign in to message/i)).not.toBeInTheDocument();
    });
});
