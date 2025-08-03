// tests/frontend/pages/ReviewerAdminPage.test.jsx
import React from "react";
import { render, screen, fireEvent, waitFor, within } from "../test-utils";
import ReviewerAdminPage from "../../../src/pages/ReviewerAdminPage";
import { vi } from "vitest";

/**
 * 依赖 MSW handlers 中预置的 Alice / Bob，故不做全模块 api mock 以避免冲突。
 */

describe("ReviewerAdminPage", () => {
    afterEach(() => {
        vi.restoreAllMocks();
        vi.clearAllMocks();
    });

    test("renders and loads list", async () => {
        render(<ReviewerAdminPage />);

        expect(screen.getByText(/reviewer management/i)).toBeInTheDocument();

        // Alice 和 Bob 来自 MSW 内存 DB
        await waitFor(() => {
            expect(screen.getByText("Alice")).toBeInTheDocument();
            expect(screen.getByText("Bob")).toBeInTheDocument();
        });
    });

    test("can open delete confirm modal for Alice", async () => {
        render(<ReviewerAdminPage />);

        // 等待 Alice 出现
        const aliceCell = await screen.findByText("Alice");
        const row = aliceCell.closest("tr");
        if (!row) {
            throw new Error("Failed to locate row containing Alice");
        }

        // 在该行内精确找到删除按钮（aria-label 包含 email）
        const deleteBtn = within(row).getByRole("button", {
            name: /delete alice@bristol.ac.uk/i,
        });
        fireEvent.click(deleteBtn);

        // 弹窗出现
        expect(
            await screen.findByRole("alertdialog", { name: /delete reviewer/i })
        ).toBeInTheDocument();
    });
});