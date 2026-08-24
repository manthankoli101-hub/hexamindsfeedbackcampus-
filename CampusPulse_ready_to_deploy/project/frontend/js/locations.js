// Shared campus floorplan location data.
// Rooms are rectangles given as [x1, y1, x2, y2] in pixel coordinates read
// directly off the 1553 x 1013 floorplan image (top-left origin), same
// coordinate system used by the Leaflet overlay in js/floorplan-image.js +
// js/map.js. x/y (the dot position) is the rectangle's own center, computed
// below — same room shapes as the floorplan file, so edit `rect` there and
// this stays in sync.
//
// This file is the single source of truth for location names, so the
// "Location" dropdown on the report form and the rooms on the Severity
// Map always line up.

const FLOORPLAN_IMG_WIDTH = 1553;
const FLOORPLAN_IMG_HEIGHT = 1013;

const CAMPUS_LOCATIONS = [
  // ---- B Wing (top-left) ----
  { name: "B Wing",          rect: [65, 65, 357, 231],    note: "B Wing entrance area." },
  { name: "B1",               rect: [103, 231, 283, 350],  note: "Classroom / office B1." },
  { name: "B2",               rect: [103, 350, 283, 473],  note: "Classroom / office B2." },
  { name: "B3",               rect: [103, 473, 283, 599],  note: "Classroom / office B3." },
  { name: "Toilet (M) - B",   rect: [352, 395, 452, 445],  note: "Men's toilet, B Wing." },
  { name: "Toilet (F) - B",   rect: [352, 445, 452, 500],  note: "Women's toilet, B Wing." },
  { name: "Wash Area - B",    rect: [352, 500, 452, 600],  note: "Wash area, B Wing." },

  // ---- Ground (central courtyard) ----
  { name: "Ground",           rect: [559, 65, 992, 599],   note: "Central open ground / courtyard." },

  // ---- C Wing (top-right) ----
  { name: "C Wing",           rect: [1193, 65, 1480, 231], note: "C Wing entrance area." },
  { name: "Toilet (M) - C",   rect: [1089, 395, 1191, 445], note: "Men's toilet, C Wing." },
  { name: "Toilet (F) - C",   rect: [1089, 445, 1191, 500], note: "Women's toilet, C Wing." },
  { name: "Wash Area - C",    rect: [1089, 500, 1191, 600], note: "Wash area, C Wing." },
  { name: "C1",               rect: [1258, 231, 1440, 350], note: "Classroom / office C1." },
  { name: "C2",               rect: [1258, 350, 1440, 473], note: "Classroom / office C2." },
  { name: "C3",               rect: [1258, 473, 1440, 599], note: "Classroom / office C3." },

  // ---- A Wing + Canteen (bottom row) ----
  { name: "A Wing",           rect: [75, 600, 300, 938],   note: "A Wing entrance area." },
  { name: "A1",                rect: [300, 683, 428, 938],  note: "Classroom / office A1." },
  { name: "A2",                rect: [428, 683, 542, 938],  note: "Classroom / office A2." },
  { name: "A3",                rect: [542, 683, 663, 938],  note: "Classroom / office A3." },
  { name: "A4",                rect: [845, 683, 977, 938],  note: "Classroom / office A4." },
  { name: "A5",                rect: [977, 683, 1110, 938], note: "Classroom / office A5." },
  { name: "A6",                rect: [1110, 683, 1245, 938],note: "Classroom / office A6." },
  { name: "Canteen",          rect: [1245, 600, 1470, 938], note: "Canteen." }
].map((room) => ({
  ...room,
  x: (room.rect[0] + room.rect[2]) / 2,
  y: (room.rect[1] + room.rect[3]) / 2
}));

window.FLOORPLAN_IMG_WIDTH = FLOORPLAN_IMG_WIDTH;
window.FLOORPLAN_IMG_HEIGHT = FLOORPLAN_IMG_HEIGHT;
window.CAMPUS_LOCATIONS = CAMPUS_LOCATIONS;
