import express from "express";

const app = express();

app.get("/debug", (req, res) => {
  res.json({
    geminiKey: process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.substring(0, 5) + "..." : "missing",
    apiKey: process.env.API_KEY ? process.env.API_KEY.substring(0, 5) + "..." : "missing"
  });
});

app.listen(3001, () => "Debug server on 3001");
