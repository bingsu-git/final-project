const express = require("express");
const fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));
const Mistake = require("../models/Mistake");

const router = express.Router();

router.post("/analyze-pattern", async (req, res) => {
  const { text, sessionId } = req.body;

  if (!text || !sessionId) {
    return res.status(400).json({ error: "text와 sessionId는 필수입니다." });
  }

  try {
    // Flask 서버로 문장 분석 요청
    const flaskRes = await fetch("http://localhost:5001/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text })
    });

    const result = await flaskRes.json();

    // 패턴 감지된 경우만 저장
    if (result.patterns && result.patterns.length > 0) {
      for (const p of result.patterns) {
        await Mistake.create({
          sessionId,
          original: text,
          corrected: "", // 나중에 교정값도 넣을 수 있음
          explanation: p.explanation,
          pattern: p.pattern
        });
      }
    }

    return res.json({ success: true, result });

  } catch (err) {
    console.error("분석 중 에러:", err);
    return res.status(500).json({ error: "문법 분석 실패" });
  }
});

module.exports = router;
