import React from "react";
import { render, screen, fireEvent, waitFor } from "../test-utils";
import ReviewersPage from "../../../src/pages/ReviewersPage";
import { vi } from "vitest";

describe("ReviewersPage (MSW-powered)", () => {
    test("loads, searches and deletes", async () => {
        vi.useFakeTimers();
        render(<ReviewersPage />);
        // 加载
        await screen.findByText("Alice");

        // 搜索 Bob
        fireEvent.change(screen.getByRole("textbox", { name: /search reviewers/i }), {
            target: { value: "bob" },
        });
        await act(async () => { vi.advanceTimersByTime(350); });
        // 结果过滤
        await screen.findByText("Bob");
        await waitFor(() => {
            expect(screen.queryByText("Alice")).not.toBeInTheDocument();
        });

        // 删除 Bob -> 打开确认弹窗
        fireEvent.click(screen.getByRole("button", { name: /delete bob@bristol\.ac\.uk/i }));
        expect(screen.getByRole("alertdialog")).toBeInTheDocument();
        // 确认删除
        fireEvent.click(screen.getByRole("button", { name: /delete/i }));
        await waitFor(() => {
            // 成功提示
            expect(screen.getByText(/reviewer deleted/i)).toBeInTheDocument();
        });
        vi.useRealTimers();
    });
});