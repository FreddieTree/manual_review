import React from "react";
import { render, screen, fireEvent, waitFor } from "../test-utils";
import ReviewerAdminPage from "../../../src/pages/ReviewerAdminPage";

// 模块级 API mock
vi.mock("../../../src/api", () => ({
    getReviewers: vi.fn().mockResolvedValue({
        reviewers: [
            { email: "a@bristol.ac.uk", name: "Alice", role: "reviewer", active: true, note: "" },
            { email: "b@bristol.ac.uk", name: "Bob", role: "admin", active: false, note: "on leave" },
        ],
        meta: { total: 2 },
    }),
    addReviewer: vi.fn().mockResolvedValue({ success: true }),
    updateReviewer: vi.fn().mockResolvedValue({ success: true }),
    deleteReviewer: vi.fn().mockResolvedValue({ success: true }),
}));

describe("ReviewerAdminPage", () => {
    test("renders and loads list", async () => {
        render(<ReviewerAdminPage />);
        expect(screen.getByText(/reviewer management/i)).toBeInTheDocument();
        await waitFor(() => {
            expect(screen.getByText("Alice")).toBeInTheDocument();
            expect(screen.getByText("Bob")).toBeInTheDocument();
        });
    });

    test("can open delete confirm modal", async () => {
        render(<ReviewerAdminPage />);
        await screen.findByText("Alice");
        fireEvent.click(screen.getByRole("button", { name: /delete a@bristol.ac.uk/i }));
        // 确认弹窗
        expect(screen.getByRole("alertdialog", { name: /delete reviewer/i })).toBeInTheDocument();
    });
});