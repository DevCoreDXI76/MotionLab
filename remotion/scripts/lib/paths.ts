import path from "node:path";

// remotion/scripts/lib -> remotion/ -> MotionLab/
export const REMOTION_DIR = path.resolve(__dirname, "..", "..");
export const ROOT_DIR = path.resolve(REMOTION_DIR, "..");
export const PROJECTS_DIR = path.join(ROOT_DIR, "projects");
export const TEMPLATES_DIR = path.join(ROOT_DIR, "templates");
export const PUBLIC_DIR = path.join(REMOTION_DIR, "public");
