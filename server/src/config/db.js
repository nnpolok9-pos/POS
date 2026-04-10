const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
const { MongoMemoryServer } = require("mongodb-memory-server");

let memoryServer;

const connectDB = async () => {
  try {
    let mongoUri = process.env.MONGO_URI;

    if (process.env.MONGO_MEMORY === "true") {
      const dataDir = path.join(process.cwd(), ".mongo-data", "mongo");
      fs.mkdirSync(dataDir, { recursive: true });

      memoryServer = await MongoMemoryServer.create({
        instance: {
          dbPath: dataDir,
          dbName: "fast-food-pos",
          storageEngine: "wiredTiger"
        }
      });

      mongoUri = memoryServer.getUri();
      console.log("Using local persistent MongoDB for development");
    }

    await mongoose.connect(mongoUri);
    console.log("MongoDB connected");
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    process.exit(1);
  }
};

const disconnectDB = async () => {
  await mongoose.connection.close();
  if (memoryServer) {
    await memoryServer.stop({ doCleanup: false });
  }
};

module.exports = { connectDB, disconnectDB };
