import React from "react";
import { render, screen, fireEvent, waitFor } from "../test-utils";
import ReviewPage from "../../../src/pages/ReviewPage";

// stub 子组件，聚焦页面行为
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

// mock hooks & api
vi.mock("../../../src/hooks/useUser", () => ({
    useUser: () => ({ user: { name: "Tina" }, loading: false, logout: vi.fn() }),
}));

const mockGetAssignedAbstract = vi.fn().mockResolvedValue({
    abstract: {
        pmid: "12345",
        sentence_count: 1,
        sentence_results: [
            {
                sentence_index: 0,
                sentence: "S1",
                assertions: [{ subject: "A", predicate: "rel", object: "B" }],
            },
        ],
    },
});
const mockSubmitReview = vi.fn().mockResolvedValue({ success: true });

vi.mock("../../../src/api", () => ({
    getAssignedAbstract: () => mockGetAssignedAbstract(),
    submitReview: (payload) => mockSubmitReview(payload),
}));

describe("ReviewPage", () => {
    test("loads abstract and submits", async () => {
        render(<ReviewPage />);
        await waitFor(() => screen.getByTestId("TopBar"));
        expect(screen.getByTestId("AbstractMetaCard")).toHaveTextContent("PMID:12345");

        const submitBtn = screen.getByRole("button", { name: /submit review/i });
        fireEvent.click(submitBtn);

        await waitFor(() => {
            expect(mockSubmitReview).toHaveBeenCalled();
            expect(screen.getByText(/review submitted/i)).toBeInTheDocument();
        });
    });
});