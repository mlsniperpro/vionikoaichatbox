import { db } from "./config/firebase.js";

import { doc, getDoc, increment, setDoc, updateDoc } from "firebase/firestore";

const updateUserWordCount = async (data, userId) => {
  if (!userId) throw new Error("User not logged in");

  const userDocRef = doc(db, "wordsgenerated", userId);

  let length = 0;

  // Data validation and word count calculation
  if (typeof data === "string") {
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

//Save chats to firestore collection chat
async function saveChatToFirestore(userId, chatId, chatName, name, email, phone, fileName, response, role) {
  const chatDocRef = doc(db, "chat", chatId);
  const chatDocSnapshot = await getDoc(chatDocRef);

  if (chatDocSnapshot.exists()) {
    await updateDoc(chatDocRef, {
      messages: [...chatDocSnapshot.data().messages, { role: role, message: response}]
    });
  } else {
    await setDoc(chatDocRef, {
      userId: userId,
      chatId: chatId,
      chatName: chatName,
      title: chatName+" - "+response,
      name: name,
      email: email,
      phone: phone,
      fileName: fileName,
      embedded: true,
      time: new Date(),
      createdAt: Date.now(),
      messages: [{ role: role, message: response }],
    });
  }
}

export { updateUserWordCount, saveChatToFirestore };
