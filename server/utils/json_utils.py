import numpy as np

def to_json_safe(obj):
    # dict
    if isinstance(obj, dict):
        return {k: to_json_safe(v) for k, v in obj.items()}

    # list ou tuple
    if isinstance(obj, (list, tuple)):
        return [to_json_safe(v) for v in obj]

    # numpy array
    if isinstance(obj, np.ndarray):
        return obj.tolist()

    # qualquer numero numpy (genérico)
    if isinstance(obj, np.generic):
        return obj.item()

    return obj
