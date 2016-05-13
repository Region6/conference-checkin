var Converter = require("csvtojson").Converter,
    converter = new Converter({}),
    Sequelize = require("sequelize"),
    fs = require('fs'),
    pnf = require('google-libphonenumber').PhoneNumberFormat,
    phoneUtil = require('google-libphonenumber').PhoneNumberUtil.getInstance(),
    path = require('path'),
    mysql = require('mysql'),
    nconf = require('nconf'),
    async = require('async'),
    moment = require('moment-timezone'),
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

ExhibitorAttendees
.findAll()
.then(
  function(registrants) {
    
    async.each(
      registrants,
      function(registrant, cb) {
        var record = {}, f_val, np, phoneNumber;
        console.log(registrant.phone);
        f_val = registrant.phone.toString();
        f_val = f_val.replace(/\D/g,'').slice(0,10);
        np = f_val.slice(0,3)+"-"+f_val.slice(3,6)+"-"+f_val.slice(6);
        console.log(np);
        try {
          phoneNumber = phoneUtil.parse(np, 'US');
          console.log(phoneUtil.format(phoneNumber, pnf.NATIONAL));
          phoneNumber = phoneUtil.format(phoneNumber, pnf.NATIONAL);
        }
        catch (e) {
          console.log(e);
          phoneNumber = null;
        }
        record.phone = phoneNumber;
        registrant.update(record).then(
          function(result) {
            cb();
          },
          function(error) {
            console.log(error);
            cb();
          }
        )
      },
      function(error) {
        finish();
      }
    );
  },
  function(err) {
    console.log("Error:", err);
    finish();
  }
);
