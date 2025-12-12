from flask import jsonify
from services.training_service import train_model


def train_neural_network():
    try:
        return jsonify(train_model())
    except Exception as e:
        return jsonify({"error": str(e)}), 500
