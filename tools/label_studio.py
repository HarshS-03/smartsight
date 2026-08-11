import os
import json
import sys
import shutil
import tkinter as tk
from tkinter import filedialog

try:
    from flask import Flask, jsonify, request, send_from_directory, send_file
    FLASK_AVAILABLE = True
except ImportError:
    FLASK_AVAILABLE = False

try:
    import cv2
    OPENCV_AVAILABLE = True
except ImportError:
    OPENCV_AVAILABLE = False

# Fallback print warning if flask is missing
if not FLASK_AVAILABLE:
    print("\n" + "="*70)
    print("[ERROR] Flask is not installed.")
    print("Please install Flask to run the interactive labeling studio:")
    print("  pip install flask opencv-python")
    print("="*70 + "\n")
    sys.exit(1)

app = Flask(__name__)

# Config file to store selected folder path
CONFIG_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "labeler_config.json")

def load_or_pick_folder():
    """Load saved folder path or let user pick one"""
    # Try to load saved config
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, "r") as f:
                config = json.load(f)
                saved_dir = config.get("dataset_root")
                if saved_dir and os.path.isdir(saved_dir):
                    print(f"✓ Loaded dataset folder from config: {saved_dir}")
                    return saved_dir
        except Exception as e:
            print(f"Could not load config: {e}")
    
    # Show folder picker dialog
    print("\n" + "="*70)
    print("📂 Please select your dataset folder...")
    print("="*70 + "\n")
    
    root = tk.Tk()
    root.withdraw()  # Hide the main window
    root.attributes('-topmost', True)  # Bring dialog to front
    
    folder = filedialog.askdirectory(
        title="Select Dataset Folder for YOLO Labeler",
        mustexist=True
    )
    
    root.destroy()
    
    if not folder:
        print("\n" + "="*70)
        print("[ERROR] No folder selected. Exiting...")
        print("="*70 + "\n")
        sys.exit(1)
    
    # Save the selected folder to config
    try:
        with open(CONFIG_FILE, "w") as f:
            json.dump({"dataset_root": folder}, f, indent=2)
        print(f"✓ Saved dataset folder to config: {folder}\n")
    except Exception as e:
        print(f"Warning: Could not save config: {e}\n")
    
    return folder

# Locate the dataset root (user-selected or from config)
ROOT_DIR = load_or_pick_folder()
EXCLUDE_DIRS = ["yolo_dataset_detect", "yolo_dataset_classify", "__pycache__", ".git", "Dataset_Labeled"]

def get_person_dirs():
    dirs = []
    for d in sorted(os.listdir(ROOT_DIR)):
        full_path = os.path.join(ROOT_DIR, d)
        if os.path.isdir(full_path) and d not in EXCLUDE_DIRS:
            dirs.append(d)
    return dirs

def detect_face_bbox(image_path):
    """
    Attempts to detect a face using OpenCV Haar Cascades.
    Returns normalized coordinates: (x_center, y_center, width, height)
    If no face is detected, returns None.
    """
    if not OPENCV_AVAILABLE:
        return None
        
    try:
        img = cv2.imread(image_path)
        if img is None:
            return None
            
        height, width, _ = img.shape
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        
        # Load standard face cascade
        cascade_path = cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
        face_cascade = cv2.CascadeClassifier(cascade_path)
        
        # Detect faces
        faces = face_cascade.detectMultiScale(
            gray, 
            scaleFactor=1.1, 
            minNeighbors=5, 
            minSize=(30, 30)
        )
        
        if len(faces) > 0:
            # Take the largest detected face
            faces = sorted(faces, key=lambda f: f[2] * f[3], reverse=True)
            x, y, w, h = faces[0]
            
            # Convert to YOLO format (normalized center x, center y, width, height)
            x_center = (x + w / 2) / width
            y_center = (y + h / 2) / height
            norm_w = w / width
            norm_h = h / height
            
            # Constrain to range [0, 1]
            return [
                max(0.0, min(1.0, x_center)),
                max(0.0, min(1.0, y_center)),
                max(0.0, min(1.0, norm_w)),
                max(0.0, min(1.0, norm_h))
            ]
    except Exception as e:
        pass
        
    return None

# ================= SERVER ROUTES =================

@app.route("/")
def index():
    return HTML_CONTENT

@app.route("/api/dataset")
def api_dataset():
    person_dirs = get_person_dirs()
    class_map = {name: idx for idx, name in enumerate(person_dirs)}
    
    # Generate classes.txt inside Dataset_Labeled for compatibility with external annotation tools (like LabelImg)
    labeled_root = os.path.join(ROOT_DIR, "Dataset_Labeled")
    os.makedirs(labeled_root, exist_ok=True)
    with open(os.path.join(labeled_root, "classes.txt"), "w") as cf:
        cf.write("\n".join(person_dirs) + "\n")
        
    images_db = {}
    total_images = 0
    total_labeled = 0
    
    for person in person_dirs:
        person_path = os.path.join(ROOT_DIR, person)
        
        # Get all images in this directory
        images = sorted([
            f for f in os.listdir(person_path) 
            if f.lower().endswith(('.jpg', '.jpeg', '.png', '.webp', '.bmp'))
        ])
        
        images_db[person] = []
        for img_name in images:
            base_name, _ = os.path.splitext(img_name)
            labeled_dir = os.path.join(ROOT_DIR, "Dataset_Labeled", person)
            label_path = os.path.join(labeled_dir, f"{base_name}.txt")
            
            labeled = False
            bbox = None
            
            if os.path.exists(label_path):
                try:
                    with open(label_path, "r") as f:
                        lines = f.readlines()
                        if lines:
                            parts = lines[0].strip().split()
                            if len(parts) == 5:
                                _, x_c, y_c, w, h = parts
                                bbox = [float(x_c), float(y_c), float(w), float(h)]
                                labeled = True
                except Exception:
                    pass
            
            images_db[person].append({
                "name": img_name,
                "labeled": labeled,
                "bbox": bbox
            })
            total_images += 1
            if labeled:
                total_labeled += 1
                
    return jsonify({
        "classes": person_dirs,
        "images": images_db,
        "opencv_available": OPENCV_AVAILABLE,
        "stats": {
            "total_images": total_images,
            "total_labeled": total_labeled,
            "progress_percent": round((total_labeled / total_images * 100) if total_images > 0 else 0, 1)
        }
    })

@app.route("/api/image/<class_name>/<image_name>")
def api_image(class_name, image_name):
    # Security: Ensure class_name is an actual class folder and image_name exists
    person_dirs = get_person_dirs()
    if class_name not in person_dirs:
        return "Class not found", 404
        
    class_path = os.path.join(ROOT_DIR, class_name)
    image_path = os.path.join(class_path, image_name)
    
    if not os.path.exists(image_path) or not os.path.isfile(image_path):
        return "Image not found", 404
        
    return send_file(image_path)

@app.route("/api/save", methods=["POST"])
def api_save():
    data = request.get_json()
    if not data:
        return jsonify({"success": False, "message": "Invalid request"}), 400
        
    class_name = data.get("class_name")
    image_name = data.get("image_name")
    bbox = data.get("bbox") # [x_center, y_center, width, height]
    
    person_dirs = get_person_dirs()
    if class_name not in person_dirs:
        return jsonify({"success": False, "message": "Class folder not found"}), 404
        
    class_id = person_dirs.index(class_name)
    class_path = os.path.join(ROOT_DIR, class_name)
    image_path = os.path.join(class_path, image_name)
    
    if not os.path.exists(image_path):
        return jsonify({"success": False, "message": "Image file not found"}), 404
        
    base_name, _ = os.path.splitext(image_name)
    labeled_dir = os.path.join(ROOT_DIR, "Dataset_Labeled", class_name)
    os.makedirs(labeled_dir, exist_ok=True)
    label_path = os.path.join(labeled_dir, f"{base_name}.txt")
    
    if bbox is None:
        # User wants to clear/delete label
        if os.path.exists(label_path):
            os.remove(label_path)
        return jsonify({"success": True, "message": "Label deleted"})
        
    x_c, y_c, w, h = bbox
    # Constrain to 0.0 - 1.0
    x_c = max(0.0, min(1.0, x_c))
    y_c = max(0.0, min(1.0, y_c))
    w = max(0.0, min(1.0, w))
    h = max(0.0, min(1.0, h))
    
    try:
        with open(label_path, "w") as f:
            f.write(f"{class_id} {x_c:.6f} {y_c:.6f} {w:.6f} {h:.6f}\n")
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route("/api/auto_detect", methods=["POST"])
def api_auto_detect():
    if not OPENCV_AVAILABLE:
        return jsonify({"success": False, "message": "OpenCV is not available on the server"}), 400
        
    data = request.get_json()
    class_name = data.get("class_name")
    image_name = data.get("image_name")
    
    person_dirs = get_person_dirs()
    if class_name not in person_dirs:
        return jsonify({"success": False, "message": "Class not found"}), 404
        
    image_path = os.path.join(ROOT_DIR, class_name, image_name)
    if not os.path.exists(image_path):
        return jsonify({"success": False, "message": "Image not found"}), 404
        
    bbox = detect_face_bbox(image_path)
    if bbox:
        return jsonify({"success": True, "bbox": bbox})
    else:
        return jsonify({"success": False, "message": "No face detected by Haar Cascades. Please draw manually."})

# ================= EMBEDDED FRONTEND (HTML / CSS / JS) =================

HTML_CONTENT = """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>YOLO Labeler Studio</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Google+Sans+Code:wght@400;500;600&family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-base: #0b0f19;
            --bg-surface: #111827;
            --bg-surface-light: #1f2937;
            --bg-surface-hover: #374151;
            --color-primary: #00f0ff;
            --color-primary-dim: rgba(0, 240, 255, 0.15);
            --color-success: #10b981;
            --color-success-dim: rgba(16, 185, 129, 0.15);
            --color-warning: #ef4444;
            --color-warning-dim: rgba(239, 68, 68, 0.15);
            --text-main: #f3f4f6;
            --text-secondary: #9ca3af;
            --text-muted: #6b7280;
            --border-color: rgba(255, 255, 255, 0.08);
            --glass-blur: 16px;
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
            user-select: none;
            -webkit-user-drag: none;
        }

        body {
            font-family: 'Inter', sans-serif;
            background-color: var(--bg-base);
            color: var(--text-main);
            height: 100vh;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }

        /* Top Header */
        header {
            background: rgba(17, 24, 39, 0.7);
            backdrop-filter: blur(var(--glass-blur));
            border-bottom: 1px solid var(--border-color);
            padding: 12px 24px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            z-index: 10;
        }

        .logo-section {
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .logo-icon {
            width: 32px;
            height: 32px;
            background: linear-gradient(135deg, var(--color-primary), #3b82f6);
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 700;
            color: var(--bg-base);
            font-family: 'Google Sans Code', monospace;
            box-shadow: 0 0 15px rgba(0, 240, 255, 0.4);
        }

        h1 {
            font-family: 'Google Sans Code', monospace;
            font-size: 1.25rem;
            font-weight: 600;
            letter-spacing: -0.5px;
            background: linear-gradient(to right, #ffffff, var(--text-secondary));
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }

        .stats-bar {
            display: flex;
            align-items: center;
            gap: 24px;
        }

        .stat-card {
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid var(--border-color);
            border-radius: 8px;
            padding: 6px 14px;
            display: flex;
            align-items: center;
            gap: 10px;
            font-size: 0.85rem;
        }

        .stat-card .label {
            color: var(--text-secondary);
        }

        .stat-card .value {
            font-weight: 600;
            color: var(--color-primary);
        }

        .progress-container {
            width: 150px;
            height: 6px;
            background: var(--bg-surface-light);
            border-radius: 10px;
            overflow: hidden;
        }

        .progress-bar {
            height: 100%;
            background: linear-gradient(to right, var(--color-primary), var(--color-success));
            width: 0%;
            transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }

        /* Main Workspace Container */
        .workspace {
            flex: 1;
            display: grid;
            grid-template-columns: 280px 1fr 340px;
            overflow: hidden;
        }

        /* Left Class Sidebar */
        .sidebar-classes {
            background: rgba(17, 24, 39, 0.4);
            border-right: 1px solid var(--border-color);
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }

        .search-box {
            padding: 16px;
            border-bottom: 1px solid var(--border-color);
        }

        .search-input {
            width: 100%;
            background: var(--bg-surface-light);
            border: 1px solid var(--border-color);
            padding: 10px 14px;
            border-radius: 8px;
            color: var(--text-main);
            outline: none;
            font-family: inherit;
            font-size: 0.9rem;
            transition: border-color 0.2s;
        }

        .search-input:focus {
            border-color: var(--color-primary);
            box-shadow: 0 0 10px rgba(0, 240, 255, 0.15);
        }

        .classes-list {
            flex: 1;
            overflow-y: auto;
            padding: 8px 12px;
        }

        .classes-list::-webkit-scrollbar {
            width: 4px;
        }

        .classes-list::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.1);
            border-radius: 10px;
        }

        .class-item {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 10px 12px;
            border-radius: 8px;
            cursor: pointer;
            margin-bottom: 4px;
            transition: all 0.2s ease;
            border: 1px solid transparent;
        }

        .class-item:hover {
            background: rgba(255, 255, 255, 0.04);
            color: #ffffff;
        }

        .class-item.active {
            background: var(--color-primary-dim);
            color: var(--color-primary);
            border: 1px solid rgba(0, 240, 255, 0.25);
            font-weight: 500;
        }

        .class-name {
            font-size: 0.9rem;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 180px;
        }

        .class-counter {
            font-size: 0.75rem;
            background: rgba(255, 255, 255, 0.05);
            padding: 2px 6px;
            border-radius: 20px;
            color: var(--text-secondary);
            font-family: 'Google Sans Code', monospace;
        }

        .class-item.active .class-counter {
            background: rgba(0, 240, 255, 0.2);
            color: var(--color-primary);
        }

        /* Central Editor Area */
        .editor-area {
            display: flex;
            flex-direction: column;
            background: #090c15;
            position: relative;
            overflow: hidden;
            border-right: 1px solid var(--border-color);
        }

        .canvas-container {
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
            padding: 32px;
            overflow: hidden;
        }

        .image-wrapper {
            position: relative;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
            border-radius: 8px;
            overflow: hidden;
            border: 1px solid rgba(255, 255, 255, 0.05);
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .workspace-img {
            max-width: 100%;
            max-height: 70vh;
            display: block;
            object-fit: contain;
            pointer-events: none;
        }

        /* SVG Annotation Overlay */
        .svg-overlay {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            cursor: crosshair;
        }

        .bbox-rect {
            fill: rgba(0, 240, 255, 0.12);
            stroke: var(--color-primary);
            stroke-width: 2.5;
            cursor: move;
            stroke-dasharray: 4;
            animation: dash 15s linear infinite;
        }

        @keyframes dash {
            to {
                stroke-dashoffset: -1000;
            }
        }

        .bbox-handle {
            fill: #ffffff;
            stroke: var(--color-primary);
            stroke-width: 2;
            cursor: pointer;
            transition: transform 0.1s;
        }

        .bbox-handle:hover {
            transform: scale(1.3);
            fill: var(--color-primary);
        }

        /* Editor Control Toolbar */
        .toolbar {
            background: rgba(17, 24, 39, 0.8);
            backdrop-filter: blur(var(--glass-blur));
            border-top: 1px solid var(--border-color);
            padding: 16px 24px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 16px;
        }

        .tool-group {
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .btn {
            background: var(--bg-surface-light);
            border: 1px solid var(--border-color);
            color: var(--text-main);
            padding: 10px 18px;
            border-radius: 8px;
            font-size: 0.9rem;
            font-weight: 500;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            gap: 8px;
            transition: all 0.2s ease;
            font-family: inherit;
        }

        .btn:hover {
            background: var(--bg-surface-hover);
            border-color: rgba(255, 255, 255, 0.2);
            transform: translateY(-1px);
        }

        .btn:active {
            transform: translateY(0);
        }

        .btn-primary {
            background: var(--color-primary);
            color: var(--bg-base);
            border-color: var(--color-primary);
            font-weight: 600;
            box-shadow: 0 0 15px rgba(0, 240, 255, 0.2);
        }

        .btn-primary:hover {
            background: #00d8e6;
            border-color: #00d8e6;
            box-shadow: 0 0 20px rgba(0, 240, 255, 0.4);
        }

        .btn-success {
            background: var(--color-success);
            color: #ffffff;
            border-color: var(--color-success);
        }

        .btn-success:hover {
            background: #0ea572;
            border-color: #0ea572;
        }

        .btn-warning {
            background: transparent;
            color: #ef4444;
            border-color: rgba(239, 68, 68, 0.3);
        }

        .btn-warning:hover {
            background: var(--color-warning-dim);
            border-color: #ef4444;
        }

        .btn:disabled {
            opacity: 0.4;
            cursor: not-allowed;
            transform: none !important;
            box-shadow: none !important;
        }

        /* Right Panel: Thumbnails and Shortcuts */
        .right-panel {
            background: rgba(17, 24, 39, 0.3);
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }

        .right-panel-header {
            padding: 16px;
            border-bottom: 1px solid var(--border-color);
            display: flex;
            align-items: center;
            justify-content: space-between;
        }

        .right-panel-title {
            font-family: 'Google Sans Code', monospace;
            font-size: 0.95rem;
            font-weight: 600;
            color: var(--text-secondary);
        }

        .image-grid-container {
            flex: 1;
            overflow-y: auto;
            padding: 12px;
        }

        .image-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 10px;
        }

        .image-grid::-webkit-scrollbar {
            width: 4px;
        }

        .image-grid::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.1);
            border-radius: 10px;
        }

        .grid-item {
            background: var(--bg-surface);
            border: 1px solid var(--border-color);
            border-radius: 8px;
            padding: 6px;
            cursor: pointer;
            position: relative;
            display: flex;
            flex-direction: column;
            align-items: center;
            transition: all 0.2s ease;
        }

        .grid-item:hover {
            background: var(--bg-surface-light);
            border-color: rgba(255, 255, 255, 0.15);
        }

        .grid-item.active {
            border-color: var(--color-primary);
            box-shadow: 0 0 10px rgba(0, 240, 255, 0.2);
            background: rgba(0, 240, 255, 0.03);
        }

        .grid-thumb-wrapper {
            width: 100%;
            aspect-ratio: 1;
            border-radius: 4px;
            overflow: hidden;
            background: #000;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .grid-thumb {
            max-width: 100%;
            max-height: 100%;
            object-fit: cover;
        }

        .grid-label {
            font-size: 0.75rem;
            color: var(--text-secondary);
            margin-top: 6px;
            text-align: center;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            width: 100%;
        }

        /* Status Badge Overlay */
        .status-badge {
            position: absolute;
            top: 10px;
            right: 10px;
            width: 8px;
            height: 8px;
            border-radius: 50%;
            box-shadow: 0 0 6px rgba(0,0,0,0.5);
        }

        .status-badge.labeled {
            background-color: var(--color-success);
            box-shadow: 0 0 8px var(--color-success);
        }

        .status-badge.unlabeled {
            background-color: var(--color-warning);
            box-shadow: 0 0 8px var(--color-warning);
        }

        /* Keyboard Shortcuts Panel */
        .shortcuts-section {
            background: rgba(17, 24, 39, 0.9);
            border-top: 1px solid var(--border-color);
            padding: 16px;
        }

        .shortcuts-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 10px;
            font-size: 0.8rem;
        }

        .shortcut-item {
            display: flex;
            align-items: center;
            justify-content: space-between;
            background: rgba(255, 255, 255, 0.02);
            padding: 6px 10px;
            border-radius: 6px;
            border: 1px solid rgba(255, 255, 255, 0.03);
        }

        .shortcut-key {
            background: var(--bg-surface-light);
            border: 1px solid var(--border-color);
            border-radius: 4px;
            padding: 2px 6px;
            font-family: 'Google Sans Code', monospace;
            font-weight: 600;
            color: var(--color-primary);
            font-size: 0.75rem;
        }

        /* Loading / Toast notification overlay */
        .toast {
            position: absolute;
            bottom: 100px;
            left: 50%;
            transform: translateX(-50%) translateY(20px);
            background: rgba(17, 24, 39, 0.95);
            border: 1px solid var(--color-primary);
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5), 0 0 15px rgba(0, 240, 255, 0.2);
            color: #ffffff;
            padding: 12px 24px;
            border-radius: 30px;
            font-weight: 500;
            z-index: 100;
            display: flex;
            align-items: center;
            gap: 10px;
            opacity: 0;
            pointer-events: none;
            transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }

        .toast.show {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
        }

        .toast.error {
            border-color: var(--color-warning);
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5), 0 0 15px rgba(239, 68, 68, 0.2);
        }

        /* Quick Help Banner when empty */
        .empty-workspace-state {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            text-align: center;
            z-index: 5;
            pointer-events: none;
        }

        .empty-icon {
            font-size: 4rem;
            margin-bottom: 16px;
            opacity: 0.3;
        }

        .empty-text {
            color: var(--text-secondary);
            font-weight: 500;
            margin-bottom: 6px;
        }

        .empty-subtext {
            color: var(--text-muted);
            font-size: 0.85rem;
        }
    </style>
</head>
<body>
    <!-- Top Header -->
    <header>
        <div class="logo-section">
            <div class="logo-icon">03</div>
            <div>
                <h1>YOLO Labeler Studio</h1>
                <p style="font-size: 0.75rem; color: var(--text-muted);">Face Bounding Box Editor</p>
            </div>
        </div>
        
        <div class="stats-bar">
            <div class="stat-card">
                <span class="label">Total Images</span>
                <span class="value" id="stats-total">0</span>
            </div>
            <div class="stat-card">
                <span class="label">Labeled</span>
                <span class="value" style="color: var(--color-success);" id="stats-labeled">0</span>
            </div>
            <div class="stat-card">
                <span class="label">Completion</span>
                <div class="progress-container">
                    <div class="progress-bar" id="stats-progress-bar"></div>
                </div>
                <span class="value" id="stats-percent">0%</span>
            </div>
        </div>
    </header>

    <!-- Main Workspace -->
    <div class="workspace">
        <!-- Left Sidebar: Classes -->
        <div class="sidebar-classes">
            <div class="search-box">
                <input type="text" class="search-input" id="class-search" placeholder="Search categories...">
            </div>
            <div class="classes-list" id="classes-container">
                <!-- Class items will be rendered here dynamically -->
            </div>
        </div>

        <!-- Center Editor Area -->
        <div class="editor-area">
            <div class="canvas-container">
                <div class="empty-workspace-state" id="empty-state">
                    <div class="empty-icon">🖼️</div>
                    <div class="empty-text">No image loaded</div>
                    <div class="empty-subtext">Click and drag to draw a bounding box once an image is selected</div>
                </div>

                <div class="image-wrapper" id="image-wrapper" style="display: none;">
                    <img id="main-image" class="workspace-img" src="" alt="Workspace Image">
                    <svg id="svg-overlay" class="svg-overlay">
                        <!-- Bounding box rect -->
                        <rect id="svg-rect" class="bbox-rect" x="0" y="0" width="0" height="0" style="display: none;"></rect>
                        
                        <!-- Drag handles -->
                        <circle id="handle-tl" class="bbox-handle" cx="0" cy="0" r="6" style="display: none;"></circle>
                        <circle id="handle-tr" class="bbox-handle" cx="0" cy="0" r="6" style="display: none;"></circle>
                        <circle id="handle-bl" class="bbox-handle" cx="0" cy="0" r="6" style="display: none;"></circle>
                        <circle id="handle-br" class="bbox-handle" cx="0" cy="0" r="6" style="display: none;"></circle>
                    </svg>
                </div>
            </div>

            <!-- Toolbar -->
            <div class="toolbar">
                <div class="tool-group">
                    <button class="btn btn-warning" id="btn-clear" disabled>
                        <span>🗑️</span> Clear Box
                    </button>
                    <button class="btn" id="btn-full" disabled>
                        <span>📺</span> Full-Frame
                    </button>
                    <button class="btn" id="btn-auto" disabled>
                        <span>🤖</span> Auto-Detect Face
                    </button>
                </div>
                <div class="tool-group">
                    <div style="font-size: 0.85rem; color: var(--text-secondary); margin-right: 12px;" id="current-coords">
                        [No Box]
                    </div>
                    <button class="btn btn-primary" id="btn-save" disabled>
                        <span>💾</span> Save Label
                    </button>
                </div>
            </div>
        </div>

        <!-- Right Sidebar: Image list -->
        <div class="right-panel">
            <div class="right-panel-header">
                <span class="right-panel-title" id="active-class-title">Images</span>
                <span class="class-counter" id="active-class-counter">0/0</span>
            </div>
            
            <div class="image-grid-container">
                <div class="image-grid" id="image-grid">
                    <!-- Thumbnails go here -->
                </div>
            </div>

            <!-- Keyboard Shortcuts Grid -->
            <div class="shortcuts-section">
                <div class="right-panel-title" style="margin-bottom: 12px; font-size: 0.85rem;">Keyboard Shortcuts</div>
                <div class="shortcuts-grid">
                    <div class="shortcut-item">
                        <span>Save & Next</span>
                        <span class="shortcut-key">Enter / Space</span>
                    </div>
                    <div class="shortcut-item">
                        <span>Next Image</span>
                        <span class="shortcut-key">→ / D</span>
                    </div>
                    <div class="shortcut-item">
                        <span>Prev Image</span>
                        <span class="shortcut-key">← / A</span>
                    </div>
                    <div class="shortcut-item">
                        <span>Classes</span>
                        <span class="shortcut-key">↑ / ↓</span>
                    </div>
                    <div class="shortcut-item">
                        <span>Auto-Detect</span>
                        <span class="shortcut-key">R</span>
                    </div>
                    <div class="shortcut-item">
                        <span>Full-Frame</span>
                        <span class="shortcut-key">F</span>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Notification Toast -->
    <div class="toast" id="toast">
        <span id="toast-icon">ℹ️</span>
        <span id="toast-text">Message goes here</span>
    </div>

    <script>
        // --- Application State ---
        let dataset = {
            classes: [],
            images: {},
            opencv_available: false,
            stats: {}
        };
        
        let currentClass = "";
        let currentImageIndex = -1;
        
        // Bounding box in normalized coordinates [x_center, y_center, width, height]
        let activeBbox = null; 
        
        // Draggability states
        let isDrawing = false;
        let dragMode = null; // 'move', 'tl', 'tr', 'bl', 'br'
        let dragStartNorm = { x: 0, y: 0 };
        let dragStartBbox = null;

        // Elements caching
        const elMainImage = document.getElementById("main-image");
        const elSvgOverlay = document.getElementById("svg-overlay");
        const elSvgRect = document.getElementById("svg-rect");
        const elHandleTl = document.getElementById("handle-tl");
        const elHandleTr = document.getElementById("handle-tr");
        const elHandleBl = document.getElementById("handle-bl");
        const elHandleBr = document.getElementById("handle-br");
        const elImageWrapper = document.getElementById("image-wrapper");
        const elEmptyState = document.getElementById("empty-state");
        const elCurrentCoords = document.getElementById("current-coords");
        
        // Buttons
        const btnSave = document.getElementById("btn-save");
        const btnClear = document.getElementById("btn-clear");
        const btnFull = document.getElementById("btn-full");
        const btnAuto = document.getElementById("btn-auto");

        // --- Core Functions ---
        
        async function fetchDataset() {
            try {
                const res = await fetch("/api/dataset");
                dataset = await res.json();
                
                updateStatsDashboard();
                renderClassesList();
                
                // Keep selected class or load the first one
                if (dataset.classes.length > 0) {
                    if (!currentClass || !dataset.classes.includes(currentClass)) {
                        selectClass(dataset.classes[0]);
                    } else {
                        // Refresh active class render
                        renderClassImages();
                        updateClassItemsList();
                    }
                }
            } catch (err) {
                showToast("Error loading dataset. Is server running?", true);
            }
        }

        function updateStatsDashboard() {
            document.getElementById("stats-total").textContent = dataset.stats.total_images;
            document.getElementById("stats-labeled").textContent = dataset.stats.total_labeled;
            document.getElementById("stats-percent").textContent = dataset.stats.progress_percent + "%";
            document.getElementById("stats-progress-bar").style.width = dataset.stats.progress_percent + "%";
            
            // Enable/disable Auto-detect globally
            if (!dataset.opencv_available) {
                btnAuto.title = "OpenCV (cv2) is not installed on the server backend.";
            }
        }

        function renderClassesList(filterText = "") {
            const container = document.getElementById("classes-container");
            container.innerHTML = "";
            
            dataset.classes.forEach(cls => {
                if (filterText && !cls.toLowerCase().includes(filterText.toLowerCase())) {
                    return;
                }
                
                const images = dataset.images[cls] || [];
                const total = images.length;
                const labeled = images.filter(img => img.labeled).length;
                
                const item = document.createElement("div");
                item.className = `class-item ${cls === currentClass ? 'active' : ''}`;
                item.dataset.class = cls;
                item.onclick = () => selectClass(cls);
                
                item.innerHTML = `
                    <span class="class-name" title="${cls}">${cls}</span>
                    <span class="class-counter">${labeled}/${total}</span>
                `;
                container.appendChild(item);
            });
        }

        function updateClassItemsList() {
            const items = document.querySelectorAll(".class-item");
            items.forEach(item => {
                const cls = item.dataset.class;
                const images = dataset.images[cls] || [];
                const total = images.length;
                const labeled = images.filter(img => img.labeled).length;
                
                if (cls === currentClass) {
                    item.classList.add("active");
                } else {
                    item.classList.remove("active");
                }
                item.querySelector(".class-counter").textContent = `${labeled}/${total}`;
            });
        }

        function selectClass(className) {
            currentClass = className;
            updateClassItemsList();
            
            document.getElementById("active-class-title").textContent = className;
            
            renderClassImages();
            
            // Auto load first image in the category
            const classImages = dataset.images[currentClass] || [];
            if (classImages.length > 0) {
                // Find first unlabeled image or default to 0
                let firstUnlabeled = classImages.findIndex(img => !img.labeled);
                if (firstUnlabeled === -1) firstUnlabeled = 0;
                selectImage(firstUnlabeled);
            } else {
                unloadWorkspace();
            }
        }

        function renderClassImages() {
            const grid = document.getElementById("image-grid");
            grid.innerHTML = "";
            
            const classImages = dataset.images[currentClass] || [];
            document.getElementById("active-class-counter").textContent = `0/${classImages.length}`;
            
            classImages.forEach((img, idx) => {
                const item = document.createElement("div");
                item.className = `grid-item ${idx === currentImageIndex ? 'active' : ''}`;
                item.dataset.index = idx;
                item.onclick = () => selectImage(idx);
                
                const badge = document.createElement("div");
                badge.className = `status-badge ${img.labeled ? 'labeled' : 'unlabeled'}`;
                
                const thumbWrapper = document.createElement("div");
                thumbWrapper.className = "grid-thumb-wrapper";
                
                const imgEl = document.createElement("img");
                imgEl.className = "grid-thumb";
                imgEl.src = `/api/image/${currentClass}/${img.name}`;
                imgEl.loading = "lazy";
                
                const label = document.createElement("div");
                label.className = "grid-label";
                label.textContent = img.name;
                
                thumbWrapper.appendChild(imgEl);
                item.appendChild(badge);
                item.appendChild(thumbWrapper);
                item.appendChild(label);
                
                grid.appendChild(item);
            });
            
            if (currentImageIndex !== -1) {
                document.getElementById("active-class-counter").textContent = `${currentImageIndex + 1}/${classImages.length}`;
            }
        }

        function selectImage(index) {
            const classImages = dataset.images[currentClass] || [];
            if (index < 0 || index >= classImages.length) return;
            
            currentImageIndex = index;
            
            // Highlight thumbnail in right panel
            const items = document.querySelectorAll(".grid-item");
            items.forEach(item => {
                if (parseInt(item.dataset.index) === index) {
                    item.classList.add("active");
                    item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                } else {
                    item.classList.remove("active");
                }
            });
            
            document.getElementById("active-class-counter").textContent = `${currentImageIndex + 1}/${classImages.length}`;
            
            const imgData = classImages[index];
            
            // Show Workspace
            elEmptyState.style.display = "none";
            elImageWrapper.style.display = "flex";
            
            // Load source
            elMainImage.src = `/api/image/${currentClass}/${imgData.name}`;
            
            // Setup coordinates
            if (imgData.labeled && imgData.bbox) {
                activeBbox = [...imgData.bbox];
            } else {
                activeBbox = null;
            }
            
            // Reset SVGs, wait for image load to draw properly
            elMainImage.onload = () => {
                drawBoundingBox();
                enableControls();
            };
        }

        function unloadWorkspace() {
            currentImageIndex = -1;
            activeBbox = null;
            elImageWrapper.style.display = "none";
            elEmptyState.style.display = "block";
            disableControls();
        }

        function enableControls() {
            btnSave.disabled = false;
            btnClear.disabled = (activeBbox === null);
            btnFull.disabled = false;
            btnAuto.disabled = !dataset.opencv_available;
        }

        function disableControls() {
            btnSave.disabled = true;
            btnClear.disabled = true;
            btnFull.disabled = true;
            btnAuto.disabled = true;
            elCurrentCoords.textContent = "[No Box]";
        }

        // --- Drawing and Geometry Math ---
        
        // Renders activeBbox on top of the image
        function drawBoundingBox() {
            if (!activeBbox) {
                elSvgRect.style.display = "none";
                elHandleTl.style.display = "none";
                elHandleTr.style.display = "none";
                elHandleBl.style.display = "none";
                elHandleBr.style.display = "none";
                elCurrentCoords.textContent = "[No Box]";
                btnClear.disabled = true;
                return;
            }
            
            btnClear.disabled = false;
            
            // Dimensions of rendered image
            const rect = elMainImage.getBoundingClientRect();
            const wImg = rect.width;
            const hImg = rect.height;
            
            // activeBbox is in YOLO format: [x_center, y_center, width, height]
            const [x_c, y_c, w, h] = activeBbox;
            
            // Convert to top-left corner and pixel size
            const widthPx = w * wImg;
            const heightPx = h * hImg;
            const xPx = (x_c - w / 2) * wImg;
            const yPx = (y_c - h / 2) * hImg;
            
            // Render bounding box
            elSvgRect.setAttribute("x", xPx);
            elSvgRect.setAttribute("y", yPx);
            elSvgRect.setAttribute("width", widthPx);
            elSvgRect.setAttribute("height", heightPx);
            elSvgRect.style.display = "block";
            
            // Position Corner Handles
            elHandleTl.setAttribute("cx", xPx);
            elHandleTl.setAttribute("cy", yPx);
            elHandleTl.style.display = "block";
            
            elHandleTr.setAttribute("cx", xPx + widthPx);
            elHandleTr.setAttribute("cy", yPx);
            elHandleTr.style.display = "block";
            
            elHandleBl.setAttribute("cx", xPx);
            elHandleBl.setAttribute("cy", yPx + heightPx);
            elHandleBl.style.display = "block";
            
            elHandleBr.setAttribute("cx", xPx + widthPx);
            elHandleBr.setAttribute("cy", yPx + heightPx);
            elHandleBr.style.display = "block";
            
            // Update Coordinate Display
            elCurrentCoords.textContent = `Center: (${x_c.toFixed(3)}, ${y_c.toFixed(3)}) Size: ${w.toFixed(3)}x${h.toFixed(3)}`;
        }

        // Helper to convert mouse pointer to normalized coordinates [0, 1] relative to the image bounding rect
        function getNormalizedMousePos(e) {
            const rect = elMainImage.getBoundingClientRect();
            let x = (e.clientX - rect.left) / rect.width;
            let y = (e.clientY - rect.top) / rect.height;
            
            // Clamp to [0.0, 1.0] range
            x = Math.max(0.0, Math.min(1.0, x));
            y = Math.max(0.0, Math.min(1.0, y));
            
            return { x, y };
        }

        // --- Interaction Logic ---
        
        elSvgOverlay.addEventListener("mousedown", (e) => {
            if (currentImageIndex === -1) return;
            e.preventDefault();
            
            const mouseNorm = getNormalizedMousePos(e);
            dragStartNorm = mouseNorm;
            
            // Check if clicking a handle
            if (e.target === elHandleTl) {
                dragMode = 'tl';
            } else if (e.target === elHandleTr) {
                dragMode = 'tr';
            } else if (e.target === elHandleBl) {
                dragMode = 'bl';
            } else if (e.target === elHandleBr) {
                dragMode = 'br';
            } else if (e.target === elSvgRect) {
                dragMode = 'move';
            } else {
                // Clicking on empty area: start drawing new box!
                dragMode = 'draw';
                isDrawing = true;
                activeBbox = [mouseNorm.x, mouseNorm.y, 0, 0];
                drawBoundingBox();
            }
            
            if (activeBbox) {
                dragStartBbox = [...activeBbox]; // Copy original
            }
        });

        window.addEventListener("mousemove", (e) => {
            if (!dragMode || currentImageIndex === -1) return;
            
            const mouseNorm = getNormalizedMousePos(e);
            
            if (dragMode === 'draw') {
                // Calculate width and height based on draw drag start
                const x1 = dragStartNorm.x;
                const y1 = dragStartNorm.y;
                const x2 = mouseNorm.x;
                const y2 = mouseNorm.y;
                
                const w = Math.abs(x2 - x1);
                const h = Math.abs(y2 - y1);
                const x_c = (x1 + x2) / 2;
                const y_c = (y1 + y2) / 2;
                
                activeBbox = [x_c, y_c, w, h];
            } 
            else if (dragMode === 'move') {
                const dx = mouseNorm.x - dragStartNorm.x;
                const dy = mouseNorm.y - dragStartNorm.y;
                
                let x_c = dragStartBbox[0] + dx;
                let y_c = dragStartBbox[1] + dy;
                const w = dragStartBbox[2];
                const h = dragStartBbox[3];
                
                // Clamp movement bounds so box stays within image
                x_c = Math.max(w / 2, Math.min(1.0 - w / 2, x_c));
                y_c = Math.max(h / 2, Math.min(1.0 - h / 2, y_c));
                
                activeBbox = [x_c, y_c, w, h];
            } 
            else {
                // Corner Resizing
                // Deconstruct original box
                const [ox_c, oy_c, ow, oh] = dragStartBbox;
                let x1 = ox_c - ow / 2;
                let y1 = oy_c - oh / 2;
                let x2 = ox_c + ow / 2;
                let y2 = oy_c + oh / 2;
                
                if (dragMode === 'tl') {
                    x1 = mouseNorm.x;
                    y1 = mouseNorm.y;
                } else if (dragMode === 'tr') {
                    x2 = mouseNorm.x;
                    y1 = mouseNorm.y;
                } else if (dragMode === 'bl') {
                    x1 = mouseNorm.x;
                    y2 = mouseNorm.y;
                } else if (dragMode === 'br') {
                    x2 = mouseNorm.x;
                    y2 = mouseNorm.y;
                }
                
                // Formulate updated dimensions
                const w = Math.abs(x2 - x1);
                const h = Math.abs(y2 - y1);
                const x_c = (x1 + x2) / 2;
                const y_c = (y1 + y2) / 2;
                
                activeBbox = [x_c, y_c, w, h];
            }
            
            drawBoundingBox();
        });

        window.addEventListener("mouseup", () => {
            if (dragMode === 'draw' && activeBbox) {
                // If box drawn is extremely tiny, count it as a click/miss and clear
                if (activeBbox[2] < 0.01 || activeBbox[3] < 0.01) {
                    activeBbox = null;
                    drawBoundingBox();
                }
            }
            dragMode = null;
            isDrawing = false;
        });

        // Redraw overlay if user resizes window (responsiveness check)
        window.addEventListener("resize", drawBoundingBox);

        // --- Button Actions ---
        
        btnClear.addEventListener("click", () => {
            activeBbox = null;
            drawBoundingBox();
        });

        btnFull.addEventListener("click", () => {
            activeBbox = [0.5, 0.5, 1.0, 1.0];
            drawBoundingBox();
        });

        btnAuto.addEventListener("click", triggerAutoDetect);

        btnSave.addEventListener("click", saveCurrentLabel);

        // --- Save and API integration ---
        
        async function saveCurrentLabel() {
            if (currentImageIndex === -1) return;
            
            const classImages = dataset.images[currentClass] || [];
            const imgData = classImages[currentImageIndex];
            
            const payload = {
                class_name: currentClass,
                image_name: imgData.name,
                bbox: activeBbox
            };
            
            try {
                const res = await fetch("/api/save", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                });
                
                const data = await res.json();
                if (data.success) {
                    showToast("Label saved successfully!");
                    
                    // Update state locally
                    imgData.labeled = (activeBbox !== null);
                    imgData.bbox = activeBbox ? [...activeBbox] : null;
                    
                    // Recalculate stats and refresh visual indicators
                    updateStatsLocally();
                    renderClassImages();
                    updateClassItemsList();
                    
                    // Auto-advance to the next UNLABELED image in the class
                    let nextIdx = currentImageIndex + 1;
                    let advanced = false;
                    
                    // Loop to find next unlabeled image
                    for (let i = nextIdx; i < classImages.length; i++) {
                        if (!classImages[i].labeled) {
                            selectImage(i);
                            advanced = true;
                            break;
                        }
                    }
                    
                    // If no subsequent unlabeled image is found, wrap around
                    if (!advanced) {
                        for (let i = 0; i < currentImageIndex; i++) {
                            if (!classImages[i].labeled) {
                                selectImage(i);
                                advanced = true;
                                break;
                            }
                        }
                    }
                    
                    // If everything is labeled, just advance to next physical image
                    if (!advanced && nextIdx < classImages.length) {
                        selectImage(nextIdx);
                    }
                } else {
                    showToast("Error: " + data.message, true);
                }
            } catch (err) {
                showToast("Server communication failed.", true);
            }
        }

        async function triggerAutoDetect() {
            if (currentImageIndex === -1) return;
            
            const classImages = dataset.images[currentClass] || [];
            const imgData = classImages[currentImageIndex];
            
            showToast("AI face detection running...");
            
            try {
                const res = await fetch("/api/auto_detect", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        class_name: currentClass,
                        image_name: imgData.name
                    })
                });
                
                const data = await res.json();
                if (data.success) {
                    activeBbox = data.bbox;
                    drawBoundingBox();
                    showToast("Face auto-detected successfully!");
                } else {
                    showToast(data.message, true);
                }
            } catch (err) {
                showToast("Face detection backend error.", true);
            }
        }

        function updateStatsLocally() {
            let total = 0;
            let labeled = 0;
            
            dataset.classes.forEach(cls => {
                const images = dataset.images[cls] || [];
                total += images.length;
                labeled += images.filter(img => img.labeled).length;
            });
            
            dataset.stats.total_images = total;
            dataset.stats.total_labeled = labeled;
            dataset.stats.progress_percent = total > 0 ? round((labeled / total * 100), 1) : 0;
            
            function round(value, precision) {
                const multiplier = Math.pow(10, precision || 0);
                return Math.round(value * multiplier) / multiplier;
            }
            
            updateStatsDashboard();
        }

        // --- Search bar filtering ---
        
        document.getElementById("class-search").addEventListener("input", (e) => {
            renderClassesList(e.target.value);
        });

        // --- Notification Toast Alert ---
        
        let toastTimeout = null;
        function showToast(text, isError = false) {
            const toast = document.getElementById("toast");
            const toastText = document.getElementById("toast-text");
            const toastIcon = document.getElementById("toast-icon");
            
            toastText.textContent = text;
            toastIcon.textContent = isError ? "⚠️" : "✨";
            
            if (isError) {
                toast.classList.add("error");
            } else {
                toast.classList.remove("error");
            }
            
            toast.classList.add("show");
            
            if (toastTimeout) clearTimeout(toastTimeout);
            
            toastTimeout = setTimeout(() => {
                toast.classList.remove("show");
            }, 3000);
        }

        // --- Keyboard Shortcuts Integration ---
        
        window.addEventListener("keydown", (e) => {
            // Ignore if user is currently searching/typing in the filter box
            if (document.activeElement.tagName === "INPUT") return;
            
            const key = e.key.toLowerCase();
            
            if (key === "arrowright" || key === "d") {
                // Next image
                const classImages = dataset.images[currentClass] || [];
                if (currentImageIndex < classImages.length - 1) {
                    selectImage(currentImageIndex + 1);
                }
            } 
            else if (key === "arrowleft" || key === "a") {
                // Prev image
                if (currentImageIndex > 0) {
                    selectImage(currentImageIndex - 1);
                }
            } 
            else if (key === "arrowup" || key === "w") {
                // Prev class
                e.preventDefault();
                const clsIdx = dataset.classes.indexOf(currentClass);
                if (clsIdx > 0) {
                    selectClass(dataset.classes[clsIdx - 1]);
                }
            } 
            else if (key === "arrowdown" || key === "s") {
                // Next class
                e.preventDefault();
                const clsIdx = dataset.classes.indexOf(currentClass);
                if (clsIdx < dataset.classes.length - 1 && clsIdx !== -1) {
                    selectClass(dataset.classes[clsIdx + 1]);
                }
            } 
            else if (e.key === "Enter" || e.key === " ") {
                // Save label and advance
                e.preventDefault();
                if (!btnSave.disabled) {
                    saveCurrentLabel();
                }
            } 
            else if (key === "f") {
                // Full frame
                if (currentImageIndex !== -1) {
                    activeBbox = [0.5, 0.5, 1.0, 1.0];
                    drawBoundingBox();
                }
            } 
            else if (key === "c" || e.key === "Delete") {
                // Clear Box
                if (currentImageIndex !== -1) {
                    activeBbox = null;
                    drawBoundingBox();
                }
            } 
            else if (key === "r") {
                // Auto Detect Face
                if (currentImageIndex !== -1 && dataset.opencv_available) {
                    triggerAutoDetect();
                }
            }
        });

        // --- App Initial Load ---
        fetchDataset();
    </script>
</body>
</html>
"""

# ================= RUN SERVER =================

if __name__ == "__main__":
    port = 5000
    print("\n" + "="*70)
    print("      🚀 ANTIGRAVITY YOLO LABELER STUDIO IS RUNNING! 🚀")
    print("="*70)
    print(f"Dataset folder: {ROOT_DIR}")
    print(f"Config file: {CONFIG_FILE}")
    print(f"Local address: http://127.0.0.1:{port}")
    if OPENCV_AVAILABLE:
        print("AI face detection: ACTIVE (OpenCV installed)")
    else:
        print("AI face detection: DISABLED (OpenCV not installed)")
    print("\nTo change the dataset folder:")
    print("  1. Delete 'labeler_config.json' in the script directory")
    print("  2. Run this script again to select a new folder")
    print("\nPress Ctrl+C inside this window to stop the server.")
    print("="*70 + "\n")
    
    app.run(host="127.0.0.1", port=port, debug=True)
