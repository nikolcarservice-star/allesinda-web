# Allesinda — обновление от 31.05.2026

Архив **`allesinda-web-main_update_2026-05-31.zip`** (~2,5 MB) — копия проекта для замены/обновления оригинала.

**Не включено в архив:** `node_modules`, `.next`, `.venv`, `__pycache__`, `allesinda.db`, `.env.local`, `img_backup`.

---

## Что нового (с исправления выбивания из аккаунта)

### Авторизация
- `frontend/lib/context/auth-context.tsx` — выход только при **401**, повтор запроса при сетевых сбоях (не разлогинивает при refresh).
- `frontend/app/profile/page.tsx` — ожидание `loading` перед редиректом на login.
- `frontend/lib/api/client.ts` — корректная обработка ошибок API.

### Кабинет мастера (`/profile`, role=master)
- `frontend/components/master/master-cabinet.tsx` — мобильный кабинет (вкладки Profil / Foto / Video / Bewertungen).
- `frontend/components/master/master-cabinet-desktop.tsx` — **отдельный ПК-интерфейс** (Card + Tabs, как dashboard).
- `frontend/app/profile/profile-layout-wrapper.tsx` — отступы только на mobile.
- `frontend/components/layout/header.tsx` — шапка скрыта на mobile в кабинете, на **desktop** — обычная.
- `frontend/lib/api/masters.ts` — cabinet API + fallback при 404.
- `backend/app/routers/masters.py` — `GET/PATCH /masters/me/cabinet`.
- `backend/app/schemas.py`, `backend/app/models.py` — profession, cabinet fields.

### Аккаунт: выход и удаление
- `frontend/components/profile/account-session-section.tsx` — Abmelden, удаление с паролем и **LÖSCHEN**.
- `backend/app/utils/account_deletion.py` — 14 дней восстановления, затем анонимизация.
- `backend/app/routers/auth.py` — `request-deletion`, `restore`, `PATCH /auth/me`.
- `frontend/app/login/page.tsx` — восстановление удалённого аккаунта.

### Мобильный UI (сайт)
- `frontend/components/layout/mobile-back-bar.tsx` + `frontend/lib/navigation/mobile-back.ts` — **Zurück** на всех страницах (кроме home, master detail, call).
- `frontend/components/layout/mobile-app-chrome.tsx` — интеграция back bar.
- `frontend/components/layout/footer.tsx` + `conditional-footer.tsx` — подвал **только desktop**; на mobile скрыт.

### Медиа
- `frontend/lib/api/media.ts` — загрузка видео, таймаут, расширения.
- `backend/app/routers/media.py` — m4v, 3gp и др.

---

## Как обновить оригинал

1. Сделайте **резервную копию** текущего проекта и `.env` / `.env.local`.
2. Распакуйте ZIP поверх папки проекта (или в новую папку и перенесите).
3. Сохраните свои `.env.local` и `backend/.env` — они **не** в архиве.
4. Установите зависимости:
   ```bash
   cd frontend && pnpm install
   cd ../backend && pip install -r requirements.txt
   ```
5. **Перезапустите backend** (нужны новые эндпоинты cabinet и deletion).
6. При необходимости примените миграции БД / пересоздайте `allesinda.db` через seed.

---

## Проверка после обновления

- [ ] Вход → `/profile` как master → refresh страницы — **остаётесь в аккаунте**
- [ ] Mobile: кнопка Zurück, нет подвала, нижнее меню
- [ ] Desktop: `/profile` — карточки и вкладки ПК, шапка и подвал сайта
- [ ] Speichern в кабинете мастера
- [ ] Загрузка фото/видео
- [ ] Удаление аккаунта (тест на staging)
