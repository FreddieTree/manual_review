// src/components/ui/Tooltip.jsx
import React, { forwardRef, useId, useState, useRef, useEffect, cloneElement } from "react";
import PropTypes from "prop-types";
import clsx from "clsx";

function TooltipImpl(
    { label, children, placement = "top", className = "", delay = 100, offset = 8, maxWidth = 220, ...rest },
    ref
) {
    const id = useId();
    const triggerRef = useRef(null);
    const tooltipRef = useRef(null);
    const [visible, setVisible] = useState(false);
    const [style, setStyle] = useState({});
    const [arrowStyle, setArrowStyle] = useState({});
    // ✅ 安全获取 matchMedia
    let prefersReduced = false;
    if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
        try {
            const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
            prefersReduced = !!mql && !!mql.matches;
        } catch {
            prefersReduced = false;
        }
    }
    const showTimer = useRef(null);

    const show = () => {
        if (showTimer.current) clearTimeout(showTimer.current);
        showTimer.current = setTimeout(() => setVisible(true), delay);
    };
    const hide = () => {
        if (showTimer.current) clearTimeout(showTimer.current);
        setVisible(false);
    };

    const updatePosition = () => {
        const trigger = triggerRef.current;
        const tip = tooltipRef.current;
        if (!trigger || !tip) return;

        const trigRect = trigger.getBoundingClientRect();
        const tipRect = tip.getBoundingClientRect();
        const viewportW = window.innerWidth;
        const viewportH = window.innerHeight;

        const compute = (pl) => {
            switch (pl) {
                case "top":
                    return { top: trigRect.top - tipRect.height - offset, left: trigRect.left + trigRect.width / 2 - tipRect.width / 2, placement: "top" };
                case "bottom":
                    return { top: trigRect.bottom + offset, left: trigRect.left + trigRect.width / 2 - tipRect.width / 2, placement: "bottom" };
                case "left":
                    return { top: trigRect.top + trigRect.height / 2 - tipRect.height / 2, left: trigRect.left - tipRect.width - offset, placement: "left" };
                case "right":
                    return { top: trigRect.top + trigRect.height / 2 - tipRect.height / 2, left: trigRect.right + offset, placement: "right" };
                default:
                    return {};
            }
        };

        let { top, left, placement: finalPlacement } = compute(placement);

        if (finalPlacement === "top" && top < 8) {
            ({ top, left, placement: finalPlacement } = compute("bottom"));
        } else if (finalPlacement === "bottom" && top + tipRect.height > viewportH - 8) {
            ({ top, left, placement: finalPlacement } = compute("top"));
        } else if (finalPlacement === "left" && left < 8) {
            ({ top, left, placement: finalPlacement } = compute("right"));
        } else if (finalPlacement === "right" && left + tipRect.width > viewportW - 8) {
            ({ top, left, placement: finalPlacement } = compute("left"));
        }

        const padding = 6;
        left = Math.min(Math.max(left, padding), viewportW - tipRect.width - padding);
        top = Math.min(Math.max(top, padding), viewportH - tipRect.height - padding);

        const arrowSize = 8;
        let arrowPos = {};
        if (finalPlacement === "top" || finalPlacement === "bottom") {
            const centerX = trigRect.left + trigRect.width / 2 - left;
            arrowPos.left = Math.min(Math.max(centerX - arrowSize / 2, 8), tipRect.width - arrowSize - 8);
            arrowPos.top = finalPlacement === "top" ? tipRect.height - arrowSize / 2 : -arrowSize / 2;
            arrowPos.transform = "rotate(45deg)";
        } else {
            const centerY = trigRect.top + trigRect.height / 2 - top;
            arrowPos.top = Math.min(Math.max(centerY - arrowSize / 2, 8), tipRect.height - arrowSize - 8);
            arrowPos.left = finalPlacement === "left" ? tipRect.width - arrowSize / 2 : -arrowSize / 2;
            arrowPos.transform = "rotate(45deg)";
        }

        setStyle({ top: Math.round(top + window.scrollY), left: Math.round(left + window.scrollX) });
        setArrowStyle({ width: arrowSize, height: arrowSize, ...arrowPos });
    };

    useEffect(() => {
        if (visible) updatePosition();
        // eslint-disable-next-line react-hooks/exhaustive-deps
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visible]);

    useEffect(() => {
        const onKey = (e) => {
            if (e.key === "Escape") hide();
        };
        if (visible) {
            document.addEventListener("keydown", onKey);
            return () => document.removeEventListener("keydown", onKey);
        }
    }, [visible]);

    const child = React.isValidElement(children)
        ? cloneElement(children, {
            ref: (node) => {
                triggerRef.current = node;
                if (typeof ref === "function") ref(node);
                else if (ref && typeof ref === "object") ref.current = node;

                const orig = children.ref;
                if (typeof orig === "function") orig(node);
                else if (orig && typeof orig === "object") orig.current = node;
            },
            "aria-describedby": visible ? id : undefined,
            onMouseEnter: (e) => {
                show();
                children.props.onMouseEnter?.(e);
            },
            onMouseLeave: (e) => {
                hide();
                children.props.onMouseLeave?.(e);
            },
            onFocus: (e) => {
                show();
                children.props.onFocus?.(e);
            },
            onBlur: (e) => {
                hide();
                children.props.onBlur?.(e);
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
                    style={{ ...style, maxWidth, whiteSpace: "normal" }}
                    {...rest}
                >
                    <div className="relative">
                        <div className="truncate">{label}</div>
                        <div
                            aria-hidden="true"
                            className="absolute bg-black"
                            style={{ ...arrowStyle, borderRadius: 2, boxShadow: "0 4px 12px rgba(0,0,0,0.15)" }}
                        />
                    </div>
                </div>
            )}
        </>
    );
}

if (process.env.NODE_ENV !== "production") {
    TooltipImpl.propTypes = {
        label: PropTypes.node.isRequired,
        children: PropTypes.node.isRequired,
        placement: PropTypes.oneOf(["top", "bottom", "left", "right"]),
        className: PropTypes.string,
        delay: PropTypes.number,
        offset: PropTypes.number,
        maxWidth: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    };
}

const Tooltip = forwardRef(TooltipImpl);
export default Tooltip;