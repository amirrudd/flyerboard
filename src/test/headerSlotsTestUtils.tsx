import { useState, useSyncExternalStore, type ReactNode } from "react";
import { HeaderSlotsContext, HeaderSlotsStore } from "../features/layout/HeaderSlots";

/**
 * Test harness for components that register header slots via `useHeaderSlots`
 * (the persistent Layout header pattern). In the app the slots render inside
 * Layout's single <Header>; in unit tests this harness renders them into
 * plain testid'd divs so assertions like "share button is in the header"
 * keep working without mounting the real Layout/Header.
 */
function HarnessHeader({ store }: { store: HeaderSlotsStore }) {
    const slots = useSyncExternalStore(store.subscribe, store.getSnapshot);
    if (slots?.hidden) return null;
    return (
        <div data-testid="header">
            <div data-testid="header-left">{slots?.leftNode}</div>
            <div data-testid="header-center">{slots?.centerNode}</div>
            <div data-testid="header-right">{slots?.rightNode}</div>
        </div>
    );
}

export function HeaderSlotsHarness({ children }: { children: ReactNode }) {
    const [store] = useState(() => new HeaderSlotsStore());
    return (
        <HeaderSlotsContext.Provider value={store}>
            <HarnessHeader store={store} />
            {children}
        </HeaderSlotsContext.Provider>
    );
}
