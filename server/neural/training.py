import numpy as np
from neural.model import build_model
import os
import tensorflow as tf


def train_nn_model():
    # Exemplo simples baseado no seu codigo
    # Substitua pela logica real do seu dataset ROOT se quiser

    n_samples = 2000
    x = np.random.rand(n_samples, 4)
    y = (x.mean(axis=1) > 0.5).astype(int)

    model = build_model(input_dim=4)

    history = model.fit(
        x,
        y,
        epochs=10,
        batch_size=32,
        verbose=0
    )

    save_dir = "trained_models"
    os.makedirs(save_dir, exist_ok=True)

    model_path = os.path.join(save_dir, "nn_model.keras")
    model.save(model_path)

    return {
        "message": "model trained",
        "model_path": model_path,
        "accuracy": float(history.history["accuracy"][-1])
    }
