// src/components/ui/Tooltip.jsx
import React, { useId, useState, useRef, useEffect, cloneElement } from "react";
import PropTypes from "prop-types";
import clsx from "clsx";

/**
 * Polished tooltip with:
 *  - fade/scale animation (respects prefers-reduced-motion)
 *  - accessible aria attributes
 *  - arrow
 *  - basic viewport collision avoidance
 *  - keyboard focus & escape key dismissal
 */
export default function Tooltip({
    label,
    children,
    placement = "top", // top / bottom / left / right
    className = "",
    delay = 100,
    offset = 8,
    maxWidth = 220,
}) {
    const id = useId();
    const triggerRef = useRef(null);
    const tooltipRef = useRef(null);
    const [visible, setVisible] = useState(false);
    const [computedPlacement, setComputedPlacement] = useState(placement);
    const [style, setStyle] = useState({});
    const [arrowStyle, setArrowStyle] = useState({});
    const prefersReduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const showTimer = useRef(null);

    const show = () => {
        if (showTimer.current) clearTimeout(showTimer.current);
        showTimer.current = setTimeout(() => setVisible(true), delay);
    };
    const hide = () => {
        if (showTimer.current) clearTimeout(showTimer.current);
        setVisible(false);
    };

    // Positioning with basic collision detection
    const updatePosition = () => {
        const trigger = triggerRef.current;
        const tip = tooltipRef.current;
        if (!trigger || !tip) return;

        const trigRect = trigger.getBoundingClientRect();
        const tipRect = tip.getBoundingClientRect();
        const viewportW = window.innerWidth;
        const viewportH = window.innerHeight;

        let finalPlacement = placement;
        const baseStyle = {};

        const arrowOffset = 6; // distance for arrow

        const compute = (pl) => {
            switch (pl) {
                case "top":
                    return {
                        top: trigRect.top - tipRect.height - offset,
                        left: trigRect.left + trigRect.width / 2 - tipRect.width / 2,
                    };
                case "bottom":
                    return {
                        top: trigRect.bottom + offset,
                        left: trigRect.left + trigRect.width / 2 - tipRect.width / 2,
                    };
                case "left":
                    return {
                        top: trigRect.top + trigRect.height / 2 - tipRect.height / 2,
                        left: trigRect.left - tipRect.width - offset,
                    };
                case "right":
                    return {
                        top: trigRect.top + trigRect.height / 2 - tipRect.height / 2,
                        left: trigRect.right + offset,
                    };
                default:
                    return {};
            }
        };

        let pos = compute(placement);

        // simple collision flip
        if (placement === "top" && pos.top < 8) {
            finalPlacement = "bottom";
            pos = compute("bottom");
        } else if (placement === "bottom" && pos.top + tipRect.height > viewportH - 8) {
            finalPlacement = "top";
            pos = compute("top");
        } else if (placement === "left" && pos.left < 8) {
            finalPlacement = "right";
            pos = compute("right");
        } else if (placement === "right" && pos.left + tipRect.width > viewportW - 8) {
            finalPlacement = "left";
            pos = compute("left");
        }

        // clamp to viewport with small padding
        const padding = 6;
        pos.left = Math.min(Math.max(pos.left, padding), viewportW - tipRect.width - padding);
        pos.top = Math.min(Math.max(pos.top, padding), viewportH - tipRect.height - padding);

        // arrow positioning
        let arrowPos = {};
        const arrowSize = 8;
        if (finalPlacement === "top" || finalPlacement === "bottom") {
            const centerX = trigRect.left + trigRect.width / 2 - pos.left;
            arrowPos.left = Math.min(Math.max(centerX - arrowSize / 2, 8), tipRect.width - arrowSize - 8);
            arrowPos.top = finalPlacement === "top" ? tipRect.height - arrowSize / 2 : -arrowSize / 2;
            arrowPos.transform = "rotate(45deg)";
        } else {
            const centerY = trigRect.top + trigRect.height / 2 - pos.top;
            arrowPos.top = Math.min(Math.max(centerY - arrowSize / 2, 8), tipRect.height - arrowSize - 8);
            arrowPos.left = finalPlacement === "left" ? tipRect.width - arrowSize / 2 : -arrowSize / 2;
            arrowPos.transform = "rotate(45deg)";
        }

        setComputedPlacement(finalPlacement);
        setStyle({
            top: Math.round(pos.top + window.scrollY),
            left: Math.round(pos.left + window.scrollX),
        });
        setArrowStyle({
            width: arrowSize,
            height: arrowSize,
            ...arrowPos,
        });
    };

    // Sync on visibility or window resize/scroll
    useEffect(() => {
        if (visible) {
            updatePosition();
        }
    }, [visible, label, placement]);

    useEffect(() => {
        const handle = () => {
            if (visible) updatePosition();
        };
        window.addEventListener("resize", handle);
        window.addEventListener("scroll", handle, true);
        return () => {
            window.removeEventListener("resize", handle);
            window.removeEventListener("scroll", handle, true);
            if (showTimer.current) clearTimeout(showTimer.current);
        };
    }, [visible]);

    // hide on Escape
    useEffect(() => {
        const onKey = (e) => {
            if (e.key === "Escape") hide();
        };
        if (visible) {
            document.addEventListener("keydown", onKey);
            return () => document.removeEventListener("keydown", onKey);
        }
    }, [visible]);

    // accessibility: aria-describedby linkage is expected to be handled by parent if needed

    // Clone child to attach ref if it doesn't already forward
    const child = React.isValidElement(children)
        ? cloneElement(children, {
            ref: (node) => {
                triggerRef.current = node;
                const { ref: origRef } = children;
                if (typeof origRef === "function") origRef(node);
                else if (origRef && typeof origRef === "object") {
                    origRef.current = node;
                }
            },
            "aria-describedby": visible ? id : undefined,
            onMouseEnter: (e) => {
                show();
                if (children.props.onMouseEnter) children.props.onMouseEnter(e);
            },
            onMouseLeave: (e) => {
                hide();
                if (children.props.onMouseLeave) children.props.onMouseLeave(e);
            },
            onFocus: (e) => {
                show();
                if (children.props.onFocus) children.props.onFocus(e);
            },
            onBlur: (e) => {
                hide();
                if (children.props.onBlur) children.props.onBlur(e);
            },
        })
        : children;

    return (
        <>
            {child}
            {label && (
                <div
                    ref={tooltipRef}
                    role="tooltip"
                    id={id}
                    aria-live="polite"
                    className={clsx(
                        "pointer-events-none fixed z-50 max-w-xs rounded-xl px-4 py-2 text-sm font-medium leading-snug shadow-2xl bg-black text-white backdrop-blur-sm",
                        "transition-opacity duration-150 ease-out",
                        prefersReduced ? "" : "will-change-transform",
                        visible ? "opacity-100 scale-100" : "opacity-0 scale-95",
                        className
                    )}
                    style={{
                        ...style,
                        maxWidth,
                        whiteSpace: "normal",
                    }}
                >
                    <div className="relative">
                        <div className="truncate">{label}</div>
                        {/* arrow */}
                        <div
                            aria-hidden="true"
                            className="absolute bg-black"
                            style={{
                                ...arrowStyle,
                                borderRadius: 2,
                                boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                            }}
                        />
                    </div>
                </div>
            )}
        </>
    );
}

Tooltip.propTypes = {
    label: PropTypes.node.isRequired,
    children: PropTypes.node.isRequired,
    placement: PropTypes.oneOf(["top", "bottom", "left", "right"]),
    className: PropTypes.string,
    delay: PropTypes.number,
    offset: PropTypes.number,
    maxWidth: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
};

Tooltip.defaultProps = {
    placement: "top",
    delay: 100,
    offset: 8,
    className: "",
    maxWidth: 220,
};