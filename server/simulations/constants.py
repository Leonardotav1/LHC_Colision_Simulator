# Core unit system:
# - distances in centimeters
# - momentum in GeV
# - magnetic field in Tesla

# Campo magnetico fixo do CMS (Tesla).
B_FIELD_T = 3.8

# Common conversions
MEV_TO_GEV = 1.0 / 1000.0
M_TO_CM = 100.0

# Geometria cilindrica simplificada (cm), aproximada ao CMS:
# comprimento total ~ 2100 cm e diametro externo ~ 1500 cm.

TRACKER_RADIUS_CM = 125.0
TRACKER_HALF_Z_CM = 290.0

ECAL_RADIUS_CM = 185.0
ECAL_HALF_Z_CM = 350.0

HCAL_RADIUS_CM = 300.0
HCAL_HALF_Z_CM = 430.0

# Mantido por compatibilidade com codigo legado.
CALO_RADIUS_CM = HCAL_RADIUS_CM
CALO_HALF_Z_CM = HCAL_HALF_Z_CM

MUON_RADIUS_CM = 730.0
MUON_HALF_Z_CM = 1050.0

# Visualization defaults in cm
BEAM_Z_CM = 900.0
MIN_AXIS_LIMIT_CM = 800.0
AXIS_PADDING = 1.15

# Baseline trajectory lengths in cm
PHOTON_LENGTH_CM = 500.0
JET_LENGTH_CM = 520.0
MET_SCALE_CM_PER_GEV = 4.0
