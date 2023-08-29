import { db } from "./config/firebase.js";

import { doc, getDoc, increment, setDoc, updateDoc } from "firebase/firestore";

const updateUserWordCount = async (data, userId) => {
 /* console.log(
    "The userId passed in To Update User Word Count Now is: ",
    userId
  );
  */
  //console.log("updateUserWordCount called");
  //console.log("The data passed in To Update User Word Count Now is: ", data);
  if (!userId) throw new Error("User not logged in");

  const userDocRef = doc(db, "wordsgenerated", userId);

  let length = 0;

  // Data validation and word count calculation
  if (typeof data === "string") {
    //console.log("The data is a string");
    length = data.split(" ").length;
  } else if (
    data.choices &&
    data.choices[0] &&
    data.choices[0].message &&
    data.choices[0].message.content
  ) {
    length = data.choices[0].message.content.split(" ").length;
  } else {
    throw new Error("Invalid data format");
  }

  try {
    const userDocSnapshot = await getDoc(userDocRef);

    if (userDocSnapshot.exists()) {
      // Use atomic increment to update the word count
      await updateDoc(userDocRef, {
        count: increment(length),
      });
    } else {
      await setDoc(userDocRef, {
        userId: userId,
        count: length,
      });
    }
  } catch (error) {
    console.error("Error updating user word count:", error);
    throw error; // Re-throw the error so the caller can handle it if needed
  }
};

export default updateUserWordCount;
