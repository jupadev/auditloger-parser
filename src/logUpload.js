const { Sequelize } = require("sequelize");
const fs = require("fs/promises");
const chunk = require("lodash.chunk");

const { AUDITLOG_TABLE, BULK_CHUNK, LOGIN_JSON_PATH } = require("./constants");
const { deleteFile } = require("./utils");
const { sequelize, testConnection } = require("./db/connection");
const { AuditLogModel } = require("./models/auditLog");

const exportLoginToDB = async () => {
  try {
    if (await fs.access(LOGIN_JSON_PATH)) {
      console.log("file exists");
    }
  } catch (err) {
    console.error("Error file doesn't exist", err);
    return Promise.reject(err);
  }

  try {
    const data = await fs.readFile(LOGIN_JSON_PATH, {
      encoding: "utf8",
    });
    // Do something with the data
    const loginJson = JSON.parse(data).map((record) => {
      return {
        login_date: new Date(record.date),
        terminal: record.terminal,
        login_method: record.loginType,
        login_type: "C",
        fail_detail: null,
        from_dict_network_login: null,
        from_dict_enabled_nexo: null,
        from_dict_nexo_user: null,
      };
    });

    const bulkRecords = chunk(loginJson, BULK_CHUNK);
    console.log("bulkRecords", bulkRecords);
    await testConnection();

    for (const bulk of bulkRecords) {
      const resultBulk = await AuditLogModel.bulkCreate(bulk);
    }

    await sequelize.close();
    console.log("DB connection closed");
  } catch (error) {
    console.log("error reading auditlog json", error);
  }
};

const start = async () => {
  await exportLoginToDB();
  console.log("deleting file file");
  await deleteFile(LOGIN_JSON_PATH);
};

start();
