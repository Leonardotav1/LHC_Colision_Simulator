import os
from flask import jsonify
from werkzeug.utils import secure_filename


def handle_root_upload(request, upload_folder):
    if "file" not in request.files:
        return jsonify({"error": "no file uploaded"}), 400

    file = request.files["file"]

    if file.filename == "":
        return jsonify({"error": "empty filename"}), 400

    filename = secure_filename(file.filename)
    save_path = os.path.join(upload_folder, filename)

    file.save(save_path)

    return jsonify({
        "message": "file uploaded",
        "path": save_path
    })
