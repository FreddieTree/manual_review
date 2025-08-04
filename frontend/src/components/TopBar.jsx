import React, { useState, useCallback, useMemo, forwardRef, memo, useEffect } from "react";
import PropTypes from "prop-types";
import clsx from "clsx";
import PricingDisplay from "./PricingDisplay";
import ConfirmModal from "./ConfirmModal";
import { Listbox } from "@headlessui/react";
import { ChevronDownIcon } from "@heroicons/react/24/solid";
import { useUser } from "../hooks/useUser";
import { useNavigate, useLocation } from "react-router-dom";
import { client } from "../api/client";

const systemFont = "system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif";
const LOGIN_PATH = (import.meta.env.VITE_LOGIN_PATH || "/").replace(/\/+$/, "") || "/";

function TopBarImpl({ abstract = {}, onExit, className = "", isAdminView = false }, ref) {
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
            client
                .get("reviewers?per_page=200")
                .then((res) => {
                    const listRaw = Array.isArray(res?.reviewers)
                        ? res.reviewers
                        : Array.isArray(res?.data?.reviewers)
                            ? res.data.reviewers
                            : [];
                    const list = (listRaw || []).map((r) => ({
                        name: (r.name || r.email || "").trim(),
                        email: (r.email || "").toLowerCase(),
                    }));
                    if (cancelled) return;
                    setReviewersList(list);
                    if (list.length) setSelectedReviewer(list[0]);
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
            onExit();
            return;
        }
        try {
            await logout(); // ensure logout completes
        } catch (e) {
            // swallow but log
            // eslint-disable-next-line no-console
            console.warn("Logout failed:", e);
        }
        // explicit redirect to login preserving next
        const next = encodeURIComponent(location.pathname + location.search);
        navigate(`${LOGIN_PATH}?next=${next}`, { replace: true });
    }, [onExit, logout, navigate, location]);

    const greetName = useMemo(() => {
        if (userLoading) return "";
        if (user?.name && user.name.trim()) return user.name.trim();
        if (user?.email) return String(user.email).split("@")[0];
        return "there";
    }, [user, userLoading]);

    const pricingTitle = useMemo(() => {
        if (user?.is_admin) {
            if (selectedReviewer) return `Pricing for ${selectedReviewer.name}`;
            return "All reviewers pricing";
        }
        return "Your pricing";
    }, [user, selectedReviewer]);

    return (
        <>
            <section
                ref={ref}
                className={clsx(
                    "relative isolate mx-auto my-4 rounded-3xl overflow-hidden",
                    "bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800",
                    "shadow-xl",
                    "backdrop-blur-sm",
                    "transition-colors",
                    "flex flex-col md:flex-row items-center justify-between px-6 py-4",
                    className
                )}
                style={{ maxWidth: "1100px", fontFamily: systemFont }}
                aria-label="Top bar"
            >
                <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center gap-3">
                    {isAdminView ? (
                        <div className="flex flex-col">
                            <div className="flex items-baseline gap-2">
                                <div className="text-2xl font-extrabold text-slate-900 dark:text-white">Admin Dashboard</div>
                                <div className="text-sm font-semibold text-indigo-500">v2</div>
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
                                <Listbox value={selectedReviewer} onChange={setSelectedReviewer} by="email">
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
                                        <Listbox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 shadow-lg py-1 text-sm">
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

                    <div className="flex flex-col items-end space-y-1">
                        <div className="text-[11px] text-gray-500 dark:text-gray-400 font-medium">{pricingTitle}</div>
                        <div className="flex items-center gap-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 shadow-sm">
                            {user?.is_admin ? (
                                <PricingDisplay abstractId={pmid} compact reviewerEmail={selectedReviewer?.email} showTooltip />
                            ) : (
                                <PricingDisplay abstractId={pmid} compact showTooltip />
                            )}
                        </div>
                    </div>

                    <button
                        aria-label="Exit"
                        onClick={() => setShowExitConfirm(true)}
                        className="inline-flex items-center justify-center px-4 py-2 rounded-full border border-red-300 text-red-700 bg-red-50 hover:bg-red-100 transition font-semibold text-sm shadow-sm"
                    >
                        Exit
                    </button>
                </div>
            </section>

            <ConfirmModal
                open={showExitConfirm}
                title="Exit"
                description="Are you sure you want to leave? Any unsaved work will be lost."
                confirmText="Log out"
                onConfirm={handleExit}
                onCancel={() => setShowExitConfirm(false)}
            />
        </>
    );
}

if (process.env.NODE_ENV !== "production") {
    TopBarImpl.propTypes = {
        abstract: PropTypes.object,
        onExit: PropTypes.func,
        className: PropTypes.string,
        isAdminView: PropTypes.bool,
    };
}

export default memo(forwardRef(TopBarImpl));