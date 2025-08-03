// tests/frontend/pages/ReviewerAdminPage.sort-page.test.jsx
import React from "react";
import { render, screen, fireEvent } from "../test-utils";
import ReviewerAdminPage from "../../../src/pages/ReviewerAdminPage";
import * as api from "../../../src/api";

vi.spyOn(api, "getReviewers").mockResolvedValue({
    reviewers: [
        { email: "b@x.com", name: "Bob", role: "admin", active: false },
        { email: "a@x.com", name: "Alice", role: "reviewer", active: true },
    ],
});

test("sort by name and change per page", async () => {
    render(<ReviewerAdminPage />);
    await screen.findByText("Bob");

    fireEvent.click(screen.getByRole("button", { name: /sort by name/i }));
    // asc -> Alice 在前
    const cells = screen.getAllByRole("cell");
    expect(cells.map(c => c.textContent).join(" ")).toMatch(/Alice.*Bob/);

    fireEvent.change(screen.getByLabelText(/per page/i), { target: { value: "10" } });
    expect(screen.getByText(/page 1 of/i)).toBeInTheDocument();
});