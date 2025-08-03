// tests/frontend/pages/ReviewPage.submit-branch.test.jsx
import React from "react";
import { render, screen, fireEvent, waitFor, within } from "../test-utils";
import ReviewPage from "../../../src/pages/ReviewPage";
import * as api from "../../../src/api";
import * as utils from "../../../src/utils";
import { vi } from "vitest";

// stub 子组件，隔离页面逻辑
vi.mock("../../../src/components/AbstractMetaCard", () => ({
    default: (props) => <div data-testid="AbstractMetaCard">PMID:{props.pmid}</div>,
}));
vi.mock("../../../src/components/AssertionEditor", () => ({
    default: (props) => <div data-testid={`AssertionEditor-${props.idx}`}>Editor {props.idx}</div>,
}));
vi.mock("../../../src/components/AssertionSummaryPanel", () => ({
    default: () => <div data-testid="SummaryPanel">Summary</div>,
}));
vi.mock("../../../src/components/TopBar", () => ({
    default: () => <div data-testid="TopBar">TopBar</div>,
}));

// user hook stub (如果 ReviewPage 依赖)
vi.mock("../../../src/hooks/useUser", () => ({
    useUser: () => ({ user: { name: "Tina" }, loading: false, logout: vi.fn() }),
}));

describe("ReviewPage submit branch (overallDecision !== accept)", () => {
    beforeEach(() => {
        // spy and mock implementations
        vi.spyOn(utils, "deriveOverallDecision").mockReturnValue("modify");

        vi.spyOn(api, "getAssignedAbstract").mockResolvedValue({
            abstract: {
                pmid: "1",
                title: "T",
                journal: "J",
                year: 2024,
                sentence_count: 1,
                sentence_results: [
                    {
                        sentence_index: 1,
                        sentence: "S",
                        assertions: [{}],
                    },
                ],
            },
        });

        vi.spyOn(api, "submitReview").mockResolvedValue({ ok: true });
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.clearAllMocks();
    });

    test("shows confirm when overallDecision is not accept and submits after confirmation", async () => {
        render(<ReviewPage />);

        // 等待 submit 按钮出现（代表页面加载完成）
        const submitBtn = await screen.findByRole("button", { name: /submit review/i });
        fireEvent.click(submitBtn);

        // 由于 overallDecision 是 "modify"，会弹出确认框
        const dialog = await screen.findByRole("alertdialog");
        const confirmBtn = within(dialog).getByRole("button", { name: /^submit$/i });
        fireEvent.click(confirmBtn);

        // 最终触发 submitReview
        await waitFor(() => {
            expect(api.submitReview).toHaveBeenCalled();
        });
    });
});