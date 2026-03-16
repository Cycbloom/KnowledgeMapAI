import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import pngToIco from 'png-to-ico';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const buildDir = join(__dirname, '..', 'build');

const sizes = [16, 24, 32, 48, 64, 128, 256, 512];

async function createPngFromSvg() {
  console.log('Creating PNG files from SVG...');
  
  const svgPath = join(buildDir, 'icon.svg');
  const iconsDir = join(buildDir, 'icons');
  await fs.mkdir(iconsDir, { recursive: true });
  
  for (const size of sizes) {
    const outputPath = join(iconsDir, `${size}x${size}.png`);
    await sharp(svgPath)
      .resize(size, size)
      .png()
      .toFile(outputPath);
    console.log(`  Created: ${size}x${size}.png`);
  }
}

async function createIco() {
  console.log('Creating ICO file...');
  
  const pngBuffers = [];
  for (const size of [16, 24, 32, 48, 64, 128, 256]) {
    const pngPath = join(buildDir, 'icons', `${size}x${size}.png`);
    try {
      const buffer = await fs.readFile(pngPath);
      pngBuffers.push(buffer);
    } catch {
      console.warn(`  Warning: ${pngPath} not found`);
    }
  }
  
  if (pngBuffers.length === 0) {
    throw new Error('No PNG files found to create ICO');
  }
  
  const icoBuffer = await pngToIco(pngBuffers);
  const icoPath = join(buildDir, 'icon.ico');
  await fs.writeFile(icoPath, icoBuffer);
  console.log(`  Created: icon.ico`);
}

async function main() {
  try {
    await createPngFromSvg();
    await createIco();
    console.log('Icon generation complete!');
  } catch (error) {
    console.error('Error generating icons:', error);
    process.exit(1);
  }
}

main();
