import React, { forwardRef, memo } from "react";
import { Link } from "react-router-dom";

function NoTasksPageImpl(_, ref) {
  return (
    <div
      ref={ref}
      className="flex flex-col items-center justify-center min-h-[70vh] bg-gradient-to-b from-blue-50 via-white to-blue-100"
    >
      <div className="text-5xl mb-4 animate-bounce">🎉</div>
      <div className="text-2xl sm:text-3xl font-black text-emerald-700 mb-3 tracking-wide">
        All abstracts are fully reviewed!
      </div>
      <div className="text-gray-700 mb-8 text-base sm:text-lg text-center">
        <b>No more abstracts</b> need your review at this time.
        <br />
        <span className="text-gray-500">
          Thank you for your valuable contributions to the project!
        </span>
      </div>
      <Link
        to="/"
        className="inline-block px-7 py-2.5 bg-blue-700 text-white rounded-xl shadow-md font-bold text-base hover:bg-blue-900 hover:scale-105 transition"
      >
        ⬅️ Back to Home
      </Link>
      <div className="mt-10 text-gray-400 text-xs">
        Platform refreshes automatically as new abstracts become available.
      </div>
    </div>
  );
}

export default memo(forwardRef(NoTasksPageImpl));