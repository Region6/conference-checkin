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
    mapping = {
      "Contact Last Name": "lastname",
      "Contact First Name": "firstname",
      "Email Address": "email",
      "Company": "organization",
      "Title": "title",
      "Work Addr 1": "address",
      "Work Addr 2": "address2",
      "Work City": "city",
      "Work State": "state",
      "Work ZIP/Postal Code": "zip",
      "Work Phone": "phone",
      "Registration Confirmation Number": "confirmation",
      "Managment?": "management",
      "Enter your 6-8 digit VPPPA Member ID": "siteId",
      "Registration Date": "created"
    },
    eventIds = {
      "VPPPA Member": "f4f1fc6a-0709-11e6-9571-53e72e0ba997",
      "Workshop Presenter": "797979fe-070f-11e6-baec-9b71d60d6a06",
      "Non Member": "7a0364ac-070f-11e6-99ba-1bc46ece7a2f",
      "OSHA Employee": "95123ef4-17f8-11e6-be73-a7d35618aafa"
    },
    config, OnsiteAttendees,
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
        confirmation: registrant.confirmation
      }, phoneNumber, f_val, np;
      console.log(registrant.phone);
      f_val = registrant.phone.toString();
      f_val = f_val.replace(/\D/g,'').slice(0,10);
      np = f_val.slice(0,3)+"-"+f_val.slice(3,6)+"-"+f_val.slice(6);
      console.log(np);
      try {
        phoneNumber = phoneUtil.parse(np, 'US');
        console.log(phoneUtil.format(phoneNumber, pnf.NATIONAL));
        registrant.phone = phoneUtil.format(phoneNumber, pnf.NATIONAL);
      }
      catch (e) {
        console.log(e);
        phoneNumber = null;
      }
      //
      //registrant.phone = phoneUtil.format(phoneNumber, pnf.INTERNATIONAL);
      OnsiteAttendees
      .findOne(
        {
          where: where
        }
      )
      .then(
        function(reg) {
          if (reg) {
            console.log("Found record", registrant.confirmation);
            return reg.update(registrant);
          } else {
            console.log("New record", registrant.confirmation);
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

converter.fromFile(
  "tmp/registrants.csv",
  function(err, results) {
    //console.log(results);
    var registrants = [];
    results.forEach(function(reg, index) {
      var record = {}
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
        } else if(mapping[prop] === "management") {
          var management = (reg[prop] === "Yes") ? true : false;
          record[key] = management;
        } else if(mapping[prop] === "created") {
          var created = moment.tz(reg[prop], "MMM D YYYY h:mmA", "America/Chicago").format("YYYY-MM-DD HH:mm:ss");
          record[key] = created;
        } else {
          record[key] = reg[prop];
        }
      }
      record.eventId = eventIds[reg["Registrant Type"]];
      
      console.log(index);
      if (reg["Invitee Status"] === "Cancelled") {
        var deleted = moment.tz(reg["Last Registration Date"], "MMM D YYYY h:mmA", "America/Chicago").format("YYYY-MM-DD HH:mm:ss");
        record["deletedAt"] = deleted;
      } else {
        record["deletedAt"] = null;
      }
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