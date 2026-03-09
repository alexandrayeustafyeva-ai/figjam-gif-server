const express = require("express");
const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");
const axios = require("axios");

const app = express();
app.use(express.json({ limit: "10mb" }));

function extractFileId(url) {
  const patterns = [
    /\/file\/d\/([^/]+)/,
    /[?&]id=([^&]+)/,
    /\/d\/([^/]+)/
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

async function downloadFile(url, outputPath) {
  const response = await axios({
    url,
    method: "GET",
    responseType: "stream",
    maxRedirects: 10
  });

  return new Promise((resolve, reject) => {
    const writer = fs.createWriteStream(outputPath);
    response.data.pipe(writer);
    writer.on("finish", resolve);
    writer.on("error", reject);
  });
}

app.get("/", (req, res) => {
  res.send("OK");
});

app.post("/image", async (req, res) => {
  try {
    const driveUrl = req.body.url;
    const fileId = extractFileId(driveUrl);

    if (!fileId) {
      return res.status(400).send("Invalid Drive link");
    }

    const mediaUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
    const tmpPath = path.join(__dirname, "tmp-image");

    await downloadFile(mediaUrl, tmpPath);

    const bytes = fs.readFileSync(tmpPath);
    fs.unlinkSync(tmpPath);

    res.set("Content-Type", "application/octet-stream");
    res.send(bytes);
  } catch (e) {
    console.error(e);
    res.status(500).send("Image download failed");
  }
});

app.post("/gif", async (req, res) => {
  try {
    const driveUrl = req.body.url;
    const fileId = extractFileId(driveUrl);

    if (!fileId) {
      return res.status(400).send("Invalid Drive link");
    }

    const mediaUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
    const videoPath = path.join(__dirname, "video.mp4");
    const gifPath = path.join(__dirname, "preview.gif");

    await downloadFile(mediaUrl, videoPath);

    exec(
      `ffmpeg -y -t 5 -i "${videoPath}" -vf "fps=10,scale=320:-1:flags=lanczos" "${gifPath}"`,
      (err) => {
        try {
          if (err) {
            console.error(err);
            return res.status(500).send("ffmpeg error");
          }

          const gif = fs.readFileSync(gifPath);

          if (fs.existsSync(videoPath)) fs.unlinkSync(videoPath);
          if (fs.existsSync(gifPath)) fs.unlinkSync(gifPath);

          res.set("Content-Type", "image/gif");
          res.send(gif);
        } catch (e) {
          console.error(e);
          res.status(500).send("gif read error");
        }
      }
    );
  } catch (e) {
    console.error(e);
    res.status(500).send("Video download failed");
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
});
