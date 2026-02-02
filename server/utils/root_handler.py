import os
from flask import jsonify
from werkzeug.utils import secure_filename

def handle_root_upload(request, upload_folder):
    # Caso não tenha nenhum arquivo, retorna o erro
    if "file" not in request.files:
        return jsonify({"error": "no file uploaded"}), 400

    # Armazena o arquivo na variável
    file = request.files["file"]

    # Caso não tenha nada, retona erro
    if file.filename == "":
        return jsonify({"error": "empty filename"}), 400

    # Salva o arquivo na pasta de upload
    filename = secure_filename(file.filename)
    save_path = os.path.join(upload_folder, filename)

    #Salva o arquivo na pasta
    file.save(save_path)

    return jsonify({
        "message": "file uploaded",
        "path": save_path
    })
