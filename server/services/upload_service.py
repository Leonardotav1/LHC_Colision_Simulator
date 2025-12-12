from flask import request

def process_root_upload():
    file = request.files.get("file")

    if file is None:
        return {"error": "no file uploaded"}, 400

    print("Processando arquivo ROOT:", file.filename)

    filepath = f"./uploads/{file.filename}"
    file.save(filepath)

    return {
        "status": "ok",
        "filename": file.filename
    }
