const fs = require("fs");
const path = require('path');
const { unlink } = require("fs/promises");

const generateMapJson = (pathFile, jsonFile, successCallback = () => {}) => {
  fs.writeFile(pathFile, JSON.stringify(jsonFile, null, 2), (error) => {
    if (error) {
      console.log("An error has occurred ", error);
      return;
    }
    console.log("Data written successfully to disk");
    successCallback();
  });
};

const deleteFile = async (pathFile) => {
  const dirPath = path.join(__dirname, pathFile);
  try {
    await unlink(dirPath);
    console.log(`File ${dirPath} was deleted.`);
    return Promise.resolve(dirPath);
  } catch (error) {
    console.error(`Error deleting file ${dirPath}`, error);
    return Promise.reject(error);
  }
};

module.exports = {
  generateMapJson,
  deleteFile,
};
