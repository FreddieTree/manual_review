import React, { forwardRef, memo } from "react";
import { Link } from "react-router-dom";

function NotFoundPageImpl(_, ref) {
  return (
    <div
      ref={ref}
      className="flex flex-col items-center justify-center min-h-[70vh] bg-gradient-to-b from-red-50 via-white to-gray-100"
    >
      <div className="text-7xl font-extrabold text-red-400 mb-2 drop-shadow-md animate-pulse">
        404
      </div>
      <div className="text-2xl font-bold text-gray-800 mb-2">Page Not Found</div>
      <div className="text-gray-500 mb-8 text-base">
        The page you’re looking for doesn’t exist or has been moved.
      </div>
      <Link
        to="/"
        className="inline-block px-8 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-800 shadow font-bold transition"
      >
        Go to Home
      </Link>
      <div className="mt-10 text-xs text-gray-300">
        If you believe this is a bug, please contact the system admin.
      </div>
    </div>
  );
}

export default memo(forwardRef(NotFoundPageImpl));