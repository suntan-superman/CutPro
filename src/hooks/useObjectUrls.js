"use client";

import { useCallback, useEffect, useRef } from "react";

// Object URLs are resources: create them in event handlers, never during render.
export default function useObjectUrls() {
  const urls = useRef(new Set());

  const createObjectUrl = useCallback((file) => {
    const url = URL.createObjectURL(file);
    urls.current.add(url);
    return url;
  }, []);

  const revokeObjectUrl = useCallback((url) => {
    if (url && urls.current.delete(url)) URL.revokeObjectURL(url);
  }, []);

  const clearObjectUrls = useCallback(() => {
    urls.current.forEach((url) => URL.revokeObjectURL(url));
    urls.current.clear();
  }, []);

  useEffect(() => clearObjectUrls, [clearObjectUrls]);

  return { createObjectUrl, revokeObjectUrl, clearObjectUrls };
}
