import { fileURLToPath } from 'node:url';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { Item } from '../dao/index.js';

const imagesDir = fileURLToPath(new URL('../public/images/uploads/', import.meta.url));
const imagesUrl = '/images/uploads/';
const maxBytes = 2 * 1024 * 1024;
const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function imageExtension(bytes) {
  if (bytes.length >= 4 && bytes[0] === 255 && bytes[1] === 216 && bytes.at(-2) === 255 && bytes.at(-1) === 217) return '.jpg';
  if (bytes.length >= 33 && bytes.subarray(0, 8).equals(pngSignature) && bytes.toString('ascii', 12, 16) === 'IHDR') return '.png';
  if (bytes.length >= 20 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP' &&
      bytes.readUInt32LE(4) + 8 === bytes.length) return '.webp';
  return null;
}

export async function storeCroppedImage(data) {
  if (typeof data !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(data) || data.length > Math.ceil(maxBytes / 3) * 4) {
    throw new Error('Image invalide ou trop volumineuse.');
  }
  const bytes = Buffer.from(data, 'base64');
  const extension = imageExtension(bytes);
  if (bytes.length > maxBytes || !extension) {
    throw new Error('Image invalide ou trop volumineuse.');
  }
  const name = randomUUID() + extension;
  await fs.mkdir(imagesDir, { recursive: true });
  await fs.writeFile(path.join(imagesDir, name), bytes, { flag: 'wx' });
  return imagesUrl + name;
}

export async function removeUnusedImage(url) {
  if (typeof url !== 'string' || !url.startsWith(imagesUrl)) return;
  try {
    if (await Item.count({ where: { image: url } })) return;
    await fs.unlink(path.join(imagesDir, path.basename(url)));
  } catch (error) {
    if (error.code !== 'ENOENT') console.error('Unable to clean up item image:', error.message);
  }
}
