import React, { useEffect, useCallback, forwardRef, memo } from "react";
import PropTypes from "prop-types";
import clsx from "clsx";
import { useTheme } from "../hooks/useTheme";

/**
 * 轻量主题切换：light / dark / system
 */
function ThemeSwitcherImpl({ className = "" }, ref) {
    const { mode, resolved, setTheme } = useTheme();

    useEffect(() => {
        document.documentElement.dataset.theme = resolved;
    }, [resolved]);

    const options = [
        { key: "light", label: "Light" },
        { key: "dark", label: "Dark" },
        { key: "system", label: "Auto" },
    ];

    const handleKey = useCallback(
        (e, key) => {
            if (e.key === " " || e.key === "Enter") {
                e.preventDefault();
                setTheme(key);
            }
        },
        [setTheme]
    );

    return (
        <div
            ref={ref}
            role="group"
            aria-label="Theme switcher"
            className={clsx(
                "inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white/60 dark:bg-gray-800/60 backdrop-blur-md px-3 py-1 shadow-sm",
                "text-[13px] font-medium",
                className
            )}
        >
            <div className="sr-only">Theme:</div>
            {options.map((o) => {
                const selected = mode === o.key;
                return (
                    <button
                        key={o.key}
                        type="button"
                        aria-pressed={selected}
                        aria-label={`Switch to ${o.label} theme`}
                        onClick={() => setTheme(o.key)}
                        onKeyDown={(e) => handleKey(e, o.key)}
                        className={clsx(
                            "relative flex items-center justify-center rounded-full transition-all text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1",
                            selected
                                ? "bg-gradient-to-r from-indigo-600 to-sky-500 text-white shadow"
                                : "bg-transparent text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700",
                            "px-3 py-1",
                            "min-w-[60px]"
                        )}
                    >
                        {o.label}
                        {selected && <span className="sr-only"> (selected)</span>}
                    </button>
                );
            })}
            <div className="ml-2 flex items-center gap-1 text-[11px] text-gray-500">
                <span className="hidden sm:inline">Applied:</span>{" "}
                <span className="font-semibold capitalize">{resolved}</span>
            </div>
        </div>
    );
}

const ThemeSwitcher = memo(forwardRef(ThemeSwitcherImpl));

if (process.env.NODE_ENV !== "production") {
    ThemeSwitcher.propTypes = {
        className: PropTypes.string,
    };
}

export default ThemeSwitcher;