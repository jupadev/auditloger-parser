const fs = require("fs");
const fsPromises = require("fs/promises");
const { createInterface } = require("readline");

const { parse } = require("csv-parse");
const dayjs = require("dayjs");
const isBetween = require("dayjs/plugin/isBetween");
const path = require('path');

const {
  LOGIN_JSON_PATH,
  ASTOR_LOGS_PATH,
  ASTOR_FOLDER_PATH,
  LOGS_FOLDER_PATH,
  ROW_DELIMITER,
  LOGIN_TYPES,
} = require("./constants");
const { generateMapJson } = require("./utils");
dayjs.extend(isBetween);

let auditLoginOnly = [];

const LOG_CHUNK = 40;

const getLogChunk = (logRecord, logMap, endIndex) => {
  return logMap.slice(logRecord.index, endIndex || logRecord.index + LOG_CHUNK);
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
    {
      type: "SALIDA",
      details: "TAstorSession.CloudLogin",
    },
  ];
  const rulesDone = [];
  const loginSuccess = logChunk.filter((chunk) => {
    const details = chunk.details.trim();
    return conditions.find((condition, index) => {
      const result =
        chunk.type === condition.type &&
        details.startsWith(condition.details) &&
        !rulesDone.includes(index);
      if (result) {
        rulesDone.push(index);
      }
      return result;
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
  const rulesDone = [];
  const loginSuccess = logChunk.filter((chunk) => {
    const details = chunk.details.trim();
    return conditions.find((condition, index) => {
      const result =
        chunk.type === condition.type &&
        details.startsWith(condition.details) &&
        !rulesDone.includes(index);
      if (result) {
        rulesDone.push(index);
      }
      return result;
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
  ];
  const rulesDone = [];
  const loginSuccess = logChunk.filter((chunk) => {
    const details = chunk.details.trim();
    return conditions.find((condition, index) => {
      const result =
        chunk.type === condition.type &&
        details.startsWith(condition.details) &&
        !rulesDone.includes(index);
      if (result) {
        rulesDone.push(index);
      }
      return result;
    });
  });

  return loginSuccess.length === conditions.length;
};

const checkWrongPassword = (logChunk = []) => {
  const conditions = [
    {
      type: "SALIDA",
      details: "TAstorSession.IsValidUser User",
    },
    {
      type: "INICIO",
      details: "TAstorSession.IsUserLogged",
    },
    {
      type: "SALIDA",
      details: "TAstorData.ExistSessionByIdentifier",
    },
    {
      type: "SALIDA",
      details: "TAstorSession.IsUserLogged     --> Result = False",
    },
  ];

  const rulesDone = [];
  let skipTest = false;
  const loginSuccess = logChunk.filter((chunk) => {
    const details = chunk.details.trim();
    if (
      (chunk.type === "SALIDA" &&
        details.startsWith("TAstorData.AddSession")) ||
      (chunk.type === "SALIDA" &&
        details.startsWith("TAstorSession.ValidatePassword")) ||
      skipTest
    ) {
      skipTest = true;
      return false;
    }

    return conditions.find((condition, index) => {
      const result =
        chunk.type === condition.type &&
        details.startsWith(condition.details) &&
        !rulesDone.includes(index);
      if (result) {
        rulesDone.push(index);
      }
      return result;
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

const renameAstorSession = async () => {
  renameFileName = `AstorSession-${dayjs().format('YYYY-MM-DD HHmmss')}.txt`;
  const renamePath = path.join(ASTOR_FOLDER_PATH, `/${renameFileName}`);
  const astorFilePath = ASTOR_LOGS_PATH
  console.log("Renaming proccesed file:", renamePath)
  try {
    await fsPromises.rename(astorFilePath, renamePath)
    console.log("source file was renamed successfully");
  } catch (error) {
    console.log("error renaming file", error)
  }

  try {
    await fsPromises.writeFile(astorFilePath,"")
    console.log("New AstorSession was created successfully");
  } catch (error) {
    console.log("error creating AstorSession file", error)
  }
  
}

const identifyLoginTypes = (auditLoginOnly = [], logMap) => {
  const cloudLoginSuccess = [];
  const networkLoginSuccess = [];
  const loginFail = [];
  const wrongPasswords = [];
  const maxIndex = logMap.length;
  auditLoginOnly.forEach((logInfo = {}) => {
    const { logChunk, ...restLogInfo } = { ...logInfo };
    const lastIndex =
      logChunk.findIndex((log) => {
        return (
          log.type === "SALIDA" &&
          log.details.trim().startsWith("TAstorSession.IsValidUser User :")
        );
      }) || 0;
    const logs = logChunk.slice(0, lastIndex);
    const hasFails = logs.find(({ type, details = "" }) => {
      return type === "#FALLA" && details.includes("Proceso: IsValidUser");
    });
    if (hasFails) {
      loginFail.push({
        ...restLogInfo,
        failDetected: true,
        failDetails: `User not found: ${hasFails.details}`,
      });
    }
  });

  const failIndexes = loginFail.map((log) => log.index);

  auditLoginOnly.forEach(({ logChunk, ...logInfo }) => {
    if (failIndexes.includes(logInfo.index)) {
      return;
    }

    if (checkWrongPassword(logChunk)) {
      wrongPasswords.push({
        ...logInfo,
        isCloud: logChunk.some(
          (log) =>
            log.type === "INICIO" &&
            log.details.trim().startsWith("TAstorSession.CloudLogin")
        ),
        failDetected: true,
        failDetails: "Wrong password",
      });
    } else if (checkIsCloudLogin(logChunk)) {
      cloudLoginSuccess.push({
        ...logInfo,
        loginType: LOGIN_TYPES.cloud,
        isCloud: true,
      });
    } else if (checkIsNetworkLogin(logChunk)) {
      networkLoginSuccess.push({
        ...logInfo,
        loginType: LOGIN_TYPES.network,
        isCloud: false,
      });
    }
  });
  console.log("wrongPasswords", wrongPasswords.length);
  console.log("login fail", loginFail.length);
  console.log("cloud login", cloudLoginSuccess.length);
  console.log("network login", networkLoginSuccess.length);
  generateMapJson(LOGIN_JSON_PATH, [
    ...wrongPasswords,
    ...loginFail,
    ...cloudLoginSuccess,
    ...networkLoginSuccess,
  ], renameAstorSession);
};

const createLoginAttemptFile = (logMap) => {
  const filename = `map_${dayjs().format('YYYY-MM-DD HHmmss')}.json`
  generateMapJson(`${LOGS_FOLDER_PATH}/${filename}`, logMap);
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
  console.log("Start login detected:", auditLoginOnly.length);
  identifyLoginTypes(auditLoginOnly, logMap);
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
