import speakeasy from 'speakeasy';
import qrcode from 'qrcode-terminal';
import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SECRET_FILE = path.join(__dirname, '.2fa-secret.json');

function loadSecret() {
  try {
    const data = readFileSync(SECRET_FILE, 'utf8');
    return JSON.parse(data);
  } catch (e) {
    return null;
  }
}

function saveSecret(secret) {
  writeFileSync(SECRET_FILE, JSON.stringify(secret, null, 2));
}

function generateSecret() {
  return speakeasy.generateSecret({
    name: 'AyGift Admin',
    issuer: 'AyGift'
  });
}

function displayQR(secret) {
  const otpauthUrl = speakeasy.otpauthURL({
    secret: secret.ascii,
    label: 'AyGift Admin',
    issuer: 'AyGift'
  });
  console.log('Scan this QR code with Google Authenticator:');
  qrcode.generate(otpauthUrl, { small: true });
  console.log('Secret:', secret.ascii);
}

function main() {
  let secret = loadSecret();
  if (!secret) {
    console.log('No 2FA secret found. Generating new one...');
    secret = generateSecret();
    saveSecret(secret);
    console.log('Secret saved to .2fa-secret.json');
  } else {
    console.log('Using existing 2FA secret.');
  }

  displayQR(secret);
}

main();