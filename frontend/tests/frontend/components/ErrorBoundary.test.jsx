import React from "react";
import { render, screen, fireEvent } from "../test-utils";
import ErrorBoundary from "../../../src/components/ErrorBoundary";

function Boom() {
    // 直接 throw 触发 ErrorBoundary
    throw new Error("boom!");
}

describe("ErrorBoundary", () => {
    test("shows fallback UI and can retry", () => {
        render(
            <ErrorBoundary>
                <Boom />
            </ErrorBoundary>
        );
        expect(screen.getByRole("alert")).toBeInTheDocument();
        expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();

        const retry = screen.getByRole("button", { name: /retry/i });
        fireEvent.click(retry);
        // retry 会 reset，并重新渲染 children；为了简单，这里重试后仍报错，仍显示 fallback
        expect(screen.getByRole("alert")).toBeInTheDocument();
    });
});