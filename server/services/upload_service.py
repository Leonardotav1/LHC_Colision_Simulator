from flask import request
import os

def process_root_upload():
    file = request.files.get("file")

    if file is None:
        return {"error": "no file uploaded"}, 400

    print("Processando arquivo ROOT:", file.filename)

    upload_folder = "./upload/"
    if not os.path.exists(upload_folder):
        os.makedirs(upload_folder)

    filepath = os.path.join(upload_folder, file.filename)

    file.save(filepath)

    return {
        "status": "ok",
        "filename": file.filename
    }
