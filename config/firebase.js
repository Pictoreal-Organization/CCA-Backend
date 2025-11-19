const admin = require("firebase-admin");
require('dotenv').config(); // Load env vars

let serviceAccount;

// 1. Check if the environment variable exists (Production/Render)
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  // Parse the string back into an object
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
} else {
  // 2. Fallback to the local file (Local Development)
  // This keeps it working on your PC if you have the file locally
  try {
    serviceAccount = require("../firebase-service-account.json");
  } catch (e) {
    console.error("❌ No Firebase credentials found (Env Var or File).");
  }
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

module.exports = admin;