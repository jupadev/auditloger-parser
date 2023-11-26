const mysql = require("mysql2");
const fs = require("fs/promises");

const AUDITLOG_TABLE = "GR_TB_LOGIN_TRACKING";

const { Sequelize } = require("sequelize");

const opts = {
  define: {
    //prevent sequelize from pluralizing table names
    freezeTableName: true,
  },
};
const sequelize = new Sequelize("auditlogs", "root", "admin1234", {
  host: "localhost",
  dialect: "mysql",
  define: {
    freezeTableName: true,
  },
});
const testConection = async () => {
  try {
    await sequelize.authenticate();
    console.log("sequelize: Connection has been established successfully.");
  } catch (error) {
    console.error("sequelize: Unable to connect to the database:", error);
  }
};

// Creating the model
const AuditLogModel = sequelize.define(
  AUDITLOG_TABLE,
  {
    login_date: { type: Sequelize.DATE },
    terminal: { type: Sequelize.STRING },
    login_method: { type: Sequelize.STRING },
    login_type: { type: Sequelize.STRING },
    fail_detail: { type: Sequelize.STRING },
    from_dict_network_login: { type: Sequelize.STRING },
    from_dict_enabled_nexo: { type: Sequelize.STRING },
    from_dict_nexo_user: { type: Sequelize.STRING },
  },
  { timestamps: false }
);

const connectToDB = async () => {
  return new Promise((resolve, reject) => {
    // create a new MySQL connection
    const connection = mysql.createConnection({
      host: "localhost",
      user: "root",
      password: "admin1234",
      database: "auditlogs",
      multipleStatements: true, // necessary to run chained queries
    });
    // connect to the MySQL database
    connection.connect((error) => {
      if (error) {
        console.error("Error connecting to MySQL database:", error);
        reject(error);
      } else {
        console.log("Connected to MySQL database!");
        resolve(connection);
      }
    });
  });
};

fs.readFile("./loginTracker/login.json", { encoding: "utf8" })
  .then(async (data) => {
    // Do something with the data
    const loginJson = JSON.parse(data);
    const record = loginJson[0];
    console.log("record.....", record);
    const recordValues = [
      [
        new Date(record.date),
        record.terminal,
        record.loginType,
        "C",
        null,
        null,
        null,
        null,
      ],
      [
        new Date(record.date),
        record.terminal,
        record.loginType,
        "C",
        null,
        null,
        null,
        null,
      ],
    ];
    const connection = await connectToDB();

    await testConection();

    // connection.execute(`select * from ${AUDITLOG_TABLE}`, (err, results) => {
    //   console.log(results);
    // });
    // connection.query(
    //   `INSERT INTO ${AUDITLOG_TABLE} (login_date, terminal, login_method, login_type, fail_detail, from_dict_network_login, from_dict_enabled_nexo, from_dict_nexo_user) VALUES (?);`,
    //   recordValues,
    //   (err) => {
    //     if (err) {
    //       console.log("error", err);
    //       connection.end();
    //     }
    //   }
    // );

    AuditLogModel.bulkCreate([
      {
        login_date: new Date(record.date),
        terminal: record.terminal,
        login_method: record.loginType,
        login_type: "C",
        fail_detail: null,
        from_dict_network_login: null,
        from_dict_enabled_nexo: null,
        from_dict_nexo_user: null,
      },
      {
        login_date: new Date(record.date),
        terminal: record.terminal,
        login_method: record.loginType,
        login_type: "N",
        fail_detail: null,
        from_dict_network_login: null,
        from_dict_enabled_nexo: null,
        from_dict_nexo_user: null,
      },
    ]).then(() => console.log("Employee data have been saved"));
  })
  .catch((error) => {
    // Do something if error
  });

// connection.query(
//   "SELECT * FROM GR_TB_LOGIN_TRACKING",
//   function (err, results, fields) {
//     console.log(results); // results contains rows returned by server
//     console.log(fields); // fields contains extra meta data about results, if available
//   }
// );
// close the MySQL connection
// connection.end(() => {console.log("DB connection closed")});
