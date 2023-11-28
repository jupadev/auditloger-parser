const { Sequelize } = require("sequelize");

const opts = {
  define: {
    freezeTableName: true,
  },
};

const sequelizeMySQL = new Sequelize("auditlogs", "root", "admin1234", {
  host: "localhost",
  dialect: "mysql",
  ...opts
});

const sequelize = new Sequelize("auditlogs", "root", "admin1234", {
  host: "LAPTOP-GN9BGVO4",
  dialect: "mssql",
  timezone: "America/Argentina/Buenos_Aires",
  dialectOptions: {
    options: {
      instanceName: 'SQLEXPRESS',
      requestTimeout: 60000,
      encrypt: false
    },
  },
  ...opts
});


const testConnection = async (sequelize) => {
  try {
    await sequelize.authenticate();
    console.log("sequelize: Connection has been established successfully.");
    return Promise.resolve()
  } catch (error) {
    console.error("sequelize ERROR: Unable to connect to the database:", error);
    return Promise.reject("sequelize ERROR: Unable to connect to the database:")
  }
};

module.exports = {
  sequelize,
  sequelizeMySQL,
  testConnection,
};
