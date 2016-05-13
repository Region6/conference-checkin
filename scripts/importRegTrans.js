var Converter = require("csvtojson").Converter,
    converter = new Converter({}),
    Sequelize = require("sequelize"),
    fs = require('fs'),
    path = require('path'),
    mysql = require('mysql'),
    nconf = require('nconf'),
    async = require('async'),
    moment = require('moment-timezone'),
    emailField = "Email Address",
    transField = "Transaction ID",
    eventIds = {
      "VPPPA Member": "f4f1fc6a-0709-11e6-9571-53e72e0ba997",
      "Workshop Presenter": "797979fe-070f-11e6-baec-9b71d60d6a06",
      "Non Member": "7a0364ac-070f-11e6-99ba-1bc46ece7a2f",
    },
    config, OnsiteAttendees, RegistrantTransactions,
    configFile = process.cwd()+'/config/settings.json',
    finish = function() {
      process.exit();
    },
    pad = function(num, size) {
      var s = num+"";
      while (s.length < size) { s = "0" + s; }
      return s;
    },
    updateTransaction = function(registrant, trans, cb) {
      if (trans.transId || trans.type === "Check") {
        //console.log(trans.transId, registrant.confirmation);
        var where = {
          confirmation: registrant.confirmation,
          transactionId: trans.transId
        };
        if (trans.type === "Check") {
          console.log("Is check", trans.refNumber);
          where = {
            confirmation: registrant.confirmation,
            checkNumber: trans.refNumber
          };
        }
        RegistrantTransactions
        .findOne(
          {
            where: where
          }
        )
        .then(
          function(regTrans) {
            if (regTrans) {
              console.log("Found record", trans.refNumber);
              return regTrans.update(where);
            } else {
              console.log("New record", trans.refNumber);
              return RegistrantTransactions.create(where);
            }
          },
          function(err) {
            console.log("Error:", err);
            return;
          }
        ).then(
          function(results) {
            cb();
          },
          function(err) {
            console.log("Error:", err);
            cb();
          }  
        );
      } else {
        cb();
      }
    };

config = nconf
.argv()
.env("__")
.file({ file: configFile });


checkin = new Sequelize(
  config.get("mysql:database"),
  config.get("mysql:username"),
  config.get("mysql:password"),
  {
    logging: false,
    dialect: 'mysql',
    omitNull: true,
    host: config.get("mysql:host") || "localhost",
    port: config.get("mysql:port") || 3306,
    pool: { maxConnections: 5, maxIdleTime: 30},
    paranoid: true
  }
);

RegistrantTransactions = checkin.define('registrantTransactions', {
  id:                   { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
  confirmation :        { type: Sequelize.STRING(255) },
  transactionId :       { type: Sequelize.STRING(255) },
  checkNumber :         { type: Sequelize.STRING(255) },
  createdAt :           { type: Sequelize.DATE },
  updatedAt :           { type: Sequelize.DATE },
  deletedAt :           { type: Sequelize.DATE }
});

OnsiteAttendees = checkin.define('onsiteAttendees', {
  id:                   { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
  confirmation :        { type: Sequelize.STRING(255) },
  eventId :             { type: Sequelize.STRING(36) },
  firstname :           { type: Sequelize.STRING(255) },
  lastname :            { type: Sequelize.STRING(255) },
  address :             { type: Sequelize.STRING(255) },
  address2 :            { type: Sequelize.STRING(255) },
  city :                { type: Sequelize.STRING(255) },
  state :               { type: Sequelize.STRING(255) },
  zip :                 { type: Sequelize.STRING(15) },
  email :               { type: Sequelize.STRING(255) },
  phone :               { type: Sequelize.STRING(25) },
  management:           { type: Sequelize.BOOLEAN },
  title :               { type: Sequelize.STRING(255) },
  organization :        { type: Sequelize.STRING(255) },
  created :             { type: Sequelize.DATE },
  updated :             { type: Sequelize.DATE },
  siteId :              { type: Sequelize.STRING(10) },
  attend:               { type: Sequelize.BOOLEAN },
  checked_in_time :     { type: Sequelize.DATE },
  isCheck :               { type: Sequelize.STRING(255) },
  groupConfirm :        { type: Sequelize.STRING(255) },
  speaker:              { type: Sequelize.BOOLEAN },
  exhibitor:            { type: Sequelize.BOOLEAN },
  deletedAt :           { type: Sequelize.DATE }
},{
  timestamps: false
});

converter.fromFile(
  "tmp/transactions.csv",
  function(err, results) {
    //console.log(results);
    var registrants = [];
    results.forEach(function(reg, index) {
      var record = {}
      record.email = reg[emailField];
      record.transId = reg[transField];
      record.type = reg["Payment Method"];
      record.refNumber = reg["Reference Number"];
      console.log(index);
      registrants.push(record);
    });
    async.each(
      registrants,
      function(reg, cb) {
        OnsiteAttendees
        .findOne(
          {
            where: {
              email: reg.email
            }
          }
        )
        .then(
          function(result) {
            if (result) {
              updateTransaction(result, reg, function() {
                cb();
              });
            } else {
              console.log("No registrant found", reg.transId);
              cb();
            }
          }
        );
      },
      function(error) {
        finish();
      }
    );
  }
);