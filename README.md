# Smart Sight

A state-of-the-art **Real-Time AI Face Recognition, Access Control.** Smart Sight seamlessly integrates deep-learning computer vision models with high-performance client applications built for **Web**, **Android**, and **Desktop (Electron)**.

---

## Core Features

- **Real-Time Detection & Recognition**: Employs InsightFace (SCRFD & ArcFace) with 5-point facial landmark alignment for robust, highly accurate biometric identification and tracking.
- **Ultra-Fast Anti-Spoofing (Liveness Defense)**: Integrated MiniFASNet V2 ONNX runtime for real-time fake face, printed photo, and screen attack detection (~5ms).
- **Intelligent Dataset Management**: Effortlessly organize person profiles, bulk upload photos, manage face embeddings, and browse infinite-scroll galleries.
- **Automated Stranger Classification**: ArcFace + DBSCAN auto-clustering to automatically cluster unknown individuals into distinct face groups for quick bulk registration or review.
- **Comprehensive Analytics & Filtering**: Real-time logs and time-filtered analytics with dedicated classification views for **All**, **Known**, **Unknown / Strangers**, and **Spoof Attempts**.
- **Professional PDF & Excel Reports**: One-click generation of beautifully structured portrait A4 PDF reports (powered by ReportLab) and comprehensive multi-sheet Excel reports (powered by OpenPyXL) with customizable timeframes and role breakdowns.
- **Hybrid Alert & Notification System**: Instant localized audio alerts, Server-Sent Events (SSE) real-time streaming, and Firebase Cloud Messaging (FCM) push notifications with background badge counters.
- **Multi-Platform Native Experience**: Shared modern React 18 frontend customized for Browser Web, Native Android App (Capacitor 8.5), and Native Desktop App (Electron 5).
- **Ultra-Modern UI/UX**: Polished glassmorphic & dark/light responsive interface, pill-shaped controls, smooth Framer Motion micro-animations, and system-native typography.

---

## Technology Stack

**Backend & AI Services:**

- **Framework:** Django 5.x / 6.x (Python 3.13+) & Django REST Framework
- **Computer Vision & Deep Learning:** InsightFace (SCRFD & ArcFace), MiniFASNet V2, ONNX Runtime, OpenCV
- **Clustering & Embeddings:** Scikit-Learn (DBSCAN), NumPy
- **Document & Report Generation:** ReportLab (Portrait A4 PDF), OpenPyXL (Excel `.xlsx`)
- **Push Notifications:** Firebase Admin SDK (FCM)
- **Database:** Supabase PostgreSQL (Managed Cloud DB via `dj-database-url` & `psycopg2-binary`)

**Frontend (Web, Desktop & Android):**

- **Core:** React 18, Vite 6, React Router DOM v6
- **UI & Icons:** Bootstrap 5.3, Bootstrap Icons, Lucide React, Framer Motion
- **Desktop Runtime:** Electron (@capacitor-community/electron)
- **Mobile Runtime:** Capacitor 8.5 (@capacitor/core, @capacitor/android, push & local notifications)

---

## Project Architecture

```text
smartsight/
├── app/                          # Django Backend Application (Models, Views, AI Engine, Reports)
├── desktop/                      # React 18 + Vite + Electron Desktop Application
├── frontend-android/             # React 18 + Vite + Capacitor Android Mobile Project
├── media/                        # Saved Dataset Photos, Stranger Captures, & Generated Reports
├── smartsight/                   # Django Core Project Settings & Routing
├── tools/                        # Utility & maintenance scripts
├── requirements.txt              # Python Backend Dependencies
└── manage.py                     # Django Management CLI
```

---

## Installation & Setup

### 1. Prerequisites

- **Python 3.10+ / 3.13+** with `pip`
- **Node.js 18+** & **npm**
- **Supabase Account / PostgreSQL Database**:
  - `DATABASE_URL` (Connection pooling or direct URI)
  - `SUPABASE_URL` & `SUPABASE_KEY`
- **Firebase Project Credentials** (for mobile FCM push notifications):
  - `firebase-credentials.json` placed in root directory
- **Android Studio & JDK 17+** *(Required only for compiling Android APK)*
- **C++ Build Tools / Visual Studio Build Tools** *(Optional/Recommended for compiling ONNX / InsightFace wheels on Windows if needed)*

---

### 2. Backend Initialization

```bash
# Navigate to the project root
cd smartsight

# Create and activate a virtual environment
python -m venv env
.\env\Scripts\Activate.ps1    # On Windows
# source env/bin/activate     # On Linux / macOS

# Install Python dependencies
pip install -r requirements.txt

# Run migrations & populate database
python manage.py migrate

# Start the Django API server
python manage.py runserver 0.0.0.0:8000
```

---

### 3. Desktop Application (Web / Electron)

#### Web Development Mode:

```bash
cd desktop
npm install
npm run dev
```

#### Standalone Windows Desktop App (.EXE / Electron):

```bash
cd desktop

# Run the Electron app in development mode
npm run electron:start

# Package standalone Windows installer / executable
npm run electron:make
```

*The packaged executable will be generated inside `desktop/electron/make/`.*

---

### 4. Android Mobile Application (Capacitor)

#### Mobile Web Preview:

```bash
cd frontend-android
npm install
npm run dev
```

#### Build Android APK:

```bash
cd frontend-android

# Build mobile assets & sync native Android project
npm run build
npx cap sync android

# Build the Android Debug APK via Gradle
cd android
.\gradlew assembleDebug
```

*The output APK will be generated at:*
`frontend-android/android/app/build/outputs/apk/debug/app-debug.apk`

---

## Reporting & Exports

Smart Sight provides built-in enterprise reporting:

- **PDF Export**: Portrait A4 layout created with ReportLab, featuring summary statistics, severity-colored spoof indicators, and timestamped detection tables.
- **Excel Export**: Multi-column Excel spreadsheets generated with OpenPyXL, including timeframes, classification tags, confidence scores, and camera metadata.

---

## License & Security

Developed for Smart Sight biometric intelligence. Biometric embeddings and detection logs are authenticated and stored locally.

## Developer

- **Harsh_03** ([@HarshS-03](https://github.com/HarshS-03))

---

*© Harsh_03. All rights reserved.*
