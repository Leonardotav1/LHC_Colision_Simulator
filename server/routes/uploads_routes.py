from flask import Blueprint
from controllers.upload_controller import upload_root_file

# Blueprint para upload de arquivos
upload_bp = Blueprint("upload", __name__, url_prefix="/upload")

@upload_bp.post("/")
def upload():
    return upload_root_file()
