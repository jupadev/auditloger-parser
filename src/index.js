const fs = require("fs");
const { parse } = require("csv-parse");
const dayjs = require("dayjs");
const isBetween = require("dayjs/plugin/isBetween");
dayjs.extend(isBetween);

const fileName = "AstorSessionTest.txt";

const logMap = {};
let auditLoginOnly = [];

const LOG_CHUNK = 30;

const generateMapJson = () => {
  const path = "./logs/map.json";

  fs.writeFile(path, JSON.stringify(logMap, null, 2), (error) => {
    if (error) {
      console.log("An error has occurred ", error);
      return;
    }
    console.log("Data written successfully to disk");
  });
};

const getLogChunk = (logRecord) => {
  const logs = logMap[logRecord.id] || [];
  return logs.slice(logRecord.index, logRecord.index + LOG_CHUNK);
};

const getTerminalInfo = (startLogin) => {
  const loginInfo = startLogin.details
    .trim()
    .replace("TAstorSession.IsValidUser User : ", "")
    .split(" Terminal: ");
  const terminalInfo = loginInfo[1]
    ? loginInfo[1].split("|")
    : ["not found", "not found"];
  return {
    ...startLogin,
    user: loginInfo[0],
    terminal: terminalInfo[0],
    ip: terminalInfo[1],
    logChunk: getLogChunk(startLogin),
  };
};

const checkIsCloudLogin = (logChunk = []) => {
  const loginSuccess = logChunk.filter((chunk) => {
    const details = chunk.details.trim();

    if (
      chunk.type === "SALIDA" &&
      details.startsWith("TAstorSession.IsValidUser User")
    ) {
      return true;
    }

    if (
      chunk.type === "INICIO" &&
      details.startsWith("TAstorSession.CloudLogin")
    ) {
      return true;
    }

    if (
      chunk.type === "INICIO" &&
      details.startsWith("TAstorData.AssignRol")
    ) {
      return true;
    }

    if (
      chunk.type === "INICIO" &&
      details.startsWith("TAstorData.AddSession")
    ) {
      return true;
    }

    if (
      chunk.type === "SALIDA" &&
      details.startsWith("TAstorData.AddSession")
    ) {
      return true;
    }
  });

  if (loginSuccess.length === 4) {
    return logChunk[0]
  }
}

const identifyLoginTypes = (auditLoginOnly = []) => {
  const cloudLoginSuccess = [];
  auditLoginOnly.forEach(({ logChunk }) => {
    const cloudLogin = checkIsCloudLogin(logChunk);
    if (cloudLogin) {
      cloudLoginSuccess.push(cloudLogin)
    }
  });

console.log("cloud login", cloudLoginSuccess, cloudLoginSuccess.length)
};

const generateMap = () => {
  fs.createReadStream(`./logs/${fileName}`)
    .pipe(parse({ delimiter: " | ", from_line: 1 }))
    .on("data", function (row) {
      if (!logMap[row[1]]) {
        logMap[row[1]] = [];
      }
      const record = {
        id: row[1],
        date: row[0],
        dateFormatted: dayjs(row[0], "YYYY/MM/DD HH:mm:ss:SSS", "es"),
        type: row[2],
        details: row[3],
        index: logMap[row[1]].length,
      };
      logMap[record.id].push(record);
    })
    .on("end", () => {
      generateMapJson();
      auditLoginOnly = Object.keys(logMap).reduce((prev, id) => {
        const values = logMap[id] || [];
        const startLogins = values
          .filter(({ type, details }) => {
            return (
              type === "INICIO" &&
              details.trim().startsWith("TAstorSession.IsValidUser User :")
            );
          })
          .map(getTerminalInfo);
        return prev.concat(startLogins);
      }, []);
      // console.log("startLoginFlat", auditLoginOnly, auditLoginOnly.length);

      identifyLoginTypes(auditLoginOnly);
    });
};

generateMap();
