# Собирает папки v1…v10 из template.html: та же страница, но с другими настройками первого экрана и оформления.
# Корень сайта (index.html) = v10, выбранная версия (alejo 14.11).
import pathlib, re
d = pathlib.Path(__file__).parent
base = (d/'template.html').read_text()  # шаблон страницы; ?v= для сброса кэша менять здесь
V = {
  'v1': ('Переписка', '{ introStyle: "chat" }'),
  'v2': ('Фото на первом экране, светлая тема', '{ introStyle: "photo", theme: "light", themeKey: "quiz_theme_v2" }'),
  'v3': ('Пудра и слива, тёмная — бургунди', '{ introStyle: "photo", skin: "powder", heroPhoto: "yulia_powder.jpg", theme: "light", themeKey: "quiz_theme_v3" }'),
  'v4': ('Серо-голубой', '{ introStyle: "photo", skin: "sky" }'),
  'v5': ('Изумруд, светлая, рисунки', '{ introStyle: "photo", skin: "emerald", heroPhoto: "yulia_powder.jpg", videoCover: "yulia_big.jpg", themeLock: true, resultIcons: true, resultVideo: true, theme: "light", illus: "draw" }'),
  'v6': ('Изумруд, светлая, фото', '{ introStyle: "photo", skin: "emerald", heroPhoto: "yulia_powder.jpg", videoCover: "yulia_big.jpg", themeLock: true, resultIcons: true, resultVideo: true, theme: "light", illus: "photo" }'),
  'v7': ('Изумруд, тёмная, рисунки', '{ introStyle: "photo", skin: "emerald", heroPhoto: "yulia_powder.jpg", videoCover: "yulia_big.jpg", themeLock: true, resultIcons: true, resultVideo: true, theme: "dark", illus: "draw" }'),
  'v8': ('Изумруд, тёмная, фото', '{ introStyle: "photo", skin: "emerald", heroPhoto: "yulia_powder.jpg", videoCover: "yulia_big.jpg", themeLock: true, resultIcons: true, resultVideo: true, theme: "dark", illus: "photo" }'),
  'v9': ('Итоговая: изумруд, рисунки, светлая + переключатель', '{ introStyle: "photo", skin: "emerald", heroPhoto: "yulia_powder.jpg", videoCover: "yulia_big.jpg", resultIcons: true, resultVideo: true, theme: "light", themeKey: "quiz_theme_v9", illus: "draw" }'),
  'v10': ('Итоговая: изумруд, фото, светлая + переключатель', '{ introStyle: "photo", skin: "emerald", heroPhoto: "yulia_powder.jpg", videoCover: "yulia_big.jpg", resultIcons: true, resultVideo: true, theme: "light", themeKey: "quiz_theme_v10", illus: "photo", introAccent: true }'),
}
for k, (name, cfg) in V.items():
    h = base.replace('<meta charset="utf-8">', '<meta charset="utf-8">\n<base href="../">')
    h = re.sub(r'(<script src="config\.js[^"]*"></script>)', r'\1\n<script>window.QUIZ_VARIANT = ' + cfg + ';</script>', h)
    h = h.replace('<title>Тест — Юлия Мартынюк</title>', '<title>Тест — Юлия Мартынюк</title>\n<!-- версия ' + k + ': ' + name + ' -->')
    (d/k).mkdir(exist_ok=True)
    (d/k/'index.html').write_text(h)
print('ok')

# Главная страница квиза = v10 (без <base>, файлы рядом)
name, cfg = V['v10']
h = re.sub(r'(<script src="config\.js[^"]*"></script>)', r'\1\n<script>window.QUIZ_VARIANT = ' + cfg + ';</script>', base)
h = h.replace('<title>Тест — Юлия Мартынюк</title>', '<title>Тест — Юлия Мартынюк</title>\n<!-- главная = v10: ' + name + '. Не править вручную: собирается make_versions.py из template.html -->')
(d/'index.html').write_text(h)
print('index = v10')
