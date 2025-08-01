import { useTheme } from "../hooks/useTheme";
import { useEffect } from "react";
import clsx from "clsx";

const optionStyles = "px-3 py-1 rounded-full text-xs font-medium cursor-pointer transition";

export default function ThemeSwitcher() {
    const { mode, resolved, setTheme } = useTheme();

    useEffect(() => {
        // optional: reflect in document attribute for server rendering fallback
        document.documentElement.dataset.theme = resolved;
    }, [resolved]);

    return (
        <div className="inline-flex items-center gap-2 bg-surface/80 backdrop-blur-sm rounded-full border border-gray-200 px-2 py-1">
            <div className="text-xs font-semibold text-gray-600 mr-2">Theme:</div>
            <div className="flex gap-1">
                {["light", "dark", "system"].map((o) => (
                    <div
                        key={o}
                        onClick={() => setTheme(o)}
                        className={clsx(
                            optionStyles,
                            mode === o
                                ? "bg-primary text-white shadow-btn"
                                : "bg-muted text-gray-700 hover:bg-gray-100"
                        )}
                        aria-label={`Switch to ${o}`}
                    >
                        {o === "system" ? "Auto" : o.charAt(0).toUpperCase() + o.slice(1)}
                    </div>
                ))}
            </div>
            <div className="ml-3 text-[11px] text-gray-500">
                Applied: <span className="font-medium">{resolved}</span>
            </div>
        </div>
    );
}