const fs = require("fs");
const { createInterface } = require("readline");

const { parse } = require("csv-parse");
const dayjs = require("dayjs");
const isBetween = require("dayjs/plugin/isBetween");
const { Transform } = require("stream");

const {
  LOGIN_JSON_PATH,
  ASTOR_LOGS_PATH,
  ROW_DELIMITER,
  LOGIN_TYPES,
} = require("./constants");
const { generateMapJson } = require("./utils");
dayjs.extend(isBetween);

let auditLoginOnly = [];

const LOG_CHUNK = 30;

const getLogChunk = (logRecord, logMap) => {
  return logMap.slice(logRecord.index, logRecord.index + LOG_CHUNK);
};

const getTerminalInfo = (startLogin, logMap) => {
  const loginInfo = startLogin.details
    .trim()
    .replace("TAstorSession.IsValidUser User : ", "")
    .split(" Terminal: ");
  const terminalInfo = loginInfo[1]
    ? loginInfo[1].split("|")
    : ["not found", "not found"];
  return {
    ...startLogin,
    user: loginInfo[0].includes("\\")
      ? loginInfo[0].split("\\")[1]
      : loginInfo[0],
    terminal: terminalInfo[0],
    ip: terminalInfo[1],
    logChunk: getLogChunk(startLogin, logMap),
  };
};

const checkIsCloudLogin = (logChunk = []) => {
  const conditions = [
    {
      type: "SALIDA",
      details: "TAstorSession.IsValidUser User",
    },
    {
      type: "INICIO",
      details: "TAstorSession.CloudLogin",
    },
    {
      type: "INICIO",
      details: "TAstorData.AssignRol",
    },
    {
      type: "INICIO",
      details: "TAstorData.AddSession",
    },
    {
      type: "SALIDA",
      details: "TAstorData.AddSession",
    },
  ];
  const loginSuccess = logChunk.filter((chunk) => {
    const details = chunk.details.trim();
    return conditions.find((condition) => {
      return (
        chunk.type === condition.type && details.startsWith(condition.details)
      );
    });
  });
  return loginSuccess.length === conditions.length;
};

const checkIsLocalLogin = (logChunk = []) => {
  const conditions = [
    {
      type: "SALIDA",
      details: "TAstorSession.IsValidUser User",
    },
    {
      type: "SALIDA",
      details: "TAstorSession.ValidatePassword",
    },
    {
      type: "INICIO",
      details: "TAstorData.AssignRol",
    },
    {
      type: "INICIO",
      details: "TAstorData.AddSession",
    },
    {
      type: "SALIDA",
      details: "TAstorData.AddSession",
    },
    {
      type: "SALIDA",
      details: "TAstorData.Login",
    },
  ];
  const loginSuccess = logChunk.filter((chunk) => {
    const details = chunk.details.trim();

    return conditions.find((condition) => {
      return (
        chunk.type === condition.type && details.startsWith(condition.details)
      );
    });
  });

  return loginSuccess.length === conditions.length;
};

const checkIsNetworkLogin = (logChunk = []) => {
  const conditions = [
    {
      type: "SALIDA",
      details: "TAstorSession.IsValidUser User",
    },
    {
      type: "INICIO",
      details: "TAstorSession.Login",
    },
    {
      type: "INICIO",
      details: "TAstorData.AssignRol",
    },
    {
      type: "T_AUDI",
      details: "TAstorSession.Login ValidarServicioLevantado",
    },
    {
      type: "T_AUDI",
      details: "TAstorSession.InternalLogin",
    },
    {
      type: "SALIDA",
      details: "TAstorData.AddSession",
    },
  ];
  const loginSuccess = logChunk.filter((chunk) => {
    const details = chunk.details.trim();

    return conditions.find((condition) => {
      return (
        chunk.type === condition.type && details.startsWith(condition.details)
      );
    });
  });

  return loginSuccess.length === conditions.length;
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
      cloudLoginSuccess.push({ ...logInfo, loginType: LOGIN_TYPES.cloud });
    } else if (checkIsLocalLogin(logChunk)) {
      localLoginSuccess.push({ ...logInfo, loginType: LOGIN_TYPES.standard });
    } else if (checkIsNetworkLogin(logChunk)) {
      networkLoginSuccess.push({ ...logInfo, loginType: LOGIN_TYPES.network });
    } else if (checkIsLoginFail(logChunk)) {
      loginFail.push(logInfo);
    }
  });

  console.log("cloud login", cloudLoginSuccess.length);
  console.log("local login", localLoginSuccess.length);
  console.log("network login", networkLoginSuccess.length);
  generateMapJson(LOGIN_JSON_PATH, [
    ...cloudLoginSuccess,
    ...localLoginSuccess,
    ...networkLoginSuccess,
  ]);
};

const createLoginAttemptFile = (logMap) => {
  generateMapJson("./logs/map.json", logMap);
  auditLoginOnly = logMap.reduce((prev, logRecord) => {
    const { type, details } = logRecord;
    if (
      type === "INICIO" &&
      details.trim().startsWith("TAstorSession.IsValidUser User :")
    ) {
      return prev.concat(getTerminalInfo(logRecord, logMap));
    }
    return prev;
  }, []);
  identifyLoginTypes(auditLoginOnly);
};

const generateMap = () => {
  const logMap = [];
  return new Promise((resolve, reject) => {
    try {
      const rlInterface = createInterface({
        input: fs.createReadStream(ASTOR_LOGS_PATH),
        output: process.stdout,
        terminal: false, // to indicate this is not TTY
      });
      rlInterface.on("line", (line = "") => {
        if (!line.includes("|")) {
          return;
        }
        const row = line.split(ROW_DELIMITER);
        const record = {
          id: row[1],
          date: row[0],
          // dateFormatted: dayjs(row[0], "YYYY/MM/DD HH:mm:ss:SSS", "es"),
          type: row[2],
          details: row[3],
          index: logMap.length,
        };
        logMap.push(record);
      });
      rlInterface.on("close", () => {
        resolve(logMap);
      });
    } catch (error) {
      console.error("generateMap error", error);
      reject(error);
    }
  });
};

const start = async () => {
  const logJson = await generateMap();
  createLoginAttemptFile(logJson);
};

start();
