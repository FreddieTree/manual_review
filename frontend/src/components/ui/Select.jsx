import React, { forwardRef, Fragment } from "react";
import PropTypes from "prop-types";
import clsx from "clsx";
import Loader from "./Loader";
import { Listbox, Transition } from "@headlessui/react";

/**
 * Apple-like upgraded Select component.
 * Features: error/success/disabled states, loading indicator, accessible labels, smooth focus, dark-mode friendly.
 */
const sizeMap = {
    sm: "text-sm h-9",
    md: "text-base h-11",
    lg: "text-lg h-12",
};

function SelectImpl(
    {
        className = "",
        variant = "default", // default / error / success
        size = "md", // sm / md / lg
        id,
        name,
        disabled = false,
        children,
        errorMessage,
        helpText,
        loading = false,
        prefix = null,
        suffix = null,
        placeholder = "",
        onClear,
        clearable = false,
        value,
        selectedDisplay,
        overlay = false,
        // custom listbox mode for large option sets
        listbox = false,
        options = [], // [{ value, label }]
        maxVisibleOptions = 5,
        "aria-label": ariaLabel,
        ...props
    },
    ref
) {
    const isInvalid = variant === "error" || Boolean(errorMessage);
    const describedByIds = [];
    if (errorMessage && id) describedByIds.push(`${id}-error`);
    if (helpText && id) describedByIds.push(`${id}-help`);

    const baseBg = disabled ? "bg-gray-100 dark:bg-slate-800" : "bg-white dark:bg-slate-900";
    const borderColor =
        isInvalid
            ? "border-red-400 focus-within:ring-red-300"
            : variant === "success"
                ? "border-emerald-400 focus-within:ring-emerald-300"
                : "border border-gray-200 dark:border-slate-700 focus-within:ring-indigo-300";
    const textColor = disabled ? "text-gray-400 dark:text-slate-500" : "text-gray-900 dark:text-gray-100";

    // Listbox dropdown implementation (scrollable, capped height)
    if (listbox) {
        const optionItems = Array.isArray(options) ? options : [];
        const maxHeightPx = Math.max(1, Number(maxVisibleOptions) || 5) * 40; // ~40px per item

        return (
            <div className={clsx("flex flex-col relative w-full", className)}>
                <div
                    className={clsx(
                        "relative flex items-center rounded-xl shadow-sm",
                        baseBg,
                        borderColor,
                        sizeMap[size],
                        disabled && "opacity-60 cursor-not-allowed",
                        "overflow-visible"
                    )}
                >
                    {prefix && <div className="pl-3 pr-2 flex items-center select-none">{prefix}</div>}

                    <div className="flex-1">
                        <Listbox
                            value={value}
                            onChange={(v) => props.onChange?.({ target: { value: v } })}
                            disabled={disabled || loading}
                        >
                            <div className="relative">
                                <Listbox.Button
                                    id={id}
                                    aria-label={ariaLabel || name}
                                    aria-invalid={isInvalid || undefined}
                                    aria-describedby={describedByIds.filter(Boolean).join(" ") || undefined}
                                    className={clsx(
                                        "w-full text-left bg-transparent outline-none appearance-none px-3 cursor-pointer",
                                        "flex items-center justify-between",
                                        "transition placeholder-gray-400"
                                    )}
                                    type="button"
                                >
                                    <span className={clsx("truncate", value ? "text-gray-900 dark:text-gray-100" : "text-gray-400")}>
                                        {selectedDisplay || optionItems.find((o) => String(o.value) === String(value))?.label || placeholder || ""}
                                    </span>
                                    <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                                        <svg className="w-4 h-4 text-gray-400" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 8l4 4 4-4" />
                                        </svg>
                                    </span>
                                </Listbox.Button>
                                <Transition as={Fragment} enter="transition ease-out duration-100" enterFrom="opacity-0" enterTo="opacity-100" leave="transition ease-in duration-100" leaveFrom="opacity-100" leaveTo="opacity-0">
                                    <Listbox.Options
                                        className={clsx(
                                            "absolute z-50 mt-1 w-full overflow-auto rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 shadow-2xl py-1 text-sm"
                                        )}
                                        style={{ maxHeight: maxHeightPx }}
                                    >
                                        {placeholder && (
                                            <Listbox.Option value="" disabled hidden className="cursor-default select-none px-3 py-2 text-gray-400">
                                                {placeholder}
                                            </Listbox.Option>
                                        )}
                                        {optionItems.map((opt) => (
                                            <Listbox.Option
                                                key={String(opt.value)}
                                                value={opt.value}
                                                className={({ active, selected }) =>
                                                    clsx(
                                                        "cursor-pointer px-3 py-2",
                                                        active && "bg-gray-100 dark:bg-slate-700",
                                                        selected && "font-semibold"
                                                    )
                                                }
                                            >
                                                {opt.label}
                                            </Listbox.Option>
                                        ))}
                                    </Listbox.Options>
                                </Transition>
                            </div>
                        </Listbox>
                    </div>

                    {suffix && <div className="pr-3 pl-2 flex items-center select-none">{suffix}</div>}
                </div>

                {/* Help / error text */}
                <div className="mt-1 flex flex-col gap-1">
                    {errorMessage ? (
                        <div id={id ? `${id}-error` : undefined} role="alert" className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                            <span>{errorMessage}</span>
                        </div>
                    ) : helpText ? (
                        <div id={id ? `${id}-help` : undefined} className="text-xs text-gray-500 dark:text-slate-400">{helpText}</div>
                    ) : null}
                </div>
            </div>
        );
    }


    return (
        <div className={clsx("flex flex-col relative w-full", className)}>
            <div
                className={clsx(
                    "relative flex items-center rounded-xl shadow-sm transition focus-within:ring-2",
                    baseBg,
                    borderColor,
                    sizeMap[size],
                    disabled && "opacity-60 cursor-not-allowed",
                    "overflow-hidden"
                )}
            >
                {prefix && <div className="pl-3 pr-2 flex items-center select-none">{prefix}</div>}

                {overlay && (
                    <span
                        aria-hidden="true"
                        className={clsx(
                            "absolute left-3 right-8 pointer-events-none",
                            textColor,
                            "truncate"
                        )}
                    >
                        {selectedDisplay || placeholder || ""}
                    </span>
                )}

                <select
                    id={id}
                    name={name}
                    ref={ref}
                    disabled={disabled || loading}
                    aria-label={ariaLabel || name}
                    aria-invalid={isInvalid || undefined}
                    aria-describedby={describedByIds.filter(Boolean).join(" ") || undefined}
                    value={value}
                    className={clsx(
                        overlay
                            ? "absolute inset-0 w-full h-full opacity-0 appearance-none outline-none cursor-pointer transition"
                            : clsx(
                                  "flex-1 bg-transparent appearance-none outline-none w-full px-3 transition placeholder-gray-400",
                                  textColor,
                                  "py-0"
                              )
                    )}
                    {...props}
                >
                    {placeholder && (
                        <option value="" disabled hidden>
                            {placeholder}
                        </option>
                    )}
                    {children}
                </select>

                {/* clearable button */}
                {clearable && !disabled && !loading && value && typeof onClear === "function" && (
                    <button
                        type="button"
                        aria-label="Clear selection"
                        onClick={(e) => {
                            e.preventDefault();
                            onClear();
                        }}
                        className="pr-2 pl-1 flex items-center justify-center text-gray-400 hover:text-gray-600 focus:outline-none"
                    >
                        <svg
                            aria-hidden="true"
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            viewBox="0 0 24 24"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <path d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                )}

                {/* loading spinner */}
                {loading && (
                    <div className="pr-2 flex items-center">
                        <Loader size="sm" label="" variant="neutral" aria-label="Loading options" />
                    </div>
                )}

                {/* dropdown arrow */}
                <div className="pointer-events-none absolute right-3 flex items-center">
                    <svg
                        className={clsx(
                            "w-4 h-4 transition-transform duration-200",
                            isInvalid
                                ? "text-red-500"
                                : variant === "success"
                                    ? "text-emerald-500"
                                    : "text-gray-400 dark:text-gray-400"
                        )}
                        viewBox="0 0 20 20"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        aria-hidden="true"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 8l4 4 4-4" />
                    </svg>
                </div>
            </div>

            {/* Help / error text */}
            <div className="mt-1 flex flex-col gap-1">
                {errorMessage ? (
                    <div
                        id={id ? `${id}-error` : undefined}
                        role="alert"
                        className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1"
                    >
                        <svg
                            aria-hidden="true"
                            className="w-4 h-4 flex-shrink-0"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            viewBox="0 0 24 24"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <circle cx="12" cy="12" r="10" />
                            <path d="M12 8v4m0 4h.01" />
                        </svg>
                        <span>{errorMessage}</span>
                    </div>
                ) : helpText ? (
                    <div id={id ? `${id}-help` : undefined} className="text-xs text-gray-500 dark:text-slate-400">
                        {helpText}
                    </div>
                ) : null}
            </div>
        </div>
    );
}

const Select = forwardRef(SelectImpl);

if (process.env.NODE_ENV !== "production") {
    Select.propTypes = {
        className: PropTypes.string,
        variant: PropTypes.oneOf(["default", "error", "success"]),
        size: PropTypes.oneOf(["sm", "md", "lg"]),
        id: PropTypes.string,
        name: PropTypes.string,
        disabled: PropTypes.bool,
        children: PropTypes.node,
        errorMessage: PropTypes.string,
        helpText: PropTypes.string,
        loading: PropTypes.bool,
        prefix: PropTypes.node,
        suffix: PropTypes.node,
        placeholder: PropTypes.string,
        clearable: PropTypes.bool,
        onClear: PropTypes.func,
        value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        selectedDisplay: PropTypes.string,
        overlay: PropTypes.bool,
        "aria-label": PropTypes.string,
        // listbox mode
        listbox: PropTypes.bool,
        options: PropTypes.arrayOf(
            PropTypes.shape({
                value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
                label: PropTypes.node.isRequired,
            })
        ),
        maxVisibleOptions: PropTypes.number,
    };
}

export default Select;