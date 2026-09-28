# 🎯 SmartSight — Architecture & Responsibilities Matrix

> **Date Updated:** 27 Sept 2026  
> **Architecture Principle:** Mobile is Edge Scanner/Reporter | Desktop is Central Admin & Dataset Controller  
> **Status:** FINAL APPROVED BLUEPRINT

---

## 📌 Strict Separation of Concerns

| Platform | Role & Allowed Features | Prohibited Features |
| :--- | :--- | :--- |
| 🟢 **Android Mobile App** | 1. **Scan & Detect** (Mobile Camera Single-Shot Biometric Gate)<br>2. **Reports** (Audit logs, Stats, PDF with Photos, Excel)<br>3. **About Us** | ❌ No Dataset Management (No adding/editing faces)<br>❌ No Admin/User Configuration<br>❌ No Camera Management / RTSP stream controls<br>❌ No 24x7 background streaming loop |
| 🟡 **Desktop App (Electron)** | 1. **Full Dataset Management** (Add/Edit/Delete identities, photo uploads, embedding rebuild)<br>2. **Stranger Clustering** (DBSCAN review & identity assignment)<br>3. **Real-time Live Entry Feed** (Shows photo, name, dept detected by mobile)<br>4. **Reports & Exports** (PDF with Photos & Excel)<br>5. **Admin & System Settings** | ❌ No Live Camera Feed (Video streaming desktop me nahi hogi) |
| 🔴 **Web App (`frontend/`)** | ❌ **Completely Discarded** | Entire module inactive |

---

## 1. 🟢 Android Mobile Application (Lean Verification Terminal)

Mobile app ab ek clean, fast aur lightweight terminal banegi jisme **sirf 3 sections** honge:

### 1️⃣ Scan & Detect (Biometric Access Gate)
- **Camera**: Phone ka front ya rear camera use hoga.
- **Mode**: "Scan & Verify" button dabane par instant frame capture hoga (No continuous loop battery drain).
- **Verification Engine**:
  - Django Backend (YOLOv8 + ArcFace) se instant check.
  - Snapshot photo captured image storage me auto-save hogi.
- **Immediate Visual Status Feedback**:
  - 🟢 **ACCESS GRANTED**: Person Name, Department, Designation, Match Confidence, Entry Timestamp.
  - 🔴 **ACCESS DENIED**: Unregistered Person / Stranger warning banner.

### 2️⃣ Reports & Analytics
- Live list of access events (Timestamp, Name, Department, Status, Face Thumbnail).
- Filter by Today / Yesterday / Custom Range / Department.
- 📸 **Download PDF Report (with Face Images)** directly to phone storage.
- 📊 Download Excel (.xlsx) Report.

### 3️⃣ About Us
- App version, developer credits, system info.

---

## 2. 🟡 Desktop Application (Dataset Management & Central Monitoring Console)

Admin saara data management aur setup **sirf desktop se** karega:

### 1️⃣ Full Dataset & Identity Management (Desktop Only)
- Department rosters manage karna (Student / Faculty / Staff / Security).
- Nayi person profiles create karna, photos bulk upload karna.
- Photos delete ya update karna.
- ArcFace embedding database rebuild/recalculate karna.
- Unknown / Stranger captures review karke identity assign karna (DBSCAN Clustering).

### 2️⃣ Real-Time Department Access Monitor
- **No live video feed.**
- Jaise hi guard ya mobile device se koi person scan hoga:
  - Desktop dashboard pe real-time entry card pop hoga: **Actual Captured Photo + Name + Department + Allowed/Denied + Time**.
  - Sound alert on Unknown / Denied person attempt.

### 3️⃣ Comprehensive Reports & Audit Exports
- Full attendance & access audit logs.
- PDF generation with high-resolution face photos.
- Excel reports.

### 4️⃣ Admin & System Controls
- User account controls, passwords, server configs.

---

## 3. 🔴 Web Application (`frontend/`)

- Completely removed from workflow.

---

## 🔄 Data & Action Flow

```text
               ┌────────────────────────────────────────────────────────┐
               │              🟡 DESKTOP APP (ADMIN CONSOLE)            │
               │  - Creates/Edits Persons & Departments                 │
               │  - Uploads Face Photos & Generates Embeddings          │
               │  - Clusters & Assigns Strangers                        │
               │  - Views Real-Time Scans & Generates Reports           │
               └──────────────────────────┬─────────────────────────────┘
                                          │
                                          │ (Configures Datasets & Rules)
                                          ▼
                      ┌───────────────────────────────────────┐
                      │          DJANGO SERVER & AI           │
                      │  - Face Embeddings (ArcFace)          │
                      │  - Recognition Logs + Captured Photos │
                      │  - PDF Report Generator with Images   │
                      └───────────────────▲───────────────────┘
                                          │
                                          │ (Sends Single Camera Frame)
                                          │ (Receives Allowed/Denied Status)
                                          │
               ┌──────────────────────────┴─────────────────────────────┐
               │              🟢 ANDROID APP (EDGE TERMINAL)            │
               │  1. Scan & Detect (Instant Camera Gate)                │
               │  2. Reports (Log Viewer + PDF with Photos Download)    │
               │  3. About Us                                           │
               └────────────────────────────────────────────────────────┘
```

---

## 📋 Action Items for Codebase Realignment

1. **Backend (`app/`)**:
   - Create high-quality **PDF Report Generator** with embedded captured face images using ReportLab / Canvas.
   - Endpoint for direct single-frame biometric scan and decision returning Name, Department, Status, and Image URL.
2. **Android App (`frontend-android`)**:
   - Clean up navigation: Remove Dataset, Cameras, and Admin Panel from Mobile.
   - Retain only **Scan & Detect**, **Reports** (with PDF/Excel download), and **About Us**.
   - Make DetectionPage a single-action "Tap to Scan" biometric gate.
3. **Desktop App (`desktop`)**:
   - Keep DatasetPage, AdminPanelPage, ReportsPage, and AboutPage intact.
   - In DetectionPage / Monitoring Dashboard: Remove RTSP/webcam video streaming player; replace with real-time detection event feed showing photo cards of people scanned on mobile.
