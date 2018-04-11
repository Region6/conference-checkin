const path = require('path');
const fs = require('fs');
let settings = {
  mysql: {},
  redis: {},
  authorizenet: {},
};
try {
  settings = require('./settings');
} catch(e) {
  console.log('no settings.js');
}
// Main server/app configuration
module.exports = {
  mysql: {
    host     : process.env.DB_PORT_3306_TCP_ADDR || process.env.DB_HOST || settings.mysql.host || 'localhost',
    username : process.env.DB_USERNAME || settings.mysql.username || 'wdwtables',
    password : process.env.DB_PASSWORD || settings.mysql.password || 'password',
    database : process.env.DB_DATABASE || settings.mysql.database|| 'wdwtables',
    dialect: 'mysql',
    multipleStatements: true,
  },
  redis: {
    host: process.env.REDIS_PORT_6379_TCP_ADDR || process.env.REDIS_HOST || settings.redis.host || 'localhost',
    port: process.env.REDIS_PORT_6379_TCP_PORT || process.env.REDIS_PORT || settings.redis.port || 6379,
    db: process.env.REDIS_DB || settings.redis.db || 0,
    url: process.env.REDIS_URL || settings.redis.url || 'redis://localhost',
    url2: process.env.REDIS_URL2 || settings.redis.url2 || 'redis://localhost',
  },
  authorizenet: {
    id: process.env.AUTHORIZENET_ID || settings.authorizenet.id || 'authorizenet id',
    key: process.env.AUTHORIZENET_KEY || settings.authorizenet.key || 'authorizenet key',
    sandbox: process.env.AUTHORIZENET_SANDBOX || settings.authorizenet.sandbox || false,
  },
  host: process.env.WEB_HOST || settings.host || 'localhost',
  port: process.env.WEB_PORT || settings.port || 3000,
  salt: process.env.SALT || settings.salt || 'key',
  id: process.env.ID || settings.id || 'generated uuid',
  serviceName: 'CheckinApi',
};
