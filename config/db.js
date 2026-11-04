const mongoose = require("mongoose");

const connectDB = async () => {
    try {
        const uri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/cmms";
        await mongoose.connect(uri);

        console.log("MongoDB Connected Successfully!");
        console.log("Database:", mongoose.connection.name);

        // Drop any obsolete leftover indexes (like partCode_1) that cause duplicate key errors
        try {
            const sparesColl = mongoose.connection.db.collection('spares');
            const indexes = await sparesColl.indexes();
            for (const idx of indexes) {
                if (idx.name === 'partCode_1' || idx.name === 'partName_1') {
                    console.log(`Dropping obsolete index "${idx.name}" from spares collection...`);
                    await sparesColl.dropIndex(idx.name);
                }
            }
        } catch (idxErr) {
            // Ignore if index doesn't exist
        }

    } catch (error) {
        console.log("MongoDB Connection Failed:", error.message);
        process.exit(1);
    }
};

module.exports = connectDB;
