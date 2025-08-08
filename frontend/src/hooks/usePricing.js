import { useState, useEffect, useCallback, useRef } from "react";
// Pricing no longer supported; this hook now no-ops and always returns null

/**
 * usePricing：自动拉取并轮询 pricing，支持 pauseOnHidden
 */
export function usePricing() {
    // Always return nulls; pricing removed.
    return { pricing: null, loading: false, error: null, isStale: false, refetch: () => {} };
}