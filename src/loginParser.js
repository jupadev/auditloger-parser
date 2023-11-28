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

const identifyLoginTypes = (auditLoginOnly = [], logMap) => {
  const cloudLoginSuccess = [];
  const networkLoginSuccess = [];
  const loginFail = [];
  const wrongPasswords = [];
  const maxIndex = logMap.length;
  auditLoginOnly.forEach((logInfo) => {
    const startIndex = logInfo.index;
    let index = logInfo.index;
    let isValidUserStart = true;
    while (isValidUserStart) {
      const logInfoNext = logMap[index];
      if (
        logInfoNext.type === "SALIDA" &&
        logInfoNext.details
          .trim()
          .startsWith("TAstorSession.IsValidUser User :")
      ) {
        isValidUserStart = false;
      } else {
        index++;
      }
      if (index === 20) {
        isValidUserStart = false;
      }
    }
    if (!isValidUserStart && index - startIndex > 1) {
      const logs = getLogChunk(logInfo, logMap, index) || [];
      const hasFails = logs.find(({ type, details = "" }) => {
        return type === "#FALLA" && details.includes("Proceso: IsValidUser");
      });
      if (hasFails) {
        loginFail.push({
          ...logInfo,
          failDetected: true,
          failDetails: hasFails.details,
        });
      }
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
  console.log(
    "wrongPasswords",
    wrongPasswords.map((i) => i.index)
  );
  console.log("login fail", loginFail.length);
  console.log("cloud login", cloudLoginSuccess.length);
  console.log("network login", networkLoginSuccess.length);
  generateMapJson(LOGIN_JSON_PATH, [
    ...wrongPasswords,
    ...loginFail,
    ...cloudLoginSuccess,
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
  console.log(auditLoginOnly.length);
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
