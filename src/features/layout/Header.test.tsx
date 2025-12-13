import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Header } from './Header';
import { BrowserRouter } from 'react-router-dom';

// Mock child components to simplify testing
vi.mock('./HeaderRightActions', () => ({
    HeaderRightActions: () => <div data-testid="header-right-actions">Actions</div>,
}));

vi.mock('../auth/SignOutButton', () => ({
    SignOutButton: () => <button>Sign Out</button>,
}));

// Mock location service
vi.mock('../../lib/locationService', () => ({
    searchLocations: vi.fn().mockResolvedValue([]),
    formatLocation: vi.fn((loc) => loc.locality),
}));

// Mock performance utils (debounce)
vi.mock('../../lib/performanceUtils', () => ({
    debounce: (fn: Function) => fn,
}));

describe('Header', () => {
    const renderHeader = (props = {}) => {
        return render(
            <BrowserRouter>
                <Header {...props} />
            </BrowserRouter>
        );
    };

    it('should render logo and search bar', () => {
        renderHeader();
        // Logo appears in both desktop and mobile views
        const logos = screen.getAllByText('FlyerBoard');
        expect(logos.length).toBeGreaterThan(0);

        // Search bar might also appear multiple times
        const searchInputs = screen.getAllByPlaceholderText('Search in flyers...');
        expect(searchInputs.length).toBeGreaterThan(0);
    });

    it('should render right actions', () => {
        renderHeader();
        expect(screen.getByTestId('header-right-actions')).toBeInTheDocument();
    });

    it('should call setSearchQuery when typing in search bar', () => {
        const setSearchQuery = vi.fn();
        renderHeader({ setSearchQuery });

        // Target the desktop search input (or the first one found)
        const inputs = screen.getAllByPlaceholderText('Search in flyers...');
        fireEvent.change(inputs[0], { target: { value: 'test' } });

        expect(setSearchQuery).toHaveBeenCalledWith('test');
    });

    it('should toggle sidebar when menu button is clicked (mobile)', () => {
        // Resize window to mobile size
        window.innerWidth = 500;
        fireEvent(window, new Event('resize'));

        const setSidebarCollapsed = vi.fn();
        renderHeader({ setSidebarCollapsed, sidebarCollapsed: false });

        const menuButtons = screen.getAllByTitle(/menu/i);
        // Assuming the mobile one is visible or at least present
        fireEvent.click(menuButtons[0]);

        expect(setSidebarCollapsed).toHaveBeenCalled();
    });
});
