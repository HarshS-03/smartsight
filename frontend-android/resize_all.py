import os
from PIL import Image

src_icon = 's:\\smartsight\\desktop\\public\\app_icon.png'
src_fg = 's:\\smartsight\\desktop\\public\\app_icon_fg.png'

factor = 1.6

# 1. Update Android Public icons
for fn, src in [('app_icon.png', src_icon), ('app_icon_fg.png', src_fg), ('icon-512.png', src_icon)]:
    try:
        img = Image.open(src).convert('RGBA')
        w, h = img.size
        img = img.resize((int(w * factor), int(h * factor)), Image.Resampling.LANCZOS)
        left = (img.width - w) / 2
        top = (img.height - h) / 2
        img = img.crop((left, top, left + w, top + h))
        img.save('s:\\smartsight\\frontend-android\\public\\' + fn)
        img.save('s:\\smartsight\\desktop\\public\\' + fn)
    except Exception as e:
        print(e)

# 2. Update Android Mipmaps (overwriting them with the newly scaled icon)
# The mipmaps have different sizes, so we'll just scale the desktop 512x512 down to standard mipmap sizes.
mipmap_sizes = {
    'mipmap-mdpi': 48,
    'mipmap-hdpi': 72,
    'mipmap-xhdpi': 96,
    'mipmap-xxhdpi': 144,
    'mipmap-xxxhdpi': 192,
}
base_img = Image.open(src_icon).convert('RGBA')
w, h = base_img.size
base_img = base_img.resize((int(w * factor), int(h * factor)), Image.Resampling.LANCZOS)
left = (base_img.width - w) / 2
top = (base_img.height - h) / 2
base_img = base_img.crop((left, top, left + w, top + h))

res_dir = 's:\\smartsight\\frontend-android\\android\\app\\src\\main\\res'
for folder, size in mipmap_sizes.items():
    folder_path = os.path.join(res_dir, folder)
    if os.path.exists(folder_path):
        scaled = base_img.resize((size, size), Image.Resampling.LANCZOS)
        for fn in ['ic_launcher.png', 'ic_launcher_foreground.png', 'ic_launcher_round.png']:
            scaled.save(os.path.join(folder_path, fn))

# 3. Create .ico for electron
ico_path = 's:\\smartsight\\desktop\\electron\\assets\\appIcon.ico'
os.makedirs(os.path.dirname(ico_path), exist_ok=True)
# .ico can contain multiple sizes, but a single 256x256 is usually fine
ico_img = base_img.resize((256, 256), Image.Resampling.LANCZOS)
ico_img.save(ico_path, format='ICO', sizes=[(256, 256)])
print("Done")
