import React, { forwardRef } from "react";
import PropTypes from "prop-types";
import clsx from "clsx";

function CardImpl({ children, className = "", as: Component = "div", ...rest }, ref) {
  return (
    <Component
      ref={ref}
      className={clsx(
        // Apple-style glass/surface card
        "bg-white/90 dark:bg-slate-900/60 backdrop-blur-sm",
        "rounded-2xl border border-gray-100 dark:border-slate-800",
        "shadow-xl",
        "p-6",
        className
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


