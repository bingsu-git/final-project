const admin = require("firebase-admin");

// Firebase Admin SDK 초기화
const serviceAccount = require("../serviceAccountKey.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// 토큰을 검증하고 사용자 정보를 req 객체에 추가하는 미들웨어
async function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(403).send("Unauthorized");
  }

  const idToken = authHeader.split("Bearer ")[1];

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    req.user = decodedToken; // req.user에 { uid, email, ... } 정보가 담김
    next();
  } catch (error) {
    console.error("Firebase 토큰 검증 오류:", error);
    return res.status(403).send("Unauthorized");
  }
}

module.exports = verifyToken;
