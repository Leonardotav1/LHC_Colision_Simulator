import uproot
import pandas as pd

def read_root_file(path, tree_name="analysis;1"):
    
    # Lê o arquivo ROOT e retorna um DataFrame pandas
    with uproot.open(path) as file:
        tree = file[tree_name]
        df = tree.arrays(library="pd")
        for event in df.itertuples():
            print("Evento:", event.Index, "n_leptons:", event.lep_n)
    return df
