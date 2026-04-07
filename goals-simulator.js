// Normalize old [x, y] waypoint/exclusive format to new ['-', x, y]
function normalizePoints(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map(p =>
    Array.isArray(p) && p.length === 2 ? ["-", p[0], p[1]] : p
  );
}

function parseDefaultConfigs(inputData) {
  try {
    console.log("Parsing configs...");
    // Use inputData if provided, otherwise parse defaultSimulationConfigList
    let parsedData;
    if (inputData) {
      parsedData = inputData; // Assume inputData is already an object or array
      // If it's the full config object with 'goals' array (from config.json)
      if (Array.isArray(parsedData)) {
        // It's likely just the goals array
        parsedData = { goals: parsedData };
      } else if (parsedData.goals && Array.isArray(parsedData.goals)) {
        // It's the full config object
        parsedData = { goals: parsedData.goals };
      } else if (!parsedData.goals) {
        // Try to wrap it if it looks like a list of configs
        parsedData = { goals: parsedData };
      }
    } else {
      // defaultSimulationConfigList is already a JS object
      parsedData = typeof defaultSimulationConfigList === 'string'
        ? JSON.parse(defaultSimulationConfigList)
        : JSON.parse(JSON.stringify(defaultSimulationConfigList));
    }

    console.log(
      "Parsed data has",
      parsedData.goals?.length || 0,
      "configs"
    );

    if (
      parsedData &&
      parsedData.goals &&
      Array.isArray(parsedData.goals)
    ) {
      return parsedData.goals.map((config, index) => {
        const boundaries = config.boundary || [-6, 6, -6, 6];
        const walls = [];

        // Convert wall array [vertical, horizontal] to wall objects
        if (config.wall && config.wall.length >= 2) {
          const [verticalWall, horizontalWall] = config.wall;

          if (verticalWall !== null) {
            walls.push({
              type: "vertical",
              x1: verticalWall,
              y1: boundaries[2] - 5, // ymin - 5
              x2: verticalWall,
              y2: boundaries[3] + 5, // ymax + 5
            });
          }

          if (horizontalWall !== null) {
            walls.push({
              type: "horizontal",
              x1: boundaries[0] - 5, // xmin - 5
              y1: horizontalWall,
              x2: boundaries[1] + 5, // xmax + 5
              y2: horizontalWall,
            });
          }
        }

        // Convert targets to grids format
        const grids = [config.initial_positions || []];
        const gridSteps = [0]; // Starting position
        const gridWaypoints = [[]]; // Starting grid has no waypoints
        const gridExclusivePoints = [[]]; // Starting grid has no exclusive points

        if (config.targets && Array.isArray(config.targets)) {
          config.targets.forEach((target) => {
            if (Array.isArray(target) && target.length >= 4) {
              const [steps, robots, exclusive, waypoints] = target;
              grids.push(robots || []);
              gridSteps.push(steps || 5);
              gridWaypoints.push(normalizePoints(waypoints || []));
              gridExclusivePoints.push(normalizePoints(exclusive || []));
            }
          });
        }

        // Ensure at least one target grid
        if (grids.length < 2) {
          grids.push([]);
          gridSteps.push(5);
          gridWaypoints.push([]);
          gridExclusivePoints.push([]);
        }

        // Calculate total steps
        const totalSteps = gridSteps
          .slice(1)
          .reduce((sum, steps) => sum + steps, 0);

        return {
          id: `cfg-default-${Date.now()}-${index}`,
          grids,
          steps: totalSteps,
          gridSteps,
          gridWaypoints,
          gridExclusivePoints,
          boundaries: {
            xmin: boundaries[0],
            xmax: boundaries[1],
            ymin: boundaries[2],
            ymax: boundaries[3],
          },
          walls,
          needsRedraw: true,
        };
      });
    } else {
      throw new Error(
        "Invalid JSON format. Expected object with 'goals' array."
      );
    }
  } catch (error) {
    console.error("Error parsing configurations:", error);
    // Fallback to empty array
    return [];
  }
}

// Initialize with empty array - will be populated in initialize()
// MAKE THIS GLOBAL so it's accessible from handleFormSubmit()
window.activeSimulationConfigs = [];

// EXPOSE FUNCTION TO LOAD GOALS
window.loadGoalsIntoSimulator = function (goalsData) {
  console.log("Loading goals into simulator:", goalsData);
  window.activeSimulationConfigs = parseDefaultConfigs(goalsData);
  renderAllFrames();
  updateFullConfigTextArea();
};
// --- Initial Data ---
/* let activeSimulationConfigs = [
{
  id: `cfg-${Date.now()}-0`,
    [
      ["O", 0, 0],
      ["F", 0, 1],
      ["R", -1, 1],
    ],
    [
      ["O", 0, 0],
      ["R", -2, 1],
      ["F", -1, 1],
    ],
  ],
  steps: 1,
  boundaries: { xmin: -3, xmax: 1, ymin: -1, ymax: 2 },
  waypoints: [],
  exclusive_points: [],
},
{
  id: `cfg-${Date.now()}-1`,
  grids: [
    [
      ["O", 0, 0],
      ["F", 0, 1],
      ["L", -1, 1],
    ],
    [
      ["O", 0, 0],
      ["L", -2, 1],
      ["F", -1, 1],
    ],
  ],
  steps: 1,
  boundaries: { xmin: -3, xmax: 1, ymin: -1, ymax: 2 },
  waypoints: [],
  exclusive_points: [],
},
].map((cfg) => ({ ...cfg, needsRedraw: true }));
*/
// --- Constants and Config ---
const FRAME_CANVAS_SIZE = 300;
const FRAME_SCALE = 25;
const FRAME_OFFSET = FRAME_CANVAS_SIZE / 2;
const simConfig = {
  colors: {
    L: "#FF0000",
    R: "#008000",
    F: "#0000FF",
    O: "#FFA500",
    r: "#FF0000",
    g: "#008000",
    b: "#0000FF",
    o: "#FFA500",
    B: "#0000FF",
    G: "#008000",
    Y: "#FFFF00",
    P: "#800080",
    y: "#FFFF00",
    p: "#800080",
    W: "#333",
    w: "#333",
  },
  boundaryColor: "#666",
  boundaryWidth: 2,
  robotRadius: 8,
  boundaryHitThreshold: 10,
  waypointColor: "#0c2c67",
  exclusivePointColor: "#0c2c67",
  waypointRadius: 8,
  exclusivePointRadius: 8,
};
const SCROLL_ZONE_HEIGHT = 60;
const SCROLL_SPEED = 10;

// --- Global State Variables ---
let frameElements = {};
let draggedItem = null;
let draggedRobotData = null;
let draggedWaypointData = null;
let draggedExclusivePointData = null;
let draggedBoundaryEdge = null;
let sourceCanvasElement = null;
let sourceConfigId = null;
let sourceGridIndex = -1;
let sourceRobotsListRef = null;
let sourceWaypointsListRef = null;
let sourceExclusivePointsListRef = null;
let draggedRobotIndex = -1;
let draggedWaypointIndex = -1;
let draggedExclusivePointIndex = -1;
let isNewRobotFromPalette = false;
let isNewWaypointFromPalette = false;
let isNewExclusivePointFromPalette = false;
let isNewWallFromPalette = false;
let draggedWallData = null;
let draggedFrameId = null;
let dropIndicator = null;
let scrollIntervalId = null;
let currentPaletteDragSource = null;

// --- Element References ---
const simulatorColumn = document.getElementById("simulator-column");
const simulationConfigListTextArea = document.getElementById(
  "simulationConfigList"
);
const dragGhost = document.getElementById("dragGhost");
const boundaryGhost = document.getElementById("boundaryGhost");
const loadModal = document.getElementById("loadModal");
const newConfigEditor = document.getElementById("newConfigEditor");
const addFrameBtn = document.getElementById("addFrameBtn");
const resizeHandle = document.getElementById("resizeHandle");
const toggleEditorBtn = document.getElementById("toggleEditorBtn");
const editorColumn = document.getElementById("editor-column");
const mainContainer = document.querySelector(".main-container");

// --- Help Modal Elements ---
const parametersHelpBtn = document.getElementById("parametersHelpBtn");
const parametersHelpModal = document.getElementById("parametersHelpModal");
const closeParametersHelpModal = document.getElementById("closeParametersHelpModal");

const goalsHelpBtn = document.getElementById("goalsHelpBtn");
const goalsHelpModal = document.getElementById("goalsHelpModal");
const closeHelpModal = document.getElementById("closeHelpModal");

// Open Parameters help modal
if (parametersHelpBtn) {
  parametersHelpBtn.addEventListener("click", () => {
    parametersHelpModal.style.display = "block";
  });
}

// Close Parameters help modal
if (closeParametersHelpModal) {
  closeParametersHelpModal.addEventListener("click", () => {
    parametersHelpModal.style.display = "none";
  });
}

// Close Parameters help modal when clicking outside
if (parametersHelpModal) {
  parametersHelpModal.addEventListener("click", (e) => {
    if (e.target === parametersHelpModal) {
      parametersHelpModal.style.display = "none";
    }
  });
}

// Open Goals help modal
if (goalsHelpBtn) {
  goalsHelpBtn.addEventListener("click", () => {
    goalsHelpModal.style.display = "block";
  });
}

// Close Goals help modal
if (closeHelpModal) {
  closeHelpModal.addEventListener("click", () => {
    goalsHelpModal.style.display = "none";
  });
}

// Close Goals help modal when clicking outside
if (goalsHelpModal) {
  goalsHelpModal.addEventListener("click", (e) => {
    if (e.target === goalsHelpModal) {
      goalsHelpModal.style.display = "none";
    }
  });
}

// Close help modals with Escape key
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (parametersHelpModal && parametersHelpModal.style.display === "block") {
      parametersHelpModal.style.display = "none";
    }
    if (goalsHelpModal && goalsHelpModal.style.display === "block") {
      goalsHelpModal.style.display = "none";
    }
  }
});

// Disable Add Goal and Reset Goals buttons if canEdit is false
if (!canEdit) {
  const addFrameBtn = document.getElementById("addFrameBtn");
  const resetConfigBtn = document.getElementById("resetConfigBtn");

  if (addFrameBtn) {
    addFrameBtn.disabled = true;
    addFrameBtn.style.opacity = "0.5";
    addFrameBtn.style.cursor = "not-allowed";
    addFrameBtn.title = "Editing is disabled";
  }

  if (resetConfigBtn) {
    resetConfigBtn.disabled = true;
    resetConfigBtn.style.opacity = "0.5";
    resetConfigBtn.style.cursor = "not-allowed";
    resetConfigBtn.title = "Editing is disabled";
  }
}

// --- Resize and Toggle Variables ---
let isResizing = false;
let isEditorHidden = true; // Changed to true - hidden by default
const LAYOUT_STORAGE_KEY = "multiRobotSimLayout_v1";

// --- Helper Functions ---
function frameWorldToCanvas(x, y) {
  return {
    cx: FRAME_OFFSET + x * FRAME_SCALE,
    cy: FRAME_OFFSET - y * FRAME_SCALE,
  };
}
function frameCanvasToWorld(cx, cy) {
  return {
    x: (cx - FRAME_OFFSET) / FRAME_SCALE,
    y: (FRAME_OFFSET - cy) / FRAME_SCALE,
  };
}
function isWithinBoundaries(x, y, frameBoundaries) {
  if (!frameBoundaries) return false;
  return (
    x >= frameBoundaries.xmin &&
    x <= frameBoundaries.xmax &&
    y >= frameBoundaries.ymin &&
    y <= frameBoundaries.ymax
  );
}

function distancePointToLine(px, py, x1, y1, x2, y2) {
  const A = px - x1;
  const B = py - y1;
  const C = x2 - x1;
  const D = y2 - y1;

  const dot = A * C + B * D;
  const lenSq = C * C + D * D;

  if (lenSq === 0) return Math.sqrt(A * A + B * B);

  let param = dot / lenSq;

  if (param < 0) {
    return Math.sqrt(A * A + B * B);
  } else if (param > 1) {
    const E = px - x2;
    const F = py - y2;
    return Math.sqrt(E * E + F * F);
  } else {
    const closestX = x1 + param * C;
    const closestY = y1 + param * D;
    const dx = px - closestX;
    const dy = py - closestY;
    return Math.sqrt(dx * dx + dy * dy);
  }
}

// --- Drawing Functions ---
function drawGridLines(ctx) {
  if (!ctx) return;
  ctx.clearRect(0, 0, FRAME_CANVAS_SIZE, FRAME_CANVAS_SIZE);
  ctx.strokeStyle = "#e8e8e8";
  ctx.lineWidth = 1;
  ctx.setLineDash([]);
  const gridRange = 6;
  for (let i = -gridRange; i <= gridRange; i++) {
    if (i === 0) continue;
    const { cx } = frameWorldToCanvas(i, 0);
    ctx.beginPath();
    ctx.moveTo(cx + 0.5, 0);
    ctx.lineTo(cx + 0.5, FRAME_CANVAS_SIZE);
    ctx.stroke();
    const { cy } = frameWorldToCanvas(0, i);
    ctx.beginPath();
    ctx.moveTo(0, cy + 0.5);
    ctx.lineTo(FRAME_CANVAS_SIZE, cy + 0.5);
    ctx.stroke();
  }
  ctx.strokeStyle = "#b0b0b0";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, FRAME_OFFSET + 0.5);
  ctx.lineTo(FRAME_CANVAS_SIZE, FRAME_OFFSET + 0.5);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(FRAME_OFFSET + 0.5, 0);
  ctx.lineTo(FRAME_OFFSET + 0.5, FRAME_CANVAS_SIZE);
  ctx.stroke();
}
function drawBoundaries(ctx, frameBoundaries, rotation = 0) {
  if (!ctx || !frameBoundaries) return;

  ctx.save();
  // Apply rotation if specified
  if (rotation) {
    ctx.translate(CANVAS_CENTER_X, CANVAS_CENTER_Y);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.translate(-CANVAS_CENTER_X, -CANVAS_CENTER_Y);
  }

  ctx.strokeStyle = simConfig.boundaryColor;
  ctx.lineWidth = simConfig.boundaryWidth;
  ctx.setLineDash([5, 3]);
  const { cx: xmin_cx } = frameWorldToCanvas(frameBoundaries.xmin, 0);
  const { cx: xmax_cx } = frameWorldToCanvas(frameBoundaries.xmax, 0);
  const { cy: ymin_cy } = frameWorldToCanvas(0, frameBoundaries.ymin);
  const { cy: ymax_cy } = frameWorldToCanvas(0, frameBoundaries.ymax);
  ctx.strokeRect(
    xmin_cx,
    ymax_cy,
    xmax_cx - xmin_cx,
    ymin_cy - ymax_cy
  );
  ctx.setLineDash([]);

  ctx.restore();
}
function drawRobots(ctx, robots, frameBoundaries, rotation = 0) {
  if (!ctx || !robots) return;

  ctx.save();
  // Apply rotation if specified
  if (rotation) {
    ctx.translate(CANVAS_CENTER_X, CANVAS_CENTER_Y);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.translate(-CANVAS_CENTER_X, -CANVAS_CENTER_Y);
  }

  robots.forEach(([color, x, y]) => {
    const { cx, cy } = frameWorldToCanvas(x, y);
    const isInBounds = isWithinBoundaries(x, y, frameBoundaries);

    // Draw circle - prioritize letterColorMap for user-modified colors
    ctx.fillStyle = letterColorMap[color] || simConfig.colors[color] || "gray";
    ctx.beginPath();
    ctx.arc(cx, cy, simConfig.robotRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = isInBounds ? "#000" : "#e53935";
    ctx.lineWidth = isInBounds ? 2 : 2;
    ctx.stroke();

    // Draw letter inside
    ctx.fillStyle = "#fff";
    ctx.font = "bold 14px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(color, cx, cy);
  });

  ctx.restore();
}

// Helper: draw a pie-chart circle using all robot colors, used for '*' (mixed) points
function drawAllColorsPie(ctx, cx, cy, radius) {
  const colors = Object.values(letterColorMap);
  if (colors.length === 0) {
    ctx.fillStyle = '#888';
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  // Clip to the circle so sector edges never bleed outside
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.clip();
  const angleStep = (Math.PI * 2) / colors.length;
  const eps = 0.02; // tiny overlap to close sub-pixel gaps between sectors
  for (let i = 0; i < colors.length; i++) {
    ctx.fillStyle = colors[i];
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius + 1, i * angleStep - Math.PI / 2, (i + 1) * angleStep - Math.PI / 2 + eps);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

// Canvas-pixel offset applied to '*' waypoints that share a cell with a robot
const MIXED_WP_OFFSET_PX = 6;

function drawWaypoints(ctx, waypoints, frameBoundaries, rotation = 0, robots = []) {
  if (!ctx || !waypoints) return;

  ctx.save();
  // Apply rotation if specified
  if (rotation) {
    ctx.translate(CANVAS_CENTER_X, CANVAS_CENTER_Y);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.translate(-CANVAS_CENTER_X, -CANVAS_CENTER_Y);
  }

  waypoints.forEach((waypoint) => {
    // Support both old format [x, y] and new format [char, x, y]
    let char, x, y;
    if (waypoint.length === 3 && typeof waypoint[0] === 'string') {
      [char, x, y] = waypoint;
    } else if (waypoint.length === 2) {
      // Old format [x, y] - treat as general waypoint with "-"
      char = '-';
      [x, y] = waypoint;
    } else {
      // Default fallback
      char = '-';
      x = 0;
      y = 0;
    }

    const { cx: rawCx, cy: rawCy } = frameWorldToCanvas(x, y);
    // For any non-general waypoint co-located with a robot, offset so both are visible
    const hasRobotHere = char !== '-' && robots.some(([, rx, ry]) => rx === x && ry === y);
    const cx = hasRobotHere ? rawCx + MIXED_WP_OFFSET_PX : rawCx;
    const cy = hasRobotHere ? rawCy - MIXED_WP_OFFSET_PX : rawCy;
    const isInBounds = isWithinBoundaries(x, y, frameBoundaries);

    // Draw circle background
    const size = simConfig.waypointRadius;
    let bgColor;
    if (char === '*') {
      // Mixed point: draw all robot colors as pie sectors
      drawAllColorsPie(ctx, cx, cy, size);
      bgColor = '#333'; // neutral color used for the hollow hole
    } else {
      bgColor = (char && char !== '-') ? (letterColorMap[char] || simConfig.waypointColor) : "#000000";
      ctx.fillStyle = bgColor;
      ctx.beginPath();
      ctx.arc(cx, cy, size, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw filled white pin icon
    const pR = size * 0.45;           // head circle radius
    const headCy = cy - size * 0.38;  // center y of pin head
    const tipY = cy + size * 0.68;    // tip y

    // Compute tangent points from head circle to tip
    const d = tipY - headCy;
    const sinA = pR / d;
    const cosA = Math.sqrt(1 - sinA * sinA);
    const endAngle = Math.atan2(sinA, cosA);
    const startAngle = Math.atan2(sinA, -cosA);

    // Filled white pin shape
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(cx, headCy, pR, endAngle, startAngle, true); // arc through top
    ctx.lineTo(cx, tipY);   // left tangent → tip
    ctx.closePath();        // tip → right tangent
    ctx.fill();

    // Hollow hole: draw bgColor filled circle over pin head center
    ctx.fillStyle = bgColor;
    ctx.beginPath();
    ctx.arc(cx, headCy, pR * 0.42, 0, Math.PI * 2);
    ctx.fill();

    // Border around badge circle
    ctx.strokeStyle = isInBounds ? "#333" : "#e53935";
    ctx.lineWidth = isInBounds ? 1.5 : 2;
    ctx.beginPath();
    ctx.arc(cx, cy, size, 0, Math.PI * 2);
    ctx.stroke();
  });

  ctx.restore();
}

function drawExclusivePoints(
  ctx,
  exclusivePoints,
  frameBoundaries,
  rotation = 0
) {
  if (!ctx || !exclusivePoints) return;

  ctx.save();
  // Apply rotation if specified
  if (rotation) {
    ctx.translate(CANVAS_CENTER_X, CANVAS_CENTER_Y);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.translate(-CANVAS_CENTER_X, -CANVAS_CENTER_Y);
  }

  exclusivePoints.forEach((exclusivePoint) => {
    // Support both old format [x, y] and new format [char, x, y]
    let char, x, y;
    if (exclusivePoint.length === 3 && typeof exclusivePoint[0] === 'string') {
      [char, x, y] = exclusivePoint;
    } else if (exclusivePoint.length === 2) {
      // Old format [x, y] - treat as general exclusive point with "-"
      char = '-';
      [x, y] = exclusivePoint;
    } else {
      // Default fallback
      char = '-';
      x = 0;
      y = 0;
    }

    const { cx, cy } = frameWorldToCanvas(x, y);
    const isInBounds = isWithinBoundaries(x, y, frameBoundaries);

    // Draw circle background - use color-specific background if char is not "-"
    const size = simConfig.exclusivePointRadius;
    if (char === '*') {
      // Mixed point: draw all robot colors as pie sectors
      drawAllColorsPie(ctx, cx, cy, size);
    } else {
      if (char && char !== '-') {
        ctx.fillStyle = letterColorMap[char] || simConfig.exclusivePointColor;
      } else {
        ctx.fillStyle = "#000000";
      }
      ctx.beginPath();
      ctx.arc(cx, cy, size, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw X inside
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx - size * 0.6, cy - size * 0.6);
    ctx.lineTo(cx + size * 0.6, cy + size * 0.6);
    ctx.moveTo(cx + size * 0.6, cy - size * 0.6);
    ctx.lineTo(cx - size * 0.6, cy + size * 0.6);
    ctx.stroke();

    // Border
    ctx.strokeStyle = isInBounds ? "#333" : "#e53935";
    ctx.lineWidth = isInBounds ? 1.5 : 2;
    ctx.beginPath();
    ctx.arc(cx, cy, size, 0, Math.PI * 2);
    ctx.stroke();
  });

  ctx.restore();
}

function drawWalls(ctx, walls, frameBoundaries, rotation = 0) {
  if (!ctx || !walls) return;

  ctx.save();
  // Apply rotation if specified
  if (rotation) {
    ctx.translate(FRAME_OFFSET, FRAME_OFFSET);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.translate(-FRAME_OFFSET, -FRAME_OFFSET);
  }

  // Find all intersection points
  const intersections = [];
  for (let i = 0; i < walls.length; i++) {
    for (let j = i + 1; j < walls.length; j++) {
      const wall1 = walls[i];
      const wall2 = walls[j];

      const intersection = findWallIntersection(wall1, wall2);
      if (intersection) {
        intersections.push({
          x: intersection.x,
          y: intersection.y,
          wall1: wall1,
          wall2: wall2,
        });
      }
    }
  }

  // Draw each wall, trimming at intersections
  walls.forEach((wall) => {
    // Find intersections that affect this wall
    const wallIntersections = intersections.filter(
      (intersection) =>
        intersection.wall1 === wall || intersection.wall2 === wall
    );

    if (wallIntersections.length === 0) {
      // No intersections, draw the full wall
      const { cx: cx1, cy: cy1 } = frameWorldToCanvas(wall.x1, wall.y1);
      const { cx: cx2, cy: cy2 } = frameWorldToCanvas(wall.x2, wall.y2);

      ctx.strokeStyle = "#000";
      ctx.lineWidth = 4;
      ctx.lineCap = "butt";
      ctx.beginPath();
      ctx.moveTo(cx1, cy1);
      ctx.lineTo(cx2, cy2);
      ctx.stroke();
    } else {
      // Find the closest intersection point to trim the wall
      let startPoint = { x: wall.x1, y: wall.y1 };
      let endPoint = { x: wall.x2, y: wall.y2 };

      // For each intersection, determine which arm to keep.
      // We always use (0,0) as the reference origin (never the boundary center).
      //
      // Vertical wall at x=wx, clipped by horizontal wall at y=wy (intersection = (wx, wy)):
      //   wy ≤ 0 → corner is in lower half → keep UPPER arm (y > wy) → replace START (y1→wy)
      //   wy > 0 → corner is in upper half → keep LOWER arm (y < wy) → replace END   (y2→wy)
      //
      // Horizontal wall at y=wy, clipped by vertical wall at x=wx (intersection = (wx, wy)):
      //   wx > 0 → corner is in right half → keep RIGHT arm (x > wx) → replace START (x1→wx)
      //   wx ≤ 0 → corner is in left  half → keep LEFT  arm (x < wx) → replace END   (x2→wx)
      wallIntersections.forEach((intersection) => {
        const intPoint = { x: intersection.x, y: intersection.y };

        const isHorizontal = (wall.y1 === wall.y2);
        // Use (0,0) as origin reference:
        // Horizontal wall at y=wy, clipped at x=wx:
        //   wx ≤ 0 → corner on left side → keep RIGHT arm → replace START
        //   wx > 0 → corner on right side → keep LEFT arm  → replace END
        // Vertical wall at x=wx, clipped at y=wy:
        //   wy ≤ 0 → corner on bottom → keep UPPER arm → replace START
        //   wy > 0 → corner on top    → keep LOWER arm → replace END
        const shouldReplaceStart = isHorizontal
          ? (intPoint.x <= 0)  // horizontal: replace START when corner is on left/negative side
          : (intPoint.y <= 0); // vertical:   replace START when corner is on bottom/negative side

        if (shouldReplaceStart) {
          // Replace start with intersection (arm extends from corner toward axis maximum)
          if (isHorizontal) {
            // Horizontal wall
            if (
              intPoint.x >= Math.min(wall.x1, wall.x2) &&
              intPoint.x <= Math.max(wall.x1, wall.x2)
            ) {
              startPoint = intPoint;
            }
          } else {
            // Vertical wall
            if (
              intPoint.y >= Math.min(wall.y1, wall.y2) &&
              intPoint.y <= Math.max(wall.y1, wall.y2)
            ) {
              startPoint = intPoint;
            }
          }
        } else {
          // Replace end with intersection (arm extends from axis minimum to corner)
          if (isHorizontal) {
            // Horizontal wall
            if (
              intPoint.x >= Math.min(wall.x1, wall.x2) &&
              intPoint.x <= Math.max(wall.x1, wall.x2)
            ) {
              endPoint = intPoint;
            }
          } else {
            // Vertical wall
            if (
              intPoint.y >= Math.min(wall.y1, wall.y2) &&
              intPoint.y <= Math.max(wall.y1, wall.y2)
            ) {
              endPoint = intPoint;
            }
          }
        }
      });

      // Draw the trimmed wall
      const { cx: cx1, cy: cy1 } = frameWorldToCanvas(
        startPoint.x,
        startPoint.y
      );
      const { cx: cx2, cy: cy2 } = frameWorldToCanvas(
        endPoint.x,
        endPoint.y
      );

      ctx.strokeStyle = "#000";
      ctx.lineWidth = 4;
      ctx.lineCap = "butt";
      ctx.beginPath();
      ctx.moveTo(cx1, cy1);
      ctx.lineTo(cx2, cy2);
      ctx.stroke();
    }
  });

  // Draw small squares at intersection points for better corner visualization
  intersections.forEach((intersection) => {
    const { cx, cy } = frameWorldToCanvas(
      intersection.x,
      intersection.y
    );

    ctx.fillStyle = "#000";
    ctx.fillRect(cx - 2, cy - 2, 4, 4);
  });

  ctx.restore();
}

// Helper function to find intersection between two walls
function findWallIntersection(wall1, wall2) {
  const { x1: x1a, y1: y1a, x2: x2a, y2: y2a } = wall1;
  const { x1: x1b, y1: y1b, x2: x2b, y2: y2b } = wall2;

  // Check if wall1 is horizontal and wall2 is vertical
  if (y1a === y2a && x1b === x2b) {
    const wallY = y1a;
    const wallX = x1b;

    // Check if intersection point is within both wall segments
    if (
      wallX >= Math.min(x1a, x2a) &&
      wallX <= Math.max(x1a, x2a) &&
      wallY >= Math.min(y1b, y2b) &&
      wallY <= Math.max(y1b, y2b)
    ) {
      return { x: wallX, y: wallY };
    }
  }

  // Check if wall1 is vertical and wall2 is horizontal
  if (x1a === x2a && y1b === y2b) {
    const wallX = x1a;
    const wallY = y1b;

    // Check if intersection point is within both wall segments
    if (
      wallX >= Math.min(x1b, x2b) &&
      wallX <= Math.max(x1b, x2b) &&
      wallY >= Math.min(y1a, y2a) &&
      wallY <= Math.max(y1a, y2a)
    ) {
      return { x: wallX, y: wallY };
    }
  }

  return null;
}

// --- Core Frame Rendering and Updating ---
function redrawFrame(configId) {
  const frameData = frameElements[configId];
  const config = activeSimulationConfigs.find((c) => c.id === configId);
  if (!frameData || !config) return;

  const boundaries = config.boundaries || {
    xmin: -6,
    xmax: 6,
    ymin: -6,
    ymax: 6,
  };
  const rotation = config.rotation || 0;

  // Redraw each canvas for the frame
  frameData.canvases.forEach((canvas, gridIndex) => {
    const ctx = canvas.getContext("2d");
    const robots = config.grids[gridIndex] || [];
    const gridWaypoints =
      (config.gridWaypoints && config.gridWaypoints[gridIndex]) || [];
    const gridExclusivePoints =
      (config.gridExclusivePoints &&
        config.gridExclusivePoints[gridIndex]) ||
      [];

    drawGridLines(ctx);
    drawBoundaries(ctx, boundaries, rotation);
    drawWaypoints(ctx, gridWaypoints, boundaries, rotation, robots);
    drawExclusivePoints(ctx, gridExclusivePoints, boundaries, rotation);
    drawWalls(ctx, config.walls || [], boundaries, rotation);
    drawRobots(ctx, robots, boundaries, rotation);
  });

  // Update boundary info text
  const boundsInfo = frameData.frameDiv.querySelector(".boundary-info");
  if (boundsInfo) {
    boundsInfo.querySelector("span.xmin").textContent = boundaries.xmin;
    boundsInfo.querySelector("span.xmax").textContent = boundaries.xmax;
    boundsInfo.querySelector("span.ymin").textContent = boundaries.ymin;
    boundsInfo.querySelector("span.ymax").textContent = boundaries.ymax;
  }
  if (frameData.stepsInput) {
    frameData.stepsInput.value = config.steps;
  }
  config.needsRedraw = false;
}

function createFrameElement(configData, index) {
  const frameDiv = document.createElement("div");
  frameDiv.className = "simulation-frame";
  frameDiv.dataset.configId = configData.id;
  frameDiv.draggable = true;

  // --- Header ---
  const headerDiv = document.createElement("div");
  headerDiv.className = "frame-header";
  const dragHandle = document.createElement("div");
  dragHandle.className = "drag-handle";
  dragHandle.title = "Drag to reorder frames";
  const title = document.createElement("h4");

  // Calculate total steps for the title
  let totalSteps = 0;
  if (configData.gridSteps && configData.gridSteps.length > 1) {
    totalSteps = configData.gridSteps
      .slice(1)
      .reduce((sum, steps) => sum + steps, 0);
  } else if (configData.steps) {
    totalSteps = configData.steps;
  }

  // Add title text (normal color)
  title.textContent = `Simulation ${index + 1
    } (Total Steps: ${totalSteps})`;

  const rotateBtn = document.createElement("button");
  rotateBtn.className = "btn btn-light btn-sm rotate-btn";
  rotateBtn.title = "Rotate frame 90°";
  rotateBtn.innerHTML = `<svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
            <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
        </svg>`;
  rotateBtn.onclick = () => rotateFrame(configData.id);
  const closeBtn = document.createElement("button");
  closeBtn.className = "close-frame-btn";
  closeBtn.innerHTML = `<svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
        </svg>`;
  closeBtn.title = "Close this simulation frame";
  closeBtn.onclick = () => closeFrame(configData.id);

  // Disable close button if not in edit mode
  if (!canEdit) {
    closeBtn.disabled = true;
    closeBtn.style.opacity = '0.5';
    closeBtn.style.cursor = 'not-allowed';
    closeBtn.title = 'Edit mode required';
  }
  headerDiv.append(dragHandle, title, rotateBtn, closeBtn);
  frameDiv.appendChild(headerDiv);

  // --- Grids Wrapper ---
  const gridsWrapper = document.createElement("div");
  gridsWrapper.className = "grids-wrapper";
  frameDiv.appendChild(gridsWrapper);

  // --- Canvas Creation ---
  const boundaries = configData.boundaries || {
    xmin: -6,
    xmax: 6,
    ymin: -6,
    ymax: 6,
  };
  const canvases = [];

  (configData.grids || []).forEach((grid, gridIndex) => {
    const container = document.createElement("div");
    container.className = "frame-canvas-container";
    container.dataset.gridIndex = gridIndex;
    container.dataset.configId = configData.id;

    // Create title with proper naming
    const titleDiv = document.createElement("h5");
    if (gridIndex === 0) {
      titleDiv.textContent = "Starting Position";
    } else {
      titleDiv.textContent = `Target ${gridIndex}`;
    }
    container.appendChild(titleDiv);

    // Add delete button (only show for target grids, not starting position, and only if more than 2 total grids)
    if (gridIndex > 0 && configData.grids.length > 2) {
      const deleteBtn = document.createElement("button");
      deleteBtn.className = "grid-delete-btn";
      deleteBtn.innerHTML = "×";
      deleteBtn.title = "Delete this grid";
      deleteBtn.onclick = (e) => {
        e.stopPropagation();
        deleteGrid(configData.id, gridIndex);
      };
      container.appendChild(deleteBtn);
    }
    const canvas = document.createElement("canvas");
    canvas.id = `canvas-${configData.id}-${gridIndex}`;
    canvas.width = FRAME_CANVAS_SIZE;
    canvas.height = FRAME_CANVAS_SIZE;
    canvas.dataset.gridIndex = gridIndex; // Store index
    container.appendChild(canvas);
    canvases.push(canvas);

    // Add boundary info only to the first canvas
    if (gridIndex === 0) {
      const boundsInfo = document.createElement("div");
      boundsInfo.className = "boundary-info";
      boundsInfo.innerHTML = `Bounds: x:[<span class="xmin">${boundaries.xmin}</span>,<span class="xmax">${boundaries.xmax}</span>] y:[<span class="ymin">${boundaries.ymin}</span>,<span class="ymax">${boundaries.ymax}</span>]`;
      container.appendChild(boundsInfo);
    } else {
      // Add step control for non-starting grids (positioned like boundary info)
      const stepsContainer = document.createElement("div");
      stepsContainer.className = "grid-steps-control";
      stepsContainer.style.cssText = `
              font-family: monospace;
              font-size: 0.8em;
              color: #5f6b7a;
              margin-top: 5px;
              text-align: center;
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 5px;
            `;

      const stepsLabel = document.createElement("label");
      stepsLabel.textContent = "Steps:";
      stepsLabel.style.cssText = "margin: 0; font-weight: 500;";

      const stepsInput = document.createElement("input");
      stepsInput.type = "number";
      stepsInput.min = "0";
      stepsInput.value =
        (configData.gridSteps && configData.gridSteps[gridIndex]) || 5;
      stepsInput.style.cssText = `
              width: 50px;
              padding: 2px 4px;
              border: 1px solid #ccc;
              border-radius: 3px;
              font-size: 0.8em;
              font-family: monospace;
            `;
      // Simulation goal steps should be editable when canEdit is true
      if (!canEdit) {
        stepsInput.disabled = true;
        stepsInput.style.opacity = "0.5";
        stepsInput.style.cursor = "not-allowed";
      }
      stepsInput.addEventListener("change", (e) => {
        updateGridSteps(
          configData.id,
          gridIndex,
          parseInt(e.target.value) || 0
        );
      });

      stepsContainer.appendChild(stepsLabel);
      stepsContainer.appendChild(stepsInput);
      container.appendChild(stepsContainer);
    }
    gridsWrapper.appendChild(container);
    canvas.addEventListener("mousedown", handleCanvasMouseDown);
  });

  // --- Add Grid Button ---
  const addGridContainer = document.createElement("div");
  addGridContainer.className = "add-grid-btn-container";
  const addGridBtn = document.createElement("button");
  addGridBtn.className = "add-grid-btn";
  addGridBtn.innerHTML = `<svg width="24" height="24" fill="currentColor" viewBox="0 0 24 24">
            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
        </svg>`;
  addGridBtn.title = "Add new grid";
  addGridBtn.onclick = () => addNewGrid(configData.id);
  if (!canEdit) {
    addGridBtn.disabled = true;
    addGridBtn.style.opacity = "0.5";
    addGridBtn.style.cursor = "not-allowed";
  }
  addGridContainer.appendChild(addGridBtn);
  gridsWrapper.appendChild(addGridContainer);

  // --- Store References ---
  frameElements[configData.id] = {
    frameDiv,
    canvases,
    titleElement: title,
  };

  // --- Attach Frame Drag Listeners ---
  frameDiv.addEventListener("mousedown", (e) => {
    const handle = e.target.closest(".drag-handle");
    frameDiv.dataset.dragReady = handle ? "true" : "false";
  });
  frameDiv.addEventListener("dragstart", handleFrameDragStart);
  frameDiv.addEventListener("dragend", handleFrameDragEnd);

  return frameDiv;
}

function renderAllFrames() {
  const palette = simulatorColumn.querySelector(".robot-palette");
  if (!palette) return;

  // Store scroll positions of grids wrappers before re-rendering
  const scrollPositions = {};
  const existingFrames =
    simulatorColumn.querySelectorAll(".simulation-frame");
  existingFrames.forEach((frame) => {
    const configId = frame.dataset.configId;
    const gridsWrapper = frame.querySelector(".grids-wrapper");
    if (gridsWrapper && configId) {
      scrollPositions[configId] = gridsWrapper.scrollLeft;
    }
  });

  // Clear existing frames
  const framesToRemove =
    simulatorColumn.querySelectorAll(".simulation-frame");
  framesToRemove.forEach((frame) => simulatorColumn.removeChild(frame));
  frameElements = {};

  // Create and append frames
  activeSimulationConfigs.forEach((config, index) => {
    const frameDiv = createFrameElement(config, index);
    simulatorColumn.appendChild(frameDiv);
    redrawFrame(config.id);

    // Restore scroll position for this frame's grids wrapper
    if (scrollPositions[config.id] !== undefined) {
      const gridsWrapper = frameDiv.querySelector(".grids-wrapper");
      if (gridsWrapper) {
        // Use setTimeout to ensure DOM is fully rendered before setting scroll
        setTimeout(() => {
          gridsWrapper.scrollLeft = scrollPositions[config.id];
        }, 0);
      }
    }
  });

  updateFullConfigTextArea();
  saveConfigsToLocalStorage();
}

function addNewGrid(configId) {
  if (!canEdit) return;
  const config = activeSimulationConfigs.find(
    (cfg) => cfg.id === configId
  );
  if (config) {
    if (!config.grids) {
      config.grids = [];
    }
    config.grids.push([]); // Add a new empty grid

    // Initialize or extend gridSteps array
    if (!config.gridSteps) {
      config.gridSteps = Array(config.grids.length).fill(0);
      config.gridSteps[1] = 5; // Default for first target
    } else {
      config.gridSteps.push(5); // Default step count for new grid
    }

    // Update total steps
    const totalSteps = config.gridSteps
      .slice(1)
      .reduce((sum, steps) => sum + steps, 0);
    config.steps = totalSteps;

    // Instead of full re-render, just update this specific frame
    updateSingleFrame(configId);
  }
}

function deleteGrid(configId, gridIndex) {
  const config = activeSimulationConfigs.find(
    (cfg) => cfg.id === configId
  );
  if (
    config &&
    config.grids &&
    config.grids.length > 2 &&
    gridIndex > 0
  ) {
    // Remove the grid at the specified index
    config.grids.splice(gridIndex, 1);

    // Also remove corresponding gridSteps entry
    if (config.gridSteps && config.gridSteps.length > gridIndex) {
      config.gridSteps.splice(gridIndex, 1);
    }

    // Remove corresponding gridWaypoints entry
    if (
      config.gridWaypoints &&
      config.gridWaypoints.length > gridIndex
    ) {
      config.gridWaypoints.splice(gridIndex, 1);
    }

    // Remove corresponding gridExclusivePoints entry
    if (
      config.gridExclusivePoints &&
      config.gridExclusivePoints.length > gridIndex
    ) {
      config.gridExclusivePoints.splice(gridIndex, 1);
    }

    // Update total steps
    if (config.gridSteps) {
      const totalSteps = config.gridSteps
        .slice(1)
        .reduce((sum, steps) => sum + steps, 0);
      config.steps = totalSteps;
    }

    // Update this specific frame
    updateSingleFrame(configId);
  }
}

function updateSingleFrame(configId) {
  const config = activeSimulationConfigs.find(
    (cfg) => cfg.id === configId
  );
  const frameData = frameElements[configId];
  if (!config || !frameData) return;

  // Store current scroll position
  const gridsWrapper =
    frameData.frameDiv.querySelector(".grids-wrapper");
  const currentScrollLeft = gridsWrapper ? gridsWrapper.scrollLeft : 0;

  // Get the grids wrapper to update
  if (gridsWrapper) {
    // Clear existing canvas containers (but keep the add button)
    const existingContainers = gridsWrapper.querySelectorAll(
      ".frame-canvas-container"
    );
    existingContainers.forEach((container) => container.remove());

    // Re-create canvas containers for all grids
    const boundaries = config.boundaries || {
      xmin: -6,
      xmax: 6,
      ymin: -6,
      ymax: 6,
    };
    const newCanvases = [];

    config.grids.forEach((grid, gridIndex) => {
      const container = document.createElement("div");
      container.className = "frame-canvas-container";
      container.dataset.gridIndex = gridIndex;
      container.dataset.configId = config.id;

      // Create title with proper naming
      const titleDiv = document.createElement("h5");
      if (gridIndex === 0) {
        titleDiv.textContent = "Starting Position";
      } else {
        titleDiv.textContent = `Target ${gridIndex}`;
      }
      container.appendChild(titleDiv);

      // Add delete button (only show for target grids, not starting position, and only if more than 2 total grids)
      if (gridIndex > 0 && config.grids.length > 2) {
        const deleteBtn = document.createElement("button");
        deleteBtn.className = "grid-delete-btn";
        deleteBtn.innerHTML = "×";
        deleteBtn.title = "Delete this grid";
        deleteBtn.onclick = (e) => {
          e.stopPropagation();
          deleteGrid(config.id, gridIndex);
        };
        container.appendChild(deleteBtn);
      }
      const canvas = document.createElement("canvas");
      canvas.id = `canvas-${config.id}-${gridIndex}`;
      canvas.width = FRAME_CANVAS_SIZE;
      canvas.height = FRAME_CANVAS_SIZE;
      canvas.dataset.gridIndex = gridIndex;
      container.appendChild(canvas);
      newCanvases.push(canvas);

      // Add boundary info only to the first canvas
      if (gridIndex === 0) {
        const boundsInfo = document.createElement("div");
        boundsInfo.className = "boundary-info";
        boundsInfo.style.cssText = `
                font-family: monospace;
                font-size: 0.8em;
                color: #5f6b7a;
                margin-top: 5px;
                text-align: center;
              `;
        boundsInfo.innerHTML = `Bounds: x:[<span class="xmin">${boundaries.xmin}</span>,<span class="xmax">${boundaries.xmax}</span>] y:[<span class="ymin">${boundaries.ymin}</span>,<span class="ymax">${boundaries.ymax}</span>]`;
        container.appendChild(boundsInfo);
      } else {
        // Add step control for non-starting grids (positioned like boundary info)
        const stepsContainer = document.createElement("div");
        stepsContainer.className = "grid-steps-control";
        stepsContainer.style.cssText = `
                font-family: monospace;
                font-size: 0.8em;
                color: #5f6b7a;
                margin-top: 5px;
                text-align: center;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 5px;
              `;

        const stepsLabel = document.createElement("label");
        stepsLabel.textContent = "Steps:";
        stepsLabel.style.cssText = "margin: 0; font-weight: 500;";

        const stepsInput = document.createElement("input");
        stepsInput.type = "number";
        stepsInput.min = "0";
        stepsInput.value =
          (config.gridSteps && config.gridSteps[gridIndex]) || 5;
        stepsInput.style.cssText = `
                width: 50px;
                padding: 2px 4px;
                border: 1px solid #ccc;
                border-radius: 3px;
                font-size: 0.8em;
                font-family: monospace;
              `;
        // Simulation goal steps should be editable when canEdit is true
        if (!canEdit) {
          stepsInput.disabled = true;
          stepsInput.style.opacity = "0.5";
          stepsInput.style.cursor = "not-allowed";
        }
        stepsInput.addEventListener("change", (e) => {
          updateGridSteps(
            config.id,
            gridIndex,
            parseInt(e.target.value) || 0
          );
        });

        stepsContainer.appendChild(stepsLabel);
        stepsContainer.appendChild(stepsInput);
        container.appendChild(stepsContainer);
      }

      // Insert before the add button
      const addGridContainer = gridsWrapper.querySelector(
        ".add-grid-btn-container"
      );
      gridsWrapper.insertBefore(container, addGridContainer);
      canvas.addEventListener("mousedown", handleCanvasMouseDown);
    });

    // Update stored canvas references
    frameData.canvases = newCanvases;

    // Redraw all canvases for this frame
    redrawFrame(configId);

    // Restore scroll position immediately
    gridsWrapper.scrollLeft = currentScrollLeft;
  }

  // Update the text area and save
  updateFullConfigTextArea();
  saveConfigsToLocalStorage();
}

function closeFrame(configId) {
  activeSimulationConfigs = activeSimulationConfigs.filter(
    (cfg) => cfg.id !== configId
  );
  delete frameElements[configId];
  renderAllFrames();
}

function updateSteps(configId, newValue) {
  const config = activeSimulationConfigs.find(
    (cfg) => cfg.id === configId
  );
  if (config) {
    config.steps = Math.max(0, newValue);
    if (frameElements[configId]?.stepsInput) {
      frameElements[configId].stepsInput.value = config.steps;
    }
    updateFullConfigTextArea();
  }
}

function updateGridSteps(configId, gridIndex, newValue) {
  const config = activeSimulationConfigs.find(
    (cfg) => cfg.id === configId
  );
  if (config) {
    // Initialize gridSteps if it doesn't exist
    if (!config.gridSteps) {
      config.gridSteps = Array(config.grids.length).fill(0);
      config.gridSteps[1] = 5; // Default for first target
    }

    // Update the specific grid's steps
    config.gridSteps[gridIndex] = Math.max(0, newValue);

    // Calculate total steps (sum of all grid steps except starting position)
    const totalSteps = config.gridSteps
      .slice(1)
      .reduce((sum, steps) => sum + steps, 0);
    config.steps = totalSteps;

    // Update frame title to show total steps
    updateFrameTitle(configId);

    updateFullConfigTextArea();
    saveConfigsToLocalStorage();
  }
}

function updateFrameTitle(configId) {
  const config = activeSimulationConfigs.find(
    (cfg) => cfg.id === configId
  );
  if (config && frameElements[configId]?.titleElement) {
    const frameIndex =
      activeSimulationConfigs.findIndex((cfg) => cfg.id === configId) +
      1;
    const totalSteps = config.steps || 0;

    // Update title text
    frameElements[configId].titleElement.textContent = `Simulation ${frameIndex} (Total Steps: ${totalSteps})`;
  }
}

// --- Editor Display (Shows Full List, Read-Only) ---
function updateFullConfigTextArea() {
  if (!simulationConfigListTextArea) return;
  if (activeSimulationConfigs.length === 0) {
    simulationConfigListTextArea.value = JSON.stringify(
      {
        goals: [],
      },
      null,
      2
    );
    return;
  }

  try {
    // Generate JSON format (existing logic)
    const simulationConfigs = activeSimulationConfigs.map((config) => {
      const boundaries = config.boundaries || {
        xmin: -6,
        xmax: 6,
        ymin: -6,
        ymax: 6,
      };
      const grids = config.grids || [];
      const gridSteps = config.gridSteps || [];
      const gridWaypoints = config.gridWaypoints || [];
      const gridExclusivePoints = config.gridExclusivePoints || [];
      const walls = config.walls || [];

      // Find vertical and horizontal walls
      let verticalWall = null,
        horizontalWall = null;
      walls.forEach((wall) => {
        if (wall.type === "vertical") {
          verticalWall = wall.x1; // x position of vertical wall
        } else if (wall.type === "horizontal") {
          horizontalWall = wall.y1; // y position of horizontal wall
        }
      });

      // Format grids: starting grid as initial_positions, targets with steps, exclusive points, and waypoints
      let initialPositions = [];
      let targets = [];

      if (grids.length > 0) {
        // Starting position (first grid)
        initialPositions = grids[0].map(([color, x, y]) => [
          color,
          x,
          y,
        ]);

        // Target grids with steps, exclusive points, and waypoints (remaining grids)
        for (let i = 1; i < grids.length; i++) {
          const steps = (gridSteps && gridSteps[i]) || 5;
          const robots = grids[i].map(([color, x, y]) => [color, x, y]);
          const exclusivePoints = (gridExclusivePoints[i] || []).map(
            (point) => {
              // Support both old [x, y] and new [char, x, y] format
              if (point.length === 3 && typeof point[0] === 'string') {
                return [point[0], point[1], point[2]];
              }
              // Old format - use "-" as default char
              return ["-", point[0], point[1]];
            }
          );
          const waypoints = (gridWaypoints[i] || []).map((point) => {
            // Support both old [x, y] and new [char, x, y] format
            if (point.length === 3 && typeof point[0] === 'string') {
              return [point[0], point[1], point[2]];
            }
            // Old format - use "-" as default char
            return ["-", point[0], point[1]];
          });
          targets.push([steps, robots, exclusivePoints, waypoints]);
        }
      }

      return {
        initial_positions: initialPositions,
        targets: targets,
        boundary: [
          boundaries.xmin,
          boundaries.xmax,
          boundaries.ymin,
          boundaries.ymax,
        ],
        wall: [verticalWall, horizontalWall],
        // is_essential removed - not needed in output
      };
    });

    const fullConfig = {
      goals: simulationConfigs,
    };

    // Custom JSON stringify to keep position arrays on single lines
    const customStringify = (obj, indent = 0) => {
      const spaces = "  ".repeat(indent);

      if (Array.isArray(obj)) {
        // Check if this is a position array (contains [color, x, y] tuples)
        const isPositionArray =
          obj.length > 0 &&
          obj.every(
            (item) =>
              Array.isArray(item) &&
              item.length === 3 &&
              typeof item[0] === "string" &&
              typeof item[1] === "number" &&
              typeof item[2] === "number"
          );

        // Check if this is a boundary array (4 numbers)
        const isBoundaryArray =
          obj.length === 4 &&
          obj.every((item) => typeof item === "number");

        // Check if this is a wall array (2 values, can be null or number)
        const isWallArray =
          obj.length === 2 &&
          obj.every(
            (item) => item === null || typeof item === "number"
          );

        if (isPositionArray) {
          // Format position arrays on single line
          return (
            "[" +
            obj
              .map(
                (pos) =>
                  `[${JSON.stringify(pos[0])}, ${pos[1]}, ${pos[2]}]`
              )
              .join(", ") +
            "]"
          );
        } else if (isBoundaryArray || isWallArray) {
          // Format boundary and wall arrays on single line
          return (
            "[" +
            obj
              .map((item) => (item === null ? "null" : item))
              .join(", ") +
            "]"
          );
        } else {
          // Check if this is a targets array with position sub-arrays
          const isTargetsArray =
            obj.length > 0 &&
            obj.every(
              (item) =>
                Array.isArray(item) &&
                item.length >= 2 &&
                Array.isArray(item[1])
            );

          if (isTargetsArray) {
            // Format targets array with proper indentation but keep position sub-arrays on single lines
            const items = obj.map((target) => {
              const [steps, robots, exclusive, waypoints] = target;
              const robotsStr = Array.isArray(robots)
                ? "[" +
                robots
                  .map(
                    (pos) =>
                      `[${JSON.stringify(pos[0])}, ${pos[1]}, ${pos[2]
                      }]`
                  )
                  .join(", ") +
                "]"
                : JSON.stringify(robots);
              const exclusiveStr = Array.isArray(exclusive)
                ? "[" +
                exclusive
                  .map((pos) => {
                    // Support both old [x, y] and new [char, x, y] format
                    if (pos.length === 3 && typeof pos[0] === 'string') {
                      return `[${JSON.stringify(pos[0])}, ${pos[1]}, ${pos[2]}]`;
                    }
                    // Old format - use "-" as default char
                    return `[${JSON.stringify("-")}, ${pos[0]}, ${pos[1]}]`;
                  })
                  .join(", ") +
                "]"
                : JSON.stringify(exclusive);
              const waypointsStr = Array.isArray(waypoints)
                ? "[" +
                waypoints
                  .map((pos) => {
                    // Support both old [x, y] and new [char, x, y] format
                    if (pos.length === 3 && typeof pos[0] === 'string') {
                      return `[${JSON.stringify(pos[0])}, ${pos[1]}, ${pos[2]}]`;
                    }
                    // Old format - use "-" as default char
                    return `[${JSON.stringify("-")}, ${pos[0]}, ${pos[1]}]`;
                  })
                  .join(", ") +
                "]"
                : JSON.stringify(waypoints);

              return `${spaces}  [${steps}, ${robotsStr}, ${exclusiveStr}, ${waypointsStr}]`;
            });
            return "[\n" + items.join(",\n") + `\n${spaces}]`;
          } else {
            // Regular array formatting
            const items = obj.map((item) =>
              customStringify(item, indent)
            );
            return (
              "[\n" +
              items.map((item) => spaces + "  " + item).join(",\n") +
              `\n${spaces}]`
            );
          }
        }
      } else if (typeof obj === "object" && obj !== null) {
        const entries = Object.entries(obj);
        const items = entries.map(([key, value]) => {
          const formattedValue = customStringify(value, indent + 1);
          return `${spaces}  "${key}": ${formattedValue}`;
        });
        return "{\n" + items.join(",\n") + `\n${spaces}}`;
      } else {
        return JSON.stringify(obj);
      }
    };

    simulationConfigListTextArea.value = customStringify(fullConfig);
  } catch (error) {
    console.error("Error formatting config for text area:", error);
    simulationConfigListTextArea.value = JSON.stringify(
      {
        error: "Error generating configuration JSON.",
      },
      null,
      2
    );
  }
}

// --- Rotation Helper Functions ---
function rotate_point(x, y, angle) {
  // angle: 0, 90, 180, 270
  switch (angle) {
    case 0:
      return [x, y];
    case 90:
      return [y, -x];
    case 180:
      return [-x, -y];
    case 270:
      return [-y, x];
    default:
      return [x, y];
  }
}

function nextAngle(angle) {
  // 0 -> 90 -> 180 -> 270 -> 0
  return (angle + 90) % 360;
}

function rotateFrame(configId) {
  const config = activeSimulationConfigs.find(
    (cfg) => cfg.id === configId
  );
  if (!config) return;

  const oldRotation = config.rotation || 0;
  const newRotation = nextAngle(oldRotation);
  const rotationDelta = newRotation - oldRotation;

  // Transform ALL coordinate data
  if (config.grids) {
    config.grids.forEach((grid) => {
      for (let i = 0; i < grid.length; i++) {
        const [color, x, y] = grid[i];
        const [newX, newY] = rotate_point(x, y, rotationDelta);
        grid[i] = [color, newX, newY];
      }
    });
  }

  // Transform waypoints if they exist (per-grid format)
  if (config.gridWaypoints) {
    config.gridWaypoints.forEach((waypoints, gridIndex) => {
      if (waypoints && waypoints.length > 0) {
        config.gridWaypoints[gridIndex] = waypoints.map((waypoint) => {
          if (waypoint.length === 2) {
            // Old format [x, y]
            const [x, y] = waypoint;
            const [newX, newY] = rotate_point(x, y, rotationDelta);
            return [newX, newY];
          } else if (waypoint.length === 4) {
            // New format [symbol, x, y, direction]
            const [symbol, x, y, direction] = waypoint;
            const [newX, newY] = rotate_point(x, y, rotationDelta);
            const newDirection = (direction + rotationDelta) % 360;
            return [symbol, newX, newY, newDirection];
          }
          return waypoint;
        });
      }
    });
  }

  // Transform exclusive points if they exist (per-grid format)
  if (config.gridExclusivePoints) {
    config.gridExclusivePoints.forEach((exclusivePoints, gridIndex) => {
      if (exclusivePoints && exclusivePoints.length > 0) {
        config.gridExclusivePoints[gridIndex] = exclusivePoints.map(
          (exclusivePoint) => {
            if (exclusivePoint.length === 2) {
              // Old format [x, y]
              const [x, y] = exclusivePoint;
              const [newX, newY] = rotate_point(x, y, rotationDelta);
              return [newX, newY];
            } else if (exclusivePoint.length === 4) {
              // New format [symbol, x, y, direction]
              const [symbol, x, y, direction] = exclusivePoint;
              const [newX, newY] = rotate_point(x, y, rotationDelta);
              const newDirection = (direction + rotationDelta) % 360;
              return [symbol, newX, newY, newDirection];
            }
            return exclusivePoint;
          }
        );
      }
    });
  }

  // Transform waypoints if they exist (legacy format)
  if (config.waypoints) {
    config.waypoints = config.waypoints.map(([x, y]) => {
      const [newX, newY] = rotate_point(x, y, rotationDelta);
      return [newX, newY];
    });
  }

  // Transform exclusive points if they exist (legacy format)
  if (config.exclusive_points) {
    config.exclusive_points = config.exclusive_points.map(([x, y]) => {
      const [newX, newY] = rotate_point(x, y, rotationDelta);
      return [newX, newY];
    });
  }

  // Transform walls if they exist
  if (config.walls) {
    config.walls = config.walls.map((wall) => {
      const [newX1, newY1] = rotate_point(
        wall.x1,
        wall.y1,
        rotationDelta
      );
      const [newX2, newY2] = rotate_point(
        wall.x2,
        wall.y2,
        rotationDelta
      );

      // Determine new wall type based on rotation
      const isHorizontal =
        Math.abs(newX2 - newX1) > Math.abs(newY2 - newY1);

      return {
        type: isHorizontal ? "horizontal" : "vertical",
        x1: newX1,
        y1: newY1,
        x2: newX2,
        y2: newY2,
      };
    });
  }

  // Transform boundaries
  if (config.boundaries) {
    const { xmin, xmax, ymin, ymax } = config.boundaries;

    // Get all four corners
    const corners = [
      [xmin, ymin],
      [xmax, ymin],
      [xmax, ymax],
      [xmin, ymax],
    ];

    // Rotate all corners
    const rotatedCorners = corners.map(([x, y]) =>
      rotate_point(x, y, rotationDelta)
    );

    // Find new boundaries
    const allX = rotatedCorners.map(([x, y]) => x);
    const allY = rotatedCorners.map(([x, y]) => y);

    config.boundaries = {
      xmin: Math.min(...allX),
      xmax: Math.max(...allX),
      ymin: Math.min(...allY),
      ymax: Math.max(...allY),
    };
  }

  // Reset rotation to 0 since coordinates are transformed
  config.rotation = 0;

  // Redraw the frame - use renderAllFrames to ensure frameElements are properly set up
  renderAllFrames();
  updateFullConfigTextArea();
  saveConfigsToLocalStorage();
}

// --- Drag Event Handlers (Robot/Boundary) ---
function getFrameConfigFromElement(element) {
  const frameDiv = element.closest(".simulation-frame");
  if (!frameDiv) return null;
  const configId = frameDiv.dataset.configId;
  return activeSimulationConfigs.find((cfg) => cfg.id === configId);
}

function handlePaletteDragStart(e) {
  if (!canEdit) {
    e.preventDefault();
    return;
  }
  const paletteElement = e.target.closest(
    ".palette-robot, .palette-waypoint, .palette-exclusive-point, .palette-wall-horizontal, .palette-wall-vertical"
  );
  if (!paletteElement) return;

  currentPaletteDragSource = paletteElement;
  const color = paletteElement.dataset.color;
  const type = paletteElement.dataset.type;

  if (type === "waypoint") {
    // Waypoint drag
    draggedItem = "waypoint";
    // Get the color from the palette element (default to "-" for general waypoint)
    const waypointColor = paletteElement.dataset.color || "-";
    draggedWaypointData = [waypointColor, 0, 0];
    isNewWaypointFromPalette = true;
    sourceCanvasElement = null;
    sourceConfigId = null;

    // Use color-specific background if not general ("-")
    if (waypointColor === '*') {
      // All-colors-mixed: use conic-gradient with pin icon overlay
      const _colors = Object.values(letterColorMap);
      const _step = _colors.length > 0 ? (100 / _colors.length) : 100;
      const _stops = _colors.map((c, i) => `${c} ${i * _step}% ${(i + 1) * _step}%`).join(', ');
      const _pinSvg = `url('data:image/svg+xml;utf8,<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="%23ffffff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>') center/contain no-repeat`;
      dragGhost.style.background = _colors.length > 0 ? `${_pinSvg}, conic-gradient(${_stops})` : '#888';
      dragGhost.style.backgroundColor = '';
    } else {
      const waypointBgColor = waypointColor !== "-"
        ? (letterColorMap[waypointColor] || simConfig.waypointColor)
        : "#000000";
      dragGhost.style.background = '';
      dragGhost.style.backgroundColor = waypointBgColor;
    }
    dragGhost.style.display = "block";
    dragGhost.style.left = `${e.clientX}px`;
    dragGhost.style.top = `${e.clientY}px`;
    dragGhost.style.width = `${simConfig.waypointRadius * 2}px`;
    dragGhost.style.height = `${simConfig.waypointRadius * 2}px`;
    dragGhost.style.borderRadius = "50%";
    dragGhost.style.transform = "translate(-50%, -50%)";
  } else if (type === "exclusive_point") {
    // Exclusive point drag
    draggedItem = "exclusive_point";
    // Get the color from the palette element (default to "-" for general exclusive point)
    const exclusiveColor = paletteElement.dataset.color || "-";
    draggedExclusivePointData = [exclusiveColor, 0, 0];
    isNewExclusivePointFromPalette = true;
    sourceCanvasElement = null;
    sourceConfigId = null;

    // Use color-specific background if not general ("-")
    if (exclusiveColor === '*') {
      // All-colors-mixed: use conic-gradient with X icon overlay
      const _colors = Object.values(letterColorMap);
      const _step = _colors.length > 0 ? (100 / _colors.length) : 100;
      const _stops = _colors.map((c, i) => `${c} ${i * _step}% ${(i + 1) * _step}%`).join(', ');
      const _xSvg = `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="%23fff" viewBox="0 0 16 16"><path d="M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8 2.146 2.854Z"/></svg>') center/contain no-repeat`;
      dragGhost.style.background = _colors.length > 0 ? `${_xSvg}, conic-gradient(${_stops})` : '#888';
      dragGhost.style.backgroundColor = '';
    } else {
      const exclusiveBgColor = exclusiveColor !== "-"
        ? (letterColorMap[exclusiveColor] || simConfig.exclusivePointColor)
        : "#000000";
      dragGhost.style.background = '';
      dragGhost.style.backgroundColor = exclusiveBgColor;
    }
    dragGhost.style.display = "block";
    dragGhost.style.left = `${e.clientX}px`;
    dragGhost.style.top = `${e.clientY}px`;
    dragGhost.style.width = `${simConfig.exclusivePointRadius * 2}px`;
    dragGhost.style.height = `${simConfig.exclusivePointRadius * 2}px`;
    dragGhost.style.borderRadius = "50%";
    dragGhost.style.transform = "translate(-50%, -50%)";
  } else if (type === "wall_horizontal") {
    // Horizontal wall drag
    draggedItem = "wall_horizontal";
    draggedWallData = {
      type: "horizontal",
      x1: 0,
      y1: 0,
      x2: 1,
      y2: 0,
    };
    isNewWallFromPalette = true;
    sourceCanvasElement = null;
    sourceConfigId = null;

    dragGhost.style.backgroundColor = "#000";
    dragGhost.style.display = "block";
    dragGhost.style.left = `${e.clientX}px`;
    dragGhost.style.top = `${e.clientY}px`;
    dragGhost.style.width = "30px";
    dragGhost.style.height = "4px";
    dragGhost.style.borderRadius = "2px";
    dragGhost.style.transform = "translate(-50%, -50%)";
  } else if (type === "wall_vertical") {
    // Vertical wall drag
    draggedItem = "wall_vertical";
    draggedWallData = { type: "vertical", x1: 0, y1: 0, x2: 0, y2: 1 };
    isNewWallFromPalette = true;
    sourceCanvasElement = null;
    sourceConfigId = null;

    dragGhost.style.backgroundColor = "#000";
    dragGhost.style.display = "block";
    dragGhost.style.left = `${e.clientX}px`;
    dragGhost.style.top = `${e.clientY}px`;
    dragGhost.style.width = "4px";
    dragGhost.style.height = "30px";
    dragGhost.style.borderRadius = "2px";
    dragGhost.style.transform = "translate(-50%, -50%)";
  } else if (color) {
    // Robot drag (palette-robot elements have color but no type)
    draggedItem = "robot";
    draggedRobotData = [color, 0, 0];
    isNewRobotFromPalette = true;
    sourceCanvasElement = null;
    sourceConfigId = null;
    sourceGridIndex = -1;
    sourceRobotsListRef = null;
    draggedRobotIndex = -1;

    dragGhost.style.backgroundColor = letterColorMap[color] || simConfig.colors[color] || "gray";
    dragGhost.style.display = "block";
    dragGhost.style.left = `${e.clientX}px`;
    dragGhost.style.top = `${e.clientY}px`;
    dragGhost.style.width = `${simConfig.robotRadius * 2}px`;
    dragGhost.style.height = `${simConfig.robotRadius * 2}px`;
    dragGhost.style.borderRadius = "50%";
    dragGhost.style.transform = "translate(-50%, -50%)";
  }

  e.preventDefault();
  document.addEventListener("mousemove", handleDragMove);
  document.addEventListener("mouseup", handleDragEnd, { once: true });
}

function handleCanvasMouseDown(e) {
  if (!canEdit) return;
  const canvas = e.target;
  const config = getFrameConfigFromElement(canvas);
  if (!config) return;
  if (!config.boundaries) {
    config.boundaries = { xmin: -6, xmax: 6, ymin: -6, ymax: 6 };
    config.needsRedraw = true;
  }

  const rect = canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;
  const gridIndex = parseInt(canvas.dataset.gridIndex, 10);

  // Check for Boundary Drag
  const boundaryEdge = getBoundaryEdgeAtPosition(
    mouseX,
    mouseY,
    config.boundaries
  );
  if (boundaryEdge) {
    draggedItem = "boundary";
    draggedBoundaryEdge = boundaryEdge;
    sourceConfigId = config.id;
    sourceCanvasElement = canvas;
    boundaryGhost.style.display = "block";
    updateBoundaryGhostPosition(e.clientX, e.clientY, canvas, rect);
    document.addEventListener("mousemove", handleDragMove);
    document.addEventListener("mouseup", handleDragEnd, { once: true });
    return;
  }

  // Check for Waypoint Drag
  const gridWaypoints =
    (config.gridWaypoints && config.gridWaypoints[gridIndex]) || [];
  for (let i = gridWaypoints.length - 1; i >= 0; i--) {
    // Support both old [x, y] and new [char, x, y] format
    let wX, wY;
    if (gridWaypoints[i].length === 3 && typeof gridWaypoints[i][0] === 'string') {
      [, wX, wY] = gridWaypoints[i];
    } else {
      [wX, wY] = gridWaypoints[i];
    }
    const { cx: waypointCX, cy: waypointCY } = frameWorldToCanvas(wX, wY);
    // For any non-general waypoint co-located with a robot, hit-test against the offset position
    const wpChar = gridWaypoints[i].length === 3 ? gridWaypoints[i][0] : '-';
    const currentRobots = config.grids[gridIndex] || [];
    const wpHasRobot = wpChar !== '-' && currentRobots.some(([, rx, ry]) => rx === wX && ry === wY);
    const hitCX = wpHasRobot ? waypointCX + MIXED_WP_OFFSET_PX : waypointCX;
    const hitCY = wpHasRobot ? waypointCY - MIXED_WP_OFFSET_PX : waypointCY;
    const distance = Math.sqrt(
      (mouseX - hitCX) ** 2 + (mouseY - hitCY) ** 2
    );

    if (distance <= simConfig.waypointRadius + 2) {
      draggedItem = "waypoint";
      draggedWaypointData = [...gridWaypoints[i]];
      isNewWaypointFromPalette = false;
      sourceConfigId = config.id;
      sourceGridIndex = gridIndex;
      sourceCanvasElement = canvas;
      sourceWaypointsListRef = gridWaypoints;
      draggedWaypointIndex = i;

      dragGhost.style.backgroundColor = simConfig.waypointColor;
      dragGhost.style.display = "block";
      dragGhost.style.left = `${e.clientX}px`;
      dragGhost.style.top = `${e.clientY}px`;
      dragGhost.style.width = `${simConfig.waypointRadius * 2}px`;
      dragGhost.style.height = `${simConfig.waypointRadius * 2}px`;
      dragGhost.style.borderRadius = "50%";
      dragGhost.style.transform = "translate(-50%, -50%)";
      canvas.classList.add("dragging-source-canvas");

      // Remove waypoint from source grid
      gridWaypoints.splice(i, 1);
      redrawFrame(config.id);

      document.addEventListener("mousemove", handleDragMove);
      document.addEventListener("mouseup", handleDragEnd, {
        once: true,
      });
      return;
    }
  }

  // Check for Exclusive Point Drag
  const gridExclusivePoints =
    (config.gridExclusivePoints &&
      config.gridExclusivePoints[gridIndex]) ||
    [];
  for (let i = gridExclusivePoints.length - 1; i >= 0; i--) {
    // Support both old [x, y] and new [char, x, y] format
    let eX, eY;
    if (gridExclusivePoints[i].length === 3 && typeof gridExclusivePoints[i][0] === 'string') {
      [, eX, eY] = gridExclusivePoints[i];
    } else {
      [eX, eY] = gridExclusivePoints[i];
    }
    const { cx: exclusiveCX, cy: exclusiveCY } = frameWorldToCanvas(
      eX,
      eY
    );
    const distance = Math.sqrt(
      (mouseX - exclusiveCX) ** 2 + (mouseY - exclusiveCY) ** 2
    );

    if (distance <= simConfig.exclusivePointRadius + 2) {
      draggedItem = "exclusive_point";
      draggedExclusivePointData = [...gridExclusivePoints[i]];
      isNewExclusivePointFromPalette = false;
      sourceConfigId = config.id;
      sourceGridIndex = gridIndex;
      sourceCanvasElement = canvas;
      sourceExclusivePointsListRef = gridExclusivePoints;
      draggedExclusivePointIndex = i;

      dragGhost.style.backgroundColor = simConfig.exclusivePointColor;
      dragGhost.style.display = "block";
      dragGhost.style.left = `${e.clientX}px`;
      dragGhost.style.top = `${e.clientY}px`;
      dragGhost.style.width = `${simConfig.exclusivePointRadius * 2}px`;
      dragGhost.style.height = `${simConfig.exclusivePointRadius * 2
        }px`;
      dragGhost.style.borderRadius = "50%";
      dragGhost.style.transform = "translate(-50%, -50%)";
      canvas.classList.add("dragging-source-canvas");

      // Remove exclusive point from source grid
      gridExclusivePoints.splice(i, 1);
      redrawFrame(config.id);

      document.addEventListener("mousemove", handleDragMove);
      document.addEventListener("mouseup", handleDragEnd, {
        once: true,
      });
      return;
    }
  }

  // Check for Wall Drag
  const walls = config.walls || [];
  for (let i = walls.length - 1; i >= 0; i--) {
    const wall = walls[i];
    const { cx: cx1, cy: cy1 } = frameWorldToCanvas(wall.x1, wall.y1);
    const { cx: cx2, cy: cy2 } = frameWorldToCanvas(wall.x2, wall.y2);

    // Check if mouse is near the wall line
    const distanceToWall = distancePointToLine(
      mouseX,
      mouseY,
      cx1,
      cy1,
      cx2,
      cy2
    );

    if (distanceToWall <= 5) {
      // 5 pixel tolerance
      draggedItem =
        wall.type === "horizontal"
          ? "wall_horizontal"
          : "wall_vertical";
      draggedWallData = { ...wall };
      isNewWallFromPalette = false;
      sourceConfigId = config.id;
      sourceCanvasElement = canvas;

      dragGhost.style.backgroundColor = "#000";
      dragGhost.style.display = "block";
      dragGhost.style.left = `${e.clientX}px`;
      dragGhost.style.top = `${e.clientY}px`;
      dragGhost.style.width =
        wall.type === "horizontal" ? "30px" : "4px";
      dragGhost.style.height =
        wall.type === "horizontal" ? "4px" : "30px";
      dragGhost.style.borderRadius = "2px";
      dragGhost.style.transform = "translate(-50%, -50%)";
      canvas.classList.add("dragging-source-canvas");

      // Remove wall from source
      walls.splice(i, 1);
      redrawFrame(config.id);

      document.addEventListener("mousemove", handleDragMove);
      document.addEventListener("mouseup", handleDragEnd, {
        once: true,
      });
      return;
    }
  }

  // Check for Robot Drag
  const currentRobots = config.grids[gridIndex];
  if (!currentRobots) return;

  for (let i = currentRobots.length - 1; i >= 0; i--) {
    const [color, rX, rY] = currentRobots[i];
    const { cx: robotCX, cy: robotCY } = frameWorldToCanvas(rX, rY);
    const distance = Math.sqrt(
      (mouseX - robotCX) ** 2 + (mouseY - robotCY) ** 2
    );

    if (distance <= simConfig.robotRadius + 2) {
      draggedItem = "robot";
      draggedRobotData = [...currentRobots[i]];
      isNewRobotFromPalette = false;
      sourceConfigId = config.id;
      sourceGridIndex = gridIndex;
      sourceCanvasElement = canvas;
      sourceRobotsListRef = currentRobots;
      draggedRobotIndex = i;

      dragGhost.style.backgroundColor =
        letterColorMap[draggedRobotData[0]] || simConfig.colors[draggedRobotData[0]] || "gray";
      dragGhost.style.display = "block";
      dragGhost.style.left = `${e.clientX}px`;
      dragGhost.style.top = `${e.clientY}px`;
      dragGhost.style.width = `${simConfig.robotRadius * 2}px`;
      dragGhost.style.height = `${simConfig.robotRadius * 2}px`;
      dragGhost.style.borderRadius = "50%";
      dragGhost.style.transform = "translate(-50%, -50%)";
      canvas.classList.add("dragging-source-canvas");
      document.addEventListener("mousemove", handleDragMove);
      document.addEventListener("mouseup", handleDragEnd, {
        once: true,
      });
      return;
    }
  }
}

function handleDragMove(e) {
  if (
    draggedItem !== "robot" &&
    draggedItem !== "boundary" &&
    draggedItem !== "waypoint" &&
    draggedItem !== "exclusive_point" &&
    draggedItem !== "wall_horizontal" &&
    draggedItem !== "wall_vertical"
  )
    return;
  const currentX = e.clientX;
  const currentY = e.clientY;

  if (
    draggedItem === "robot" ||
    draggedItem === "waypoint" ||
    draggedItem === "exclusive_point" ||
    draggedItem === "wall_horizontal" ||
    draggedItem === "wall_vertical"
  ) {
    dragGhost.style.left = `${currentX}px`;
    dragGhost.style.top = `${currentY}px`;
    dragGhost.style.transform = "translate(-50%, -50%)";
  } else if (draggedItem === "boundary") {
    const targetElement = document.elementFromPoint(currentX, currentY);
    const frameCanvas = targetElement?.closest(
      ".simulation-frame canvas"
    );
    if (frameCanvas) {
      const rect = frameCanvas.getBoundingClientRect();
      updateBoundaryGhostPosition(
        currentX,
        currentY,
        frameCanvas,
        rect
      );
    } else {
      boundaryGhost.style.display = "none";
    }
  }

  document
    .querySelectorAll(".simulation-frame canvas")
    .forEach((canvas) => {
      canvas.classList.remove("drop-target-canvas");
    });
  const targetElement = document.elementFromPoint(currentX, currentY);
  const targetCanvas = targetElement?.closest(
    ".simulation-frame canvas"
  );
  if (
    targetCanvas &&
    (targetCanvas !== sourceCanvasElement ||
      isNewRobotFromPalette ||
      isNewWaypointFromPalette ||
      isNewExclusivePointFromPalette ||
      isNewWallFromPalette ||
      draggedItem === "boundary")
  ) {
    targetCanvas.classList.add("drop-target-canvas");
  }
}

function animateGhostReturn() {
  if (!currentPaletteDragSource || !dragGhost) {
    dragGhost.style.display = "none";
    return;
  }

  const paletteRect = currentPaletteDragSource.getBoundingClientRect();
  const ghostRect = dragGhost.getBoundingClientRect();

  // Calculate target position (center of palette element)
  const targetX = paletteRect.left + paletteRect.width / 2;
  const targetY = paletteRect.top + paletteRect.height / 2;

  // Set initial position for animation (current ghost position)
  dragGhost.style.transition = "none"; // Disable transition temporarily
  dragGhost.style.left = `${ghostRect.left + ghostRect.width / 2}px`;
  dragGhost.style.top = `${ghostRect.top + ghostRect.height / 2}px`;
  dragGhost.style.transform = "translate(-50%, -50%)";
  dragGhost.style.display = "block"; // Ensure it's visible for animation

  // Force reflow to apply initial position without transition
  dragGhost.offsetWidth;

  // Apply transition and target position
  dragGhost.style.transition = "left 0.3s ease-out, top 0.3s ease-out, transform 0.3s ease-out";
  dragGhost.style.left = `${targetX}px`;
  dragGhost.style.top = `${targetY}px`;
  dragGhost.style.transform = "translate(-50%, -50%) scale(0.5)"; // Shrink slightly

  // Hide after animation
  dragGhost.addEventListener('transitionend', function handler() {
    dragGhost.style.display = 'none';
    dragGhost.style.transition = 'none'; // Reset transition
    dragGhost.style.transform = "translate(-50%, -50%)"; // Reset transform
    dragGhost.removeEventListener('transitionend', handler);
  }, { once: true });
}

function handleDragEnd(e) {
  if (
    draggedItem !== "robot" &&
    draggedItem !== "boundary" &&
    draggedItem !== "waypoint" &&
    draggedItem !== "exclusive_point" &&
    draggedItem !== "wall_horizontal" &&
    draggedItem !== "wall_vertical"
  )
    return;

  // Always remove mousemove listener
  document.removeEventListener("mousemove", handleDragMove);
  const currentX = e.clientX;
  const currentY = e.clientY;
  const targetElement = document.elementFromPoint(currentX, currentY);
  const targetCanvas = targetElement?.closest(".simulation-frame canvas");

  // Logic to determine if we should animate return to palette
  // We animate if:
  // 1. It's a new item from palette
  // 2. AND (no target canvas OR invalid drop condition)
  // Since handleRobotDrop etc. handle the logic, we can check if targetCanvas is null here.
  // If targetCanvas is NOT null, handleRobotDrop will determine if it's valid.
  // But we need to know BEFORE hiding the ghost.

  // Let's change the order. We will NOT hide ghost here if we might animate.

  let shouldAnimateReturn = false;
  let isFromPalette =
    isNewRobotFromPalette ||
    isNewWaypointFromPalette ||
    isNewExclusivePointFromPalette ||
    isNewWallFromPalette;

  if (isFromPalette && !targetCanvas) {
    shouldAnimateReturn = true;
  }

  // If we have a target canvas, we need to check if it's a valid drop location
  // This duplicates some logic from handleRobotDrop etc but is necessary for animation decision
  if (isFromPalette && targetCanvas) {
    const config = getFrameConfigFromElement(targetCanvas);
    if (config) {
      const rect = targetCanvas.getBoundingClientRect();
      const mouseX = currentX - rect.left;
      const mouseY = currentY - rect.top;
      const dropCoords = frameCanvasToWorld(mouseX, mouseY);
      const boundaries = config.boundaries || { xmin: -6, xmax: 6, ymin: -6, ymax: 6 };

      // Check if inside boundaries
      const isInside = isWithinBoundaries(dropCoords.x, dropCoords.y, boundaries);
      if (!isInside) {
        shouldAnimateReturn = true;
      }

      // For Waypoints/Exclusive points, also check if grid 0 (start grid)
      // This rule means waypoints/exclusive points cannot be dropped on grid 0
      if ((draggedItem === "waypoint" || draggedItem === "exclusive_point") && parseInt(targetCanvas.dataset.gridIndex, 10) === 0) {
        shouldAnimateReturn = true;
      }
    } else {
      shouldAnimateReturn = true;
    }
  }

  if (shouldAnimateReturn) {
    animateGhostReturn();
    // Don't hide ghost immediately, animation will handle it
  } else {
    dragGhost.style.display = "none";
  }

  boundaryGhost.style.display = "none";

  if (draggedItem === "robot") {
    handleRobotDrop(targetCanvas, currentX, currentY);
  } else if (draggedItem === "boundary") {
    const targetConfig = getFrameConfigFromElement(targetCanvas);
    handleBoundaryDrop(targetCanvas, targetConfig, currentX, currentY);
  } else if (draggedItem === "waypoint") {
    handleWaypointDrop(targetCanvas, currentX, currentY);
  } else if (draggedItem === "exclusive_point") {
    handleExclusivePointDrop(targetCanvas, currentX, currentY);
  } else if (
    draggedItem === "wall_horizontal" ||
    draggedItem === "wall_vertical"
  ) {
    handleWallDrop(targetCanvas, currentX, currentY);
  }

  // Cleanup
  // Save configId before clearing
  const tempSourceConfigId = sourceConfigId;
  draggedItem = null;
  draggedRobotData = null;
  draggedRobotIndex = -1;
  isNewRobotFromPalette = false;
  const tempSourceCanvas = sourceCanvasElement;
  sourceCanvasElement = null;
  sourceConfigId = null;
  sourceGridIndex = -1;
  sourceRobotsListRef = null;

  if (tempSourceCanvas) {
    tempSourceCanvas.classList.remove("dragging-source-canvas");
  }

  // Always redraw the source frame if it was a robot drag
  if (tempSourceConfigId) {
    redrawFrame(tempSourceConfigId);
  }

  document
    .querySelectorAll(".simulation-frame canvas")
    .forEach((canvas) => {
      canvas.classList.remove("drop-target-canvas");
    });
  updateFullConfigTextArea();
}

function handleRobotDrop(targetCanvas, currentX, currentY) {
  const targetConfig = getFrameConfigFromElement(targetCanvas);
  let droppedInsideValidCanvas = targetCanvas && targetConfig;
  let roundedDropCoords = { x: 0, y: 0 };
  let isDropInsideTargetBoundaries = false;
  let targetGridIndex = -1;

  if (droppedInsideValidCanvas) {
    const rect = targetCanvas.getBoundingClientRect();
    const mouseX = currentX - rect.left;
    const mouseY = currentY - rect.top;
    const dropCoords = frameCanvasToWorld(mouseX, mouseY);
    roundedDropCoords = {
      x: Math.round(dropCoords.x),
      y: Math.round(dropCoords.y),
    };
    targetGridIndex = parseInt(targetCanvas.dataset.gridIndex, 10);
    const targetBoundaries = targetConfig.boundaries || {
      xmin: -6,
      xmax: 6,
      ymin: -6,
      ymax: 6,
    };
    isDropInsideTargetBoundaries = isWithinBoundaries(
      roundedDropCoords.x,
      roundedDropCoords.y,
      targetBoundaries
    );
  }


  // Check if dropped in valid location
  const isValidDrop = droppedInsideValidCanvas && isDropInsideTargetBoundaries;

  // Remove robot from source if it was dragged from the grid (not from palette)
  if (
    !isNewRobotFromPalette &&
    sourceRobotsListRef &&
    draggedRobotIndex !== -1
  ) {
    sourceRobotsListRef.splice(draggedRobotIndex, 1);
  }
  // If invalid drop and not from palette, robot stays in original position

  // Add robot to target
  if (isValidDrop) {
    const targetRobotsList = targetConfig.grids[targetGridIndex];
    if (targetRobotsList) {
      // Remove all items at this position — but preserve '*' waypoints so a robot can share a cell
      removeAllItemsAtGridPosition(
        targetConfig,
        targetGridIndex,
        roundedDropCoords.x,
        roundedDropCoords.y,
        true
      );

      // Add the new robot at the position
      targetRobotsList.push([
        draggedRobotData[0],
        roundedDropCoords.x,
        roundedDropCoords.y,
      ]);
    }
  }

  // Redraw only the affected frames since we now use per-grid targeting
  if (isValidDrop) {
    redrawFrame(targetConfig.id);
  } else {
    // Only redraw the affected frames for robot-to-robot moves
    const affectedConfigIds = new Set();
    if (sourceConfigId) affectedConfigIds.add(sourceConfigId);
    if (targetConfig) affectedConfigIds.add(targetConfig.id);

    affectedConfigIds.forEach((configId) => {
      redrawFrame(configId);
    });
  }

  updateFullConfigTextArea();
  saveConfigsToLocalStorage();
}

// Helper function to remove all items at a specific position in a specific grid
function removeAllItemsAtGridPosition(config, gridIndex, x, y, keepMixedWaypoint = false) {
  // Remove robots from the specific grid
  if (config.grids && config.grids[gridIndex]) {
    const existingRobotIndex = config.grids[gridIndex].findIndex(
      ([color, rx, ry]) => rx === x && ry === y
    );
    if (existingRobotIndex !== -1) {
      config.grids[gridIndex].splice(existingRobotIndex, 1);
    }
  }

  // Remove waypoints from the specific grid
  if (config.gridWaypoints && config.gridWaypoints[gridIndex]) {
    // Support both old [x, y] and new [char, x, y] format
    const existingWaypointIndex = config.gridWaypoints[gridIndex].findIndex((waypoint) => {
      const char = waypoint.length === 3 ? waypoint[0] : '-';
      if (keepMixedWaypoint && char !== '-') return false; // preserve non-general waypoints when a robot is dropped
      if (waypoint.length === 3 && typeof waypoint[0] === 'string') {
        return waypoint[1] === x && waypoint[2] === y;
      } else if (waypoint.length === 2) {
        return waypoint[0] === x && waypoint[1] === y;
      }
      return false;
    });
    if (existingWaypointIndex !== -1) {
      config.gridWaypoints[gridIndex].splice(existingWaypointIndex, 1);
    }
  }

  // Remove exclusive points from the specific grid
  if (
    config.gridExclusivePoints &&
    config.gridExclusivePoints[gridIndex]
  ) {
    // Support both old [x, y] and new [char, x, y] format
    const existingExclusiveIndex = config.gridExclusivePoints[gridIndex].findIndex((point) => {
      if (point.length === 3 && typeof point[0] === 'string') {
        // New format [char, x, y]
        return point[1] === x && point[2] === y;
      } else if (point.length === 2) {
        // Old format [x, y]
        return point[0] === x && point[1] === y;
      }
      return false;
    });
    if (existingExclusiveIndex !== -1) {
      config.gridExclusivePoints[gridIndex].splice(
        existingExclusiveIndex,
        1
      );
    }
  }
}

function handleWaypointDrop(targetCanvas, currentX, currentY) {
  const targetConfig = getFrameConfigFromElement(targetCanvas);
  let droppedInsideValidCanvas = targetCanvas && targetConfig;
  let roundedDropCoords = { x: 0, y: 0 };
  let isDropInsideTargetBoundaries = false;
  let targetGridIndex = -1;

  if (droppedInsideValidCanvas) {
    const rect = targetCanvas.getBoundingClientRect();
    const mouseX = currentX - rect.left;
    const mouseY = currentY - rect.top;
    const dropCoords = frameCanvasToWorld(mouseX, mouseY);
    roundedDropCoords = {
      x: Math.round(dropCoords.x),
      y: Math.round(dropCoords.y),
    };
    targetGridIndex = parseInt(targetCanvas.dataset.gridIndex, 10);
    const targetBoundaries = targetConfig.boundaries || {
      xmin: -6,
      xmax: 6,
      ymin: -6,
      ymax: 6,
    };
    isDropInsideTargetBoundaries = isWithinBoundaries(
      roundedDropCoords.x,
      roundedDropCoords.y,
      targetBoundaries
    );
  }

  // Remove waypoint from source if re-dragging
  if (
    !isNewWaypointFromPalette &&
    sourceWaypointsListRef &&
    draggedWaypointIndex !== -1
  ) {
    // Note: already removed in handleCanvasMouseDown, no need to remove again
  }

  // Prevent dropping on starting grid (index 0)
  if (droppedInsideValidCanvas && targetGridIndex === 0) {
    alert(
      "Waypoints cannot be placed on the starting grid. Please place them on target grids only."
    );
    // Restore waypoint to source if it was a re-drag
    if (!isNewWaypointFromPalette && sourceWaypointsListRef) {
      sourceWaypointsListRef.splice(
        draggedWaypointIndex,
        0,
        draggedWaypointData
      );
      if (sourceConfigId) {
        redrawFrame(sourceConfigId);
      }
    }
    return;
  }

  // Add waypoint to target
  if (droppedInsideValidCanvas && isDropInsideTargetBoundaries) {
    // Initialize per-grid waypoints array if needed
    if (!targetConfig.gridWaypoints) {
      targetConfig.gridWaypoints = [];
    }
    if (!targetConfig.gridWaypoints[targetGridIndex]) {
      targetConfig.gridWaypoints[targetGridIndex] = [];
    }

    const waypointChar = draggedWaypointData && draggedWaypointData.length === 3 ? draggedWaypointData[0] : "-";

    // For non-general waypoints: replace existing waypoint + remove exclusive point, keep robot
    // For general ('-') waypoints: clear everything at the position first
    if (waypointChar !== '-') {
      // Remove existing waypoint at this cell
      const wpList = targetConfig.gridWaypoints[targetGridIndex];
      const existingIdx = wpList.findIndex((wp) => {
        const [, wx, wy] = wp.length === 3 ? wp : ['-', wp[0], wp[1]];
        return wx === roundedDropCoords.x && wy === roundedDropCoords.y;
      });
      if (existingIdx !== -1) wpList.splice(existingIdx, 1);
      // Also remove any exclusive point at this cell
      const epList = targetConfig.gridExclusivePoints && targetConfig.gridExclusivePoints[targetGridIndex];
      if (epList) {
        const epIdx = epList.findIndex((ep) => {
          const [, ex, ey] = ep.length === 3 ? ep : ['-', ep[0], ep[1]];
          return ex === roundedDropCoords.x && ey === roundedDropCoords.y;
        });
        if (epIdx !== -1) epList.splice(epIdx, 1);
      }
    } else {
      removeAllItemsAtGridPosition(
        targetConfig,
        targetGridIndex,
        roundedDropCoords.x,
        roundedDropCoords.y
      );
    }

    // Add the new waypoint at the position (using new [char, x, y] format)
    targetConfig.gridWaypoints[targetGridIndex].push([
      waypointChar,
      roundedDropCoords.x,
      roundedDropCoords.y,
    ]);

    // Redraw only this frame
    redrawFrame(targetConfig.id);
  } else if (
    droppedInsideValidCanvas &&
    !isDropInsideTargetBoundaries
  ) {
    // Drop was outside grid boundaries - remove waypoint completely (same as robots)
    // Don't restore to source, just discard it
    if (targetConfig) {
      redrawFrame(targetConfig.id);
    }
    if (
      sourceConfigId &&
      sourceConfigId !== (targetConfig ? targetConfig.id : null)
    ) {
      redrawFrame(sourceConfigId);
    }
  } else {
    // Drop was outside any canvas or invalid - discard waypoint (do not restore to source)
    // No need to modify source lists; just redraw affected frames if necessary
    if (targetConfig) {
      redrawFrame(targetConfig.id);
    }
    if (sourceConfigId && sourceConfigId !== (targetConfig ? targetConfig.id : null)) {
      redrawFrame(sourceConfigId);
    }
  }

  updateFullConfigTextArea();
  saveConfigsToLocalStorage();
}

function handleExclusivePointDrop(targetCanvas, currentX, currentY) {
  const targetConfig = getFrameConfigFromElement(targetCanvas);
  let droppedInsideValidCanvas = targetCanvas && targetConfig;
  let roundedDropCoords = { x: 0, y: 0 };
  let isDropInsideTargetBoundaries = false;
  let targetGridIndex = -1;

  if (droppedInsideValidCanvas) {
    const rect = targetCanvas.getBoundingClientRect();
    const mouseX = currentX - rect.left;
    const mouseY = currentY - rect.top;
    const dropCoords = frameCanvasToWorld(mouseX, mouseY);
    roundedDropCoords = {
      x: Math.round(dropCoords.x),
      y: Math.round(dropCoords.y),
    };
    targetGridIndex = parseInt(targetCanvas.dataset.gridIndex, 10);
    const targetBoundaries = targetConfig.boundaries || {
      xmin: -6,
      xmax: 6,
      ymin: -6,
      ymax: 6,
    };
    isDropInsideTargetBoundaries = isWithinBoundaries(
      roundedDropCoords.x,
      roundedDropCoords.y,
      targetBoundaries
    );
  }

  // Remove exclusive point from source if re-dragging
  if (
    !isNewExclusivePointFromPalette &&
    sourceExclusivePointsListRef &&
    draggedExclusivePointIndex !== -1
  ) {
    // Note: already removed in handleCanvasMouseDown, no need to remove again
  }

  // Prevent dropping on starting grid (index 0)
  if (droppedInsideValidCanvas && targetGridIndex === 0) {
    alert(
      "Exclusive points cannot be placed on the starting grid. Please place them on target grids only."
    );
    // Restore exclusive point to source if it was a re-drag
    if (
      !isNewExclusivePointFromPalette &&
      sourceExclusivePointsListRef
    ) {
      sourceExclusivePointsListRef.splice(
        draggedExclusivePointIndex,
        0,
        draggedExclusivePointData
      );
      if (sourceConfigId) {
        redrawFrame(sourceConfigId);
      }
    }
    return;
  }

  // Add exclusive point to target
  if (droppedInsideValidCanvas && isDropInsideTargetBoundaries) {
    // Initialize per-grid exclusive points array if needed
    if (!targetConfig.gridExclusivePoints) {
      targetConfig.gridExclusivePoints = [];
    }
    if (!targetConfig.gridExclusivePoints[targetGridIndex]) {
      targetConfig.gridExclusivePoints[targetGridIndex] = [];
    }

    // Remove all items at this position in the target grid
    removeAllItemsAtGridPosition(
      targetConfig,
      targetGridIndex,
      roundedDropCoords.x,
      roundedDropCoords.y
    );

    // Add the new exclusive point at the position (using new [char, x, y] format)
    // draggedExclusivePointData contains [char, x, y] - use the char from dragged data
    const exclusiveChar = draggedExclusivePointData && draggedExclusivePointData.length === 3 ? draggedExclusivePointData[0] : "-";
    targetConfig.gridExclusivePoints[targetGridIndex].push([
      exclusiveChar,
      roundedDropCoords.x,
      roundedDropCoords.y,
    ]);

    // Redraw only this frame
    redrawFrame(targetConfig.id);
  } else if (
    droppedInsideValidCanvas &&
    !isDropInsideTargetBoundaries
  ) {
    // Drop was outside grid boundaries - remove exclusive point completely (same as robots)
    // Don't restore to source, just discard it
    if (targetConfig) {
      redrawFrame(targetConfig.id);
    }
    if (
      sourceConfigId &&
      sourceConfigId !== (targetConfig ? targetConfig.id : null)
    ) {
      redrawFrame(sourceConfigId);
    }
  } else {
    // Drop was outside any canvas or invalid - restore exclusive point to source if it was a re-drag
    if (
      !isNewExclusivePointFromPalette &&
      sourceExclusivePointsListRef
    ) {
      sourceExclusivePointsListRef.splice(
        draggedExclusivePointIndex,
        0,
        draggedExclusivePointData
      );
      if (sourceConfigId) {
        redrawFrame(sourceConfigId);
      }
    }
  }

  updateFullConfigTextArea();
  saveConfigsToLocalStorage();
}

function handleWallDrop(targetCanvas, currentX, currentY) {
  // Only consider it a valid drop if we actually have a canvas element under the mouse
  let droppedInsideValidCanvas = false;
  let roundedDropCoords = { x: 0, y: 0 };
  let targetConfig = null;

  // Check if we have a canvas AND if the mouse is actually over that canvas
  if (targetCanvas) {
    const rect = targetCanvas.getBoundingClientRect();
    const mouseX = currentX - rect.left;
    const mouseY = currentY - rect.top;

    // Ensure mouse is within canvas bounds
    if (
      mouseX >= 0 &&
      mouseX <= rect.width &&
      mouseY >= 0 &&
      mouseY <= rect.height
    ) {
      targetConfig = getFrameConfigFromElement(targetCanvas);
      if (targetConfig) {
        droppedInsideValidCanvas = true;
        const dropCoords = frameCanvasToWorld(mouseX, mouseY);
        roundedDropCoords = {
          x: Math.round(dropCoords.x),
          y: Math.round(dropCoords.y),
        };
      }
    }
  }

  // Add wall ONLY if dropped inside a valid canvas area
  if (droppedInsideValidCanvas && draggedWallData) {
    if (!targetConfig.walls) {
      targetConfig.walls = [];
    }

    const boundaries = targetConfig.boundaries || {
      xmin: -6,
      xmax: 6,
      ymin: -6,
      ymax: 6,
    };

    // Extend walls beyond boundaries to allow outside placement
    const extendedBounds = {
      xmin: boundaries.xmin - 5,
      xmax: boundaries.xmax + 5,
      ymin: boundaries.ymin - 5,
      ymax: boundaries.ymax + 5,
    };

    // Remove existing wall of the same type (max one vertical, max one horizontal)
    targetConfig.walls = targetConfig.walls.filter(
      (wall) => wall.type !== draggedWallData.type
    );

    let newWall;
    if (draggedWallData.type === "horizontal") {
      newWall = {
        type: "horizontal",
        x1: extendedBounds.xmin,
        y1: roundedDropCoords.y,
        x2: extendedBounds.xmax,
        y2: roundedDropCoords.y,
      };
    } else {
      newWall = {
        type: "vertical",
        x1: roundedDropCoords.x,
        y1: extendedBounds.ymin,
        x2: roundedDropCoords.x,
        y2: extendedBounds.ymax,
      };
    }

    targetConfig.walls.push(newWall);
  }

  // If NOT droppedInsideValidCanvas, the wall is automatically deleted
  // (it was already removed from source during drag start)

  // Redraw all frames
  activeSimulationConfigs.forEach((config) => {
    redrawFrame(config.id);
  });

  updateFullConfigTextArea();
  saveConfigsToLocalStorage();

  // Reset palette state
  isNewWallFromPalette = false;
  draggedWallData = null;
}

function handleBoundaryDrop(
  targetCanvas,
  targetConfig,
  currentX,
  currentY
) {
  if (
    !targetCanvas ||
    !targetConfig ||
    !draggedBoundaryEdge ||
    targetConfig.id !== sourceConfigId
  ) {
    return;
  }
  if (!targetConfig.boundaries) {
    targetConfig.boundaries = { xmin: -6, xmax: 6, ymin: -6, ymax: 6 };
  }

  const rect = targetCanvas.getBoundingClientRect();
  const mouseX = currentX - rect.left;
  const mouseY = currentY - rect.top;
  let worldValue =
    draggedBoundaryEdge === "xmin" || draggedBoundaryEdge === "xmax"
      ? frameCanvasToWorld(mouseX, mouseY).x
      : frameCanvasToWorld(mouseX, mouseY).y;
  let newBoundaryValue = Math.round(worldValue);

  const hardLimit = 15;
  const currentBoundaries = targetConfig.boundaries;
  let finalClampedValue = newBoundaryValue;
  switch (draggedBoundaryEdge) {
    case "xmin":
      finalClampedValue = Math.max(
        -hardLimit,
        Math.min(
          newBoundaryValue,
          (currentBoundaries.xmax ?? hardLimit) - 1
        )
      );
      break;
    case "xmax":
      finalClampedValue = Math.min(
        hardLimit,
        Math.max(
          newBoundaryValue,
          (currentBoundaries.xmin ?? -hardLimit) + 1
        )
      );
      break;
    case "ymin":
      finalClampedValue = Math.max(
        -hardLimit,
        Math.min(
          newBoundaryValue,
          (currentBoundaries.ymax ?? hardLimit) - 1
        )
      );
      break;
    case "ymax":
      finalClampedValue = Math.min(
        hardLimit,
        Math.max(
          newBoundaryValue,
          (currentBoundaries.ymin ?? -hardLimit) + 1
        )
      );
      break;
  }

  if (currentBoundaries[draggedBoundaryEdge] !== finalClampedValue) {
    currentBoundaries[draggedBoundaryEdge] = finalClampedValue;
    // Filter out robots that are now outside the new boundaries
    targetConfig.grids.forEach((grid) => {
      const filteredGrid = grid.filter(([_, x, y]) =>
        isWithinBoundaries(x, y, targetConfig.boundaries)
      );
      grid.length = 0; // Clear original grid
      grid.push(...filteredGrid); // Push back filtered robots
    });

    // Filter waypoints and exclusive points
    if (targetConfig.waypoints) {
      targetConfig.waypoints = targetConfig.waypoints.filter(([x, y]) =>
        isWithinBoundaries(x, y, targetConfig.boundaries)
      );
    }
    if (targetConfig.exclusive_points) {
      targetConfig.exclusive_points =
        targetConfig.exclusive_points.filter(([x, y]) =>
          isWithinBoundaries(x, y, targetConfig.boundaries)
        );
    }

    // Only redraw the affected frame instead of full re-render
    redrawFrame(targetConfig.id);
    updateFullConfigTextArea();
    saveConfigsToLocalStorage();
  }
}

function getBoundaryEdgeAtPosition(canvasX, canvasY, frameBoundaries) {
  const threshold = simConfig.boundaryHitThreshold;
  if (!frameBoundaries) return null;
  const { cx: xmin_cx } = frameWorldToCanvas(frameBoundaries.xmin, 0);
  const { cx: xmax_cx } = frameWorldToCanvas(frameBoundaries.xmax, 0);
  const { cy: ymin_cy } = frameWorldToCanvas(0, frameBoundaries.ymin);
  const { cy: ymax_cy } = frameWorldToCanvas(0, frameBoundaries.ymax);
  if (
    Math.abs(canvasX - xmin_cx) < threshold &&
    canvasY >= ymax_cy &&
    canvasY <= ymin_cy
  )
    return "xmin";
  if (
    Math.abs(canvasX - xmax_cx) < threshold &&
    canvasY >= ymax_cy &&
    canvasY <= ymin_cy
  )
    return "xmax";
  if (
    Math.abs(canvasY - ymin_cy) < threshold &&
    canvasX >= xmin_cx &&
    canvasX <= xmax_cx
  )
    return "ymin";
  if (
    Math.abs(canvasY - ymax_cy) < threshold &&
    canvasX >= xmin_cx &&
    canvasX <= xmax_cx
  )
    return "ymax";
  return null;
}

function updateBoundaryGhostPosition(clientX, clientY, canvas, rect) {
  if (!draggedBoundaryEdge || !boundaryGhost) return;
  const mouseX_canvas = clientX - rect.left;
  const mouseY_canvas = clientY - rect.top;
  boundaryGhost.style.display = "block";
  const canvasSize = canvas.width;
  const boundaryWidthPx = simConfig.boundaryWidth;
  switch (draggedBoundaryEdge) {
    case "xmin":
    case "xmax":
      boundaryGhost.style.left = `${mouseX_canvas + rect.left - boundaryWidthPx / 2
        }px`;
      boundaryGhost.style.top = `${rect.top}px`;
      boundaryGhost.style.width = `${boundaryWidthPx}px`;
      boundaryGhost.style.height = `${canvasSize}px`;
      break;
    case "ymin":
    case "ymax":
      boundaryGhost.style.left = `${rect.left}px`;
      boundaryGhost.style.top = `${mouseY_canvas + rect.top - boundaryWidthPx / 2
        }px`;
      boundaryGhost.style.width = `${canvasSize}px`;
      boundaryGhost.style.height = `${boundaryWidthPx}px`;
      break;
  }
}

// --- Frame Reordering Handlers ---
function handleFrameDragStart(e) {
  if (e.currentTarget.dataset.dragReady !== "true") {
    e.preventDefault();
    return;
  }
  delete e.currentTarget.dataset.dragReady;
  draggedItem = "frame";
  const frame = e.currentTarget;
  draggedFrameId = frame.dataset.configId;
  if (!draggedFrameId) {
    e.preventDefault();
    return;
  }
  e.dataTransfer.setData("text/plain", draggedFrameId);
  e.dataTransfer.effectAllowed = "move";
  setTimeout(() => {
    if (frame.isConnected) frame.classList.add("dragging");
  }, 0);
}

function handleFrameDragOver(e) {
  e.preventDefault();
  if (draggedItem !== "frame" || !simulatorColumn) return;
  e.dataTransfer.dropEffect = "move";
  const draggingFrame = simulatorColumn.querySelector(
    ".simulation-frame.dragging"
  );
  if (!draggingFrame) {
    stopScrolling();
    return;
  }
  const colRect = simulatorColumn.getBoundingClientRect();
  const mouseY = e.clientY;
  if (mouseY < colRect.top + SCROLL_ZONE_HEIGHT)
    startScrolling(-SCROLL_SPEED);
  else if (mouseY > colRect.bottom - SCROLL_ZONE_HEIGHT)
    startScrolling(SCROLL_SPEED);
  else stopScrolling();
  const targetElement = getDragAfterElement(simulatorColumn, e.clientY);
  if (!dropIndicator) {
    dropIndicator = document.createElement("div");
    dropIndicator.className = "drop-indicator";
  }
  if (targetElement == null) {
    if (!dropIndicator.parentNode || dropIndicator.nextSibling)
      simulatorColumn.appendChild(dropIndicator);
  } else {
    if (dropIndicator !== targetElement.previousSibling)
      simulatorColumn.insertBefore(dropIndicator, targetElement);
  }
}

function handleFrameDragLeave(e) {
  if (
    !simulatorColumn.contains(e.relatedTarget) &&
    draggedItem === "frame"
  ) {
    removeDropIndicator();
    stopScrolling();
  }
}

function handleFrameDrop(e) {
  e.preventDefault();
  stopScrolling();
  if (draggedItem !== "frame" || !draggedFrameId) {
    removeDropIndicator();
    return;
  }
  const droppedConfigId = e.dataTransfer.getData("text/plain");
  if (droppedConfigId !== draggedFrameId) {
    removeDropIndicator();
    return;
  }
  const targetElement = getDragAfterElement(simulatorColumn, e.clientY);
  const draggedIndex = activeSimulationConfigs.findIndex(
    (cfg) => cfg.id === droppedConfigId
  );
  if (draggedIndex === -1) {
    removeDropIndicator();
    return;
  }
  const [draggedConfig] = activeSimulationConfigs.splice(
    draggedIndex,
    1
  );
  if (targetElement) {
    const targetId = targetElement.dataset.configId;
    const targetIndex = activeSimulationConfigs.findIndex(
      (cfg) => cfg.id === targetId
    );
    if (targetIndex !== -1)
      activeSimulationConfigs.splice(targetIndex, 0, draggedConfig);
    else activeSimulationConfigs.push(draggedConfig);
  } else {
    activeSimulationConfigs.push(draggedConfig);
  }
  removeDropIndicator();
  renderAllFrames();
}

function handleFrameDragEnd(e) {
  const frame = e.target.closest(".simulation-frame");
  if (frame) {
    delete frame.dataset.dragReady;
    frame.classList.remove("dragging");
  }
  removeDropIndicator();
  stopScrolling();
  if (draggedItem === "frame") draggedItem = null;
  draggedFrameId = null;
}

function getDragAfterElement(container, y) {
  const draggableElements = [
    ...container.querySelectorAll(".simulation-frame:not(.dragging)"),
  ];
  return draggableElements.reduce(
    (closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset)
        return { offset: offset, element: child };
      else return closest;
    },
    { offset: Number.NEGATIVE_INFINITY }
  ).element;
}

function removeDropIndicator() {
  if (dropIndicator && dropIndicator.parentNode) {
    dropIndicator.parentNode.removeChild(dropIndicator);
  }
  dropIndicator = null;
}

function startScrolling(speed) {
  if (scrollIntervalId === null) {
    scrollIntervalId = setInterval(() => {
      if (simulatorColumn) simulatorColumn.scrollTop += speed;
      else stopScrolling();
    }, 30);
  }
}
function stopScrolling() {
  if (scrollIntervalId !== null) {
    clearInterval(scrollIntervalId);
    scrollIntervalId = null;
  }
}

// --- Resize and Toggle Functionality ---
function initializeResizeAndToggle() {
  // Resize functionality
  resizeHandle.addEventListener("mousedown", (e) => {
    isResizing = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    e.preventDefault();
  });

  document.addEventListener("mousemove", (e) => {
    if (!isResizing || isEditorHidden) return;

    const containerRect = mainContainer.getBoundingClientRect();
    const mouseX = e.clientX - containerRect.left;
    const totalWidth = containerRect.width;

    // Calculate new widths as percentages
    const simulatorWidth = Math.max(
      30,
      Math.min(70, (mouseX / totalWidth) * 100)
    );
    const editorWidth = 100 - simulatorWidth;

    // Apply new widths
    simulatorColumn.style.flex = `0 0 ${simulatorWidth}%`;
    editorColumn.style.flex = `0 0 ${editorWidth}%`;
  });

  document.addEventListener("mouseup", () => {
    if (isResizing) {
      isResizing = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      // Save layout after resize
      saveLayoutToLocalStorage();
    }
  });

  // Toggle functionality
  toggleEditorBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleEditor();
  });
}

function toggleEditor() {
  isEditorHidden = !isEditorHidden;

  if (isEditorHidden) {
    // Hide editor
    editorColumn.style.display = "none";
    resizeHandle.style.cursor = "pointer";
    simulatorColumn.style.flex = "1";
    toggleEditorBtn.textContent = "▸";
    toggleEditorBtn.title = "Show editor panel";
  } else {
    // Show editor
    editorColumn.style.display = "flex";
    resizeHandle.style.cursor = "col-resize";
    simulatorColumn.style.flex = "0 0 50%";
    editorColumn.style.flex = "0 0 50%";
    toggleEditorBtn.textContent = "◂";
    toggleEditorBtn.title = "Hide editor panel";
  }

  // Save layout state
  saveLayoutToLocalStorage();
}

// --- Add New Frame & Local Storage ---
function addNewFrame() {
  const newConfig = {
    id: `cfg-new-${Date.now()}`,
    grids: [[], []], // Start empty (no robots)
    steps: 5,
    gridSteps: [0, 5],
    gridWaypoints: [[], []],
    gridExclusivePoints: [[], []],
    boundaries: { xmin: -6, xmax: 6, ymin: -6, ymax: 6 },
    waypoints: [],
    exclusive_points: [],
    walls: [],
    needsRedraw: true,
  };
  activeSimulationConfigs.push(newConfig);
  renderAllFrames();
  const newFrameElement = frameElements[newConfig.id]?.frameDiv;
  if (newFrameElement) {
    newFrameElement.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
  }
}


// --- LocalStorage Functions (DISABLED) ---
const LOCAL_STORAGE_KEY = "multiRobotSimConfigs_v3";
function saveConfigsToLocalStorage() {
  // Disabled - no localStorage usage
}
function loadConfigsFromLocalStorage() {
  // Disabled - no localStorage usage
  return null;
  /*
try {
  const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (!raw) return null;
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) return null;
  return parsed.map((cfg, idx) => ({
    id: cfg.id || `cfg-cached-${Date.now()}-${idx}`,
    grids: Array.isArray(cfg.grids) ? cfg.grids : [[], []],
    steps: typeof cfg.steps === "number" ? cfg.steps : 0,
    gridSteps: Array.isArray(cfg.gridSteps) ? cfg.gridSteps : [],
    gridWaypoints: Array.isArray(cfg.gridWaypoints)
      ? cfg.gridWaypoints
      : [],
    gridExclusivePoints: Array.isArray(cfg.gridExclusivePoints)
      ? cfg.gridExclusivePoints
      : [],
    boundaries: cfg.boundaries || {
      xmin: -6,
      xmax: 6,
      ymin: -6,
      ymax: 6,
    },
    waypoints: Array.isArray(cfg.waypoints) ? cfg.waypoints : [],
    exclusive_points: Array.isArray(cfg.exclusive_points)
      ? cfg.exclusive_points
      : [],
    walls: Array.isArray(cfg.walls) ? cfg.walls : [],
    needsRedraw: true,
  }));
} catch (e) {
  console.error("Failed to load configs:", e);
  return null;
}
*/
}
function clearConfigsFromLocalStorage() {
  // Disabled - no localStorage usage
  /*
localStorage.removeItem(LOCAL_STORAGE_KEY);
*/
}

// --- Layout Storage Functions ---
function saveLayoutToLocalStorage() {
  // Disabled - no localStorage usage
  /*
try {
  const layout = {
    isEditorHidden: isEditorHidden,
    simulatorWidth: simulatorColumn.style.flex || "0 0 50%",
    editorWidth: editorColumn.style.flex || "0 0 50%",
  };
  localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(layout));
} catch (e) {
  console.error("Failed to save layout:", e);
}
*/
}

function loadLayoutFromLocalStorage() {
  // Disabled - no localStorage usage
  return null;
  /*
try {
  const raw = localStorage.getItem(LAYOUT_STORAGE_KEY);
  if (!raw) return null;
  return JSON.parse(raw);
} catch (e) {
  console.error("Failed to load layout:", e);
  return null;
}
*/
}

function applyLayoutFromStorage() {
  const layout = loadLayoutFromLocalStorage();
  if (!layout) return;

  // Apply saved layout
  if (layout.simulatorWidth) {
    simulatorColumn.style.flex = layout.simulatorWidth;
  }
  if (layout.editorWidth) {
    editorColumn.style.flex = layout.editorWidth;
  }

  // Apply editor visibility state
  if (layout.isEditorHidden) {
    isEditorHidden = false; // Reset state first
    toggleEditor(); // This will set it to hidden and update UI
  }
}

// --- Modal and Parser Logic ---
function setupModalAndParser() {
  const copyBtn = document.getElementById("copyConfigBtn");
  const loadBtn = document.getElementById("loadConfigBtn");
  const loadMissingGoalsBtn = document.getElementById(
    "loadMissingGoalsBtn"
  );
  const closeModalBtn = document.getElementById("closeModalBtn");
  const submitConfigBtn = document.getElementById("submitConfigBtn");
  const resetBtn = document.getElementById("resetConfigBtn");

  if (copyBtn)
    copyBtn.addEventListener("click", () => {
      if (!simulationConfigListTextArea) return;
      navigator.clipboard
        .writeText(simulationConfigListTextArea.value)
        .then(() => {
          const originalText = copyBtn.innerHTML;
          copyBtn.innerHTML = `Copied!`;
          setTimeout(() => {
            copyBtn.innerHTML = originalText;
          }, 1500);
        })
        .catch((err) => console.error("Failed to copy:", err));
    });

  if (loadBtn)
    loadBtn.addEventListener("click", () => {
      loadModal.style.display = "flex";
      if (newConfigEditor) {
        newConfigEditor.value = "";
        newConfigEditor.focus();
      }
    });

  if (loadMissingGoalsBtn)
    loadMissingGoalsBtn.addEventListener("click", () => {
      // Set modal to "add goals" mode
      loadModal.dataset.mode = "add-goals";
      loadModal.querySelector("h3").textContent =
        "Add Missing Goal Configurations";
      loadModal.querySelector("p").innerHTML =
        'Paste goal configurations to add to the end of your current list:<br />• JSON array of goal objects: <code>[{"initial_positions": [...], "targets": [...], ...}]</code>';
      loadModal.querySelector("#versionSelector").style.display =
        "none";
      loadModal.querySelector("#submitConfigBtn").textContent =
        "Add Goals";

      loadModal.style.display = "flex";
      if (newConfigEditor) {
        newConfigEditor.value = "";
        newConfigEditor.placeholder =
          'Paste your missing goal configurations here...\n\nExample:\n[\n  {\n    "initial_positions": [["O", 0, 0], ["L", 0, 2], ["F", -2, 2]],\n    "targets": [\n      [3, [["L", 3, 2], ["F", 1, 2], ["O", 0, 0]], [], []]\n    ],\n    "boundary": [-3, 4, -1, 3],\n    "wall": [null, null]\n  }\n]';
        newConfigEditor.focus();
      }
    });

  if (closeModalBtn)
    closeModalBtn.addEventListener("click", () => {
      loadModal.style.display = "none";
      // Reset modal to default "load" mode
      loadModal.dataset.mode = "load";
      loadModal.querySelector("h3").textContent =
        "Load New Configuration";
      loadModal.querySelector("p").innerHTML =
        'You can paste either:<br />• JSON: <code>{"goals": [...]}</code><br />• Complete HTML simulation file';
      loadModal.querySelector("#versionSelector").style.display =
        "block";
      loadModal.querySelector("#submitConfigBtn").textContent =
        "Load Configuration";
      if (newConfigEditor) {
        newConfigEditor.placeholder =
          "Paste your JSON configuration here, or paste a complete HTML simulation file...";
      }
    });

  if (submitConfigBtn)
    submitConfigBtn.addEventListener("click", () => {
      const newConfigText = newConfigEditor.value;
      const selectedFormat = versionSelector.value; // "json" or "rust"
      const isAddGoalsMode = loadModal.dataset.mode === "add-goals";

      if (!newConfigText.trim()) return;

      try {
        if (isAddGoalsMode) {
          // Handle adding goal configurations to existing list
          let newGoals = [];

          try {
            // Try to parse as JSON array of goal objects
            newGoals = JSON.parse(newConfigText.trim());
            if (!Array.isArray(newGoals)) {
              throw new Error(
                "Expected an array of goal configuration objects"
              );
            }
          } catch (jsonError) {
            throw new Error(
              `Invalid JSON format for goal configurations: ${jsonError.message}`
            );
          }

          // Convert each goal configuration to internal format and add to existing configs
          const convertedGoals = newGoals.map((goalConfig, index) => {
            const boundaries = goalConfig.boundary || [-6, 6, -6, 6];
            const walls = [];

            // Convert wall array [vertical, horizontal] to wall objects
            if (goalConfig.wall && goalConfig.wall.length >= 2) {
              const [verticalWall, horizontalWall] = goalConfig.wall;

              if (verticalWall !== null) {
                walls.push({
                  type: "vertical",
                  x1: verticalWall,
                  y1: boundaries[2] - 5, // ymin - 5
                  x2: verticalWall,
                  y2: boundaries[3] + 5, // ymax + 5
                });
              }

              if (horizontalWall !== null) {
                walls.push({
                  type: "horizontal",
                  x1: boundaries[0] - 5, // xmin - 5
                  y1: horizontalWall,
                  x2: boundaries[1] + 5, // xmax + 5
                  y2: horizontalWall,
                });
              }
            }

            // Convert targets to grids format
            const grids = [goalConfig.initial_positions || []];
            const gridSteps = [0]; // Starting position
            const gridWaypoints = [[]]; // Starting grid has no waypoints
            const gridExclusivePoints = [[]]; // Starting grid has no exclusive points

            if (
              goalConfig.targets &&
              Array.isArray(goalConfig.targets)
            ) {
              goalConfig.targets.forEach((target) => {
                if (Array.isArray(target) && target.length >= 4) {
                  const [steps, robots, exclusive, waypoints] = target;
                  grids.push(robots || []);
                  gridSteps.push(steps || 5);
                  gridWaypoints.push(normalizePoints(waypoints || []));
                  gridExclusivePoints.push(normalizePoints(exclusive || []));
                }
              });
            }

            // Ensure at least one target grid
            if (grids.length < 2) {
              grids.push([]);
              gridSteps.push(5);
              gridWaypoints.push([]);
              gridExclusivePoints.push([]);
            }

            // Calculate total steps
            const totalSteps = gridSteps
              .slice(1)
              .reduce((sum, steps) => sum + steps, 0);

            return {
              id: `cfg-added-${Date.now()}-${index}`,
              grids,
              steps: totalSteps,
              gridSteps,
              gridWaypoints,
              gridExclusivePoints,
              boundaries: {
                xmin: boundaries[0],
                xmax: boundaries[1],
                ymin: boundaries[2],
                ymax: boundaries[3],
              },
              walls,
              needsRedraw: true,
            };
          });

          // Add the new configurations to the existing list
          activeSimulationConfigs.push(...convertedGoals);

          console.log(
            `Successfully added ${convertedGoals.length} goal configurations`
          );
        } else if (selectedFormat === "json") {
          // Parse as JSON format
          let parsedData = JSON.parse(newConfigText.trim());

          // Check if it's the expected format with goals
          if (
            parsedData &&
            parsedData.goals &&
            Array.isArray(parsedData.goals)
          ) {
            // Convert JSON format to internal format
            activeSimulationConfigs = parsedData.goals.map(
              (config, index) => {
                const boundaries = config.boundary || [-6, 6, -6, 6];
                const walls = [];

                // Convert wall array [vertical, horizontal] to wall objects
                if (config.wall && config.wall.length >= 2) {
                  const [verticalWall, horizontalWall] = config.wall;

                  if (verticalWall !== null) {
                    walls.push({
                      type: "vertical",
                      x1: verticalWall,
                      y1: boundaries[2] - 5, // ymin - 5
                      x2: verticalWall,
                      y2: boundaries[3] + 5, // ymax + 5
                    });
                  }

                  if (horizontalWall !== null) {
                    walls.push({
                      type: "horizontal",
                      x1: boundaries[0] - 5, // xmin - 5
                      y1: horizontalWall,
                      x2: boundaries[1] + 5, // xmax + 5
                      y2: horizontalWall,
                    });
                  }
                }

                // Convert targets to grids format
                const grids = [config.initial_positions || []];
                const gridSteps = [0]; // Starting position
                const gridWaypoints = [[]]; // Starting grid has no waypoints
                const gridExclusivePoints = [[]]; // Starting grid has no exclusive points

                if (config.targets && Array.isArray(config.targets)) {
                  config.targets.forEach((target) => {
                    if (Array.isArray(target) && target.length >= 4) {
                      const [steps, robots, exclusive, waypoints] =
                        target;
                      grids.push(robots || []);
                      gridSteps.push(steps || 5);
                      gridWaypoints.push(waypoints || []);
                      gridExclusivePoints.push(exclusive || []);
                    }
                  });
                }

                // Ensure at least one target grid
                if (grids.length < 2) {
                  grids.push([]);
                  gridSteps.push(5);
                  gridWaypoints.push([]);
                  gridExclusivePoints.push([]);
                }

                // Calculate total steps
                const totalSteps = gridSteps
                  .slice(1)
                  .reduce((sum, steps) => sum + steps, 0);

                return {
                  id: `cfg-loaded-${Date.now()}-${index}`,
                  grids,
                  steps: totalSteps,
                  gridSteps,
                  gridWaypoints,
                  gridExclusivePoints,
                  boundaries: {
                    xmin: boundaries[0],
                    xmax: boundaries[1],
                    ymin: boundaries[2],
                    ymax: boundaries[3],
                  },
                  walls,
                  needsRedraw: true,
                };
              }
            );

            console.log(
              "Successfully loaded",
              activeSimulationConfigs.length,
              "configurations from JSON format"
            );
          } else {
            throw new Error(
              "Invalid JSON format. Expected object with 'goals' array."
            );
          }
        } else if (selectedFormat === "rust") {
          // Parse as Rust format
          console.log("Parsing as Rust format...");
          const parsedConfigs =
            parseSimulationConfigList(newConfigText);

          // Ensure each config has proper structure and IDs
          activeSimulationConfigs = parsedConfigs.map((cfg, index) => ({
            id: `cfg-loaded-${Date.now()}-${index}`,
            grids: cfg.grids || [[], []],
            steps: cfg.steps || 0,
            gridSteps: cfg.gridSteps || [0, 5],
            gridWaypoints: cfg.gridWaypoints || [[], []],
            gridExclusivePoints: cfg.gridExclusivePoints || [[], []],
            boundaries: cfg.boundaries || {
              xmin: -6,
              xmax: 6,
              ymin: -6,
              ymax: 6,
            },
            walls: cfg.walls || [],
            needsRedraw: true,
          }));

          console.log(
            "Successfully loaded",
            activeSimulationConfigs.length,
            "configurations from Rust format"
          );
        } else {
          throw new Error(`Unknown format selected: ${selectedFormat}`);
        }

        // Render the frames and update UI
        renderAllFrames();
        updateFullConfigTextArea();
        saveConfigsToLocalStorage();

        loadModal.style.display = "none";

        // Reset modal to default "load" mode after successful operation
        loadModal.dataset.mode = "load";
        loadModal.querySelector("h3").textContent =
          "Load New Configuration";
        loadModal.querySelector("p").innerHTML =
          'You can paste either:<br />• JSON: <code>{"goals": [...]}</code><br />• Complete HTML simulation file';
        loadModal.querySelector("#versionSelector").style.display =
          "block";
        loadModal.querySelector("#submitConfigBtn").textContent =
          "Load Configuration";
        if (newConfigEditor) {
          newConfigEditor.placeholder =
            "Paste your JSON configuration here, or paste a complete HTML simulation file...";
        }
      } catch (error) {
        console.error(
          `Error parsing ${isAddGoalsMode ? "goal" : selectedFormat.toUpperCase()
          } configuration:`,
          error
        );
        alert(
          `Error parsing ${isAddGoalsMode ? "goal" : selectedFormat.toUpperCase()
          } configuration:\n${error.message
          }\n\nPlease check the format and try again.`
        );
      }
    });

  if (resetBtn)
    resetBtn.addEventListener("click", () => {
      // Using a custom modal for confirm would be better, but for simplicity:
      if (
        window.confirm(
          "Are you sure you want to reset to default goals? This will reload the goals based on your selected algorithm."
        )
      ) {
        // Reload goals from defaultSimulationConfigList without reloading the page
        try {
          console.log(
            "Resetting goals from defaultSimulationConfigList..."
          );
          activeSimulationConfigs = parseDefaultConfigs();
          console.log(
            "Loaded",
            activeSimulationConfigs.length,
            "simulation configs"
          );

          // Refresh UI
          renderAllFrames();
          updateFullConfigTextArea();
          saveConfigsToLocalStorage();

          // Show success feedback on the button
          const originalText = resetBtn.innerHTML;
          const originalClass = resetBtn.className;
          resetBtn.innerHTML = "✓ Reset!";
          resetBtn.className = "btn btn-success btn-sm";
          resetBtn.style.padding = "5px 10px";
          resetBtn.style.fontSize = "0.9em";
          setTimeout(() => {
            resetBtn.innerHTML = originalText;
            resetBtn.className = originalClass;
            resetBtn.style.padding = "5px 10px";
            resetBtn.style.fontSize = "0.9em";
          }, 2000);
        } catch (error) {
          console.error("Error resetting configurations:", error);
          alert("Failed to reset goals: " + error.message);
        }
      }
    });
}

function parseSimulationConfigList(inputText) {
  // First, check if the input is HTML content
  const trimmedInput = inputText.trim();
  if (
    trimmedInput.startsWith("<!DOCTYPE html") ||
    trimmedInput.startsWith("<html")
  ) {
    // Extract the embedded defaultSimulationConfigList from HTML
    const defaultConfigMatch = inputText.match(
      /let\s+defaultSimulationConfigList\s*=\s*`([\s\S]*?)`;/
    );
    if (defaultConfigMatch) {
      const embeddedConfig = defaultConfigMatch[1];
      // Recursively parse the extracted v2 config
      return parseSimulationConfigList(embeddedConfig);
    }

    // Fallback: Extract JavaScript configuration from HTML
    const scriptMatch = inputText.match(
      /<script[\s\S]*?>([\s\S]*?)<\/script>/i
    );
    if (scriptMatch) {
      const scriptContent = scriptMatch[1];

      // Look for activeSimulationConfigs array in the script
      const configMatch = scriptContent.match(
        /let\s+activeSimulationConfigs\s*=\s*\[([\s\S]*?)\]\.map\(/
      );
      if (configMatch) {
        const configContent = configMatch[1];

        // Parse the JavaScript configuration objects
        try {
          // Create a safe eval context for the configuration
          const configString = `[${configContent}]`;
          const jsConfigs = eval(configString);

          // Convert JS format to our internal format
          return jsConfigs.map((config, index) => ({
            grids: config.grids || [[], []],
            steps: config.steps || 0,
            boundaries: config.boundaries || {
              xmin: -6,
              xmax: 6,
              ymin: -6,
              ymax: 6,
            },
            waypoints: config.waypoints || [],
            exclusive_points: config.exclusive_points || [],
          }));
        } catch (error) {
          console.error(
            "Error parsing JavaScript configuration:",
            error
          );
          throw new Error("Invalid JavaScript configuration format");
        }
      }
    }
    throw new Error("No valid configuration found in HTML content");
  }

  // Robust v2 Rust parsing logic with depth-aware tokenization
  const configs = [];

  // Clean input: remove comments and normalize whitespace
  let cleanInput = inputText
    .replace(/\/\*[\s\S]*?\*\/|\/\/[^\r\n]*/g, "") // Remove comments
    .replace(/\s+/g, " ") // Normalize whitespace
    .trim();

  // Remove outer vec![] wrapper if present
  const vecMatch = cleanInput.match(
    /^\s*vec!\s*\[\s*([\s\S]*)\s*\]\s*$/
  );
  if (vecMatch) {
    cleanInput = vecMatch[1].trim();
  }

  // Depth-aware tokenizer to find SimulationConfig::new(...) blocks
  const findSimulationConfigs = (text) => {
    const configs = [];
    let pos = 0;

    while (pos < text.length) {
      // Find next SimulationConfig::new
      const configStart = text.indexOf("SimulationConfig::new", pos);
      if (configStart === -1) break;

      // Find opening parenthesis
      const parenStart = text.indexOf("(", configStart);
      if (parenStart === -1) break;

      // Track depth to find matching closing parenthesis
      let depth = 0;
      let inString = false;
      let escapeNext = false;
      let configEnd = parenStart;

      for (let i = parenStart; i < text.length; i++) {
        const char = text[i];

        if (escapeNext) {
          escapeNext = false;
          continue;
        }

        if (char === "\\" && inString) {
          escapeNext = true;
          continue;
        }

        if (char === "'" && !escapeNext) {
          inString = !inString;
          continue;
        }

        if (!inString) {
          if (char === "(" || char === "[") {
            depth++;
          } else if (char === ")" || char === "]") {
            depth--;
            if (depth === 0) {
              configEnd = i;
              break;
            }
          }
        }
      }

      if (depth === 0) {
        const configBlock = text.substring(parenStart + 1, configEnd);
        configs.push(configBlock.trim());
        pos = configEnd + 1;
      } else {
        throw new Error(
          `Unmatched parentheses in SimulationConfig starting at position ${configStart}`
        );
      }
    }

    return configs;
  };

  // Parse each SimulationConfig block
  const configBlocks = findSimulationConfigs(cleanInput);
  if (configBlocks.length === 0) {
    throw new Error(
      "No valid SimulationConfig::new blocks found in the input"
    );
  }

  configBlocks.forEach((blockContent, blockIndex) => {
    try {
      // Parse parameters with depth-aware comma splitting
      const parseParameters = (content) => {
        const params = [];
        let currentParam = "";
        let depth = 0;
        let inString = false;
        let escapeNext = false;

        for (let i = 0; i < content.length; i++) {
          const char = content[i];

          if (escapeNext) {
            currentParam += char;
            escapeNext = false;
            continue;
          }

          if (char === "\\" && inString) {
            currentParam += char;
            escapeNext = true;
            continue;
          }

          if (char === "'" && !escapeNext) {
            inString = !inString;
            currentParam += char;
            continue;
          }

          if (!inString) {
            if (char === "(" || char === "[") {
              depth++;
            } else if (char === ")" || char === "]") {
              depth--;
            } else if (char === "," && depth === 0) {
              params.push(currentParam.trim());
              currentParam = "";
              continue;
            }
          }

          currentParam += char;
        }

        if (currentParam.trim()) {
          params.push(currentParam.trim());
        }

        return params;
      };

      const params = parseParameters(blockContent);
      if (params.length < 4) {
        throw new Error(
          `Frame ${blockIndex}: Expected at least 4 parameters, got ${params.length}`
        );
      }

      // Helper functions for parsing specific data types
      const parseRobotVec = (vecStr) => {
        if (!vecStr || vecStr.trim() === "vec![]") return [];

        const tuples = [];
        const content = vecStr
          .replace(/^vec!\s*\[\s*/, "")
          .replace(/\s*\]\s*$/, "");
        if (!content.trim()) return [];

        const tupleRegex =
          /\(\s*'([RGBOLF])'\s*,\s*(-?\d+)\s*,\s*(-?\d+)\s*\)/g;
        let tupleMatch;
        while ((tupleMatch = tupleRegex.exec(content)) !== null) {
          tuples.push([
            tupleMatch[1],
            Number(tupleMatch[2]),
            Number(tupleMatch[3]),
          ]);
        }
        return tuples;
      };

      const parsePointVec = (vecStr) => {
        if (
          !vecStr ||
          vecStr.trim() === "vec![]" ||
          vecStr.trim() === "None"
        )
          return [];

        const points = [];
        const content = vecStr
          .replace(/^vec!\s*\[\s*/, "")
          .replace(/\s*\]\s*$/, "");
        if (!content.trim()) return [];

        const pointRegex = /\(\s*(-?\d+)\s*,\s*(-?\d+)\s*\)/g;
        let pointMatch;
        while ((pointMatch = pointRegex.exec(content)) !== null) {
          points.push([Number(pointMatch[1]), Number(pointMatch[2])]);
        }
        return points;
      };

      const parseTargetsVec = (vecStr) => {
        if (!vecStr || vecStr.trim() === "vec![]") return [];

        const targets = [];
        const content = vecStr
          .replace(/^vec!\s*\[\s*/, "")
          .replace(/\s*\]\s*$/, "");
        if (!content.trim()) return [];

        // Parse target tuples: (steps, robots_vec, exclusive_vec, waypoints_vec)
        const targetParams = parseParameters(content);

        for (const targetParam of targetParams) {
          const trimmed = targetParam.trim();
          if (!trimmed.startsWith("(") || !trimmed.endsWith(")"))
            continue;

          const tupleContent = trimmed.substring(1, trimmed.length - 1);
          const tupleParams = parseParameters(tupleContent);

          if (tupleParams.length !== 4) {
            throw new Error(
              `Target tuple expected 4 elements (steps, robots, exclusive, waypoints), got ${tupleParams.length}`
            );
          }

          const steps = Math.max(0, Number(tupleParams[0]) || 5); // Clamp to >= 0, default 5
          const robots = parseRobotVec(tupleParams[1]);
          const exclusive = parsePointVec(tupleParams[2]);
          const waypoints = parsePointVec(tupleParams[3]);

          targets.push({ steps, robots, exclusive, waypoints });
        }

        return targets;
      };

      const parseBoundaries = (boundariesStr) => {
        const defaultBounds = { xmin: -6, xmax: 6, ymin: -6, ymax: 6 };

        if (!boundariesStr || boundariesStr.trim() === "None") {
          return defaultBounds;
        }

        // Extract tuple from Some((...))
        const someMatch = boundariesStr.match(
          /Some\s*\(\s*\(\s*(-?\d+)\s*,\s*(-?\d+)\s*,\s*(-?\d+)\s*,\s*(-?\d+)\s*\)\s*\)/
        );
        if (someMatch) {
          let xmin = Number(someMatch[1]);
          let xmax = Number(someMatch[2]);
          let ymin = Number(someMatch[3]);
          let ymax = Number(someMatch[4]);

          // Ensure proper ordering
          if (xmin > xmax) [xmin, xmax] = [xmax, xmin];
          if (ymin > ymax) [ymin, ymax] = [ymax, ymin];

          return { xmin, xmax, ymin, ymax };
        }

        return defaultBounds;
      };

      const parseWalls = (wallsStr, boundaries) => {
        const walls = [];
        if (
          !wallsStr ||
          wallsStr.trim() === "(None,None)" ||
          wallsStr.trim() === "(None, None)"
        ) {
          return walls;
        }

        // Remove outer parentheses and split by comma
        const wallContent = wallsStr
          .replace(/^\(\s*/, "")
          .replace(/\s*\)$/, "");
        const wallParams = parseParameters(wallContent);

        if (wallParams.length >= 2) {
          // Parse vertical wall (first parameter)
          const verticalParam = wallParams[0].trim();
          const verticalMatch = verticalParam.match(
            /Some\s*\(\s*(-?\d+)\s*\)/
          );
          if (verticalMatch) {
            const x = Number(verticalMatch[1]);
            walls.push({
              type: "vertical",
              x1: x,
              y1: boundaries.ymin - 5, // Extend beyond boundaries
              x2: x,
              y2: boundaries.ymax + 5,
            });
          }

          // Parse horizontal wall (second parameter)
          const horizontalParam = wallParams[1].trim();
          const horizontalMatch = horizontalParam.match(
            /Some\s*\(\s*(-?\d+)\s*\)/
          );
          if (horizontalMatch) {
            const y = Number(horizontalMatch[1]);
            walls.push({
              type: "horizontal",
              x1: boundaries.xmin - 5, // Extend beyond boundaries
              y1: y,
              x2: boundaries.xmax + 5,
              y2: y,
            });
          }
        }

        return walls;
      };

      // Parse v2 format: starting_grid, targets_vec, boundaries, walls
      const startingGridStr = params[0];
      const targetsStr = params[1];
      const boundariesStr = params[2];
      const wallsStr = params[3];

      // Parse boundaries first (needed for wall extension)
      const boundaries = parseBoundaries(boundariesStr);

      // Parse starting grid
      const startingGrid = parseRobotVec(startingGridStr);

      // Parse targets
      const targets = parseTargetsVec(targetsStr);

      // Parse walls
      const walls = parseWalls(wallsStr, boundaries);

      // Build internal data structure
      const grids = [startingGrid];
      const gridSteps = [0]; // Starting position always has 0 steps
      const gridWaypoints = [[]]; // Starting grid has no waypoints
      const gridExclusivePoints = [[]]; // Starting grid has no exclusive points

      // Add target grids
      targets.forEach((target) => {
        grids.push(target.robots);
        gridSteps.push(target.steps);
        gridWaypoints.push(normalizePoints(target.waypoints || []));
        gridExclusivePoints.push(normalizePoints(target.exclusive || []));
      });

      // Ensure we have at least 2 grids (starting + 1 target)
      while (grids.length < 2) {
        grids.push([]);
        gridSteps.push(5); // Default steps
        gridWaypoints.push([]);
        gridExclusivePoints.push([]);
      }

      // Calculate total steps (sum of target grid steps)
      const totalSteps = gridSteps
        .slice(1)
        .reduce((sum, steps) => sum + steps, 0);

      configs.push({
        id: `cfg-loaded-${Date.now()}-${blockIndex}`,
        grids,
        steps: totalSteps,
        gridSteps,
        gridWaypoints,
        gridExclusivePoints,
        boundaries,
        walls,
        needsRedraw: true,
      });
    } catch (error) {
      throw new Error(`Frame ${blockIndex}: ${error.message}`);
    }
  });

  if (configs.length === 0) {
    throw new Error(
      "No valid SimulationConfig::new blocks found in the input"
    );
  }

  // Validate and fix any structural issues
  configs.forEach((config, index) => {
    // Ensure minimum grid count
    while (config.grids.length < 2) {
      config.grids.push([]);
    }

    // Ensure gridSteps, gridWaypoints, gridExclusivePoints match grids length
    while (config.gridSteps.length < config.grids.length) {
      config.gridSteps.push(5);
    }
    while (config.gridWaypoints.length < config.grids.length) {
      config.gridWaypoints.push([]);
    }
    while (config.gridExclusivePoints.length < config.grids.length) {
      config.gridExclusivePoints.push([]);
    }

    // Recalculate total steps
    config.steps = config.gridSteps
      .slice(1)
      .reduce((sum, steps) => sum + steps, 0);
  });

  return configs;
}

// --- Initialization ---
function initialize() {
  console.log("=== Initialize called ===");
  console.log(
    "Current defaultSimulationConfigList configs:",
    (defaultSimulationConfigList.goals || []).length
  );

  // Parse configs from defaultSimulationConfigList OR window.loadedGoalsData at initialization time
  let initialData = undefined;
  if (window.loadedGoalsData) {
    console.log("Using window.loadedGoalsData for initialization");
    initialData = window.loadedGoalsData;
  }
  window.activeSimulationConfigs = parseDefaultConfigs(initialData);
  console.log(
    "Loaded",
    window.activeSimulationConfigs.length,
    "simulation configs"
  );

  // Check if running in iframe
  if (window.self !== window.top) {
    document.body.classList.add("in-iframe");
    // Hide editor panel by default in iframe mode
    if (!isEditorHidden) {
      toggleEditor();
    }
  }

  // No localStorage loading - configs come from postMessage only
  // const cached = loadConfigsFromLocalStorage();
  // if (cached && cached.length > 0) {
  //   activeSimulationConfigs = cached;
  // }

  // Migrate old data format if necessary
  window.activeSimulationConfigs.forEach((config) => {
    if (config.startRobots || config.endRobots) {
      config.grids = [];
      if (config.startRobots) config.grids.push(config.startRobots);
      if (config.endRobots) config.grids.push(config.endRobots);
      delete config.startRobots;
      delete config.endRobots;
    }
    // Ensure waypoints and exclusive_points exist
    if (!config.waypoints) config.waypoints = [];
    if (!config.exclusive_points) config.exclusive_points = [];
    if (!config.walls) config.walls = [];

    // Migrate to new per-grid waypoints/exclusive points format
    if (!config.gridWaypoints || !config.gridExclusivePoints) {
      const gridCount = Math.max(2, (config.grids || []).length);
      config.gridWaypoints = new Array(gridCount)
        .fill(null)
        .map(() => []);
      config.gridExclusivePoints = new Array(gridCount)
        .fill(null)
        .map(() => []);

      // If there were legacy global waypoints/exclusive_points, distribute them to target grids
      if (config.waypoints && config.waypoints.length > 0) {
        for (let i = 1; i < gridCount; i++) {
          config.gridWaypoints[i] = [...config.waypoints];
        }
      }
      if (
        config.exclusive_points &&
        config.exclusive_points.length > 0
      ) {
        for (let i = 1; i < gridCount; i++) {
          config.gridExclusivePoints[i] = [...config.exclusive_points];
        }
      }
    }

    // Migrate to new gridSteps format
    if (!config.gridSteps || config.gridSteps.length === 0) {
      config.gridSteps = Array(config.grids.length).fill(0);
      // Set starting position to 0, and distribute remaining steps among target grids
      if (config.gridSteps.length > 1) {
        const totalSteps = config.steps || 5;
        const numTargetGrids = config.gridSteps.length - 1;
        const stepsPerGrid = Math.floor(totalSteps / numTargetGrids);
        const remainder = totalSteps % numTargetGrids;

        for (let i = 1; i < config.gridSteps.length; i++) {
          config.gridSteps[i] = stepsPerGrid;
          // Add remainder to the last grid
          if (i === config.gridSteps.length - 1) {
            config.gridSteps[i] += remainder;
          }
        }

        // Update total steps to match calculated gridSteps
        config.steps = config.gridSteps
          .slice(1)
          .reduce((sum, steps) => sum + steps, 0);
      }
    } else if (config.gridSteps.length !== config.grids.length) {
      // Handle case where gridSteps array length doesn't match grids length
      const oldGridSteps = [...config.gridSteps];
      config.gridSteps = Array(config.grids.length).fill(0);

      // Copy existing values where possible
      for (
        let i = 0;
        i < Math.min(oldGridSteps.length, config.gridSteps.length);
        i++
      ) {
        config.gridSteps[i] = oldGridSteps[i];
      }

      // If we have more grids than gridSteps, distribute remaining steps
      if (config.grids.length > oldGridSteps.length) {
        const totalSteps = config.steps || 5;
        const currentTotal = config.gridSteps
          .slice(1)
          .reduce((sum, steps) => sum + steps, 0);
        const remainingSteps = Math.max(0, totalSteps - currentTotal);
        const numNewGrids = config.grids.length - oldGridSteps.length;

        if (numNewGrids > 0 && remainingSteps > 0) {
          const stepsPerNewGrid = Math.floor(
            remainingSteps / numNewGrids
          );
          const remainder = remainingSteps % numNewGrids;

          for (
            let i = oldGridSteps.length;
            i < config.gridSteps.length;
            i++
          ) {
            config.gridSteps[i] = stepsPerNewGrid;
            if (i === config.gridSteps.length - 1) {
              config.gridSteps[i] += remainder;
            }
          }
        }
      }
    }

    // Ensure steps is properly calculated from gridSteps
    if (config.gridSteps && config.gridSteps.length > 1) {
      config.steps = config.gridSteps
        .slice(1)
        .reduce((sum, steps) => sum + steps, 0);
    }
  });

  if (simulatorColumn) {
    simulatorColumn.addEventListener("dragover", handleFrameDragOver);
    simulatorColumn.addEventListener("dragleave", handleFrameDragLeave);
    simulatorColumn.addEventListener("drop", handleFrameDrop);
  }
  if (addFrameBtn) {
    addFrameBtn.addEventListener("click", addNewFrame);
  }
  document
    .querySelector(".robot-palette")
    ?.addEventListener("mousedown", handlePaletteDragStart);

  setupModalAndParser();
  initializeResizeAndToggle();
  applyLayoutFromStorage();
  renderAllFrames();

  // Update all frame titles to ensure they show correct total steps
  activeSimulationConfigs.forEach((config) => {
    updateFrameTitle(config.id);
  });

  // Ensure event listeners are attached after a short delay to handle any timing issues
  setTimeout(() => {
    // Re-attach canvas event listeners as a safety measure
    document
      .querySelectorAll(".simulation-frame canvas")
      .forEach((canvas) => {
        // Remove existing listener first to avoid duplicates
        canvas.removeEventListener("mousedown", handleCanvasMouseDown);
        // Add the listener
        canvas.addEventListener("mousedown", handleCanvasMouseDown);
      });
  }, 100);
}

// Global mouseup handler for wall drag operations
document.addEventListener("mouseup", (e) => {
  if (draggedWallData) {
    // Find the exact element under mouse cursor
    const elementUnderMouse = document.elementFromPoint(
      e.clientX,
      e.clientY
    );

    // Check if the element is a canvas (or contained within a canvas)
    let targetCanvas = null;
    if (elementUnderMouse) {
      if (elementUnderMouse.tagName === "CANVAS") {
        targetCanvas = elementUnderMouse;
      } else {
        // Check if clicked element is inside a canvas container
        const canvasParent =
          elementUnderMouse.closest(".frame-container");
        if (canvasParent) {
          targetCanvas = canvasParent.querySelector("canvas");
        }
      }
    }

    // Handle wall drop (adds to target canvas or deletes if outside)
    handleWallDrop(targetCanvas, e.clientX, e.clientY);
  }
});

// Expose initialize function to be called from main page
window.initializeEmbeddedGoalsSimulator = initialize;

// Auto-initialize if this code is being run standalone (not embedded)
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initialize);
} else {
  // DOM already loaded, initialize immediately if standalone
  if (!document.getElementById("page-1")) {
    initialize();
  }
}

// --- Message Listener for Iframe Communication ---
window.addEventListener("message", (event) => {
  if (event.data && event.data.type === "LOAD_CONFIG") {
    console.log("Received config via postMessage:", event.data.payload);
    const newConfigs = event.data.payload;

    if (Array.isArray(newConfigs) && newConfigs.length > 0) {
      // Update active configs
      window.activeSimulationConfigs = newConfigs;

      // Ensure all configs have necessary properties
      window.activeSimulationConfigs.forEach((config) => {
        if (!config.needsRedraw) config.needsRedraw = true;
        // Ensure grids/steps/waypoints arrays are consistent
        if (!config.gridSteps)
          config.gridSteps = config.grids.map(() => 5);
        if (!config.gridWaypoints)
          config.gridWaypoints = config.grids.map(() => []);
        if (!config.gridExclusivePoints)
          config.gridExclusivePoints = config.grids.map(() => []);
      });

      // Refresh UI
      renderAllFrames();
      updateFullConfigTextArea();
      saveConfigsToLocalStorage();

      // Update titles
      activeSimulationConfigs.forEach((config) => {
        updateFrameTitle(config.id);
      });
    }
  } else if (
    event.data &&
    event.data.type === "UPDATE_DEFAULT_CONFIG"
  ) {
    console.log(
      "Updating defaultSimulationConfigList:",
      event.data.payload
    );
    // Update the default simulation config list with new goals data
    // Support both string and object payloads
    defaultSimulationConfigList = typeof event.data.payload === 'string'
      ? JSON.parse(event.data.payload)
      : event.data.payload;

    // Also update localStorage with the new default
    try {
      const parsedData = defaultSimulationConfigList;
      if (
        parsedData &&
        parsedData.goals &&
        Array.isArray(parsedData.goals)
      ) {
        const defaultConfigs = parsedData.goals.map(
          (config, index) => {
            const boundaries = config.boundary || [-6, 6, -6, 6];
            const walls = [];

            if (config.wall && config.wall.length >= 2) {
              const [verticalWall, horizontalWall] = config.wall;

              if (verticalWall !== null) {
                walls.push({
                  type: "vertical",
                  x1: verticalWall,
                  y1: boundaries[2] - 5,
                  x2: verticalWall,
                  y2: boundaries[3] + 5,
                });
              }

              if (horizontalWall !== null) {
                walls.push({
                  type: "horizontal",
                  x1: boundaries[0] - 5,
                  y1: horizontalWall,
                  x2: boundaries[1] + 5,
                  y2: horizontalWall,
                });
              }
            }

            const grids = [config.initial_positions || []];
            const gridSteps = [0];
            const gridWaypoints = [[]];
            const gridExclusivePoints = [[]];

            if (config.targets && Array.isArray(config.targets)) {
              config.targets.forEach((target) => {
                if (Array.isArray(target) && target.length >= 4) {
                  const [steps, robots, exclusive, waypoints] = target;
                  grids.push(robots || []);
                  gridSteps.push(steps || 5);
                  gridWaypoints.push(waypoints || []);
                  gridExclusivePoints.push(exclusive || []);
                }
              });
            }

            if (grids.length < 2) {
              grids.push([]);
              gridSteps.push(5);
              gridWaypoints.push([]);
              gridExclusivePoints.push([]);
            }

            const totalSteps = gridSteps
              .slice(1)
              .reduce((sum, steps) => sum + steps, 0);

            return {
              id: `cfg-default-${Date.now()}-${index}`,
              grids,
              steps: totalSteps,
              gridSteps,
              gridWaypoints,
              gridExclusivePoints,
              boundaries: {
                xmin: boundaries[0],
                xmax: boundaries[1],
                ymin: boundaries[2],
                ymax: boundaries[3],
              },
              walls,
              needsRedraw: true,
            };
          }
        );

        localStorage.setItem(
          LOCAL_STORAGE_KEY,
          JSON.stringify(defaultConfigs)
        );
        window.activeSimulationConfigs = defaultConfigs;
        renderAllFrames();
        updateFullConfigTextArea();
      }
    } catch (e) {
      console.error("Error updating default config:", e);
    }
  }
});
// === EMBEDDED GOALS SIMULATOR CODE END ===
