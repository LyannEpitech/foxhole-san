"""Tunable parameters for the road-extraction pipeline.

Precision > recall: every default here errs on the side of dropping a doubtful
track rather than drawing a road across a beach. All values are starting points;
adjust after reviewing the QA overlays in out/qa/.
"""
from __future__ import annotations

# --- Image geometry -------------------------------------------------------
IMG_W = 1024
IMG_H = 888

# --- Stage A: hex masking -------------------------------------------------
SEAM_ERODE_PX = 6          # erode the hex mask inward before detection

# --- Stage B: colour segmentation (CIELAB, CIE76 dE) ----------------------
# Centroids are auto-calibrated (see calibrate.py) into calibration/palette.json.
# These fallbacks match the fixed Foxhole palette if calibration is skipped.
FALLBACK_PALETTE = {
    "paved":   [82.0, 1.5, 14.0],   # bright cream road
    "dirt":    [74.0, 3.5, 20.0],   # tan track
    "water":   [63.0, -8.0, -14.0], # blue river/sea
    "sand":    [80.0, 3.0, 18.0],   # light beach blob (confuser, ~= paved)
    "terrain": [66.0, 4.0, 22.0],   # generic ground
}

DE_ROAD_PAVED = 10.0       # dE to paved centroid
DE_ROAD_DIRT = 8.0         # dE to dirt centroid (tighter: riskier)
DE_WATER = 22.0            # dE to water centroid (generous hard veto)
WATER_DILATE_PX = 6        # dilate water mask before subtracting (kills coast edges)

# Relative negative-class veto: drop a road-coloured pixel whose *nearest*
# centroid is sand/terrain, but only when that centroid is clearly closer than
# the road centroid by this margin (guards against paved==sand degeneracy).
NEG_VETO_MARGIN = 3.0

# --- Stage C: blob-area veto ----------------------------------------------
BLOB_AREA_PX = 1500        # components larger than this...
BLOB_FILL_RATIO = 0.55     # ...and this bbox-fill are treated as blobs (beaches)
BLOB_INTERIOR_ERODE_PX = 4 # erode blob interior removed before the ridge AND

# --- Stage C: Frangi ridge filter -----------------------------------------
FRANGI_SIGMAS = [1.0, 1.5, 2.0, 2.5, 3.0]
FRANGI_ALPHA = 0.5
FRANGI_BETA = 0.5          # lower punishes blob-like structure harder
FRANGI_GAMMA = None        # None -> skimage auto (half max Hessian norm)
FRANGI_T = 0.40            # min p99-normalised Frangi response to be "linear"

# --- Stage C: white top-hat (thin-bright-line detector) -------------------
# Suppresses large bright regions AND their step-edge boundaries (sandy
# patches, coastlines) that Frangi alone falsely lights up. A road pixel must
# be BOTH a ridge (Frangi) AND a thin bright structure (top-hat).
TOPHAT_SE_PX = 7           # disk radius > max road half-width
TOPHAT_T = 10.0            # min top-hat response (0..255 L scale)

# --- Stage D: binarize + morphology ---------------------------------------
MIN_COMPONENT_AREA_PX = 40
MIN_ROAD_LEN_PX = 40       # skeleton length below which a component is dropped
GAP_CLOSE_PX = 3           # radius of the morphological closing (connect dashes)

# --- Stage D: skeleton graph ----------------------------------------------
SPUR_LEN_PX = 25           # dead-end spurs shorter than this are pruned
BRIDGE_GAP_PX = 6          # bridge degree-1 endpoints closer than this...
BRIDGE_ANGLE_DEG = 35      # ...if their tangents differ by less than this
DP_EPSILON_PX = 1.5        # Douglas-Peucker tolerance (pixels)
MIN_EDGE_LEN_PX = 15       # drop final edges shorter than this

# --- Stage D: tiering (single-class by default per user decision) ----------
TIERS = False              # False -> emit class:"road"; True -> paved/dirt
TIER_PAVED_VOTE = 0.60     # fraction of paved-coloured pixels to call an edge paved

# --- Stage E: cross-hex seam stitching ------------------------------------
BORDER_BAND_PX = 24        # node within this of the hex boundary = "border node"
SEAM_SNAP_PX = 22          # endpoint snap radius, in PIXELS (converted to world)
SEAM_ANGLE_DEG = 45        # max tangent difference to merge across a border

# --- Output ----------------------------------------------------------------
KM_PER_UNIT = 2.2 / 2042   # mirrors src/lib/logistics.ts
CONF_MIN_EMIT = 0.0        # drop edges below this mean roadStrength (0 = keep all)

# Known sandy/coastal hexes — QA regression watchlist (see qa.py).
BEACH_HEXES = [
    "FarranacCoastHex", "EndlessShoreHex", "CallahansPassageHex",
    "TheFingersHex", "StemaLandingHex", "GodcroftsHex", "TempestIslandHex",
]

# Per-region parameter overrides: {hexId: {PARAM_NAME: value}}.
REGION_OVERRIDES: dict[str, dict] = {}
