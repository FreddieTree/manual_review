import React, { forwardRef } from "react";
import PropTypes from "prop-types";
import clsx from "clsx";

function CardImpl({ children, className = "", as: Component = "div", ...rest }, ref) {
  return (
    <Component
      ref={ref}
      className={clsx(
        // Apple-style glass/surface card (allow overrides to fully replace bg when provided)
        "backdrop-blur-sm rounded-2xl border shadow-xl p-6",
        "border-gray-100 dark:border-slate-800",
        className || "bg-white dark:bg-slate-900"
      )}
      {...rest}
    >
      {children}
    </Component>
  );
}

const Card = forwardRef(CardImpl);

if (process.env.NODE_ENV !== "production") {
  Card.propTypes = {
    children: PropTypes.node,
    className: PropTypes.string,
    as: PropTypes.elementType,
  };
}

export default Card;


