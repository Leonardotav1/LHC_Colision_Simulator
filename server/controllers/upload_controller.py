from flask import request
from services.upload_service import (
    process_root_upload,
    list_uploaded_files,
    select_active_root,
    get_active_root,
    clear_uploaded_files,
    get_active_root_stats,
)


def upload_root_file():
    return process_root_upload()

def list_root_files():
    return list_uploaded_files()

def select_root_file():
    return select_active_root()

def active_root_file():
    return get_active_root()

def clear_root_files():
    return clear_uploaded_files()

def active_root_stats():
    return get_active_root_stats()
