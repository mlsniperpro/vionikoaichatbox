// youtubeLoader.js
import { YoutubeLoader as YTLoader } from "langchain/document_loaders/web/youtube";

export const createYoutubeLoader = (url, options) => {
  return YTLoader.createFromUrl(url, options);
};

export const loadYoutubeDocs = async (loader) => {
  return await loader.load();
};

// googleSearch.js
import axios from "axios";

export const performGoogleSearch = async (query, num, apiKey) => {
  const data = JSON.stringify({
    q: query,
    num: num,
  });

  const config = {
    method: "post",
    url: "https://google.serper.dev/search",
    headers: {
      "X-API-KEY": apiKey,
      "Content-Type": "application/json",
    },
    data: data,
  };

  try {
    const response = await axios(config);
    return response.data["organic"].map((x) => x["snippet"]);
  } catch (error) {
    throw new Error(error);
  }
};
