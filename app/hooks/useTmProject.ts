'use client';

import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'tm.project';

// The test-management project picked last, shared by Test Cases and Test Runs.
export const useTmProject = (): [string | null, (key: string | null) => void] => {
  const [key, setKeyState] = useState<string | null>(null);

  useEffect(() => {
    try {
      setKeyState(window.localStorage.getItem(STORAGE_KEY));
    } catch {
      // storage unavailable (private mode) — just don't remember
    }
  }, []);

  const setKey = useCallback((next: string | null) => {
    setKeyState(next);
    try {
      if (next) window.localStorage.setItem(STORAGE_KEY, next);
      else window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  return [key, setKey];
};
