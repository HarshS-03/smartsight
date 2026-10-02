import os
import re

directories = [
    r"s:\smartsight\desktop\src",
    r"s:\smartsight\frontend-android\src",
    r"s:\smartsight\frontend-android",
    r"s:\smartsight\desktop"
]

extensions = (".jsx", ".js", ".html", ".css")

replacements = [
    # For UI text
    (re.compile(r'\bBiometric(s?)\b', re.IGNORECASE), 'Access Control'),
    (re.compile(r'\bSurveillance\b', re.IGNORECASE), 'Access Control'),
    (re.compile(r'\bSurvillence\b', re.IGNORECASE), 'Access Control'),
    (re.compile(r'\bAttendance\b', re.IGNORECASE), 'Access Logs'),
]

# We should avoid replacing in URLs like `/biometric/verify/`
# or variable names like `biometricVerification` if possible, but JS uses camelCase.
# \bBiometric\b will match 'biometric' in 'biometricVerification' because 'V' is uppercase? No, \b matches word boundaries (alphanumeric to non-alphanumeric).
# So 'biometricVerification' is one word. \b won't split camelCase.
# What about 'biometric-overlay'? \b will split at '-'. That's a CSS class. 
# Changing CSS classes is fine as long as we change it everywhere. But let's only change text inside tags or quotes?
# Actually, changing CSS class names might break things if not changed everywhere.
# Let's replace only occurrences with capital 'B' 'Biometric' or 'Surveillance' (since UI text is usually capitalized) or standalone words.

# Let's just do a naive replace but keep case.
def match_case(word, replacement):
    if word.isupper():
        return replacement.upper()
    elif word.istitle():
        return replacement.title()
    elif word.islower():
        return replacement.lower()
    return replacement

def replace_in_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    new_content = content
    
    # We will skip replacing in URLs
    # Hacky way: temporarily replace urls with a placeholder
    urls = re.findall(r'/\w+/verify/', new_content)
    
    def replacer(match):
        word = match.group(0)
        # Skip if it's part of a camelCase variable name (heuristic: if it's lowercase and followed by uppercase)
        # We can just ignore that for now, since \b matches word boundaries.
        if word.lower().startswith('biometric'):
            return match_case(word, 'Access Control')
        elif word.lower() == 'surveillance' or word.lower() == 'survillence':
            return match_case(word, 'Access Control')
        elif word.lower() == 'attendance':
            return match_case(word, 'Access Logs')
        return word

    for regex, rep in replacements:
        new_content = regex.sub(replacer, new_content)

    # Some manual fixes for css classes or variables that might have been changed
    # e.g., access control-overlay -> access-control-overlay
    new_content = new_content.replace('access control-', 'access-control-')
    new_content = new_content.replace('Access Control-', 'Access-Control-')
    new_content = new_content.replace('/access control/', '/biometric/') # Revert API endpoint

    if new_content != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Updated: {filepath}")

for d in directories:
    for root, dirs, files in os.walk(d):
        # Exclude node_modules and build
        if 'node_modules' in root or 'build' in root or 'dist' in root:
            continue
        for file in files:
            if file.endswith(extensions):
                replace_in_file(os.path.join(root, file))

print("Done")
