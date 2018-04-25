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
    url: process.env.REDIS_REDIS_1_PORT_6379_TCP || process.env.REDIS_URL1 || settings.redis.url || `redis://${process.env.REDIS_PORT_6379_TCP_ADDR || settings.redis.host}:${process.env.REDIS_PORT_6379_TCP_PORT || settings.redis.port}`,
  },
  authorizenet: {
    id: process.env.AUTHORIZENET_ID || settings.authorizenet.id || 'authorizenet id',
    key: process.env.AUTHORIZENET_KEY || settings.authorizenet.key || 'authorizenet key',
    sandbox: process.env.AUTHORIZENET_SANDBOX || settings.authorizenet.sandbox || false,
  },
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID || settings.firebase.projectId || '<PROJECT_ID>',
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL || settings.firebase.clientEmail || 'foo@<PROJECT_ID>.iam.gserviceaccount.com',
    privateKey: process.env.FIREBASE_PRIVATE_KEY || settings.firebase.privateKey || '-----BEGIN PRIVATE KEY-----\n<KEY>\n-----END PRIVATE KEY-----\n',
    databaseUrl: process.env.FIREBASE_DATABASE_URL || settings.firebase.databaseUrl || 'https://<DATABASE_NAME>.firebaseio.com',
  },
  host: process.env.WEB_HOST || settings.host || 'localhost',
  port: process.env.WEB_PORT || settings.port || 3000,
  salt: process.env.SALT || settings.salt || 'key',
  id: process.env.ID || settings.id || 'generated uuid',
  authToken: process.env.AUTH_TOKEN || settings.authToken || 'generated uuid',
  serviceName: 'CheckinApi',
};
