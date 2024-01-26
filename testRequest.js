function encryptString(str) {
  // Step 1 & 2: Split the string into an array and reverse it
  var reversedArray = str.split("").reverse();

  // Step 3: Join the array back into a string
  var reversedString = reversedArray.join("");

  // Step 4: Encode the string into Base64
  var encodedString = btoa(reversedString);

  return encodedString;
}

// Example usage
var encrypted = encryptString(
  ""
);
console.log(encrypted); // This will output the encrypted string
const signature = atob(
  encrypted
)
  .split("")
  .reverse()
  .join("");

console.log(signature);