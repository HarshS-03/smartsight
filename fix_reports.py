with open(r's:\smartsight\frontend-android\src\pages\ReportsPage.jsx', 'r', encoding='utf-8') as f:
    android_lines = f.readlines()
with open(r's:\smartsight\desktop\src\pages\ReportsPage.jsx', 'r', encoding='utf-8') as f:
    desktop_lines = f.readlines()

android_snippet = android_lines[655:1241]

new_desktop = []
for i, line in enumerate(desktop_lines):
    if i == 556:
        new_desktop.extend(android_snippet)
    elif i > 556 and i < 1078:
        continue
    else:
        new_desktop.append(line)
        if 'const [frequentPersons, setFrequentPersons] = useState([]);' in line:
            new_desktop.append("  const [frequentPersonsFilter, setFrequentPersonsFilter] = useState('ALL');\n")

with open(r's:\smartsight\desktop\src\pages\ReportsPage.jsx', 'w', encoding='utf-8') as f:
    f.writelines(new_desktop)
print('Done!')
