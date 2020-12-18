var mysql = require('mysql');
var migration = require('mysql-migrations');
const appConfig = require("./config");

var connection = mysql.createPool({
  connectionLimit : 10,
  host: appConfig.host,
  user: appConfig.user,
  password: appConfig.password,
  database: appConfig.database
});

migration.init(connection, __dirname + '/migrations');