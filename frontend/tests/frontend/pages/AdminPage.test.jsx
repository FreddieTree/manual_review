// tests/frontend/pages/AdminPage.test.jsx
import React from "react";
import { render, screen, fireEvent, waitFor } from "../test-utils";
import AdminPage from "../../../src/pages/AdminPage";
import { vi } from "vitest";

// Stub child components if needed (optional, depending on implementation)
// For example, if AdminPage composes others you want to isolate, you can mock them here.
// vi.mock("../../../src/components/SomeChild", () => ({ default: () => <div>Stub</div> }));

// Use MSW by default; override only if you need a tailored response.
import * as api from "../../../src/api";

// If you want to force a certain stats payload instead of relying on the shared MSW default,
// you can override via server.use in this test file. Otherwise, assume handlers provide the expected stats.

describe("AdminPage", () => {
    test("shows key stats and refresh works", async () => {
        render(<AdminPage />);

        // Wait for stats to appear (comes from MSW handler)
        await screen.findByText(/total abstracts/i);

        expect(screen.getByText("150")).toBeInTheDocument();
        expect(screen.getByText(/fully reviewed/i)).toBeInTheDocument();
        expect(screen.getByText("100")).toBeInTheDocument();

        // Click refresh and expect the underlying API to be hit again.
        const refreshBtn = screen.getByRole("button", { name: /refresh stats/i });
        fireEvent.click(refreshBtn);

        // There's not a direct spy here because we're using MSW; if you want to count calls, you can
        // spy on the module and override the handler. Example (optional):
        // const spy = vi.spyOn(api, "getAdminStats");
        // fireEvent.click(refreshBtn);
        // await waitFor(() => expect(spy).toHaveBeenCalledTimes(1));

        // For now, just ensure the UI doesn't break on refresh.
        await waitFor(() => screen.getByText("150"));
    });
});