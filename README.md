# Smart Sight

A modern, high-performance **Real-Time AI Face Recognition, Detection, and Surveillance Platform** powered by **Django 6 REST API**, **React 18 + Vite**, **Ultralytics YOLOv8 / DeepFace / ArcFace**, and **Capacitor Android Mobile App**.

---

## Key Features

- **Real-time Face Detection**: High-accuracy face detection on live RTSP/HTTP camera feeds using YOLOv8 & OpenCV.
- **Biometric Face Recognition**: Instant face identification using DeepFace (ArcFace 512-d embeddings & Cosine Distance).
- **Dataset Management**: Organize face folders, bulk upload photos, auto-classify strangers, and lazy-load/infinite-scroll photo galleries.
- **Hybrid Alerts & Notifications**: Instant real-time local audio alerts + Firebase Cloud Messaging (FCM) push notifications for unknown intrusions.
- **Dynamic Reports & Analytics**: Glassmorphic reports dashboard, floating rounded glass table logs, analytics overview, custom timeframe filtering, and Excel report export (.xlsx).
- **Cross-Platform Dual Frontend**: Dedicated web app (`frontend`) + native Android app build (`frontend-android`) using Capacitor.
- **Ultra-Modern Glassmorphic UI System**: Inter + Google Sans Code typography, translucent frosted glass cards, refractive border highlights, and soft ambient glows.
- **AI Face Auto-Classification**: Automated DBSCAN clustering to auto-group stranger captures into individual person categories.

---

## Tech Stack

### Backend & AI Engine

- **Framework**: Django 6.0.5 (Python 3.13+)
- **Database**: SQLite (`smartsight.sqlite3`)
- **AI Models**: Ultralytics YOLOv8 (PyTorch & ONNX Runtime), DeepFace / ArcFace
- **Computer Vision**: OpenCV (`opencv-python`)
- **Report Generation**: OpenPyXL

### Frontend & Mobile App

- **Web Core**: React 18 + Vite + Bootstrap 5 + Bootstrap Icons
- **Mobile Framework**: @capacitor/core & @capacitor/android 8.5
- **Push Notifications**: @capacitor/push-notifications & Firebase Cloud Messaging
- **Typography & Styling**: Inter & Google Sans Code with Modern Telemetry Glassmorphism System (`theme.css`)

---

## Project Structure

```
Smart_Sight/
├── app/                          # Django Backend Application
│   ├── models.py                 # Person, PersonImage, RecognitionLog models
│   ├── views.py                  # REST API Endpoints & Detection Logic
│   ├── urls.py                   # Backend API Routing
│   └── utils/                    # Utility scripts (alerts, face_classifier, reports, video_processor)
├── frontend/                     # Primary React 18 + Vite Web Application
│   ├── src/
│   │   ├── api/                  # Axios API configuration
│   │   ├── components/           # Navbar, Footer, Modals, ErrorBoundary
│   │   ├── pages/                # HomePage, DetectionPage, CamerasPage, DatasetPage, ReportsPage, NotificationsPage
│   │   └── styles/               # Glassmorphic Theme System (theme.css)
│   ├── package.json              # Web Dependencies & Scripts
│   └── vite.config.js            # Vite Web Development & Production Config
├── frontend-android/             # Android Capacitor Web & App Project
│   ├── src/                      # Mobile-tuned React source code
│   ├── android/                  # Native Capacitor Android Studio Project
│   │   └── app/build/outputs/apk/# Output path for compiled app-debug.apk
│   ├── package.json              # Android App Dependencies & Capacitor Scripts
│   └── vite.config.js            # Vite Android Build Config
├── media/                        # Saved Dataset Photos & Stranger Captures
├── smartsight/                   # Django Core Project Settings
│   ├── settings.py               # Django Configuration
│   └── urls.py                   # Main Router
├── smartsight.sqlite3            # Primary SQLite Database
├── manage.py                     # Django Management Tool
└── requirements.txt              # Python Backend Dependencies
```

---

## Setup & Installation

### 1. Prerequisites

- **Python 3.13+**
- **Node.js 18+** & **npm**
- **Android Studio / Android SDK** (for Android APK compilation)

---

### 2. Backend Setup (Django)

1. Navigate to the project root:

   ```bash
   cd "s:\Smart_Sight"
   ```
2. Create and activate a Python virtual environment:

   ```bash
   python -m venv env
   .\env\Scripts\Activate.ps1   # Windows PowerShell
   # source env/bin/activate    # Linux / macOS
   ```
3. Install backend dependencies:

   ```bash
   pip install -r requirements.txt
   ```
4. Run database migrations:

   ```bash
   python manage.py migrate
   ```
5. Start the Django Backend Server:

   ```bash
   python manage.py runserver 0.0.0.0:8000
   ```

   *Backend running at:* `http://localhost:8000/`

---

### 3. Web Frontend Setup (React + Vite)

1. Open a new terminal and navigate to `frontend`:

   ```bash
   cd "s:\Smart_Sight\frontend"
   ```
2. Install dependencies:

   ```bash
   npm install
   ```
3. Start Vite Dev Server:

   ```bash
   npm run dev
   ```

   *Frontend running at:* `http://localhost:5173/`
4. Build Web Production Bundle:

   ```bash
   npm run build
   ```

---

### 4. Android App Build (Capacitor)

1. Navigate to the `frontend-android` directory:

   ```bash
   cd "s:\Smart_Sight\frontend-android"
   ```
2. Build web assets and sync with Capacitor Android:

   ```bash
   npm run build
   npx cap sync android
   ```
3. Compile Debug APK:

   ```bash
   cd android
   .\gradlew assembleDebug
   ```

   *Generated APK location:*
   `frontend-android/android/app/build/outputs/apk/debug/app-debug.apk`

---

## Developer

- **Harsh Shrimali**

---

**Last Updated**: August 2026
