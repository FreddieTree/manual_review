import clsx from "clsx";

export default function Select({
    className = "",
    variant = "default",
    size = "md",
    children,
    ...props
}) {
    const base = "w-full rounded-lg bg-white border transition appearance-none focus:ring-2 focus:ring-primary focus:border-transparent";
    const sizeMap = {
        sm: "px-3 py-2 text-sm",
        md: "px-4 py-2.5 text-base",
        lg: "px-5 py-3 text-lg",
    };
    const variantStyles = {
        default: "border border-gray-200",
        error: "border border-red-400",
    };
    return (
        <div className="relative">
            <select className={clsx(base, sizeMap[size], variantStyles[variant], className)} {...props}>
                {children}
            </select>
            <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
            </div>
        </div>
    );
}