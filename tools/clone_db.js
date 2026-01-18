require('dotenv').config();
const mongoose = require('mongoose');

// Force the test DB name
const SOURCE_URI = 'mongodb+srv://cca_admin:vzeREh25V3nsdXHl@cluster0.siijxhd.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';
const TARGET_URI = 'mongodb+srv://riddhi:riddhi_atlas_pw@cluster0.bzzm3.mongodb.net/';

if (SOURCE_URI === TARGET_URI) {
  console.error('❌ Source and Target URIs are the same. Aborting to prevent data loss.');
  process.exit(1);
}

const cloneDatabase = async () => {
  try {
    console.log(`🔌 Connecting to Source: ${SOURCE_URI.split('?')[0]}...`);
    const srcConn = await mongoose.createConnection(SOURCE_URI).asPromise();
    console.log('✅ Connected to Source');

    console.log(`🔌 Connecting to Target: ${TARGET_URI.split('?')[0]}...`);
    const tgtConn = await mongoose.createConnection(TARGET_URI).asPromise();
    console.log('✅ Connected to Target');
    
    // Get all collection names from source
    const collections = await srcConn.db.listCollections().toArray();

    for (const colInfo of collections) {
      const colName = colInfo.name;
      if (colName.startsWith('system.')) continue;
      
      console.log(`\n📦 Cloning collection: ${colName}...`);
      
      const srcCol = srcConn.db.collection(colName);
      const tgtCol = tgtConn.db.collection(colName);

      // Clear target collection
      await tgtCol.deleteMany({});
      
      // Copy data
      const docs = await srcCol.find().toArray();
      if (docs.length > 0) {
        await tgtCol.insertMany(docs);
        console.log(`   ✨ Copied ${docs.length} documents.`);
      } else {
        console.log(`   🔸 Empty collection, skipped data copy.`);
      }
    }

    console.log('\n🎉 Database cloning completed successfully!');
    console.log(`\nIMPORTANT: Use this URI for testing:\n${TARGET_URI}`);
    
    await srcConn.close();
    await tgtConn.close();
    process.exit(0);
  } catch (err) {
    console.error('❌ Error cloning database:', err);
    process.exit(1);
  }
};

cloneDatabase();
