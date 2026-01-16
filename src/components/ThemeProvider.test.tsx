import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { ThemeProvider, useTheme } from './ThemeProvider';

// Mock localStorage
const localStorageMock = (() => {
    let store: Record<string, string> = {};
    return {
        getItem: vi.fn((key: string) => store[key] || null),
        setItem: vi.fn((key: string, value: string) => {
            store[key] = value.toString();
        }),
        clear: vi.fn(() => {
            store = {};
        }),
    };
})();

Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
});

// Mock matchMedia
const matchMediaMock = vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
}));

Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: matchMediaMock,
});

describe('ThemeProvider', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorageMock.clear();
        document.documentElement.classList.remove('light', 'dark');
    });

    const TestComponent = () => {
        const { theme, setTheme } = useTheme();
        return (
            <div>
                <span data-testid="theme-value">{theme}</span>
                <button onClick={() => setTheme('light')}>Set Light</button>
                <button onClick={() => setTheme('dark')}>Set Dark</button>
                <button onClick={() => setTheme('system')}>Set System</button>
            </div>
        );
    };

    it('provides default theme and applies it to document', () => {
        render(
            <ThemeProvider defaultTheme="light">
                <TestComponent />
            </ThemeProvider>
        );

        expect(screen.getByTestId('theme-value')).toHaveTextContent('light');
        expect(document.documentElement.classList.contains('light')).toBe(true);
    });

    it('persists theme to localStorage when changed', () => {
        render(
            <ThemeProvider defaultTheme="light" storageKey="test-theme">
                <TestComponent />
            </ThemeProvider>
        );

        const darkButton = screen.getByText('Set Dark');
        act(() => {
            darkButton.click();
        });

        expect(screen.getByTestId('theme-value')).toHaveTextContent('dark');
        expect(localStorageMock.setItem).toHaveBeenCalledWith('test-theme', 'dark');
        expect(document.documentElement.classList.contains('dark')).toBe(true);
    });

    it('uses theme from localStorage if available', () => {
        localStorageMock.setItem('test-theme', 'dark');

        render(
            <ThemeProvider defaultTheme="light" storageKey="test-theme">
                <TestComponent />
            </ThemeProvider>
        );

        expect(screen.getByTestId('theme-value')).toHaveTextContent('dark');
        expect(document.documentElement.classList.contains('dark')).toBe(true);
    });

    it('respects system preference when theme is system', () => {
        matchMediaMock.mockImplementation(query => ({
            matches: query === '(prefers-color-scheme: dark)',
            media: query,
        }));

        render(
            <ThemeProvider defaultTheme="system">
                <TestComponent />
            </ThemeProvider>
        );

        expect(screen.getByTestId('theme-value')).toHaveTextContent('system');
        expect(document.documentElement.classList.contains('dark')).toBe(true);
    });
});
