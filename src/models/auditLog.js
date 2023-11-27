const { Sequelize } = require("sequelize");

const { AUDITLOG_TABLE } = require("../constants");
const { sequelize } = require("../db/connection");

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

module.exports = {
  AuditLogModel,
};