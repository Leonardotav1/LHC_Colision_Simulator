import uproot

file = uproot.open("./upload/arquivo.root")

for key in file.keys():
    obj = file[key]
    if isinstance(obj, uproot.behaviors.TTree.TTree):
        print(key)
