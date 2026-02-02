import tensorflow as tf
from keras import layers, models


def build_model(input_dim):
    model = models.Sequential()

    model.add(layers.Dense(64, activation="relu", input_shape=(input_dim,)))
    model.add(layers.Dense(64, activation="relu"))
    model.add(layers.Dense(32, activation="relu"))
    model.add(layers.Dense(1, activation="sigmoid"))

    model.compile(
        optimizer="adam",
        loss="binary_crossentropy",
        metrics=["accuracy"]
    )

    return model
