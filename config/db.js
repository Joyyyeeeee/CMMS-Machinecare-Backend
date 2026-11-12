const mongoose = require("mongoose");

const connectDB = async () => {
    try {
        const uri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/cmms";

        console.log("Connecting to MongoDB...");
        const maskedUri = uri.replace(/:([^:@]+)@/, ":****@");
        console.log("Target URI:", maskedUri);

        await mongoose.connect(uri, {
            serverSelectionTimeoutMS: 10000
        });

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
        console.error("=========================================");
        console.error("MongoDB Connection Failed!");
        console.error("Error Name:", error.name);
        console.error("Error Message:", error.message);
        if (error.message.includes("bad auth") || error.message.includes("Authentication failed")) {
            console.error("-> CAUSE: Invalid username or password in MONGO_URI in backend/.env");
            console.error("-> FIX: Go to MongoDB Atlas -> Database Access -> ensure user 'abiakshaya206_db_user' exists and password matches.");
        } else if (error.message.includes("whitelist") || error.message.includes("timed out") || error.name === "MongooseServerSelectionError") {
            console.error("-> CAUSE: Your IP address is not whitelisted in MongoDB Atlas.");
            console.error("-> FIX: Go to MongoDB Atlas -> Network Access -> Add IP Address -> click 'Allow Access from Anywhere' (0.0.0.0/0) -> Confirm.");
        } else if (error.message.includes("querySrv")) {
            console.error("-> CAUSE: DNS resolution failed for the Atlas cluster URI.");
            console.error("-> FIX: Check cluster hostname or use standard connection string.");
        }
        console.error("=========================================");
        process.exit(1);
    }
};

module.exports = connectDB;
