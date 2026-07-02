import { createContext, useContext, useLayoutEffect, useRef, type ReactNode } from "react";

/**
 * Persistent app-shell header — slot registration system.
 *
 * `Layout` renders ONE `<Header>` instance that survives route changes (no
 * more logo/Sign-In popping on every navigation or lazy-chunk load). Pages
 * customise it by registering `leftNode`/`centerNode`/`rightNode` via
 * `useHeaderSlots(...)`; pages that register nothing get the default header
 * (logo + search + location + auth actions, wired from MarketplaceContext).
 *
 * Stale-closure safety: the hook re-pushes the freshly-built config on EVERY
 * render (a no-dep `useLayoutEffect`), so slot JSX may freely close over page
 * state (e.g. AdDetail's `displaySaved`). The infinite-loop hazard of
 * "setState-in-layout-effect-every-render" is avoided because registrations
 * live in this external store and only the header host subscribes (via
 * `useSyncExternalStore`) — pushing a config re-renders the header, never the
 * registering page.
 *
 * Nesting: registrations form a stack in mount order and the most recently
 * MOUNTED registrant wins. This makes inline sub-screens work automatically —
 * e.g. the dashboard registers its header, then the inline `<AdDetail>` it
 * opens registers on top; when AdDetail unmounts the dashboard header is
 * restored. (Caveat: two registrants mounting in the same commit would insert
 * child-first because child layout-effects fire before the parent's — don't
 * mount nested registrants in a single commit; in practice sub-screens always
 * mount on a later user interaction.)
 */
export interface HeaderSlotsConfig {
    leftNode?: ReactNode;
    centerNode?: ReactNode;
    rightNode?: ReactNode;
    /**
     * Render no header at all. Reserved for full-screen sub-views that never
     * had one (e.g. the dashboard's AdMessages screen) — using it on a normal
     * page would defeat the persistent shell.
     */
    hidden?: boolean;
}

type Listener = () => void;

export class HeaderSlotsStore {
    private entries: { id: number; config: HeaderSlotsConfig }[] = [];
    private listeners = new Set<Listener>();
    private nextId = 1;
    private snapshot: HeaderSlotsConfig | null = null;

    register(config: HeaderSlotsConfig): number {
        const id = this.nextId++;
        this.entries.push({ id, config });
        this.emit();
        return id;
    }

    update(id: number, config: HeaderSlotsConfig): void {
        const entry = this.entries.find((e) => e.id === id);
        if (!entry) return;
        entry.config = config;
        this.emit();
    }

    unregister(id: number): void {
        this.entries = this.entries.filter((e) => e.id !== id);
        this.emit();
    }

    subscribe = (listener: Listener): (() => void) => {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    };

    /** `null` means "no page customisation — render the default header". */
    getSnapshot = (): HeaderSlotsConfig | null => this.snapshot;

    private emit(): void {
        this.snapshot = this.entries.length > 0 ? this.entries[this.entries.length - 1].config : null;
        for (const listener of this.listeners) listener();
    }
}

export const HeaderSlotsContext = createContext<HeaderSlotsStore | null>(null);

/**
 * Register custom header slots for the persistent Layout header while the
 * calling component is mounted; the previous registrant's slots (or the
 * default header) are restored on unmount.
 *
 * Call unconditionally at top level (hooks rules) and pass a freshly-built
 * config each render — do NOT memoize it, or slot nodes will go stale.
 * Outside a `HeaderSlotsContext` provider (unit tests, inline embeds) this is
 * a no-op.
 */
export function useHeaderSlots(config: HeaderSlotsConfig): void {
    const store = useContext(HeaderSlotsContext);
    const idRef = useRef<number | null>(null);
    // "Latest ref" pattern so the mount effect can register without depending
    // on (and re-running for) every new config object. Written in the effect
    // below (not during render) to satisfy react-hooks/refs.
    const configRef = useRef<HeaderSlotsConfig | null>(null);

    // Runs on EVERY render, and — because effects fire in call order — BEFORE
    // the mount effect below on the first render: it captures the latest
    // config and re-pushes it so slot nodes never close over stale page state.
    useLayoutEffect(() => {
        configRef.current = config;
        if (store && idRef.current !== null) {
            store.update(idRef.current, config);
        }
    });

    // Register once per mount / unregister on unmount — keeps this
    // registrant's position in the stack stable for its whole lifetime.
    useLayoutEffect(() => {
        if (!store) return;
        const id = store.register(configRef.current ?? {});
        idRef.current = id;
        return () => {
            store.unregister(id);
            idRef.current = null;
        };
    }, [store]);
}
