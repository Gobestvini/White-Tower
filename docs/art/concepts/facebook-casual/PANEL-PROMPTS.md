# Промпты чистых панелей

Четыре панели восстановлены встроенным `image_gen`, `transparent_background=true`, с исходным концептом как `referenced_image_paths`. Остальные 146 элементов вырезаны из оригиналов без перерисовки. Панели являются реконструкциями скрытых поверхностей, а не попиксельными копиями.

## panel-levels

Источник: `04-levels.png`.

Use case: background-extraction / precise-object-edit. Image 1 is the edit target, an existing White Tower game concept. Prepare a PRODUCTION GAME GUI ASSET. Extract ONLY the large rounded ivory level-selection panel with its blue-and-gold outer border. Remove the entire logo, tower, sky, islands, all title texts, all 30 numbered buttons, footer pagination and settings button. Reconstruct a clean unmarked ivory interior. Preserve the outer silhouette, proportions, perspective (front facing), bevel, blue frame and gold rim of the panel. The panel must be a standalone reusable GUI background, no header title plaque, no text or icons. Preserve original material, palette, lighting and craftsmanship. Actual transparent RGBA background everywhere outside the panel silhouette, not checkerboard or a flat color. Center the isolated asset with 24px transparent safety padding. No surrounding scene, no drop shadow from any sky/island, no watermark. Do not create a screenshot or collage.

## panel-settings

Источник: `05-settings.png`.

Use case: background-extraction / precise-object-edit. Image 1 is the edit target, an existing White Tower game concept. Prepare a PRODUCTION GAME GUI ASSET. Extract ONLY the large tall ivory settings panel with its blue outer frame. Remove the blue Settings title plaque and reconstruct the upper body rim behind it. Remove ALL texts, icons, toggles, slider, row dividers, inner settings card and all buttons. Reconstruct a clean unmarked ivory interior. Preserve the outer silhouette, tall proportions, front facing perspective and blue bevel frame of the panel. Preserve original material, palette, lighting and craftsmanship. Actual transparent RGBA background everywhere outside the panel silhouette, not checkerboard or a flat color. Center the isolated asset with 24px transparent safety padding. No surrounding scene, no drop shadow from any sky/island, no watermark. Do not create a screenshot or collage.

## panel-confirmation

Источник: `08-reset-confirmation.png`.

Use case: background-extraction / precise-object-edit. Image 1 is the edit target, an existing White Tower game concept. Prepare a PRODUCTION GAME GUI ASSET. Extract ONLY the foreground ivory confirmation dialog with its blue rounded frame. Remove icon, all text and both buttons completely and reconstruct the smooth clean unmarked ivory interior. Preserve the exact front-facing compact rounded panel silhouette, blue bevel rim and proportions. Remove all of the dimmed settings screen behind. Preserve original material, palette, lighting and craftsmanship. Actual transparent RGBA background everywhere outside the panel silhouette, not checkerboard or a flat color. Center the isolated asset with 24px transparent safety padding. No surrounding scene, no drop shadow from any sky/island, no watermark. Do not create a screenshot or collage.

## panel-storage

Источник: `09-storage-recovery.png`.

Use case: background-extraction / precise-object-edit. Image 1 is the edit target, an existing White Tower game concept. Prepare a PRODUCTION GAME GUI ASSET. Extract ONLY the tall ivory settings panel and its blue header bar, preserving the header shape and large rounded blue rim. Remove header text, close icon, warning banner, every row, all labels/icons/controls and green button. Reconstruct a clean blank ivory interior and blank blue header. Preserve front-facing proportions and original framing style. Preserve original material, palette, lighting and craftsmanship. Actual transparent RGBA background everywhere outside the panel silhouette, not checkerboard or a flat color. Center the isolated asset with 24px transparent safety padding. No surrounding scene, no drop shadow from any sky/island, no watermark. Do not create a screenshot or collage.

Сырые результаты обрабатывает `tools/prepare-transparent-panels.py`: основной alpha-компонент, удаление загрязнённого внешнего края, нормализация почти непрозрачного интерьера, обрезка и 8 px прозрачного padding.
