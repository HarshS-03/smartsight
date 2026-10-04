import os
from PIL import Image

res_dir = 's:\\smartsight\\frontend-android\\android\\app\\src\\main\\res'
factor = 1.4

for folder in os.listdir(res_dir):
    if folder.startswith('mipmap'):
        for fn in ['ic_launcher.png', 'ic_launcher_foreground.png', 'ic_launcher_round.png']:
            path = os.path.join(res_dir, folder, fn)
            if os.path.exists(path):
                try:
                    img = Image.open(path).convert('RGBA')
                    w, h = img.size
                    img = img.resize((int(w * factor), int(h * factor)), Image.Resampling.LANCZOS)
                    left = (img.width - w) / 2
                    top = (img.height - h) / 2
                    img = img.crop((left, top, left + w, top + h))
                    img.save(path)
                    print(f"Resized {path}")
                except Exception as e:
                    print(f"Failed {path}: {e}")
