import uproot

file = uproot.open("./upload/Arquivo_lhc.root")

for key in file.keys():
    obj = file[key]
    if isinstance(obj, uproot.behaviors.TTree.TTree):
        print(key)
