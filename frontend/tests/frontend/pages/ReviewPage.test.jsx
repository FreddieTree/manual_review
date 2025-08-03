// tests/frontend/pages/ReviewPage.test.jsx
import React from "react";
import { render, screen, fireEvent, waitFor, within } from "../test-utils";
import ReviewPage from "../../../src/pages/ReviewPage";
import * as api from "../../../src/api";
import * as utils from "../../../src/utils";
import { vi } from "vitest";

/**
 * STUBS
 * - Avoid duplicate testids: only ReviewPage should supply data-testid="TopBar" and "AbstractMetaCard".
 */
vi.mock("../../../src/components/AbstractMetaCard", () => ({
    default: (props) => <div>PMID:{props.pmid}</div>, // no testid here
}));
vi.mock("../../../src/components/AssertionEditor", () => ({
    default: (props) => (
        <div data-testid={`AssertionEditor-${props.idx}`}>Editor {props.idx}</div>
    ),
}));
vi.mock("../../../src/components/AssertionSummaryPanel", () => ({
    default: () => <div data-testid="SummaryPanel">Summary</div>,
}));
vi.mock("../../../src/components/TopBar", () => ({
    default: () => <div>TopBar</div>, // **removed data-testid to avoid duplication**
}));

// stub user hook
vi.mock("../../../src/hooks/useUser", () => ({
    useUser: () => ({ user: { name: "Tina" }, loading: false, logout: vi.fn() }),
}));

describe("ReviewPage flows", () => {
    afterEach(() => {
        vi.clearAllMocks();
        vi.restoreAllMocks();
    });

    test("loads abstract and submits when overallDecision is accept", async () => {
        vi.spyOn(utils, "deriveOverallDecision").mockReturnValue("accept");

        const getAssignedAbstractSpy = vi
            .spyOn(api, "getAssignedAbstract")
            .mockResolvedValue({
                abstract: {
                    pmid: "12345",
                    sentence_count: 1,
                    sentence_results: [
                        {
                            sentence_index: 1,
                            sentence: "S1",
                            assertions: [{ subject: "A", predicate: "rel", object: "B" }],
                        },
                    ],
                },
            });
        const submitReviewSpy = vi
            .spyOn(api, "submitReview")
            .mockResolvedValue({ success: true });

        render(<ReviewPage />);

        // 等待页面加载完成：TopBar 外层 wrapper 提供 data-testid="TopBar"
        const topBar = await screen.findByTestId("TopBar");
        expect(topBar).toBeInTheDocument();

        // 确认 meta card wrapper 显示 PMID（ReviewPage 本身提供 testid）
        const metaWrapper = await screen.findByTestId("AbstractMetaCard");
        expect(metaWrapper).toHaveTextContent("PMID:12345");

        // 点击 submit（overallDecision 是 accept，不会弹确认）
        const submitBtn = await screen.findByRole("button", { name: /submit review/i });
        fireEvent.click(submitBtn);

        // 等待提交被调用并且成功消息出现
        await waitFor(() => {
            expect(submitReviewSpy).toHaveBeenCalled();
        });
        expect(await screen.findByText(/review submitted/i)).toBeInTheDocument();

        // sanity check: abstract 被拉取
        expect(getAssignedAbstractSpy).toHaveBeenCalled();
    });

    test("shows confirm when overallDecision is not accept and submits after confirming", async () => {
        vi.spyOn(utils, "deriveOverallDecision").mockReturnValue("modify");

        vi.spyOn(api, "getAssignedAbstract").mockResolvedValue({
            abstract: {
                pmid: "1",
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
        const submitSpy = vi.spyOn(api, "submitReview").mockResolvedValue({ ok: true });

        render(<ReviewPage />);

        const submitBtn = await screen.findByRole("button", { name: /submit review/i });
        fireEvent.click(submitBtn);

        // 确认框出现
        const dialog = await screen.findByRole("alertdialog");
        const confirmBtn = within(dialog).getByRole("button", { name: /^submit$/i });
        fireEvent.click(confirmBtn);

        await waitFor(() => {
            expect(submitSpy).toHaveBeenCalled();
        });
        expect(await screen.findByText(/review submitted/i)).toBeInTheDocument();
    });
});