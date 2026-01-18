require('dotenv').config();
const mongoose = require('mongoose');

const debugDb = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to:', process.env.MONGO_URI);
    console.log('📂 Database Name:', conn.connection.name);
    
    // Check collections
    const collections = await conn.connection.db.listCollections().toArray();
    console.log('\n📊 Collections:');
    
    for (const col of collections) {
      const count = await conn.connection.db.collection(col.name).countDocuments();
      console.log(`   - ${col.name}: ${count} docs`);
    }

    // List Databses (if possible)
    try {
      const admin = conn.connection.db.admin();
      const dbs = await admin.listDatabases();
      console.log('\n🗄️  All Databases in Cluster:');
      dbs.databases.forEach(db => console.log(`   - ${db.name} (${db.sizeOnDisk} bytes)`));
    } catch (e) {
      console.log('   (Cannot list databases - insufficient permissions)');
    }

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

debugDb();
