# SmartSight Cloud Architecture & Migration Plan

This document outlines the step-by-step strategy to migrate the local SmartSight infrastructure to a scalable, cloud-based architecture.

## The Problem
Currently, all relational data, large biometric face vectors (JSON format), and captured images are stored locally (SQLite and Local File System). When both the Desktop Operator App and Android Mobile Scanner hit the server simultaneously, SQLite gets locked (`database is locked` error), and the local disk runs out of space.

## The Solution Architecture
The migration is divided into three distinct storage domains to optimize cost, speed, and concurrency:

1. **Relational Database** ➔ **Supabase (PostgreSQL)**
2. **Biometric Face Vectors (`.npz`)** ➔ **Supabase Storage**
3. **Media Files (Images/Captures)** ➔ **Google Drive (15 GB Free)**

---

## Phase 1: Shrink DB & Local `.npz` Optimization
Before moving to the cloud, we must shrink the bloated SQLite database.

1. **Remove `PersonEmbedding` (JSONField) Model**: We will delete the database table that stores embeddings as heavy JSON arrays.
2. **Implement `gallery_embeddings.npz`**: The face embeddings for all registered persons will be saved in a single, highly compressed NumPy binary file (`.npz`).
3. **In-Memory Matching**: On server start, this `.npz` file will load directly into RAM. Face recognition queries will run entirely in memory (microseconds) without ever touching a database.
4. **Result**: The local SQLite database shrinks from ~30MB down to < 1MB, making it extremely easy and fast to export/import to the cloud.

---

## Phase 2: Migrate Relational Data to Supabase (PostgreSQL)
Once the database only contains lightweight logs and text:

1. **Data Dump**: Export a clean JSON dump of the tiny SQLite database (`python manage.py dumpdata`).
2. **Connect Supabase**: Update Django's `DATABASES` setting in `settings.py` to point to a free Supabase PostgreSQL URI.
3. **Schema & Import**: Run `python manage.py migrate` on Supabase to build the SQL tables, then `python manage.py loaddata` to import the records.
4. **Result**: Complete elimination of `database is locked` errors due to Postgres's Row-Level Locking, allowing 100+ concurrent app connections.

---

## Phase 3: Cloud Sync the `.npz` File (Supabase Storage)
Because the `.npz` file contains the critical biometric gallery, it cannot only live on the ephemeral local server disk.

1. **Supabase Bucket**: Create a `models` bucket in Supabase Storage.
2. **Startup Routine**: When the Django server starts, it will download the latest `gallery_embeddings.npz` from the Supabase bucket to ensure it has the latest faces.
3. **Background Sync**: Whenever the Admin adds a new person or updates a profile, the server will update the local RAM matrix and asynchronously push the updated `.npz` file back to the Supabase Bucket.
4. **Result**: Safe, backed-up biometric data that doesn't slow down the instant scan matching.

---

## Phase 4: Migrate Images to Google Drive
The captured faces and dataset images consume hundreds of megabytes (and will grow into GBs), causing "Not enough space on the disk" errors locally.

1. **Google Cloud Service Account**: Generate a JSON key with Google Drive API access.
2. **Media Upload Hook**: Instead of saving images locally, the `biometric_verify_frame` endpoint and Django Admin will use the `googleapiclient` to stream the image files directly to a designated Google Drive folder.
3. **Direct Links**: The database will only store the Google Drive file URL (`image_url`), rather than the actual file path.
4. **Result**: Unlimited scalability for image datasets utilizing Google's free 15 GB tier, zero local disk bloat.

---

## Migration Checklist
- [x] Create comprehensive `.tar` Backup of the current stable state.
- [ ] Implement Phase 1: Refactor `app/models.py` and `embedding_engine.py` to use `.npz`.
- [ ] Implement Phase 2: Supabase connection and PostgreSQL data migration.
- [ ] Implement Phase 3: Supabase Storage integration for `.npz` syncing.
- [ ] Implement Phase 4: Google Drive integration for media storage.
