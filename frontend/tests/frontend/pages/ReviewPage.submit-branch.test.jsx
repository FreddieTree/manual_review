// tests/frontend/pages/ReviewPage.submit-branch.test.jsx
import React from "react";
import { render, screen, fireEvent, waitFor, within } from "../test-utils";
import ReviewPage from "../../../src/pages/ReviewPage";
import * as api from "../../../src/api";
import * as utils from "../../../src/utils";

vi.spyOn(api, "getAssignedAbstract").mockResolvedValue({
    abstract: { pmid: "1", sentence_count: 1, sentence_results: [{ sentence_index: 0, sentence: "S", assertions: [{}] }] }
});
vi.spyOn(utils, "deriveOverallDecision").mockReturnValue("modify");
vi.spyOn(api, "submitReview").mockResolvedValue({});

test("shows confirm when overallDecision is not accept", async () => {
    render(<ReviewPage />);
    await screen.findByText(/loading/i); // 初始 loading
    // 等待页面渲染出提交按钮（比猜测 loading 文案更稳）
    const submitBtn = await screen.findByRole("button", { name: /submit review/i });
    fireEvent.click(submitBtn);
    const dialog = await screen.findByRole("alertdialog");
    const confirmBtn = within(dialog).getByRole("button", { name: /^delete$|^submit$/i });
    fireEvent.click(confirmBtn);
    await waitFor(() => expect(api.submitReview).toHaveBeenCalled());
});