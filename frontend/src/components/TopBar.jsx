// src/components/TopBar.jsx
import React, { useState, useCallback, useMemo } from "react";
import PropTypes from "prop-types";
import clsx from "clsx";
import PricingDisplay from "./PricingDisplay";
import { useUser } from "../hooks/useUser";
import ConfirmModal from "./ConfirmModal";

export default function TopBar({ abstract = {}, onExit, className = "" }) {
    const { user, loading: userLoading } = useUser();
    const [showExitConfirm, setShowExitConfirm] = useState(false);

    const handleExit = useCallback(() => {
        setShowExitConfirm(false);
        onExit?.();
    }, [onExit]);

    const sentenceCount = abstract?.sentence_count;
    const pmid = abstract?.pmid;

    const greetName = useMemo(() => {
        if (user?.name && user.name.trim()) return user.name.trim();
        if (user?.email) return String(user.email).split("@")[0];
        return "there";
    }, [user]);

    return (
        <>
            <section
                className={clsx(
                    "relative isolate mx-auto my-4 rounded-2xl overflow-hidden",
                    "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 ring-1 ring-black/5",
                    "shadow-[0_12px_28px_rgba(0,0,0,0.08)]",
                    className
                )}
                style={{ maxWidth: "1100px" }}
                aria-label="Top bar"
            >
                {/* 用 inline clamp 防止被外部样式覆盖 */}
                <div className="w-full" style={{ padding: "clamp(14px,2.6vw,22px) clamp(16px,3.5vw,28px)" }}>
                    {/* 小屏纵向；md 起两列：左内容自适应，右侧宽度按需 */}
                    <div className="flex flex-col gap-5 md:grid md:grid-cols-[1fr_auto] md:items-center">
                        {/* 左侧：标题 + 概览 */}
                        <div className="min-w-0">
                            <h1
                                className="text-slate-900 dark:text-slate-50 font-extrabold leading-tight tracking-tight"
                                style={{ fontSize: "clamp(20px,2.4vw,26px)" }}
                            >
                                Abstract Review
                            </h1>

                            <div className="mt-1.5 flex flex-wrap items-center gap-2">
                                {typeof sentenceCount === "number" && (
                                    <span className="inline-flex items-center gap-1 rounded-full px-3 py-1 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                                        <strong className="font-semibold">{sentenceCount}</strong>
                                        <span className="text-xs">sentence{sentenceCount === 1 ? "" : "s"}</span>
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* 右侧：问候（上）+ 计价（中）+ 退出（右下） */}
                        <div className="flex flex-col items-end gap-3 md:pl-8">
                            {/* Hello（无边框） */}
                            <div className="text-sm text-slate-500 dark:text-slate-300">
                                Hello,&nbsp;
                                <span className="font-semibold text-slate-800 dark:text-slate-100">{greetName}</span>
                                {user?.is_admin && (
                                    <span className="ml-2 align-middle text-[10px] uppercase tracking-wide bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                                        Admin
                                    </span>
                                )}
                            </div>

                            {/* Pricing 外层稳定容器：不换行、不可被压扁 */}
                            <div className="shrink-0 whitespace-nowrap rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 shadow-sm">
                                <PricingDisplay abstractId={pmid} compact={false} showTooltip={true} />
                            </div>

                            {/* Exit 按钮始终在最右 */}
                            <button
                                aria-label="Exit review"
                                onClick={() => setShowExitConfirm(true)}
                                className="shrink-0 inline-flex items-center justify-center
                           px-4 py-2 rounded-xl border border-rose-200 dark:border-rose-700
                           text-rose-700 dark:text-rose-300 bg-rose-50/70 dark:bg-rose-900/10
                           font-semibold text-sm hover:bg-rose-100 dark:hover:bg-rose-900/20
                           transition shadow-sm"
                            >
                                Exit
                            </button>
                        </div>
                    </div>
                </div>
            </section>

            <ConfirmModal
                open={showExitConfirm}
                title="Exit Review"
                description="Are you sure you want to exit? Any unsaved progress will be lost."
                confirmText="Exit"
                onConfirm={handleExit}
                onCancel={() => setShowExitConfirm(false)}
            />
        </>
    );
}

TopBar.propTypes = {
    abstract: PropTypes.object,
    onExit: PropTypes.func,
    className: PropTypes.string,
};

TopBar.defaultProps = {
    abstract: {},
    onExit: null,
    className: "",
};