from flask import current_app, request
import os
from werkzeug.utils import secure_filename

def _list_root_files(upload_folder):
    if not os.path.isdir(upload_folder):
        return []
    files = []
    for name in os.listdir(upload_folder):
        path = os.path.join(upload_folder, name)
        if os.path.isfile(path) and name.lower().endswith(".root"):
            files.append({
                "filename": name,
                "path": path,
                "size": os.path.getsize(path),
                "mtime": os.path.getmtime(path)
            })
    files.sort(key=lambda x: x["mtime"], reverse=True)
    return files

def _ensure_active_root(upload_folder):
    active = current_app.config.get("ROOT_FILE_PATH")
    if active and os.path.exists(active):
        return active
    files = _list_root_files(upload_folder)
    if not files:
        return None
    active = files[0]["path"]
    current_app.config["ROOT_FILE_PATH"] = active
    return active

def process_root_upload():
    file = request.files.get("file")

    if file is None:
        return {"error": "no file uploaded"}, 400

    if file.filename == "":
        return {"error": "empty filename"}, 400

    upload_folder = current_app.config["UPLOAD_FOLDER"]
    os.makedirs(upload_folder, exist_ok=True)

    previous_active = current_app.config.get("ROOT_FILE_PATH")
    filename = secure_filename(file.filename)
    filepath = os.path.join(upload_folder, filename)
    file.save(filepath)

    # Guarda o caminho do ultimo ROOT para a rota /simulate usar
    current_app.config["ROOT_FILE_PATH"] = filepath

    removed_previous = None
    if previous_active:
        prev_abs = os.path.abspath(previous_active)
        new_abs = os.path.abspath(filepath)
        if prev_abs != new_abs and os.path.exists(prev_abs):
            try:
                os.remove(prev_abs)
                removed_previous = os.path.basename(prev_abs)
            except OSError:
                removed_previous = None

    return {
        "status": "ok",
        "filename": filename,
        "path": filepath,
        "active_filename": filename,
        "removed_previous": removed_previous
    }

def list_uploaded_files():
    upload_folder = current_app.config["UPLOAD_FOLDER"]
    os.makedirs(upload_folder, exist_ok=True)
    files = _list_root_files(upload_folder)
    active = _ensure_active_root(upload_folder)
    active_filename = os.path.basename(active) if active else None
    return {
        "files": [{"filename": f["filename"], "size": f["size"], "mtime": f["mtime"]} for f in files],
        "active_filename": active_filename
    }

def select_active_root():
    data = request.get_json(silent=True) or {}
    filename = data.get("filename")
    if not filename:
        return {"error": "filename is required"}, 400
    upload_folder = current_app.config["UPLOAD_FOLDER"]
    target = os.path.abspath(os.path.join(upload_folder, secure_filename(filename)))
    if not os.path.exists(target):
        return {"error": "file not found"}, 404
    current_app.config["ROOT_FILE_PATH"] = target
    return {"status": "ok", "active_filename": os.path.basename(target)}

def get_active_root():
    upload_folder = current_app.config["UPLOAD_FOLDER"]
    os.makedirs(upload_folder, exist_ok=True)
    active = _ensure_active_root(upload_folder)
    if not active:
        return {"active_filename": None, "path": None}
    return {"active_filename": os.path.basename(active), "path": active}
