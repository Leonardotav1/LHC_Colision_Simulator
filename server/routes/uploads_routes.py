from flask import Blueprint
from controllers.upload_controller import (
    upload_root_file,
    list_root_files,
    select_root_file,
    active_root_file,
    clear_root_files,
    active_root_stats,
)

# Blueprint para upload de arquivos
upload_bp = Blueprint("upload", __name__, url_prefix="/upload")

@upload_bp.post("/")
def upload():
    return upload_root_file()

@upload_bp.get("/files")
def files():
    return list_root_files()

@upload_bp.post("/select")
def select():
    return select_root_file()

@upload_bp.get("/active")
def active():
    return active_root_file()

@upload_bp.post("/clear")
def clear():
    return clear_root_files()

@upload_bp.get("/stats")
def stats():
    return active_root_stats()
