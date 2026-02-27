"use client"

import { useEffect } from "react"

// Глобальный фикс: гарантированно включаем прокрутку body на клиенте
export function BodyScrollReset() {
  useEffect(() => {
    try {
      document.body.style.overflow = "auto"
      document.body.style.overflowY = "auto"
      document.body.style.paddingRight = ""
    } catch {
      // ignore – на сервере или без доступа к document
    }
  }, [])

  return null
}

