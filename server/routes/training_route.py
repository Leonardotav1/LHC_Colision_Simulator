from flask import Blueprint
from controllers.training_controller import train_neural_network

training_bp = Blueprint("training", __name__, url_prefix="/train")

@training_bp.post("/")
def train():
    return train_neural_network()
