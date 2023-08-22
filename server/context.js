import { ref, getDownloadURL } from "firebase/storage";
import {storage} from "./config/firebase.js"; // Assuming you're exporting firebaseConfig from this file
import fetch from "node-fetch";


// Function to retrieve JSON from Firebase Storage
async function getJsonFromStorage(userId, fileName) {
  console.log("Fetching JSON from Firebase Storage...");
  const fileRef = ref(storage, `pdfs/${userId}/${fileName}`);

  try {
    // Get the download URL
    const url = await getDownloadURL(fileRef);

    // Fetch the file
    const response = await fetch(url);

    // Parse the JSON
    const data = await response.json();

    return data;
  } catch (error) {
    console.error("Error fetching JSON:", error);
    throw error;
  }
}

export default getJsonFromStorage;
