from flask import jsonify

def success(data, code=200):
    return jsonify({
        "status": "ok",
        "data": data
    }), code


def error(message, code=400):
    return jsonify({
        "status": "error",
        "message": message
    }), code
