import os
import re

app_files = [
    r"s:\smartsight\desktop\src\App.jsx",
    r"s:\smartsight\frontend-android\src\App.jsx",
    r"s:\smartsight\desktop\src\components\Sidebar.jsx",
    r"s:\smartsight\frontend-android\src\components\Navbar.jsx",
    r"s:\smartsight\desktop\src\pages\AdminPanelPage.jsx",
    r"s:\smartsight\frontend-android\src\pages\AdminPanelPage.jsx",
]

for filepath in app_files:
    if not os.path.exists(filepath):
        print(f"Skipping {filepath} (Not Found)")
        continue
    
    with open(filepath, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    new_lines = []
    skip_next = False
    in_camera_block = False
    
    for line in lines:
        # App.jsx specific:
        if 'import CamerasPage' in line:
            continue
        if '<Route' in line and 'path="/cameras"' in line:
            continue
            
        # AdminPanelPage.jsx specific:
        # it might have an object { title: 'Cameras', endpoint: '/cameras/', ...}
        # it's tricky to remove multi-line objects. 
        # But this is just a quick cleanup.

        new_lines.append(line)
        
    with open(filepath, 'w', encoding='utf-8') as f:
        f.writelines(new_lines)
    print(f"Updated {filepath}")
