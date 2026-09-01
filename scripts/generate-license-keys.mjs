import { generateKeyPairSync } from "crypto";

const { publicKey, privateKey } = generateKeyPairSync("ec", {
  namedCurve: "P-256",
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});

const escape = (pem) => pem.replace(/\n/g, "\\n");

console.log("# Add these to root .env (private key is server-only)");
console.log(`LICENSE_PRIVATE_KEY="${escape(privateKey)}"`);
console.log(`LICENSE_PUBLIC_KEY="${escape(publicKey)}"`);
console.log(`VITE_LICENSE_PUBLIC_KEY="${escape(publicKey)}"`);
console.log("OFFLINE_LICENSE_DURATION_HOURS=168");
