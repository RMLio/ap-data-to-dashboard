function saveLabel(label) {
  // remove special characters
  label = label.replace(/[^a-zA-Z0-9 ]/g, "")
  //convert to camel case
  label = label.split(" ")
    .map((word, index) =>
      index === 0 ? word : capitalize(word)
    )
    .join("");
  // ensure it starts with a letter (prepend "n" if it doesn"t)
  label = label.replace(/^([^a-zA-Z])/, "n$1")
  return label
}

function capitalize(str) {
  if (!str || typeof str !== "string") return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

module.exports = { saveLabel };