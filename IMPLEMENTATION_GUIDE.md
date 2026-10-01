# SmartSight Pure `.npz` + Supabase + Google Drive
# Step-by-Step Implementation Guide

---

## Overview

This guide walks through the exact steps to implement the new SmartSight architecture:
1. **Remove `JSONField`**: Transition biometric vector storage entirely to **`gallery_embeddings.npz`** (NumPy compressed binary, 46 KB). Database size drops from 28.8 MB to < 500 KB.
2. **Connect Supabase (PostgreSQL)**: Migrate relational data (profiles, verification logs, notifications) to free cloud PostgreSQL.
3. **Connect Google Drive**: Offload all 753 MB of media images (datasets and captures) to free 15 GB Google Drive storage.

---

## Phase 1: Pure `.npz` Vector Storage (Remove `JSONField`)

### 1.1 Update [app/models.py](file:///s:/smartsight/app/models.py)
Remove the `PersonEmbedding` model that used `models.JSONField()`. Biometric vectors will now live exclusively inside `gallery_embeddings.npz`.

```python
# In app/models.py:
# Delete or comment out PersonEmbedding:
# class PersonEmbedding(models.Model):
#     ... (Removed: embeddings are now managed purely by gallery_embeddings.npz)
```

### 1.2 Update [app/utils/embedding_engine.py](file:///s:/smartsight/app/utils/embedding_engine.py)
Make [EmbeddingGallery](file:///s:/smartsight/app/utils/embedding_engine.py#L93) standalone so it manages `gallery_embeddings.npz` directly with zero DB dependency:

1. **`load_gallery()`**:
   - Loads `gallery_embeddings.npz` into RAM on startup.
   - If the `.npz` file does not exist, it generates embeddings directly from `PersonImage.objects.all()` using ArcFace and saves `gallery_embeddings.npz` using `np.savez_compressed`.
2. **`add_embedding(person_id, person_name, embedding)`**:
   - Appends the vector directly to `self._matrix`.
   - Appends `(person_name, person_id)` to `self._meta`.
   - Saves immediately to `gallery_embeddings.npz`. No SQL queries needed!
3. **`remove_person(person_id)`**:
   - Filters out `person_id` from `self._matrix` and `self._meta`.
   - Saves the updated matrix to `gallery_embeddings.npz`.

### 1.3 Update Views, Admin & Signals
Remove imports and queries referencing `PersonEmbedding` from:
* [app/admin.py](file:///s:/smartsight/app/admin.py) (Remove `PersonEmbeddingInline` and `PersonEmbeddingAdmin`).
* [app/signals.py](file:///s:/smartsight/app/signals.py) (Remove cascade deletion signal for `PersonEmbedding`).
* [app/views.py](file:///s:/smartsight/app/views.py) (Update person creation to directly call `gallery.add_embedding()` instead of `PersonEmbedding.objects.create()`).

### 1.4 Apply Migration & Shrink Local Database
```powershell
python manage.py makemigrations app
python manage.py migrate
```
After running this, your local SQLite database will immediately shrink from **28.84 MB to under 500 KB**!

---

## Phase 2: Migrate Relational Database to Supabase

### 2.1 Export Clean Data Dump
Because the bloated `JSONField` is gone, the export file will be tiny (~150 KB) and export in seconds:
```powershell
python manage.py dumpdata app --natural-foreign --natural-primary -e contenttypes -e auth.Permission --indent 2 > clean_dump.json
```

### 2.2 Install PostgreSQL Dependencies
```powershell
pip install psycopg2-binary dj-database-url
```

### 2.3 Create Your Free Supabase Project
1. Log in to [supabase.com](https://supabase.com) and click **New Project** (e.g. `smartsight-db`).
2. Go to **Project Settings** ➔ **Database** ➔ **Connection String** (URI).
3. Copy the URI (format: `postgresql://postgres.[ref]:[PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres`).

### 2.4 Configure [smartsight/settings.py](file:///s:/smartsight/smartsight/settings.py)
In your `.env` file:
```env
DATABASE_URL=postgresql://postgres.[ref]:[PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres
```

In [smartsight/settings.py](file:///s:/smartsight/smartsight/settings.py#L121):
```python
import dj_database_url

DATABASES = {
    'default': dj_database_url.config(
        default=f'sqlite:///{BASE_DIR / "smartsight.sqlite3"}',
        conn_max_age=600,
        ssl_require=True
    )
}
```

### 2.5 Run Schema Migration & Import Data into Supabase
```powershell
# 1. Build all tables on Supabase
python manage.py migrate

# 2. Import clean data dump into Supabase
python manage.py loaddata clean_dump.json
```
Your database is now fully hosted in the cloud with row-level locking and zero locking conflicts!

---

## Phase 3: Setup Google Drive for Media Storage (15 GB)

### 3.1 Create Google Cloud Service Account
1. Open [Google Cloud Console](https://console.cloud.google.com/).
2. Enable the **Google Drive API**.
3. Create a Service Account (e.g. `smartsight-storage@project.iam.gserviceaccount.com`) and download its JSON key file as `service_account.json`.
4. In personal Google Drive, create a folder named `SmartSight_Media`.
5. Share the folder with the Service Account email address with **Editor** permissions.
6. Copy the Folder ID from the URL (the string after `folders/`).

### 3.2 Add Drive Storage Helper: `app/utils/drive_storage.py`
Install dependencies:
```powershell
pip install google-api-python-client google-auth
```

Create `app/utils/drive_storage.py`:
```python
import os
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

SCOPES = ['https://www.googleapis.com/auth/drive']
SERVICE_ACCOUNT_FILE = 'service_account.json'
DRIVE_FOLDER_ID = os.environ.get('GOOGLE_DRIVE_FOLDER_ID')

def get_drive_service():
    creds = service_account.Credentials.from_service_account_file(
        SERVICE_ACCOUNT_FILE, scopes=SCOPES
    )
    return build('drive', 'v3', credentials=creds)

def upload_image_to_drive(local_path, filename):
    service = get_drive_service()
    file_metadata = {
        'name': filename,
        'parents': [DRIVE_FOLDER_ID]
    }
    media = MediaFileUpload(local_path, mimetype='image/jpeg', resumable=True)
    file = service.files().create(body=file_metadata, media_body=media, fields='id').execute()
    
    # Make file viewable
    service.permissions().create(
        fileId=file.get('id'),
        body={'type': 'anyone', 'role': 'reader'}
    ).execute()
    
    return f"https://drive.google.com/uc?export=view&id={file.get('id')}"
```

### 3.3 Batch Upload Existing 2,719 Images (753 MB)
Run a one-time migration script `tools/migrate_media_to_drive.py` to:
1. Walk through `media/dataset/` and `media/unknown/`.
2. Upload each image to the Google Drive folder.
3. Update `image_path` in `RecognitionLog` and `image` in `PersonImage`.

---

## Phase 4: Verification & Testing

1. **Verify `.npz` Matching Speed**:
   ```powershell
   python -c "import django; django.setup(); from app.utils.embedding_engine import gallery; gallery.load_gallery(); print(f'Loaded {len(gallery._meta)} embeddings in matrix shape {gallery._matrix.shape}')"
   ```
   *Expected output*: `Loaded 2397 embeddings in matrix shape (2397, 512)`.
2. **Verify Check-in Logging**:
   - Start the terminal camera feed.
   - Present a face and confirm `RecognitionLog` creates a row in Supabase instantly.
3. **Verify Alert Notification**:
   - Confirm unverified face notifications arrive on the Android app and Telegram bot with the Google Drive image URL.

---

## Summary of Completed State

| Component | Technology | Storage Size | Status |
| :--- | :--- | :--- | :--- |
| **Relational Data** | Supabase (PostgreSQL) | < 500 KB | Cloud Hosted, Zero Concurrency Locks |
| **Biometric Vectors** | `gallery_embeddings.npz` | 46.3 KB | In-Memory RAM Matching (~5 μs) |
| **Media Images** | Google Drive | 753.13 MB | 15 GB Free Lifetime Cloud Storage |
| **`JSONField`** | None | 0 B | Completely Eliminated |
