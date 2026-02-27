'use client';

import { useEffect } from 'react';

// Custom hook for body scroll locking (упрощённая версия без изменения overflow)
export function useBodyScrollLock(isLocked: boolean) {
  useEffect(() => {
    // Раньше здесь блокировался скролл body через document.body.style.overflow.
    // Сейчас хук ничего не меняет, чтобы избежать залипания блокировки скролла.
  }, [isLocked]);
}
