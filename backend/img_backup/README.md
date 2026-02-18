# img_backup — резерв изображений для категорий

При старте бекенда (Docker) содержимое этой папки копируется в `uploads/`.

## Структура папок

```
img_backup/
  categories/           — иконки категорий (Meister, Produkte, Mieten)
    master-01.jpeg      — Auto
    master-02.jpeg      — Sanitär
    master-03.jpeg      — Elektrik
    master-04.jpeg      — Reinigung
    master-05.jpeg      — Sicherheit
    master-06.jpeg      — Dachdecker
    master-07.jpeg      — Schreinerei
    master-08.jpeg      — Fliesen
    master-09.jpeg      — Malerei
    master-10.jpeg      — HLK
    master-11.jpeg      — Handwerker
    product-01.jpeg     — Elektrowerkzeuge
    product-02.jpeg     — Handwerkzeuge
    ...
    rental-01.jpeg
    rental-02.jpeg
    ...
```

## Формат имён файлов

- **master-XX.jpeg** — категории мастеров (Meister), XX = 01, 02, ...
- **product-XX.jpeg** — категории товаров
- **rental-XX.jpeg** — категории аренды

Поддерживаются форматы: jpeg, jpg, png, webp.

## Обновление изображений в БД

После добавления/замены файлов выполните:

```bash
cd backend
python -m scripts.update_category_images
```

Или перезапустите контейнер с `SEED_DB_ON_START=true` (seed создаст пути при первом запуске).
