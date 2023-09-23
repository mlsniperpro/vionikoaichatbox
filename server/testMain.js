// main.js
import { createYoutubeLoader, loadYoutubeDocs } from "./extractYouTubeTranscript.js";
import { performGoogleSearch } from "./extractYouTubeTranscript.js";

const main = async () => {
  const youtubeLoader = createYoutubeLoader(
    "https://www.youtube.com/watch?v=vFSdRgant2w&ab_channel=CodingJesus",
    {
      language: "en",
      addVideoInfo: true,
    }
  );

  const youtubeDocs = await loadYoutubeDocs(youtubeLoader);
  console.log(youtubeDocs[0]);

  try {
    const googleSearchResults = await performGoogleSearch(
      "Who are the top contenders for republican party nomination in 2024?",
      100,
      "3cf70c9aa831bf56bbe2d507c1ed15596de5deef"
    );
    console.log(JSON.stringify(googleSearchResults));
  } catch (error) {
    console.log(error);
  }
};

main();
