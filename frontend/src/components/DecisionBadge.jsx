export default function DecisionBadge({ decision }) {
    const mapping = {
        accept: { label: "Accepted", bg: "bg-emerald-100", text: "text-emerald-800" },
        modify: { label: "Modify", bg: "bg-yellow-100", text: "text-yellow-800" },
        reject: { label: "Rejected", bg: "bg-red-100", text: "text-red-800" },
        uncertain: { label: "Uncertain", bg: "bg-gray-100", text: "text-gray-700" },
    };
    const info = mapping[decision] || mapping.uncertain;
    return (
        <div
            className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${info.bg} ${info.text}`}
        >
            {info.label}
        </div>
    );
}