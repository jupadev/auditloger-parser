const { Sequelize } = require("sequelize");
const fs = require("fs/promises");
const sql = require('mssql');
const { testConnection , sequelize} = require("./connection")


// const { sequelize, testConnection } = require("./connection");

const test = async () => {
 

  try {
    console.log("Initializing connection")
    await testConnection(sequelize);
  } catch (error) {
    console.log("error connection", error);
    throw new Error(error)
  }

  await sequelize.close();
  console.log("DB connection closed");
};

const start = async () => {
  await test()
};

start();
