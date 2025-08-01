// Lightweight, accessible badge for decisions
const MAPPING = {
    accept: { bg: "bg-emerald-100", text: "text-emerald-800", label: "ACCEPT" },
    modify: { bg: "bg-yellow-100", text: "text-yellow-800", label: "MODIFY" },
    reject: { bg: "bg-red-100", text: "text-red-800", label: "REJECT" },
    uncertain: { bg: "bg-gray-100", text: "text-gray-700", label: "UNCERTAIN" },
};

export default function DecisionBadge({ decision = "uncertain" }) {
    const info = MAPPING[decision] || MAPPING.uncertain;
    return (
        <div
            aria-label={`Overall decision: ${info.label}`}
            className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${info.bg} ${info.text} ring-1 ring-inset ring-gray-200`}
        >
            {info.label}
        </div>
    );
}