// Regenerates all app icons from build/icon.svg (single source of truth).
// Usage: npm run icons:generate
import sharp from "sharp";
import pngToIco from "png-to-ico";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const svgBuffer = await readFile(resolve(root, "build/icon.svg"));

const PNG_SIZES = [16, 24, 32, 48, 64, 96, 128, 180, 192, 256, 512];
const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256];

// Render a high-res master (1024px) once, then Lanczos-downscale per size —
// much crisper at 16/24/32 than direct low-res rasterization.
async function render(size) {
  return sharp(svgBuffer, { density: 144 })
    .resize(size, size, { kernel: "lanczos3" })
    .png()
    .toBuffer();
}

await mkdir(resolve(root, "build/icons"), { recursive: true });
await mkdir(resolve(root, "public/icons"), { recursive: true });

for (const size of PNG_SIZES) {
  const buffer = await render(size);
  const name = `${size}x${size}.png`;
  await writeFile(resolve(root, "build/icons", name), buffer);
  await writeFile(resolve(root, "public/icons", name), buffer);
  console.log(`[icons] ${name} -> build/icons + public/icons`);
}

const icoBuffers = await Promise.all(ICO_SIZES.map(render));
await writeFile(resolve(root, "build/icon.ico"), await pngToIco(icoBuffers));
console.log(`[icons] icon.ico (multi-size: ${ICO_SIZES.join(", ")}) -> build`);
console.log("[icons] done");
