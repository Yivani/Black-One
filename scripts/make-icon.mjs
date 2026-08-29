// Composes the generated logo onto a dark rounded-square background and rebuilds
// the full Tauri icon set from src-tauri/icons/icon-source.svg.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const iconsDir = path.join(rootDir, "src-tauri", "icons");
const logoPath = path.join(iconsDir, "logo.svg");
const sourcePath = path.join(iconsDir, "icon-source.svg");

if (!fs.existsSync(logoPath)) {
  throw new Error(`Missing ${logoPath}. Generate or place a logo.svg first.`);
}

const logo = fs.readFileSync(logoPath, "utf8");
const bodyMatch = logo.match(/<svg[^>]*>([\s\S]*)<\/svg>/i);
if (!bodyMatch) {
  throw new Error("Could not parse logo.svg");
}

let body = bodyMatch[1];
body = body.replace(/<metadata>[\s\S]*?<\/metadata>/gi, "");
// Lighten the near-black logo fill so the shape reads cleanly on the dark background.
body = body.replace(/fill="rgb\(10,10,15\)"/g, 'fill="rgb(60,60,80)"');

const sourceSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2048 2048" width="1024" height="1024">
  <rect width="2048" height="2048" rx="460" ry="460" fill="#1E1E28"/>
  ${body.trim()}
</svg>
`;

fs.mkdirSync(iconsDir, { recursive: true });
fs.writeFileSync(sourcePath, sourceSvg);
console.log(`wrote ${path.relative(rootDir, sourcePath)}`);

const logoComponentScript = path.join(rootDir, "scripts", "make-logo-component.mjs");
const logoComponentCmd = `node "${logoComponentScript}"`;
console.log(`running: ${logoComponentCmd}`);
execSync(logoComponentCmd, { stdio: "inherit", cwd: rootDir });

const cmd = `npx tauri icon "${sourcePath}" --output "${iconsDir}"`;
console.log(`running: ${cmd}`);
execSync(cmd, { stdio: "inherit", cwd: rootDir });
console.log("\nIcon set regenerated.");
