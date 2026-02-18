# Allesinda — FastAPI Backend

FastAPI backend for the Allesinda three-sided marketplace.

## Категории — изображения (img_backup)

Иконки категорий хранятся в `backend/img_backup/`. При старте Docker содержимое копируется в `uploads/`.

**Структура:** `img_backup/categories/master-01.jpeg`, `master-02.jpeg`, ... (и product-XX, rental-XX).

После добавления или замены изображений выполните:

```bash
cd backend
python -m scripts.update_category_images
```

Скрипт:
1. Копирует `img_backup/*` в `uploads/`
2. Обновляет `image_url` в БД для всех категорий
