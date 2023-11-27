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

const testConnection = async () => {
  try {
    await sequelize.authenticate();
    console.log("sequelize: Connection has been established successfully.");
  } catch (error) {
    console.error("sequelize ERROR: Unable to connect to the database:", error);
  }
};

module.exports = {
  sequelize,
  testConnection,
};
