import pandas as pd
import uproot

EXPECTED_BRANCHES = {"lep_n", "jet_n", "photon_n", "tau_n", "met", "met_phi"}


def _pick_tree_key(root_file, explicit_tree_name=None):
    if explicit_tree_name:
        if explicit_tree_name in root_file:
            return explicit_tree_name

        for key in root_file.keys():
            if key.split(";")[0] == explicit_tree_name:
                return key

        raise KeyError(f"Tree '{explicit_tree_name}' nao encontrada no arquivo ROOT.")

    best_key = None
    best_score = -1

    for key in root_file.keys():
        obj = root_file[key]
        if not isinstance(obj, uproot.behaviors.TTree.TTree):
            continue

        branches = set(obj.keys())
        score = len(EXPECTED_BRANCHES.intersection(branches))
        if score > best_score:
            best_score = score
            best_key = key

    if best_key is None:
        raise ValueError("Nenhuma TTree encontrada no arquivo ROOT.")

    return best_key


def read_root_file(path, tree_name=None):
    with uproot.open(path) as root_file:
        selected_tree_key = _pick_tree_key(root_file, tree_name)
        tree = root_file[selected_tree_key]
        df = tree.arrays(library="pd")
    return df
