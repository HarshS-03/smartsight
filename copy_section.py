import re

android_file = r"s:\smartsight\frontend-android\src\pages\ReportsPage.jsx"
desktop_file = r"s:\smartsight\desktop\src\pages\ReportsPage.jsx"

with open(android_file, 'r', encoding='utf-8') as f:
    android_lines = f.readlines()
    
with open(desktop_file, 'r', encoding='utf-8') as f:
    desktop_lines = f.readlines()

start_android = -1
end_android = -1
for i, line in enumerate(android_lines):
    if '{/* Frequent Persons Section */}' in line:
        start_android = i
    if start_android != -1 and i > start_android and '{/* Detailed Records Table */}' in line:
        end_android = i
        break

start_desktop = -1
end_desktop = -1
for i, line in enumerate(desktop_lines):
    if '{/* Frequent Persons Grid Section */}' in line:
        start_desktop = i
    if start_desktop != -1 and i > start_desktop and '{/* ' in line and 'Table' in line:
        end_desktop = i
        break

if start_android != -1 and end_android != -1 and start_desktop != -1 and end_desktop != -1:
    android_snippet = android_lines[start_android:end_android]
    
    # We also need to add `const [frequentPersonsFilter, setFrequentPersonsFilter] = useState('ALL');`
    # if it's not in desktop_lines
    
    has_filter_state = any('frequentPersonsFilter' in l for l in desktop_lines)
    
    new_desktop_lines = []
    
    for i, line in enumerate(desktop_lines):
        if i == start_desktop:
            # We skip until end_desktop
            new_desktop_lines.extend(android_snippet)
            continue
        elif i > start_desktop and i < end_desktop:
            continue
            
        new_desktop_lines.append(line)
        
        # Add state variable after frequentPersons state
        if not has_filter_state and 'const [frequentPersons, setFrequentPersons] = useState([]);' in line:
            new_desktop_lines.append("  const [frequentPersonsFilter, setFrequentPersonsFilter] = useState('ALL');\n")
            
    with open(desktop_file, 'w', encoding='utf-8') as f:
        f.writelines(new_desktop_lines)
    
    print("Desktop ReportsPage updated with Android's Frequent Persons section!")
else:
    print("Failed to find bounds.")
