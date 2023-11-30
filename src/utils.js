const fs = require("fs");
const path = require('path');
const { unlink } = require("fs/promises");

const generateMapJson = (pathFile, jsonFile, successCallback = () => {}) => {
  const dirPath = path.join(__dirname, pathFile);
  fs.writeFile(dirPath, JSON.stringify(jsonFile, null, 2), (error) => {
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
    console.log(`File ${path} was deleted.`);
    return Promise.resolve(path);
  } catch (error) {
    console.error(`Error deleting file ${path}`, error);
    return Promise.reject(error);
  }
};

module.exports = {
  generateMapJson,
  deleteFile,
};
