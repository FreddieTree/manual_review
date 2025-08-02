// tests/frontend/test-utils.tsx
import React from "react";
import { render as rtlRender } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

type Options = {
    route?: string;
    routerEntries?: string[];
    wrapper?: React.ComponentType<{ children: React.ReactNode }>;
};

export function render(ui: React.ReactElement, options: Options = {}) {
    const { route = "/", routerEntries = [route], wrapper: ExtWrapper } = options;

    function AllProviders({ children }: { children: React.ReactNode }) {
        const tree = <MemoryRouter initialEntries={routerEntries}>{children}</MemoryRouter>;
        return ExtWrapper ? <ExtWrapper>{tree}</ExtWrapper> : tree;
    }

    return rtlRender(ui, { wrapper: AllProviders as any });
}

// 便捷 re-export
export * from "@testing-library/react";