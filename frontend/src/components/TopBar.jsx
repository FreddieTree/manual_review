import React, { useState, useCallback, useMemo, forwardRef, memo, useEffect } from "react";
import PropTypes from "prop-types";
import clsx from "clsx";
// Pricing removed
import ConfirmModal from "./ConfirmModal";
import { Listbox } from "@headlessui/react";
import { ChevronDownIcon } from "@heroicons/react/24/solid";
import { useUser } from "../hooks/useUser";
import { useNavigate, useLocation } from "react-router-dom";
import { getReviewers } from "../api";

const systemFont = "system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif";
const LOGIN_PATH = (import.meta.env.VITE_LOGIN_PATH || "/").replace(/\/+$/, "") || "/";

function TopBarImpl({ abstract = {}, onExit, className = "", isAdminView = false, withMargin = true, adminActions = null, maxWidth = "1240px" }, ref) {
    const { user, loading: userLoading, logout } = useUser();
    const navigate = useNavigate();
    const location = useLocation();

    const [showExitConfirm, setShowExitConfirm] = useState(false);
    const [selectedReviewer, setSelectedReviewer] = useState(null);
    const [reviewersList, setReviewersList] = useState([]);
    const [reviewersLoading, setReviewersLoading] = useState(false);
    const [reviewersError, setReviewersError] = useState(null);

    const sentenceCount = abstract?.sentence_count;
    const pmid = abstract?.pmid;

    useEffect(() => {
        let cancelled = false;
        if (user?.is_admin) {
            setReviewersLoading(true);
            setReviewersError(null);
            getReviewers({ query: { per_page: 200 } })
                .then((data) => {
                    const listRaw = Array.isArray(data?.reviewers) ? data.reviewers : Array.isArray(data) ? data : [];
                    const list = listRaw.map((r) => ({ name: (r.name || r.email || "").trim(), email: (r.email || "").toLowerCase() }));
                    if (cancelled) return;
                    setReviewersList(list);
                    if (list.length) {
                        setSelectedReviewer(list[0]);
                        try {
                            window.dispatchEvent(new CustomEvent("admin:reviewerSelected", { detail: list[0] }));
                        } catch {}
                    }
                })
                .catch((e) => {
                    if (cancelled) return;
                    setReviewersError(e);
                })
                .finally(() => {
                    if (cancelled) return;
                    setReviewersLoading(false);
                });
        } else {
            setReviewersList([]);
            setSelectedReviewer(null);
        }
        return () => {
            cancelled = true;
        };
    }, [user]);

    const handleExit = useCallback(async () => {
        setShowExitConfirm(false);
        if (onExit) {
            try {
                await Promise.resolve(onExit());
            } catch {}
            return;
        }
        try {
            await logout(); // ensure logout completes and hard-redirects to login
        } catch (e) {
            // eslint-disable-next-line no-console
            console.warn("Logout failed:", e);
            // Fallback soft redirect even if logout throws
            const next = encodeURIComponent(location.pathname + location.search);
            navigate(`${LOGIN_PATH}?next=${next}`, { replace: true });
        }
    }, [onExit, logout, navigate, location]);

    const greetName = useMemo(() => {
        if (userLoading) return "";
        if (user?.name && user.name.trim()) return user.name.trim();
        if (user?.email) return String(user.email).split("@")[0];
        return "there";
    }, [user, userLoading]);

    // Pricing removed

    return (
        <>
            <section
                ref={ref}
                className={clsx(
                    // Remove overflow-hidden so dropdowns/portals can escape the container
                    "relative isolate z-50 overflow-visible mx-auto",
                    withMargin ? "my-4" : "my-0",
                    "bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-[24px]",
                    "shadow-xl",
                    "backdrop-blur-sm",
                    "transition-colors",
                    // For admin, keep two rows; others can switch to row on md
                    isAdminView ? "flex flex-col" : "flex flex-col md:flex-row",
                    "items-center justify-between px-6 py-5",
                    className
                )}
                style={{ maxWidth, fontFamily: systemFont }}
                aria-label="Top bar"
            >
                <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center gap-3">
                    {isAdminView ? (
                        <div className="flex flex-col">
                            <div className="flex items-baseline gap-2">
                                <div className="text-2xl font-extrabold text-slate-900 dark:text-white">Admin Dashboard</div>
                                <div className="text-sm font-semibold text-indigo-500">v3</div>
                            </div>
                            <div className="text-xs text-gray-600 dark:text-gray-300">Overview &amp; controls</div>
                        </div>
                    ) : (
                        <div className="flex flex-col">
                            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white" style={{ lineHeight: 1.1 }}>
                                Abstract Review
                            </h1>
                            <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-gray-600 dark:text-gray-400">
                                {typeof sentenceCount === "number" && (
                                    <div
                                        className="inline-flex items-center gap-1 rounded-full px-3 py-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200"
                                        aria-label={`${sentenceCount} sentences`}
                                    >
                                        <strong className="font-semibold">{sentenceCount}</strong>
                                        <span>sentence{sentenceCount === 1 ? "" : "s"}</span>
                                    </div>
                                )}
                                <div>PMID: {pmid || "—"}</div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-4 flex-wrap mt-3 md:mt-0">
                    <div className="flex flex-col text-right">
                        <div className="text-sm text-gray-500 dark:text-gray-300 flex items-center gap-1">
                            <span>
                                Hello,&nbsp;
                                <span className="font-semibold text-gray-900 dark:text-white flex items-center gap-1">
                                    {userLoading ? (
                                        <span className="inline-block h-4 w-20 rounded bg-gray-200 animate-pulse" />
                                    ) : (
                                        greetName
                                    )}
                                </span>
                            </span>
                            {user?.is_admin && (
                                <span className="ml-1 inline-flex items-center px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full text-[10px] uppercase tracking-wide font-semibold">
                                    Admin
                                </span>
                            )}
                        </div>
                        {!user && !userLoading && (
                            <div className="text-[10px] text-rose-600">Not signed in</div>
                        )}
                    </div>

                    {user?.is_admin && (
                        <div className="flex items-center gap-2">
                            <div className="text-[11px] text-gray-500 dark:text-gray-400 mr-1 font-medium">Reviewer:</div>
                            <div className="relative min-w-[140px]">
                                <Listbox
                                    value={selectedReviewer}
                                    onChange={(val) => {
                                        setSelectedReviewer(val);
                                        try {
                                            window.dispatchEvent(new CustomEvent("admin:reviewerSelected", { detail: val }));
                                        } catch {}
                                    }}
                                    by="email"
                                >
                                    <div className="relative">
                                        <Listbox.Button
                                            className="flex items-center gap-1 px-3 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-sm text-sm font-medium text-gray-900 dark:text-gray-100 w-full"
                                            aria-label="Select reviewer"
                                        >
                                            <span className="truncate">
                                                {reviewersLoading ? "Loading…" : selectedReviewer ? selectedReviewer.name : "All reviewers"}
                                            </span>
                                            <ChevronDownIcon className="w-4 h-4 flex-shrink-0 text-gray-500" />
                                        </Listbox.Button>
                                        <Listbox.Options className="absolute z-[999] mt-1 max-h-60 w-full overflow-auto rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 shadow-2xl py-1 text-sm">
                                            <Listbox.Option
                                                key="__all__"
                                                value={null}
                                                className={({ active, selected }) =>
                                                    clsx(
                                                        "cursor-pointer px-3 py-2",
                                                        active && "bg-gray-100 dark:bg-slate-700",
                                                        selected && "font-semibold"
                                                    )
                                                }
                                            >
                                                All reviewers
                                            </Listbox.Option>
                                            {reviewersList.map((r) => (
                                                <Listbox.Option
                                                    key={r.email}
                                                    value={r}
                                                    className={({ active, selected }) =>
                                                        clsx(
                                                            "cursor-pointer px-3 py-2",
                                                            active && "bg-gray-100 dark:bg-slate-700",
                                                            selected && "font-semibold"
                                                        )
                                                    }
                                                >
                                                    {r.name}
                                                </Listbox.Option>
                                            ))}
                                        </Listbox.Options>
                                    </div>
                                </Listbox>
                                {reviewersError && (
                                    <div className="text-xs text-red-600 mt-1">Failed to load reviewers</div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Pricing removed */}

                    <button
                        aria-label="Exit"
                        onClick={() => setShowExitConfirm(true)}
                        className="inline-flex items-center justify-center px-4 py-2 rounded-full border border-red-300 text-red-700 bg-red-50 hover:bg-red-100 transition font-semibold text-sm shadow-sm"
                    >
                        Exit
                    </button>
                </div>
                {isAdminView && adminActions && (
                    <div className="w-full mt-3 pt-2 border-t border-gray-100 dark:border-slate-800">
                        <div className="flex flex-wrap items-center gap-2 text-[11px] leading-none">
                            {adminActions}
                        </div>
                    </div>
                )}
            </section>

            <ConfirmModal
                open={showExitConfirm}
                title="Exit"
                description="Are you sure you want to leave? Any unsaved work will be lost."
                confirmText="Exit"
                onConfirm={handleExit}
                onCancel={() => setShowExitConfirm(false)}
            />
        </>
    );
}

const TopBar = memo(forwardRef(TopBarImpl));

if (process.env.NODE_ENV !== "production") {
    TopBar.propTypes = {
        abstract: PropTypes.object,
        onExit: PropTypes.func,
        className: PropTypes.string,
        isAdminView: PropTypes.bool,
        withMargin: PropTypes.bool,
        adminActions: PropTypes.node,
        maxWidth: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    };
}

export default TopBar;