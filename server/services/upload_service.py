from flask import current_app, request
import os
from werkzeug.utils import secure_filename

def process_root_upload():
    file = request.files.get("file")

    if file is None:
        return {"error": "no file uploaded"}, 400

    if file.filename == "":
        return {"error": "empty filename"}, 400

    upload_folder = current_app.config["UPLOAD_FOLDER"]
    os.makedirs(upload_folder, exist_ok=True)

    filename = secure_filename(file.filename)
    filepath = os.path.join(upload_folder, filename)
    file.save(filepath)

    # Guarda o caminho do ultimo ROOT para a rota /simulate usar
    current_app.config["ROOT_FILE_PATH"] = filepath

    return {
        "status": "ok",
        "filename": filename,
        "path": filepath
    }
