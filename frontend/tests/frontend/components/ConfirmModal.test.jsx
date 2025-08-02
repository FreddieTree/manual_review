import React from "react";
import { render, screen, fireEvent } from "../test-utils";
import ConfirmModal from "../../../src/components/ConfirmModal";

describe("ConfirmModal", () => {
    test("renders with title/description and a11y attributes", () => {
        const onCancel = vi.fn();
        render(
            <ConfirmModal
                open
                title="Delete reviewer"
                description="This cannot be undone."
                onCancel={onCancel}
            />
        );
        const dialog = screen.getByRole("alertdialog", { name: /delete reviewer/i });
        expect(dialog).toBeInTheDocument();
        expect(dialog).toHaveAttribute("aria-modal", "true");
        expect(screen.getByText(/cannot be undone/i)).toBeInTheDocument();
    });

    test("calls onConfirm and onCancel", () => {
        const onConfirm = vi.fn();
        const onCancel = vi.fn();
        render(
            <ConfirmModal open title="Confirm" onConfirm={onConfirm} onCancel={onCancel} />
        );
        fireEvent.click(screen.getByRole("button", { name: /confirm/i }));
        expect(onConfirm).toHaveBeenCalled();

        fireEvent.click(screen.getByRole("button", { name: /close/i }));
        expect(onCancel).toHaveBeenCalled();
    });

    test("backdrop click triggers onCancel", () => {
        const onCancel = vi.fn();
        render(<ConfirmModal open title="X" onCancel={onCancel} />);
        // backdrop 是 modal 的前一个 sibling（固定全屏），用 aria-hidden 区分
        const backdrops = screen.getAllByRole("presentation", { hidden: true });
        // 我们的 backdrop 没有 role，改用 query 方式更稳：用 fixed 层作为 click target
        const backdrop = document.querySelector(".fixed.inset-0.bg-black\\/30");
        expect(backdrop).toBeTruthy();
        fireEvent.click(backdrop);
        expect(onCancel).toHaveBeenCalled();
    });
});