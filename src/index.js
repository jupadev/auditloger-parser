const fs = require("fs");
const { parse } = require("csv-parse");
const dayjs = require("dayjs");
const isBetween = require("dayjs/plugin/isBetween");

const { generateMapJson } = require("./utils");
dayjs.extend(isBetween);

const fileName = "AstorSessionTest.txt";

const logMap = [];
let auditLoginOnly = [];

const LOG_CHUNK = 30;

const getLogChunk = (logRecord) => {
  return logMap.slice(logRecord.index, logRecord.index + LOG_CHUNK);
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

    if (chunk.type === "INICIO" && details.startsWith("TAstorData.AssignRol")) {
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

  return loginSuccess.length === 5;
};

const checkIsLocalLogin = (logChunk = []) => {
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
      details.startsWith("TAstorSession.ValidatePassword")
    ) {
      return true;
    }

    if (chunk.type === "INICIO" && details.startsWith("TAstorData.AssignRol")) {
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

  return loginSuccess.length === 5;
};

const checkIsNetworkLogin = (logChunk = []) => {
  const loginSuccess = logChunk.filter((chunk) => {
    const details = chunk.details.trim();

    if (
      chunk.type === "SALIDA" &&
      details.startsWith("TAstorSession.IsValidUser User")
    ) {
      return true;
    }

    if (chunk.type === "INICIO" && details === "TAstorSession.Login") {
      return true;
    }

    if (chunk.type === "INICIO" && details.startsWith("TAstorData.AssignRol")) {
      return true;
    }

    if (
      chunk.type === "T_AUDI" &&
      details.startsWith("TAstorSession.Login ValidarServicioLevantado")
    ) {
      return true;
    }

    if (
      chunk.type === "T_AUDI" &&
      details.startsWith("TAstorSession.InternalLogin")
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

  return loginSuccess.length === 6;
};

//Usuario local vÃ¡lido clave errÃ³nea
const checkIsLoginFail = (logChunk = []) => {
  const loginSuccess = logChunk.filter((chunk) => {
    const details = chunk.details.trim();

    if (
      chunk.type === "SALIDA" &&
      details.startsWith("TAstorSession.IsValidUser User")
    ) {
      return true;
    }

    if (
      chunk.type === "SALIDA" &&
      details === "TAstorData.ExistSessionByIdentifier"
    ) {
      return true;
    }

    if (
      chunk.type === "SALIDA" &&
      details.startsWith("TAstorSession.IsUserLogged     --> Result = False")
    ) {
      return true;
    }
  });

  return loginSuccess.length === 3;
};

const identifyLoginTypes = (auditLoginOnly = []) => {
  const cloudLoginSuccess = [];
  const localLoginSuccess = [];
  const networkLoginSuccess = [];
  const loginFail = [];
  auditLoginOnly.forEach(({ logChunk, ...logInfo }) => {
    if (checkIsCloudLogin(logChunk)) {
      cloudLoginSuccess.push({...logInfo, loginType: "cloud"});
    } else if (checkIsLocalLogin(logChunk)) {
      localLoginSuccess.push({...logInfo, loginType: "local"});
    } else if (checkIsNetworkLogin(logChunk)) {
      networkLoginSuccess.push({...logInfo, loginType: "network"});
    } else if (checkIsLoginFail(logChunk)) {
      loginFail.push(logInfo);
    }
  });

  console.log("cloud login", cloudLoginSuccess.length);
  console.log("local login", localLoginSuccess.length);
  console.log("network login", networkLoginSuccess);
  generateMapJson("./loginTracker/login.json", cloudLoginSuccess.concat(localLoginSuccess));
};

const generateMap = () => {
  fs.createReadStream(`./logs/${fileName}`)
    .pipe(parse({ delimiter: " | ", from_line: 1 }))
    .on("data", function (row) {
      const record = {
        id: row[1],
        date: row[0],
        // dateFormatted: dayjs(row[0], "YYYY/MM/DD HH:mm:ss:SSS", "es"),
        type: row[2],
        details: row[3],
        index: logMap.length,
      };
      logMap.push(record);
    })
    .on("end", () => {
      generateMapJson("./logs/map.json", logMap);
      auditLoginOnly = logMap.reduce((prev, logRecord) => {
        const { type, details } = logRecord;
        if (
          type === "INICIO" &&
          details.trim().startsWith("TAstorSession.IsValidUser User :")
        ) {
          return prev.concat(getTerminalInfo(logRecord));
        }
        return prev;
      }, []);
      // console.log("startLoginFlat", auditLoginOnly, auditLoginOnly.length);

      identifyLoginTypes(auditLoginOnly);
    });
};

generateMap();
