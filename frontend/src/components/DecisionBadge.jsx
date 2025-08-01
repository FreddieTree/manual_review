// src/components/ui/DecisionBadge.jsx
import React, { useMemo } from "react";
import PropTypes from "prop-types";
import clsx from "clsx";
import { CheckBadgeIcon, PencilSquareIcon, XCircleIcon, QuestionMarkCircleIcon } from "@heroicons/react/24/solid";

/**
 * DecisionBadge - semantic decision indicator with Apple-like clarity & polish.
 */
function DecisionBadge({
    decision = "uncertain", // accept / modify / reject / uncertain
    variant = "solid", // solid / subtle / outline / pill
    size = "sm", // sm / md / lg
    className = "",
    title, // override aria-label/title
    showIcon = true,
    "aria-live": ariaLive, // e.g. "polite" for dynamic updates
    ...props
}) {
    const mapping = useMemo(
        () => ({
            accept: {
                label: "ACCEPT",
                icon: CheckBadgeIcon,
                colors: {
                    solid: {
                        bg: "bg-emerald-600",
                        text: "text-white",
                        ring: "ring-emerald-600/30",
                    },
                    subtle: {
                        bg: "bg-emerald-100",
                        text: "text-emerald-800",
                        ring: "ring-emerald-200",
                    },
                    outline: {
                        bg: "bg-transparent",
                        text: "text-emerald-600",
                        border: "border border-emerald-600",
                        ring: "ring-emerald-600/25",
                    },
                    pill: {
                        bg: "bg-emerald-50",
                        text: "text-emerald-700",
                        ring: "ring-emerald-200",
                    },
                },
            },
            modify: {
                label: "MODIFY",
                icon: PencilSquareIcon,
                colors: {
                    solid: {
                        bg: "bg-yellow-500",
                        text: "text-white",
                        ring: "ring-yellow-500/30",
                    },
                    subtle: {
                        bg: "bg-yellow-100",
                        text: "text-yellow-800",
                        ring: "ring-yellow-200",
                    },
                    outline: {
                        bg: "bg-transparent",
                        text: "text-yellow-600",
                        border: "border border-yellow-600",
                        ring: "ring-yellow-600/25",
                    },
                    pill: {
                        bg: "bg-yellow-50",
                        text: "text-yellow-700",
                        ring: "ring-yellow-200",
                    },
                },
            },
            reject: {
                label: "REJECT",
                icon: XCircleIcon,
                colors: {
                    solid: {
                        bg: "bg-red-600",
                        text: "text-white",
                        ring: "ring-red-600/30",
                    },
                    subtle: {
                        bg: "bg-red-100",
                        text: "text-red-800",
                        ring: "ring-red-200",
                    },
                    outline: {
                        bg: "bg-transparent",
                        text: "text-red-600",
                        border: "border border-red-600",
                        ring: "ring-red-600/25",
                    },
                    pill: {
                        bg: "bg-red-50",
                        text: "text-red-700",
                        ring: "ring-red-200",
                    },
                },
            },
            uncertain: {
                label: "UNCERTAIN",
                icon: QuestionMarkCircleIcon,
                colors: {
                    solid: {
                        bg: "bg-gray-800",
                        text: "text-white",
                        ring: "ring-gray-800/30",
                    },
                    subtle: {
                        bg: "bg-gray-100",
                        text: "text-gray-800",
                        ring: "ring-gray-200",
                    },
                    outline: {
                        bg: "bg-transparent",
                        text: "text-gray-700",
                        border: "border border-gray-400",
                        ring: "ring-gray-400/25",
                    },
                    pill: {
                        bg: "bg-gray-50",
                        text: "text-gray-800",
                        ring: "ring-gray-200",
                    },
                },
            },
        }),
        []
    );

    const info = mapping[decision] || mapping.uncertain;
    const variantStyles = info.colors[variant] || info.colors.solid;

    const sizeMap = {
        sm: "text-xs px-2.5 py-1.5",
        md: "text-sm px-3.5 py-2",
        lg: "text-base px-4 py-2.5",
    };

    const iconSize = {
        sm: "w-4 h-4",
        md: "w-5 h-5",
        lg: "w-6 h-6",
    };

    return (
        <div
            role="status"
            aria-label={title || `Decision: ${info.label}`}
            aria-live={ariaLive || "off"}
            className={clsx(
                "inline-flex items-center gap-1.5 font-semibold rounded-full transition-all select-none",
                sizeMap[size],
                variant !== "outline" && "shadow-sm",
                variantStyles.bg,
                variantStyles.text,
                variantStyles.border,
                variantStyles.ring && `ring-1 ${variantStyles.ring}`,
                "backdrop-blur-[2px]",
                "overflow-hidden",
                "relative",
                "whitespace-nowrap",
                "uppercase tracking-wide",
                "leading-none",
                "transform will-change-transform",
                "hover:scale-[1.02] focus:scale-[1.02] focus:outline-none",
                "focus-visible:ring-2 focus-visible:ring-offset-1",
                className
            )}
            {...props}
        >
            {showIcon && info.icon && (
                <info.icon aria-hidden="true" className={clsx(iconSize[size], "flex-shrink-0")} />
            )}
            <span className="truncate">{info.label}</span>
        </div>
    );
}

DecisionBadge.propTypes = {
    decision: PropTypes.oneOf(["accept", "modify", "reject", "uncertain"]),
    variant: PropTypes.oneOf(["solid", "subtle", "outline", "pill"]),
    size: PropTypes.oneOf(["sm", "md", "lg"]),
    className: PropTypes.string,
    title: PropTypes.string,
    showIcon: PropTypes.bool,
    "aria-live": PropTypes.oneOf(["off", "polite", "assertive"]),
};

DecisionBadge.defaultProps = {
    decision: "uncertain",
    variant: "solid",
    size: "sm",
    className: "",
    title: null,
    showIcon: true,
    "aria-live": "off",
};

export default React.memo(DecisionBadge);