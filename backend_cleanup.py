import re

reports_file = r"s:\smartsight\app\utils\reports.py"
with open(reports_file, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('"BIOMETRIC ACCESS REPORT"', '"SMART ACCESS CONTROL REPORT"')
content = content.replace('PDF biometric audit report', 'PDF access control audit report')
content = content.replace('Biometric Verification & Access Audit', 'Smart Access Control Audit')
content = content.replace('Biometric Access Report', 'Access Control Report')
content = content.replace('Automated Surveillance Intelligence', 'Smart Access Control System')

with open(reports_file, 'w', encoding='utf-8') as f:
    f.write(content)


views_file = r"s:\smartsight\app\views.py"
with open(views_file, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('Biometric Access Verification Endpoint:', 'Access Control Verification Endpoint:')
content = content.replace('Mobile Biometric Scanner', 'Mobile Access Scanner')
content = content.replace('mobile biometric scanner', 'mobile access scanner')
content = content.replace('[Biometric Verify]', '[Access Control Verify]')

with open(views_file, 'w', encoding='utf-8') as f:
    f.write(content)

print("Updated backend Python files")
