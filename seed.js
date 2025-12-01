require('dotenv').config();
require('./db'); // MongoDB connection
const { spawn } = require('child_process');

function runScript(scriptName) {
  return new Promise((resolve, reject) => {
    console.log(`\n🚀 Running ${scriptName}...\n`);
    
    const child = spawn('node', [scriptName], {
      stdio: 'inherit', // Shows output in real-time
      shell: true
    });

    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`${scriptName} exited with code ${code}`));
      } else {
        console.log(`\n✅ ${scriptName} completed successfully!\n`);
        resolve();
      }
    });

    child.on('error', (err) => {
      reject(err);
    });
  });
}

async function seed() {
  try {
    console.log('🌱 Starting database seeding process...\n');
    console.log('═══════════════════════════════════════════════════\n');

    // Step 1: Import Core Team
    await runScript('importCoreTeam.js');

    // Step 2: Import Members
    await runScript('importMembers.js');

    console.log('═══════════════════════════════════════════════════');
    console.log('\n🎉 All seed data imported successfully!\n');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Error during seeding process:', err.message);
    process.exit(1);
  }
}

seed();