const mysql = require("mysql2");
const fs = require("fs/promises");

const AUDITLOG_TABLE = "GR_TB_LOGIN_TRACKING";
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
    const connection = await connectToDB();
    try {
      const [insertedIds] = connection.execute({
        sql: `INSERT INTO ${AUDITLOG_TABLE} (login_date, terminal, login_method, login_type, fail_detail, from_dict_network_login, from_dict_enabled_nexo, from_dict_nexo_user) VALUES (?,?,?,?,?,?,?,?);`,
        // rowsAsArray: true,
        values: [
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
          // [
          //   new Date(record.date),
          //   record.terminal,
          //   record.loginType,
          //   "C",
          //   null,
          //   null,
          //   null,
          //   null,
          // ],
        ],
      });
    } catch (error) {
      console.log("error", error);
    }

    // (error, results) => {
    //   if (error) {
    //     console.error(error);
    //     connection.end();
    //   }
    // }
    console.log("insertedIds", insertedIds);
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
