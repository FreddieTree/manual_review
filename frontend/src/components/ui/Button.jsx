import clsx from "clsx";

export default function Button({
    children,
    variant = "primary", // primary / secondary / outline / destructive / subtle
    size = "md", // sm / md / lg
    fullWidth = false,
    className = "",
    ...props
}) {
    const base = "inline-flex items-center justify-center font-semibold rounded-full transition focus-visible:outline-2 focus-visible:outline-offset-2";
    const sizes = {
        sm: "px-4 py-2 text-sm",
        md: "px-6 py-3 text-base",
        lg: "px-8 py-4 text-lg",
    };
    const variants = {
        primary: "bg-gradient-to-r from-primary to-primaryLight text-white shadow-btn hover:from-primaryDark",
        secondary: "bg-white text-primary border border-primary hover:bg-primary/5",
        outline: "bg-transparent border border-gray-300 text-gray-700 hover:bg-gray-50",
        destructive: "bg-red-600 text-white hover:bg-red-700",
        subtle: "bg-muted text-gray-700",
    };

    return (
        <button
            className={clsx(base, sizes[size], variants[variant], fullWidth && "w-full", className)}
            {...props}
        >
            {children}
        </button>
    );
}