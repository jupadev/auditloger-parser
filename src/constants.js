module.exports = {
  AUDITLOG_TABLE: "GR_TB_LOGIN_TRACKING",
  BULK_CHUNK: 5,
  LOGIN_JSON_PATH: "./loginTracker/login.json",
  // ASTOR_LOGS_PATH: "./logs/AstorSessionTest.txt",
  ASTOR_LOGS_PATH: "./logs/AstorSession.txt",
  LOGIN_TYPES: {
    cloud: "C",
    standard: "S",
    network: "N",
  },
  ROW_DELIMITER: " | ",
};
