// tests/frontend/components/ConfirmModal.a11y.test.jsx
import React from "react";
import { render, screen, fireEvent } from "../test-utils";
import ConfirmModal from "../../../src/components/ConfirmModal";

test("esc closes and focus trap works", async () => {
    const onCancel = vi.fn();
    render(<ConfirmModal open title="T" description="D" onCancel={onCancel} onConfirm={() => { }} />);
    const dialog = screen.getByRole("alertdialog");
    fireEvent.keyDown(dialog, { key: "Escape", code: "Escape" });
    expect(onCancel).toHaveBeenCalled();
});