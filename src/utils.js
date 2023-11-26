const fs = require("fs");

const generateMapJson = (path, jsonFile) => {
  fs.writeFile(path, JSON.stringify(jsonFile, null, 2), (error) => {
    if (error) {
      console.log("An error has occurred ", error);
      return;
    }
    console.log("Data written successfully to disk");
  });
};

module.exports = {
  generateMapJson
}