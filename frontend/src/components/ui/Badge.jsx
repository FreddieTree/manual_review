import clsx from "clsx";

export default function Badge({
    children,
    variant = "solid", // solid / subtle / outline
    color = "primary", // primary / success / warning / danger / gray
    className = "",
}) {
    const base = "inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold";
    const colorMap = {
        primary: {
            solid: "bg-primary text-white",
            subtle: "bg-primary/10 text-primary",
            outline: "border border-primary text-primary",
        },
        success: {
            solid: "bg-emerald-600 text-white",
            subtle: "bg-emerald-100 text-emerald-800",
            outline: "border border-emerald-600 text-emerald-600",
        },
        warning: {
            solid: "bg-yellow-500 text-white",
            subtle: "bg-yellow-100 text-yellow-800",
            outline: "border border-yellow-500 text-yellow-600",
        },
        danger: {
            solid: "bg-red-600 text-white",
            subtle: "bg-red-100 text-red-800",
            outline: "border border-red-600 text-red-600",
        },
        gray: {
            solid: "bg-gray-800 text-white",
            subtle: "bg-gray-100 text-gray-800",
            outline: "border border-gray-400 text-gray-700",
        },
    };

    return (
        <div className={clsx(base, colorMap[color]?.[variant], className)}>
            {children}
        </div>
    );
}