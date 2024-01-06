const path = require("path");
const fs = require("fs/promises");
const chunk = require("lodash.chunk");
const dayjs = require("dayjs");

const { BULK_CHUNK, LOGIN_JSON_PATH, PROCCESSED_JSON_PATH } = require("./constants");
const { deleteFile } = require("./utils");
const { sequelize, testConnection } = require("./db/connection");
const { AuditLogModel } = require("./models/auditLog");

const loginJsonPath = LOGIN_JSON_PATH;
const exportLoginToDB = async () => {
  return new Promise(async (resolve, reject) => {
    try {
      if (await fs.access(loginJsonPath)) {
        console.log("file exists");
      }
    } catch (err) {
      console.error("Error file doesn't exist", err);
      return reject(err);
    }

    try {
      const data = await fs.readFile(loginJsonPath, {
        encoding: "utf8",
      });
      // Do something with the data
      const loginJson = JSON.parse(data).map((record) => {
        return {
          login_date: record.date,
          username: record.user,
          terminal: record.terminal,
          login_type: record.isCloud ? "C" : "N",
          login_method: record.isCloud ? "Cloud" : "Network",
          is_cloud_login: Boolean(record.isCloud),
          is_fail: Boolean(record.failDetected),
          fail_detail: record.failDetails,
          from_dict_network_login: null,
          from_dict_enabled_nexo: null,
          from_dict_nexo_user: null,
          ip: record.ip,
        };
      });
  
      const bulkRecords = chunk(loginJson, BULK_CHUNK);
      await testConnection(sequelize);
  
      for (const bulk of bulkRecords) {
        const resultBulk = await AuditLogModel.bulkCreate(bulk);
        console.log('record inserted', resultBulk.length)
      }
  
      await sequelize.close();
      console.log("DB connection closed");
      return resolve();
    } catch (error) {
      return reject(error);
    }
  })
};

const start = async () => {
  try {
    await exportLoginToDB();
    console.log("deleting file file");
    const renamePath = PROCCESSED_JSON_PATH.replace('yyyy-mm-dd-time',dayjs().format('YYYY-MM-DD HHmmss'));
    await fs.rename(loginJsonPath, renamePath)
    console.log("source file renamed");
  } catch (error) {
    console.log("error exporting to DB", error)
  }

  
};

start();
