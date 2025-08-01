// src/components/AbstractMetaCard.jsx
export default function AbstractMetaCard({ title, pmid, journal, year, meta }) {
    return (
        <div className="bg-white rounded-2xl shadow-lg border px-6 py-5 flex flex-col gap-2">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div className="flex-1">
                    <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 leading-tight">
                        {title}
                    </h1>
                    <div className="mt-1 flex flex-wrap gap-3 text-sm text-gray-700">
                        <div>
                            <span className="font-semibold">PMID:</span> {pmid}
                        </div>
                        <div>
                            <span className="font-semibold">Journal:</span> {journal}
                        </div>
                        <div>
                            <span className="font-semibold">Year:</span> {year}
                        </div>
                    </div>
                </div>
                <div className="text-right text-xs text-gray-500">
                    Reviewed by <span className="font-medium">{meta?.model || "-"}</span>
                    <br />
                    {meta?.timestamp
                        ? new Date(meta.timestamp).toLocaleString(undefined, {
                            dateStyle: "short",
                            timeStyle: "short",
                        })
                        : "-"}
                </div>
            </div>
        </div>
    );
}