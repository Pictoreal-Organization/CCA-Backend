const admin = require("firebase-admin");
const serviceAccount = require("../firebase-service-account.json"); // Path to your JSON

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

module.exports = admin;