import React from "react";
import { render, screen, fireEvent, waitFor } from "../test-utils";
import AdminPage from "../../../src/pages/AdminPage";

const mockGetAdminStats = vi.fn().mockResolvedValue({
    reviewed_ratio: 66.6,
    reviewed_count: 100,
    total_abstracts: 150,
    total_reviewers: 10,
    arbitration_count: 2,
    active_reviewers: 5,
    conflicts: 2,
    abstracts_today: 3,
    new_reviewers: 1,
    last_export: "2025-06-01 10:00",
});

vi.mock("../../../src/api", () => ({
    getAdminStats: () => mockGetAdminStats(),
}));

describe("AdminPage", () => {
    test("shows key stats and refresh works", async () => {
        render(<AdminPage />);
        await screen.findByText(/total abstracts/i);
        expect(screen.getByText("150")).toBeInTheDocument();
        expect(screen.getByText(/fully reviewed/i)).toBeInTheDocument();
        expect(screen.getByText("100")).toBeInTheDocument();
        // 刷新
        fireEvent.click(screen.getByRole("button", { name: /refresh stats/i }));
        await waitFor(() => expect(mockGetAdminStats).toHaveBeenCalledTimes(2));
    });
});