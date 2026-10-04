from PIL import Image
factor = 1.4
for fn in ['app_icon_fg.png', 'app_icon.png', 'icon-512.png']:
    try:
        path = 's:\\smartsight\\frontend-android\\public\\' + fn
        img = Image.open(path).convert('RGBA')
        w, h = img.size
        img = img.resize((int(w * factor), int(h * factor)), Image.Resampling.LANCZOS)
        left = (img.width - w) / 2
        top = (img.height - h) / 2
        img = img.crop((left, top, left + w, top + h))
        img.save(path)
        print(f"Resized {fn}")
    except Exception as e:
        print(f"Failed {fn}: {e}")
