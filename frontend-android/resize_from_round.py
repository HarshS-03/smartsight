import os
from PIL import Image, ImageOps

src_icon = 's:\\smartsight\\desktop\\public\\app_icon_round.png'
# The background is probably dark blue, but since it's an app icon, maybe it has transparency.
# Let's open it and resize it to 512x512
img = Image.open(src_icon).convert('RGBA')

# We want to scale it by 1.25x so it's bigger than the original 1.0x but smaller than 1.6x
# First resize to 512x512
img_512 = img.resize((512, 512), Image.Resampling.LANCZOS)

factor = 1.25
w, h = img_512.size
scaled = img_512.resize((int(w * factor), int(h * factor)), Image.Resampling.LANCZOS)
left = (scaled.width - w) / 2
top = (scaled.height - h) / 2
final_icon = scaled.crop((left, top, left + w, top + h))

# Save to public folders
for prefix in ['s:\\smartsight\\desktop\\public\\', 's:\\smartsight\\frontend-android\\public\\']:
    for fn in ['app_icon.png', 'app_icon_fg.png', 'icon-512.png']:
        try:
            final_icon.save(prefix + fn)
        except Exception as e:
            pass

# Save to mipmaps
mipmap_sizes = {
    'mipmap-mdpi': 48,
    'mipmap-hdpi': 72,
    'mipmap-xhdpi': 96,
    'mipmap-xxhdpi': 144,
    'mipmap-xxxhdpi': 192,
}
res_dir = 's:\\smartsight\\frontend-android\\android\\app\\src\\main\\res'
for folder, size in mipmap_sizes.items():
    folder_path = os.path.join(res_dir, folder)
    if os.path.exists(folder_path):
        scaled_mipmap = final_icon.resize((size, size), Image.Resampling.LANCZOS)
        for fn in ['ic_launcher.png', 'ic_launcher_foreground.png', 'ic_launcher_round.png']:
            scaled_mipmap.save(os.path.join(folder_path, fn))

# Save to electron ico
ico_path = 's:\\smartsight\\desktop\\electron\\assets\\appIcon.ico'
os.makedirs(os.path.dirname(ico_path), exist_ok=True)
ico_img = final_icon.resize((256, 256), Image.Resampling.LANCZOS)
ico_img.save(ico_path, format='ICO', sizes=[(256, 256)])
print("Done restoring and resizing to 1.25x")
