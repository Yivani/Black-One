// Generates src/components/shared/Logo.tsx from the generated logo SVG.
// Replaces the near-black logo fill with currentColor so it adapts to the theme.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const logoPath = path.join(rootDir, "src-tauri", "icons", "logo.svg");
const outPath = path.join(rootDir, "src", "components", "shared", "Logo.tsx");

const logo = fs.readFileSync(logoPath, "utf8");
const bodyMatch = logo.match(/<svg[^>]*>([\s\S]*)<\/svg>/i);
if (!bodyMatch) {
  throw new Error("Could not parse logo.svg");
}

let body = bodyMatch[1];
body = body.replace(/<metadata>[\s\S]*?<\/metadata>/gi, "");
// Make the main shape theme-adaptive while preserving the purple core / white swoosh.
body = body.replace(/fill="rgb\(10,10,15\)"/g, 'fill="currentColor"');
// JSX uses className instead of class.
body = body.replace(/\bclass=/g, "className=");
body = body
  .replace(/\bstop-opacity=/g, "stopOpacity=")
  .replace(/\bstop-color=/g, "stopColor=")
  .replace(/\bfill-opacity=/g, "fillOpacity=");

const component = `import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  size?: number;
}

export function Logo({ className, size = 24 }: LogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 2048 2048"
      width={size}
      height={size}
      className={cn("shrink-0", className)}
      aria-hidden="true"
    >
${body.trim()}
    </svg>
  );
}
`;

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, component);
console.log(`wrote ${path.relative(rootDir, outPath)}`);
