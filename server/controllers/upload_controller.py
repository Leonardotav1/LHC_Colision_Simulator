from flask import request
from services.upload_service import process_root_upload


def upload_root_file():
    return process_root_upload()
