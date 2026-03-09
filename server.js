const express = require("express");
const { exec } = require("child_process");
const fs = require("fs");
const axios = require("axios");

const app = express();
app.use(express.json());

app.post("/gif", async (req, res) => {
  try {
    const videoUrl = req.body.url;

    const videoPath = "video.mp4";
    const gifPath = "preview.gif";

    const response = await axios({
      url: videoUrl,
      method: "GET",
      responseType: "stream",
    });

    const writer = fs.createWriteStream(videoPath);
    response.data.pipe(writer);

    writer.on("finish", () => {
      exec(
        `ffmpeg -t 5 -i ${videoPath} -vf "fps=10,scale=320:-1:flags=lanczos" ${gifPath}`,
        (err) => {
          if (err) return res.status(500).send("ffmpeg error");

          const gif = fs.readFileSync(gifPath);
          res.set("Content-Type", "image/gif");
          res.send(gif);
        }
      );
    });
  } catch (e) {
    res.status(500).send("error");
  }
});

app.listen(3000, () => {
  console.log("Server running");
});
