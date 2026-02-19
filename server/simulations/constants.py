# Core unit system:
# - distances in centimeters
# - momentum in GeV
# - magnetic field in Tesla

# Campo magnético usado para curvatura da trilha carregada. 
B_FIELD_T = 2.0

# Common conversions
MEV_TO_GEV = 1.0 / 1000.0
M_TO_CM = 100.0

# Simplified cylindrical detector geometry (cm)
TRACKER_RADIUS_CM = 120.0
TRACKER_HALF_Z_CM = 300.0

CALO_RADIUS_CM = 250.0
CALO_HALF_Z_CM = 600.0

MUON_RADIUS_CM = 700.0
MUON_HALF_Z_CM = 1200.0

# Visualization defaults in cm
BEAM_Z_CM = 800.0
MIN_AXIS_LIMIT_CM = 700.0
AXIS_PADDING = 1.15

# Reco-like smearing disabled (no additional detector noise)
LEPTON_PT_RES_FRAC = 0.0
LEPTON_ETA_RES = 0.0
LEPTON_PHI_RES = 0.0

PHOTON_PT_RES_FRAC = 0.0
JET_PT_RES_FRAC = 0.0

# Baseline trajectory lengths in cm
PHOTON_LENGTH_CM = 500.0
TAU_LENGTH_CM = 150.0
JET_LENGTH_CM = 320.0
MET_SCALE_CM_PER_GEV = 4.0
