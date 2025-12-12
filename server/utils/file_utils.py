import os

def ensure_dir(path):
    if not os.path.exists(path):
        os.makedirs(path)
    return path


def list_files(folder):
    if not os.path.exists(folder):
        return []
    return os.listdir(folder)
