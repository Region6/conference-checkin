var Converter = require("csvtojson").Converter,
    converter = new Converter({}),
    Sequelize = require("sequelize"),
    fs = require('fs'),
    path = require('path'),
    mysql = require('mysql'),
    nconf = require('nconf'),
    async = require('async'),
    moment = require('moment-timezone'),
    regConfirm = "Primary Registrant Confirmation #",
    groupConfirm = "Group Confirmation Number",
    eventIds = {
      "VPPPA Member": "f4f1fc6a-0709-11e6-9571-53e72e0ba997",
      "Workshop Presenter": "797979fe-070f-11e6-baec-9b71d60d6a06",
      "Non Member": "7a0364ac-070f-11e6-99ba-1bc46ece7a2f",
    },
    config, OnsiteAttendees,
    configFile = process.cwd()+'/config/settings.json',
    finish = function() {
      process.exit();
    },
    pad = function(num, size) {
      var s = num+"";
      while (s.length < size) { s = "0" + s; }
      return s;
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
    dialect: 'mysql',
    omitNull: true,
    host: config.get("mysql:host") || "localhost",
    port: config.get("mysql:port") || 3306,
    pool: { maxConnections: 5, maxIdleTime: 30},
    define: {
      freezeTableName: true,
      timestamps: false
    }
  }
);

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
  isCheck :             { type: Sequelize.STRING(255) },
  groupConfirm :        { type: Sequelize.STRING(255) },
  speaker:              { type: Sequelize.BOOLEAN },
  exhibitor:            { type: Sequelize.BOOLEAN },
  deletedAt :           { type: Sequelize.DATE }
});

converter.fromFile(
  "tmp/groupConfirm.csv",
  function(err, results) {
    //console.log(results);
    var registrants = [];
    results.forEach(function(reg, index) {
      var record = {}
      if (reg[groupConfirm]) {
        record["groupConfirm"] = reg[groupConfirm];
        record.confirmation = reg[regConfirm];
        console.log(index);
        registrants.push(record);
      }
    });
    async.each(
      registrants,
      function(reg, cb) {
        OnsiteAttendees
        .findOne(
          {
            where: {
              confirmation: reg.confirmation
            }
          }
        )
        .then(
          function(result) {
            if (result) {
              return result.update(reg);
            }
          }
        ).then(
          function(results) {
            cb();
          }
        );
      },
      function(error) {
        finish();
      }
    );
  }
);