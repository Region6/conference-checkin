var fs = require('fs'),
    path = require('path'),
    nconf = require('nconf'),
    mysql = require('mysql'),
    Sequelize = require("sequelize"),
    crypto = require('crypto'),
    async = require('async'),
    uuid = require("node-uuid"),
    program = require('commander'),
    glob = require('glob'),
    underscore = require('lodash'),
    pdf417 = require('pdf417'),
    ipp = require('ipp'),
    handlebars = require('handlebars'),
    moment = require('moment-timezone'),
    json2csv = require('json2csv'),
    AuthorizeRequest = require('auth-net-request'),
    request = require('request'),
    parser = require('xml2json'),
    parseString = require('xml2js').parseString,
    NodePDF = require('nodepdf'),
    pdfjs = require('pdfjs'),
    Swag = require('swag'),
    PDFMerge = require('pdf-merge'),
    Sequelize = require("sequelize"),
    template = fs.readFileSync("../e-badge-4-3.svg", "utf8"),
    pageBuilder,
    qr              = require('qr-image'),
    hummus          = require('hummus'),
    Rsvg            = require('librsvg').Rsvg,
    Registrants = require("node-registrants"),
    badges = [],
    count = 0,
    configFile = '../config/settings.json',
    pad = function(num, size) {
      var s = num+"";
      while (s.length < size) { s = "0" + s; }
      return s;
    },
    finish = function() {
      process.exit();
    },
    badgeFields= [
      "firstname",
      "lastname",
      "title",
      "email",
      "organization",
      "address",
      "address2",
      "city",
      "state",
      "zip",
      "phone"
    ],
    registrants, config, OnsiteAttendees, ExhibitorAttendees,
    pdfBadges = function(record, cback) {
      var pdfData = "",
          fileName = moment().format("x");
      var svg = pageBuilder(record);
      
      /*
      fs.writeFile('badge.'+fileName+".svg", svg, function (err) {
        if (err) throw err;
        console.log('It\'s saved!');
      });
       */
      
      var svgPdf = new Rsvg(svg);
      svgPdf.on('load', function() {
        var data = svgPdf.render({
              format: 'pdf',
              height: 792,
              width: 612
            }).data;
        fs.writeFile('badges/badge.'+fileName+".pdf", data, function (err) {
          if (err) console.log(err);
          cback('badges/badge.'+fileName+".pdf");
        });
      });
    },
    createBadge = function(registrants, cback) {
      var pageBuilder = null, record = {},
          pdfData = "", count = 1,
          exhibitorFields = ["firstname", "lastname", "email", "phone", "title"];
      console.log("Length of Registrants", registrants.length);
      async.each(
        registrants,
        function(registrant, cb){
          // console.log(template);
          
          var registrantId = "E"+pad(registrant.id, 5),
              confirmation = (typeof registrant.confirmation !== "undefined") ? registrant.confirmation : null,
              code = registrantId+"|"+confirmation;
          badgeFields.forEach(function(field, index) {
              code += "|" + registrant[field];
          });
          console.log(code);
        // var svgBarcode = qr.imageSync(code, { type: 'svg', ec_level: 'L', margin: 0, size: 2 });

          var barcode = pdf417.barcode(code, 5),
              y = 0,
              bw = 1.25,
              bh = 0.75,
              rect = 32000,
              blocks = [],
              svgBarcode = "",
              iterateCols = function(r, cb) {
                var x = 0;
                async.timesSeries(
                  barcode.num_cols,
                  function(c, next){
                    var block = "";
                    if (barcode.bcode[r][c] == 1) {
                      block = '<rect id="rect'+rect+'" height="'+bh+'" width="'+bw+'" y="'+y+'" x="'+x+'" />';
                    }
                    x += bw;
                    next(null, block);
                  },
                  function(err, blks) {
                    cb(blks);
                  }
                );
              };
            async.timesSeries(
              barcode.num_rows,
              function(n, next){
                iterateCols(n, function(blks) {
                  y += bh;
                  setImmediate(function() {
                    next(null, blks.join(""));
                  });
                });
              },
              function(err, blks) {
                record["barcode"+count.toString()] = blks.join("");
                record["id"+count.toString()] = registrantId;
                record["name"+count.toString()] = registrant.firstname;
                record["city"+count.toString()] = registrant.city;
                record["state"+count.toString()] = registrant.state;
                record["company"+count.toString()] = registrant.organization;
                record["title"+count.toString()] = registrant.title;
                count++;
                cb();
              }
            );
          },
          function(err) {
            cback(record);
          }
        );
      };

Swag.registerHelpers(handlebars);
/**
 * usages (handlebars)
 * {{short_string this}}
 * {{short_string this length=150}}
 * {{short_string this length=150 trailing="---"}}
**/
handlebars.registerHelper('short_string', function (context, options) {
  //console.log(options);
  var maxLength = options.hash.length || 100,
    trailingString = options.hash.trailing || '';
  if (typeof context !== "undefined") {
    if (context.length > maxLength) {
      return context.substring(0, maxLength) + trailingString;
    }
  }
  return context;
});
pageBuilder = handlebars.compile(template);

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
    var count = 0;
    async.whilst(
      function () { return count < Math.ceil(registrants.length / 6); },
      function (callback) {
        var records = registrants.slice(count*6, (count*6)+6);
        async.waterfall(
          [
            function(cback) {
              createBadge(records, function(record) {
                cback(null, record);
              });
            },
            function(record, cback) {
              pdfBadges(record, function(filename) {
                console.log(filename);
                cback(null);
              });
            }
          ],
          function(error, results) {
            count++;
            callback(null, count);
          }
        );
        
      },
      function (err, n) {
        finish();
      }
    );
    
    
    
  },
  function(err) {
    console.log("Error:", err);
    finish();
  }
);