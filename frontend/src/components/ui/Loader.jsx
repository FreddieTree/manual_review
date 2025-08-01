export default function Loader({ size = 36, label = "Loading..." }) {
    return (
        <div className="flex items-center gap-3">
            <div
                className="animate-spin rounded-full border-4 border-t-primary border-gray-200"
                style={{ width: size, height: size, borderTopColor: "rgba(43,93,215,1)" }}
                aria-label="Loading spinner"
            />
            {label && <div className="text-sm text-gray-600">{label}</div>}
        </div>
    );
}