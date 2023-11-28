const fs = require("fs");
const { unlink } = require("fs/promises");

const generateMapJson = (path, jsonFile) => {
  fs.writeFile(path, JSON.stringify(jsonFile, null, 2), (error) => {
    if (error) {
      console.log("An error has occurred ", error);
      return;
    }
    console.log("Data written successfully to disk");
  });
};

const deleteFile = async (path) => {
  try {
    await unlink(path);
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
