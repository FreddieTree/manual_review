import { renderHook, act } from "@testing-library/react";
import { useDebouncedValue, useDebouncedCallback } from "@/hooks/useDebounce";
import { vi } from "vitest";

describe("useDebouncedValue", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it("trailing update after delay", () => {
        const { result, rerender } = renderHook(
            ({ v }) => useDebouncedValue(v, 200),
            { initialProps: { v: "a" } }
        );
        expect(result.current).toBe("a");
        rerender({ v: "b" });
        expect(result.current).toBe("a"); // still old
        act(() => vi.advanceTimersByTime(199));
        expect(result.current).toBe("a");
        act(() => vi.advanceTimersByTime(1));
        expect(result.current).toBe("b");
    });

    it("leading updates immediately when enabled", () => {
        const { result, rerender } = renderHook(
            ({ v }) => useDebouncedValue(v, 200, { leading: true }),
            { initialProps: { v: "a" } }
        );
        expect(result.current).toBe("a");
        rerender({ v: "x" });
        expect(result.current).toBe("x");
    });
});

describe("useDebouncedCallback", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it("calls trailing once with last args", () => {
        const spy = vi.fn();
        const { result } = renderHook(() => useDebouncedCallback(spy, 200));
        act(() => {
            result.current[0]("a");
            result.current[0]("b");
        });
        expect(spy).not.toHaveBeenCalled();
        act(() => vi.advanceTimersByTime(200));
        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy).toHaveBeenCalledWith("b");
    });

    it("leading triggers immediately", () => {
        const spy = vi.fn();
        const { result } = renderHook(() => useDebouncedCallback(spy, 200, { leading: true }));
        act(() => result.current[0]("z"));
        expect(spy).toHaveBeenCalledWith("z");
    });

    it("maxWait forces call", () => {
        const spy = vi.fn();
        const { result } = renderHook(() => useDebouncedCallback(spy, 200, { maxWait: 300 }));
        act(() => {
            result.current[0]("1");
        });
        act(() => vi.advanceTimersByTime(150));
        act(() => {
            result.current[0]("2");
        });
        act(() => vi.advanceTimersByTime(150)); // total 300 from first
        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy).toHaveBeenCalledWith("2");
    });
});