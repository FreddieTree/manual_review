import React, { forwardRef } from "react";
import PropTypes from "prop-types";
import clsx from "clsx";

function SectionImpl({ title, description, children, className = "" }, ref) {
  return (
    <section ref={ref} className={clsx("space-y-3", className)}>
      {(title || description) && (
        <header className="space-y-1">
          {title && (
            <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">{title}</h2>
          )}
          {description && (
            <p className="text-sm text-gray-600 dark:text-gray-300">{description}</p>
          )}
        </header>
      )}
      {children}
    </section>
  );
}

const Section = forwardRef(SectionImpl);

if (process.env.NODE_ENV !== "production") {
  Section.propTypes = {
    title: PropTypes.node,
    description: PropTypes.node,
    children: PropTypes.node,
    className: PropTypes.string,
  };
}

export default Section;


