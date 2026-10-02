from collections import Counter
from django.utils import timezone
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side, numbers
from openpyxl.utils import get_column_letter


# ── Color Palette ──
BRAND_BLUE      = "0D6EFD"
DARK_HEADER     = "0F172A"
SUBHEADER_BG    = "1E293B"
ROW_EVEN        = "F8FAFC"
ROW_ODD         = "FFFFFF"
KNOWN_GREEN     = "15803D"
UNKNOWN_RED     = "B91C1C"
ACCENT_EMERALD  = "10B981"
BORDER_SUBTLE   = "CBD5E1"
DARK_BG         = "1E293B"
LIGHT_BG        = "F1F5F9"
FOOTER_BG       = "0F172A"

THIN_BORDER = Border(
    left=Side(style='thin', color=BORDER_SUBTLE),
    right=Side(style='thin', color=BORDER_SUBTLE),
    top=Side(style='thin', color=BORDER_SUBTLE),
    bottom=Side(style='thin', color=BORDER_SUBTLE)
)


def _fill_summary_sheet(ws, reports, title_suffix):
    """Create a branded summary dashboard sheet."""
    now = timezone.localtime(timezone.now())
    total = len(reports)
    known = sum(1 for r in reports if r.get('status') == 'KNOWN')
    unknown = total - known
    known_pct = round((known / total) * 100) if total > 0 else 0
    unknown_pct = 100 - known_pct if total > 0 else 0

    ws.sheet_properties.tabColor = BRAND_BLUE

    # ── Title Banner ──
    ws.merge_cells('A1:F1')
    ws['A1'] = f"SMART SIGHT — {title_suffix.upper()}"
    ws['A1'].font = Font(name='Inter', size=18, bold=True, color='FFFFFF')
    ws['A1'].fill = PatternFill(start_color=BRAND_BLUE, end_color=BRAND_BLUE, fill_type='solid')
    ws['A1'].alignment = Alignment(horizontal='center', vertical='center')
    ws.row_dimensions[1].height = 50

    # ── Subtitle ──
    ws.merge_cells('A2:F2')
    ws['A2'] = f"Generated: {now.strftime('%A, %d %B %Y  •  %I:%M %p')}"
    ws['A2'].font = Font(name='Inter', size=10, italic=True, color='64748B')
    ws['A2'].fill = PatternFill(start_color=LIGHT_BG, end_color=LIGHT_BG, fill_type='solid')
    ws['A2'].alignment = Alignment(horizontal='center', vertical='center')
    ws.row_dimensions[2].height = 28

    # Spacer
    ws.row_dimensions[3].height = 10

    # ── Quick Stats Section ──
    ws.merge_cells('A4:F4')
    ws['A4'] = "SUMMARY STATISTICS"
    ws['A4'].font = Font(name='Inter', size=12, bold=True, color='FFFFFF')
    ws['A4'].fill = PatternFill(start_color=DARK_HEADER, end_color=DARK_HEADER, fill_type='solid')
    ws['A4'].alignment = Alignment(horizontal='center', vertical='center')
    ws.row_dimensions[4].height = 32

    stats = [
        ('Total Detections', str(total), BRAND_BLUE),
        ('Known Persons', f"{known}  ({known_pct}%)", KNOWN_GREEN),
        ('Unknown Persons', f"{unknown}  ({unknown_pct}%)", UNKNOWN_RED),
    ]

    for i, (label, value, color) in enumerate(stats):
        row = 5 + i
        ws.cell(row=row, column=1, value='').border = THIN_BORDER
        ws.cell(row=row, column=2, value=label)
        ws.cell(row=row, column=2).font = Font(name='Inter', size=11, bold=True, color='334155')
        ws.cell(row=row, column=2).alignment = Alignment(horizontal='left', vertical='center')
        ws.cell(row=row, column=2).border = THIN_BORDER

        ws.merge_cells(start_row=row, start_column=3, end_row=row, end_column=4)
        ws.cell(row=row, column=3, value=value)
        ws.cell(row=row, column=3).font = Font(name='Inter', size=12, bold=True, color=color)
        ws.cell(row=row, column=3).alignment = Alignment(horizontal='center', vertical='center')
        ws.cell(row=row, column=3).border = THIN_BORDER

        fill_color = ROW_EVEN if i % 2 == 0 else ROW_ODD
        for c in range(1, 7):
            ws.cell(row=row, column=c).fill = PatternFill(start_color=fill_color, end_color=fill_color, fill_type='solid')
            ws.cell(row=row, column=c).border = THIN_BORDER
        ws.row_dimensions[row].height = 28

    # Spacer
    ws.row_dimensions[8].height = 10

    # ── Frequency Analysis (Top Detected Persons) ──
    # Count frequency per person within the already-filtered report set
    person_counts = {}
    for r in reports:
        is_unknown = r.get('status') == 'UNKNOWN'
        name = f"Unknown Person #{r.get('id', 'N/A')}" if is_unknown else (r.get('person_name') or 'Unknown')
        
        if name not in person_counts:
            person_counts[name] = {
                'name': name,
                'status': r.get('status', 'UNKNOWN'),
                'frequency': 0
            }
        person_counts[name]['frequency'] += 1

    sorted_persons = sorted(person_counts.values(), key=lambda x: x['frequency'], reverse=True)[:10]

    if sorted_persons:
        ws.merge_cells('A9:D9')
        ws['A9'] = "FREQUENCY ANALYSIS"
        ws['A9'].font = Font(name='Inter', size=12, bold=True, color='FFFFFF')
        ws['A9'].fill = PatternFill(start_color=DARK_HEADER, end_color=DARK_HEADER, fill_type='solid')
        ws['A9'].alignment = Alignment(horizontal='center', vertical='center')
        ws.row_dimensions[9].height = 32

        tp_headers = ['#', 'Person Name', 'Status', 'Frequency']
        for ci, h in enumerate(tp_headers, 1):
            cell = ws.cell(row=10, column=ci, value=h)
            cell.font = Font(name='Inter', size=10, bold=True, color='FFFFFF')
            cell.fill = PatternFill(start_color=SUBHEADER_BG, end_color=SUBHEADER_BG, fill_type='solid')
            cell.alignment = Alignment(horizontal='center', vertical='center')
            cell.border = THIN_BORDER
        ws.row_dimensions[10].height = 24

        for idx, p_data in enumerate(sorted_persons):
            row = 11 + idx
            st = p_data['status']
            status_text = "Known" if st == "KNOWN" else "Unknown"
            status_color = KNOWN_GREEN if st == "KNOWN" else UNKNOWN_RED

            ws.cell(row=row, column=1, value=idx + 1)
            ws.cell(row=row, column=2, value=p_data['name'])
            ws.cell(row=row, column=3, value=status_text)
            ws.cell(row=row, column=3).font = Font(name='Inter', size=10, bold=True, color=status_color)
            ws.cell(row=row, column=4, value=p_data['frequency'])

            fill = ROW_EVEN if idx % 2 == 0 else ROW_ODD
            for c in range(1, 5):
                cell = ws.cell(row=row, column=c)
                cell.fill = PatternFill(start_color=fill, end_color=fill, fill_type='solid')
                cell.border = THIN_BORDER
                if c != 3:
                    cell.font = Font(name='Inter', size=10)
                cell.alignment = Alignment(horizontal='center', vertical='center')
            ws.row_dimensions[row].height = 22

    # ── Footer ──
    footer_row = max(21, 11 + len(sorted_persons) + 2)
    ws.merge_cells(start_row=footer_row, start_column=1, end_row=footer_row, end_column=4)
    ws.cell(row=footer_row, column=1, value="Powered by Smart Sight AI  •  Smart Access Control System")
    ws.cell(row=footer_row, column=1).font = Font(name='Inter', size=9, italic=True, color='94A3B8')
    ws.cell(row=footer_row, column=1).alignment = Alignment(horizontal='center', vertical='center')
    ws.cell(row=footer_row, column=1).fill = PatternFill(start_color=FOOTER_BG, end_color=FOOTER_BG, fill_type='solid')
    for c in range(1, 5):
        ws.cell(row=footer_row, column=c).fill = PatternFill(start_color=FOOTER_BG, end_color=FOOTER_BG, fill_type='solid')
    ws.row_dimensions[footer_row].height = 30

    # Column widths
    ws.column_dimensions['A'].width = 5
    ws.column_dimensions['B'].width = 30
    ws.column_dimensions['C'].width = 15
    ws.column_dimensions['D'].width = 15


def _fill_excel_worksheet(ws, reports, title_text):
    """Fill a worksheet with styled detection records."""
    ws.sheet_properties.tabColor = "10B981"
    ws.views.sheetView[0].showGridLines = False

    # ── Title Banner ──
    ws.append([title_text])
    ws.merge_cells("A1:H1")
    title_cell = ws["A1"]
    title_cell.font = Font(name="Inter", size=16, bold=True, color="FFFFFF")
    title_cell.fill = PatternFill(start_color=BRAND_BLUE, end_color=BRAND_BLUE, fill_type="solid")
    title_cell.alignment = Alignment(horizontal="center", vertical="center")
    ws.row_dimensions[1].height = 45

    # ── Subtitle ──
    now = timezone.localtime(timezone.now())
    ws.append([f"Generated: {now.strftime('%d %b %Y, %I:%M %p')}  •  {len(reports)} Records"])
    ws.merge_cells("A2:H2")
    ws["A2"].font = Font(name="Inter", size=10, italic=True, color="64748B")
    ws["A2"].fill = PatternFill(start_color=LIGHT_BG, end_color=LIGHT_BG, fill_type="solid")
    ws["A2"].alignment = Alignment(horizontal="center", vertical="center")
    ws.row_dimensions[2].height = 26

    # ── Headers ──
    headers = ["#", "Date", "Camera", "Person Name", "Classification", "Frequency", "Entry Time", "Exit Time"]
    ws.append(headers)
    ws.row_dimensions[3].height = 28

    header_fill = PatternFill(start_color=DARK_HEADER, end_color=DARK_HEADER, fill_type="solid")
    header_font = Font(name="Inter", size=10, bold=True, color="FFFFFF")
    header_alignment = Alignment(horizontal="center", vertical="center")

    for col_num in range(1, 9):
        cell = ws.cell(row=3, column=col_num)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = header_alignment
        cell.border = THIN_BORDER

    # ── Data Rows ──
    row_idx = 4
    for idx, rep in enumerate(reports):
        rep_date = rep['date']
        if isinstance(rep_date, str):
            date_str = rep_date
        else:
            date_str = rep_date.strftime('%d/%m/%Y')

        name = rep['person_name'] if rep['person_name'] else "Unknown Person"
        status_disp = "Known" if rep['status'] == "KNOWN" else "Unknown"
        camera_disp = rep.get('camera_name', 'Default Camera')
        entry_local = timezone.localtime(rep['entry_time'])
        exit_local  = timezone.localtime(rep['exit_time'])
        entry_str = entry_local.strftime('%I:%M:%S %p')
        exit_str  = exit_local.strftime('%I:%M:%S %p')
        max_conf = f"{rep['max_confidence'] * 100:.1f}%" if rep.get('max_confidence') and rep['max_confidence'] <= 1.0 else f"{rep.get('max_confidence', 0):.1f}%"
        freq_val = rep.get('frequency', 1)

        ws.append([idx + 1, date_str, camera_disp, name, status_disp, freq_val, entry_str, exit_str])
        ws.row_dimensions[row_idx].height = 22

        row_fill = PatternFill(start_color=ROW_EVEN if row_idx % 2 == 0 else ROW_ODD, fill_type="solid")
        status_color = KNOWN_GREEN if rep['status'] == "KNOWN" else UNKNOWN_RED
        status_fill = PatternFill(
            start_color="DCFCE7" if rep['status'] == "KNOWN" else "FEE2E2",
            end_color="DCFCE7" if rep['status'] == "KNOWN" else "FEE2E2",
            fill_type="solid"
        )

        for col_num in range(1, 9):
            cell = ws.cell(row=row_idx, column=col_num)
            cell.border = THIN_BORDER

            if col_num == 5:  # Classification column
                cell.fill = status_fill
                cell.font = Font(name="Inter", size=10, bold=True, color=status_color)
            else:
                cell.fill = row_fill
                cell.font = Font(name="Inter", size=10)

            if col_num in [1, 2, 3, 5, 6, 7, 8]:
                cell.alignment = Alignment(horizontal="center", vertical="center")
            else:
                cell.alignment = Alignment(horizontal="left", vertical="center", indent=1)

        row_idx += 1

    # ── Footer Summary Row ──
    if reports:
        known_count = sum(1 for r in reports if r['status'] == 'KNOWN')
        footer_text = f"Total: {len(reports)} records  |  Known: {known_count}  |  Unknown: {len(reports) - known_count}"
        ws.merge_cells(start_row=row_idx, start_column=1, end_row=row_idx, end_column=8)
        ws.cell(row=row_idx, column=1, value=footer_text)
        ws.cell(row=row_idx, column=1).font = Font(name='Inter', size=10, bold=True, color='FFFFFF')
        ws.cell(row=row_idx, column=1).fill = PatternFill(start_color=FOOTER_BG, end_color=FOOTER_BG, fill_type='solid')
        ws.cell(row=row_idx, column=1).alignment = Alignment(horizontal='center', vertical='center')
        for c in range(1, 9):
            ws.cell(row=row_idx, column=c).fill = PatternFill(start_color=FOOTER_BG, end_color=FOOTER_BG, fill_type='solid')
            ws.cell(row=row_idx, column=c).border = THIN_BORDER
        ws.row_dimensions[row_idx].height = 28

    # ── Auto-fit Column Widths ──
    min_widths = {'A': 5, 'B': 14, 'C': 16, 'D': 22, 'E': 16, 'F': 14, 'G': 16, 'H': 16}
    for col in ws.columns:
        col_letter = None
        for cell in col:
            if hasattr(cell, 'column_letter'):
                col_letter = cell.column_letter
                break
        if not col_letter:
            continue

        max_len = 0
        for cell in col:
            if cell.row <= 2:
                continue
            val_str = str(cell.value or '')
            if len(val_str) > max_len:
                max_len = len(val_str)
        ws.column_dimensions[col_letter].width = max(max_len + 4, min_widths.get(col_letter, 12))

    # Freeze panes at row 4
    ws.freeze_panes = 'A4'


def _fill_camera_analytics_sheet(ws, reports):
    """Create a camera breakdown analytics sheet."""
    ws.sheet_properties.tabColor = "F59E0B"
    ws.views.sheetView[0].showGridLines = False

    camera_stats = {}
    for r in reports:
        cam = r.get('camera_name', 'Default Camera')
        if cam not in camera_stats:
            camera_stats[cam] = {'total': 0, 'known': 0, 'unknown': 0}
        camera_stats[cam]['total'] += 1
        if r['status'] == 'KNOWN':
            camera_stats[cam]['known'] += 1
        else:
            camera_stats[cam]['unknown'] += 1

    # Title
    ws.merge_cells('A1:E1')
    ws['A1'] = "SMART SIGHT — CAMERA ANALYTICS"
    ws['A1'].font = Font(name='Inter', size=14, bold=True, color='FFFFFF')
    ws['A1'].fill = PatternFill(start_color="F59E0B", end_color="F59E0B", fill_type='solid')
    ws['A1'].alignment = Alignment(horizontal='center', vertical='center')
    ws.row_dimensions[1].height = 40

    # Spacer
    ws.row_dimensions[2].height = 8

    # Headers
    cam_headers = ['Camera Name', 'Total Detections', 'Known', 'Unknown', 'Known %']
    for ci, h in enumerate(cam_headers, 1):
        cell = ws.cell(row=3, column=ci, value=h)
        cell.font = Font(name='Inter', size=10, bold=True, color='FFFFFF')
        cell.fill = PatternFill(start_color=DARK_HEADER, end_color=DARK_HEADER, fill_type='solid')
        cell.alignment = Alignment(horizontal='center', vertical='center')
        cell.border = THIN_BORDER
    ws.row_dimensions[3].height = 26

    # Data
    sorted_cams = sorted(camera_stats.items(), key=lambda x: x[1]['total'], reverse=True)
    for idx, (cam_name, stats) in enumerate(sorted_cams):
        row = 4 + idx
        known_pct = round((stats['known'] / stats['total']) * 100) if stats['total'] > 0 else 0

        ws.cell(row=row, column=1, value=cam_name)
        ws.cell(row=row, column=2, value=stats['total'])
        ws.cell(row=row, column=3, value=stats['known'])
        ws.cell(row=row, column=4, value=stats['unknown'])
        ws.cell(row=row, column=5, value=f"{known_pct}%")

        fill = ROW_EVEN if idx % 2 == 0 else ROW_ODD
        for c in range(1, 6):
            cell = ws.cell(row=row, column=c)
            cell.fill = PatternFill(start_color=fill, end_color=fill, fill_type='solid')
            cell.border = THIN_BORDER
            cell.font = Font(name='Inter', size=10)
            cell.alignment = Alignment(horizontal='center', vertical='center')
        ws.row_dimensions[row].height = 22

    # Column widths
    ws.column_dimensions['A'].width = 24
    ws.column_dimensions['B'].width = 18
    ws.column_dimensions['C'].width = 12
    ws.column_dimensions['D'].width = 12
    ws.column_dimensions['E'].width = 12


def generate_reports_excel(reports, title_suffix="FULL REPORT"):
    """Master Excel generator function for Smart Sight analytics reports."""
    from openpyxl import Workbook
    import io

    wb = Workbook()

    # Sheet 1: Executive Summary
    ws1 = wb.active
    ws1.title = "Executive Summary"
    _fill_summary_sheet(ws1, reports, title_suffix)

    # Sheet 2: Detection Logs
    ws2 = wb.create_sheet(title="Detection Logs")
    _fill_excel_worksheet(ws2, reports, f"SMART SIGHT — {title_suffix}")

    # Sheet 3: Camera Analytics
    ws3 = wb.create_sheet(title="Camera Analytics")
    _fill_camera_analytics_sheet(ws3, reports)

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    return output


def generate_reports_pdf(logs, title_suffix="SMART ACCESS CONTROL REPORT"):
    """
    Generate an executive PDF access control audit report with actual captured face photos.
    Uses ReportLab to build a formatted table with embedded images.
    For KNOWN persons without a snapshot, falls back to their dataset profile photo.
    """
    import os
    import io
    from django.conf import settings
    from reportlab.lib.pagesizes import letter, landscape
    from reportlab.lib import colors
    from reportlab.lib.units import inch
    from reportlab.platypus import (
        SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image as RLImage, KeepTogether
    )
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.utils import ImageReader

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=landscape(letter),
        leftMargin=30,
        rightMargin=30,
        topMargin=30,
        bottomMargin=30
    )

    styles = getSampleStyleSheet()

    # ── Styles ──
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=20,
        leading=24,
        textColor=colors.HexColor('#0F172A'),
        spaceAfter=2
    )
    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=12,
        textColor=colors.HexColor('#64748B'),
        spaceAfter=14
    )
    cell_style = ParagraphStyle(
        'CellText',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor('#1E293B')
    )
    cell_bold_style = ParagraphStyle(
        'CellBold',
        parent=cell_style,
        fontName='Helvetica-Bold'
    )
    cell_center_style = ParagraphStyle(
        'CellCenter',
        parent=cell_style,
        alignment=1  # CENTER
    )
    cell_center_bold = ParagraphStyle(
        'CellCenterBold',
        parent=cell_bold_style,
        alignment=1
    )
    header_style = ParagraphStyle(
        'HeaderCell',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9,
        leading=11,
        textColor=colors.white,
        alignment=1  # Centered
    )

    story = []
    media_root = getattr(settings, 'MEDIA_ROOT', '')

    # ── Title & Header ──
    now_str = timezone.localtime(timezone.now()).strftime('%d %b %Y, %I:%M %p')
    story.append(Paragraph(f"SMARTSIGHT — {title_suffix.upper()}", title_style))
    story.append(Paragraph(
        f"Generated on {now_str} &bull; Department Smart Access Control Audit",
        subtitle_style
    ))

    # ── Summary Statistics Bar ──
    total_count = logs.count() if hasattr(logs, 'count') else len(logs)
    known_count = sum(1 for l in logs if getattr(l, 'status', '') == 'KNOWN')
    unknown_count = total_count - known_count
    rate_str = f"{(known_count / total_count * 100):.1f}%" if total_count else "N/A"

    stat_label = ParagraphStyle('StatLabel', parent=cell_style, fontSize=7.5, textColor=colors.HexColor('#64748B'), alignment=1)
    stat_value = ParagraphStyle('StatValue', parent=cell_bold_style, fontSize=13, leading=16, alignment=1)

    summary_data = [[
        [Paragraph(f"{total_count}", stat_value), Paragraph("Total Scans", stat_label)],
        [Paragraph(f"<font color='#15803D'>{known_count}</font>", stat_value), Paragraph("Authorized (Known)", stat_label)],
        [Paragraph(f"<font color='#B91C1C'>{unknown_count}</font>", stat_value), Paragraph("Unauthorized", stat_label)],
        [Paragraph(f"<font color='#0D6EFD'>{rate_str}</font>", stat_value), Paragraph("Verification Rate", stat_label)],
    ]]
    summary_table = Table(summary_data, colWidths=[185, 185, 185, 185])
    summary_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#F1F5F9')),
        ('BOX', (0, 0), (-1, -1), 1.2, colors.HexColor('#CBD5E1')),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E2E8F0')),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ('RIGHTPADDING', (0, 0), (-1, -1), 10),
    ]))
    story.append(summary_table)
    story.append(Spacer(1, 16))

    # ── Frequency Analysis Table ──
    # Count frequency per person within the already-filtered log set
    person_counts = {}
    for log in logs:
        is_unknown = getattr(log, 'status', '') == 'UNKNOWN'
        name = f"Unknown Person #{getattr(log, 'id', 'N/A')}" if is_unknown else (getattr(log, 'person_name', None) or 'Unknown')
        
        if name not in person_counts:
            person_counts[name] = {
                'name': name,
                'status': getattr(log, 'status', 'UNKNOWN'),
                'frequency': 0
            }
        person_counts[name]['frequency'] += 1

    sorted_persons = sorted(person_counts.values(), key=lambda x: x['frequency'], reverse=True)[:10]

    if sorted_persons:
        story.append(Paragraph("FREQUENCY ANALYSIS (TOP 10)", subtitle_style))
        freq_data = [[
            Paragraph("No.", header_style),
            Paragraph("Person Name", header_style),
            Paragraph("Status", header_style),
            Paragraph("Frequency", header_style),
        ]]
        
        for idx, p_data in enumerate(sorted_persons, 1):
            st = p_data['status']
            status_color = "'#15803D'" if st == 'KNOWN' else "'#B91C1C'"
            freq_data.append([
                Paragraph(str(idx), cell_center_style),
                Paragraph(p_data['name'], cell_bold_style),
                Paragraph(f"<font color={status_color}>{'Known' if st == 'KNOWN' else 'Unknown'}</font>", cell_center_bold),
                Paragraph(str(p_data['frequency']), cell_center_style),
            ])
            
        freq_table = Table(freq_data, colWidths=[40, 320, 120, 120])
        freq_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0F172A')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#CBD5E1')),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.HexColor('#FFFFFF'), colors.HexColor('#F8FAFC')]),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ]))
        story.append(freq_table)
        story.append(Spacer(1, 16))

    # ── Table Headers ──
    table_data = [[
        Paragraph("No.", header_style),
        Paragraph("Photo", header_style),
        Paragraph("Person Name", header_style),
        Paragraph("Department / Role", header_style),
        Paragraph("Access Status", header_style),
        Paragraph("Freq.", header_style),
        Paragraph("Date & Time", header_style),
    ]]

    # ── Helper: Resolve best available photo ──
    def _resolve_photo(log):
        """
        Returns a RLImage flowable for the best available photo.
        Priority: 1) log.image_path (captured snapshot)
                  2) Person's first dataset image (for KNOWN)
                  3) Dash placeholder
        """
        # Try captured snapshot first
        img_path = getattr(log, 'image_path', None)
        if img_path:
            full_path = os.path.join(media_root, img_path) if not os.path.isabs(img_path) else img_path
            if os.path.exists(full_path):
                return _make_image(full_path)

        # Fallback: For KNOWN persons, use their first dataset photo
        if log.status == 'KNOWN' and log.person_name:
            from app.models import Person, PersonImage
            person_obj = Person.objects.filter(name__iexact=log.person_name).first()
            if person_obj:
                first_img = PersonImage.objects.filter(person=person_obj).first()
                if first_img and first_img.image:
                    dataset_path = os.path.join(media_root, str(first_img.image))
                    if os.path.exists(dataset_path):
                        return _make_image(dataset_path)

        return Paragraph("—", cell_center_style)

    def _make_image(full_path):
        """Create a proportionally scaled RLImage from file path."""
        try:
            reader = ImageReader(full_path)
            iw, ih = reader.getSize()
            aspect = ih / float(iw)
            # Target: 72px wide, max 80px tall for clear visibility
            w = 72
            h = w * aspect
            if h > 80:
                h = 80
                w = h / aspect
            return RLImage(full_path, width=w, height=h)
        except Exception:
            return Paragraph("[Error]", cell_center_style)

    # ── Build table rows ──
    # Pre-fetch all Person objects to avoid N+1 queries
    from app.models import Person, PersonImage
    person_names = set()
    for log in logs:
        if log.status == 'KNOWN' and log.person_name:
            person_names.add(log.person_name.lower())

    person_cache = {}
    if person_names:
        for p in Person.objects.filter(name__iregex=r'^(' + '|'.join(person_names) + r')$'):
            person_cache[p.name.lower()] = p
        # Pre-fetch first dataset images for all persons
        person_ids = [p.id for p in person_cache.values()]
        first_images = {}
        for pi in PersonImage.objects.filter(person_id__in=person_ids).order_by('person_id', 'id'):
            if pi.person_id not in first_images:
                first_images[pi.person_id] = pi
        # Attach to cache
        for key, p in person_cache.items():
            p._cached_first_image = first_images.get(p.id)

    for idx, log in enumerate(logs):
        # 1. Photo
        img_flowable = _resolve_photo(log)

        # 2. Department / Role
        dept_role = "—"
        person_name = getattr(log, 'person_name', None) or "Unknown / Stranger"
        if log.status == 'KNOWN' and log.person_name:
            person_obj = person_cache.get(log.person_name.lower())
            if person_obj:
                dept_parts = []
                if person_obj.department:
                    dept_parts.append(person_obj.department)
                if person_obj.class_name:
                    dept_parts.append(person_obj.class_name)
                dept_role = " / ".join(dept_parts) if dept_parts else person_obj.get_category_display()

        # 3. Status
        if log.status == 'KNOWN' or log.status == 'APPROVED':
            status_html = "<font color='#15803D'><b>✓ ALLOWED</b></font>"
        else:
            status_html = "<font color='#B91C1C'><b>✗ DENIED</b></font>"

        # 4. Frequency
        is_unknown = getattr(log, 'status', '') == 'UNKNOWN'
        name_key = f"Unknown Person #{getattr(log, 'id', 'N/A')}" if is_unknown else (getattr(log, 'person_name', None) or 'Unknown')
        freq_count = person_counts.get(name_key, {}).get('frequency', 1)

        # 5. Timestamp
        time_str = "—"
        if log.timestamp:
            dt = timezone.localtime(log.timestamp)
            time_str = dt.strftime('%d/%m/%Y  %I:%M:%S %p')

        row = [
            Paragraph(str(idx + 1), cell_center_style),
            img_flowable,
            Paragraph(person_name, cell_bold_style if log.status == 'KNOWN' else cell_style),
            Paragraph(dept_role, cell_style),
            Paragraph(status_html, cell_center_style),
            Paragraph(str(freq_count), cell_center_style),
            Paragraph(time_str, cell_center_style)
        ]
        table_data.append(row)

    # ── Table Layout ──
    #                      No.  Photo  Name   Dept   Status  Freq   DateTime
    col_widths =          [28,  82,    150,   140,   100,    50,    170]
    log_table = Table(table_data, colWidths=col_widths, repeatRows=1)

    table_styles = [
        # Header row
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0F172A')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        # Grid
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#CBD5E1')),
        # Padding — extra for photo rows
        ('TOPPADDING', (0, 0), (-1, 0), 8),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
        ('TOPPADDING', (0, 1), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 5),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        # Photo column centered
        ('ALIGN', (1, 1), (1, -1), 'CENTER'),
        # No. column centered
        ('ALIGN', (0, 1), (0, -1), 'CENTER'),
    ]

    # Alternating row colors
    for r_idx in range(1, len(table_data)):
        bg = colors.HexColor('#F8FAFC') if r_idx % 2 == 0 else colors.white
        table_styles.append(('BACKGROUND', (0, r_idx), (-1, r_idx), bg))

    log_table.setStyle(TableStyle(table_styles))
    story.append(log_table)

    # ── Footer ──
    story.append(Spacer(1, 14))
    footer_style = ParagraphStyle('Footer', parent=cell_style, fontSize=7, textColor=colors.HexColor('#94A3B8'), alignment=1)
    story.append(Paragraph(
        f"SmartSight Access Control Report &bull; {total_count} records &bull; Generated {now_str}",
        footer_style
    ))

    doc.build(story)
    buffer.seek(0)
    return buffer

