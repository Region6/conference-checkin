var Converter = require("csvtojson").Converter,
    converter = new Converter({}),
    Sequelize = require("sequelize"),
    fs = require('fs'),
    path = require('path'),
    mysql = require('mysql'),
    nconf = require('nconf'),
    async = require('async'),
    moment = require('moment-timezone'),
    mapping = {
      "AUTHOR 1 LAST NAME": "lastname",
      "AUTHOR 1 FIRST NAME": "firstname",
      "AUTHOR 1 EMAIL": "email",
      "AUTHOR 1 ORGANIZATION": "organization",
      "AUTHOR 1 POSITION": "title",
      "AUTHOR 1 ADDRESS": "address",
      "AUTHOR 1 ADDRESS 2": "address2",
      "AUTHOR 1 CITY": "city",
      "AUTHOR 1 STATE/PROVINCE": "state",
      "AUTHOR 1 POSTCODE/ZIP": "zip",
      "AUTHOR 1 TELEPHONE": "phone",
      "Registration Confirmation Number": "confirmation",
      "Managment?": "management",
      "AUTHOR 1 SITE ID": "siteId",
      "Registration Date": "created"
    },
    eventIds = {
      "VPPPA Member": "f4f1fc6a-0709-11e6-9571-53e72e0ba997",
      "Workshop Presenter": "797979fe-070f-11e6-baec-9b71d60d6a06",
      "Non Member": "7a0364ac-070f-11e6-99ba-1bc46ece7a2f",
    },
    config, OnsiteAttendees, ExhibitorAttendees,
    configFile = process.cwd()+'/config/settings.json',
    dupSiteIdField = "Enter your 6-8 digit VPPPA Member ID1",
    finish = function() {
      process.exit();
    },
    pad = function(num, size) {
      var s = num+"";
      while (s.length < size) { s = "0" + s; }
      return s;
    },
    updateRegistrant = function(registrant, cb) {
      var where = {
        email: registrant.email
      };
      ExhibitorAttendees
      .findOne(
        {
          where: where
        }
      )
      .then(
        function(reg) {
          if (reg) {
            console.log("Found record", reg.id);
            var exhReg = {speaker: true};
            return reg.update(exhReg);
          } else {
            console.log("New record");
            registrant.exhibitor = true;
            return OnsiteAttendees.create(registrant);
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

ExhibitorAttendees = checkin.define('exhibitorAttendees', {
  id:                   { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
  userId :              { type: Sequelize.INTEGER },
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
  title :               { type: Sequelize.STRING(255) },
  organization :        { type: Sequelize.STRING(255) },
  created :             { type: Sequelize.DATE },
  updated :             { type: Sequelize.DATE },
  siteId :              { type: Sequelize.STRING(10) },
  attend:               { type: Sequelize.BOOLEAN },
  checked_in_time :     { type: Sequelize.DATE },
  speaker:              { type: Sequelize.BOOLEAN }
});

converter.fromFile(
  "tmp/exh-speakers.csv",
  function(err, results) {
    //console.log(results);
    var registrants = [];
    results.forEach(function(reg, index) {
      var record = {},
          now = moment.tz("America/Chicago").format("YYYY-MM-DD HH:mm:ss");
      for (var prop in mapping) {
        var key = mapping[prop];
        if (mapping[prop] === "siteId") {
          var siteId = (reg[dupSiteIdField]) ? reg[dupSiteIdField] : reg[prop];
          //console.log(siteId);
          if (Number.isInteger(siteId)) {
            record[key] = pad(siteId, 6);
          } else {
            record[key] = null;
          }
        } else {
          record[key] = reg[prop];
        }
      }
      record.speaker = true;
      record.created = now;
      record.updated = now;
      record.eventId = eventIds["Workshop Presenter"];
      
      console.log(index);
      record["deletedAt"] = null;

      registrants.push(record);
    });
    
    async.each(
      registrants,
      function(reg, cb) {
        updateRegistrant(reg, function() {
          cb();
        });
      },
      function(error) {
        finish();
      }
    );
  }
);