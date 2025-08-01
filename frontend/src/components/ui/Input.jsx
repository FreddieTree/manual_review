import clsx from "clsx";

export default function Input({
    className = "",
    variant = "default", // default / error / success
    size = "md",
    ...props
}) {
    const base = "w-full rounded-lg placeholder-gray-400 bg-white border transition focus:ring-2 focus:ring-primary focus:border-transparent";
    const sizeMap = {
        sm: "px-3 py-2 text-sm",
        md: "px-4 py-2.5 text-base",
        lg: "px-5 py-3 text-lg",
    };
    const variantStyles = {
        default: "border border-gray-200",
        error: "border border-red-400",
        success: "border border-emerald-400",
    };
    return (
        <input
            className={clsx(base, sizeMap[size], variantStyles[variant], "shadow-input", className)}
            {...props}
        />
    );
}