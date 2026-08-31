# Smart Sight

A state-of-the-art **Real-Time AI Face Recognition, Detection, and Surveillance Platform**. Smart Sight seamlessly integrates advanced computer vision models with a highly responsive, tri-platform interface built for **Web**, **Android**, and **Desktop (Electron)**.

---

## Core Features

- **Real-Time Detection & Recognition**: Utilizes YOLOv8 for high-speed face detection and DeepFace (ArcFace) for highly accurate biometric recognition via live RTSP/HTTP camera feeds.
- **Intelligent Dataset Management**: Effortlessly organize face folders, bulk upload photos, and enjoy infinite-scroll galleries with lazy loading.
- **Automated Stranger Classification**: Employs DBSCAN clustering to automatically group unknown individuals into distinct categories for easy identification.
- **Hybrid Notification System**: Instant localized audio alerts combined with Firebase Cloud Messaging (FCM) push notifications and Telegram alerts for intrusion events.
- **Comprehensive Analytics & Reports**: A beautifully designed dashboard offering time-filtered analytics, visual data logs, interactive 24-hour timeline scrubber, and one-click `.xlsx` Excel report generation.
- **Tri-Platform Architecture**: Seamless experience across Browser Web, Native Android App (Capacitor), and Native Desktop App (Electron).
- **Ultra-Modern UI/UX**: Features a highly polished glassmorphic & solid-surface design system, incorporating pill-shaped interactive elements, a seamless neon-breathing preloader animation, light/dark themes, and optimized system-native typography.

---

## Technology Stack

**Backend & AI Services:**
- **Framework:** Django 6.0.5 (Python 3.13+)
- **Database:** SQLite
- **Computer Vision:** Ultralytics YOLOv8, DeepFace, OpenCV
- **Data Export:** OpenPyXL

**Frontend (Web, Mobile & Desktop):**
- **Core:** React 18, Vite, Bootstrap 5, Bootstrap Icons
- **Mobile Packaging:** Capacitor 8.5 (@capacitor/core, @capacitor/android)
- **Desktop Packaging:** Electron (@capacitor-community/electron)
- **Styling:** Custom Glassmorphic & Material 3 Pill CSS Design System

---

## Project Architecture

```text
Smart_Sight/
├── app/                          # Django Backend Application (Models, Views, AI Utils)
├── frontend/                     # Primary React 18 + Vite Web Application
├── frontend-android/             # Android Capacitor Web & App Project (APK Build)
├── frontend-desktop/             # Desktop Capacitor & Electron Project (EXE Build)
├── media/                        # Saved Dataset Photos & Stranger Captures
├── smartsight/                   # Django Core Project Settings
└── requirements.txt              # Python Backend Dependencies
```

---

## Installation & Setup

### 1. Prerequisites
- **Python 3.13+**
- **Node.js 18+** & **npm**
- **Android Studio / JDK 17** (for building Android APK)

### 2. Backend Initialization
```bash
# Navigate to the project root
cd Smart_Sight

# Create and activate a virtual environment
python -m venv env
.\env\Scripts\Activate.ps1

# Install dependencies and migrate database
pip install -r requirements.txt
python manage.py migrate

# Start the Django server
python manage.py runserver 0.0.0.0:8000
```

### 3. Web Frontend Setup
```bash
cd frontend
npm install

# Run the development server
npm run dev

# Build for production
npm run build
```

### 4. Android App Build (APK)
```bash
cd frontend-android
npm install

# Build the mobile-optimized web assets & sync
npm run build
npx cap sync android

# Build the Android Debug APK
cd android
.\gradlew assembleDebug
```
*The generated APK will be available at: `frontend-android/android/app/build/outputs/apk/debug/app-debug.apk`*

### 5. Desktop App Build (Windows .EXE / Electron)
```bash
cd frontend-desktop
npm install

# Build web assets and package standalone Windows installer/executable
npm run electron:make
```
*The generated executable and installer packages will be available at: `frontend-desktop/electron/make/`*

---

## License & Security
Developed for Smart Sight surveillance intelligence. All detection activities and biometric logs are securely encrypted and authenticated.

## Developer

- **Harsh_03** ([@HarshS-03](https://github.com/HarshS-03))

---
*© Harsh_03. All rights reserved.*
