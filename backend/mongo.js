const mongoose = require("mongoose");

async function connectMongo() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      dbName: 'ragdb',          // <<< 명시
    });
    console.log("MongoDB 연결 성공");
  } catch (err) {
    console.error("MongoDB 연결 실패:", err.message);
  }
}

module.exports = connectMongo;
