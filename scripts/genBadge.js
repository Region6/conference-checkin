var fs = require('fs'),
    path = require('path'),
    nconf = require('nconf'),
    mysql = require('mysql'),
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
    svgHeader = fs.readFileSync("../header.svg", "utf8"),
    qr              = require('qr-image'),
    hummus          = require('hummus'),
    Rsvg            = require('librsvg-prebuilt').Rsvg,
    Registrants = require("node-registrants"),
    badges = [],
    count = 0,
    configFile = '../config/settings.json',
    registrants,
    createBadge = function(registrant, cback) {
        var pageBuilder = null,
            pdfData = "",
            exhibitorFields = ["firstname", "lastname", "email", "phone", "title"];

        async.waterfall([
            function(cb){
              registrants.getBadgeTemplate(
                registrant.event_id,
                function(badge) {
                  cb(null, badge);
                }
              );
            },
            function(template, cb){
            // console.log(template);
              pageBuilder = handlebars.compile(template);
              var confirmation = (typeof registrant.confirmation !== "undefined") ? registrant.confirmation : registrant.confirmNum,
                  code = registrant.registrantId+"|"+confirmation;
              registrant.badgeFields.forEach(function(field, index) {
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
                  },
                  makeSvg = function(svgbcode) {
                    svgBarcode = '<g id="elements" style="fill:#000000;stroke:none" x="23.543152" y="295" transform="translate(60,300)">'+svgbcode+'</g>';
                    registrant.barcode = svgBarcode;
                    registrant.fields.id = registrant.registrantId;
                    registrant.paddedRegId = registrant.registrantId;
                    var svg = pageBuilder(registrant);
                    svg = '<?xml version="1.0" encoding="UTF-8" standalone="no"?>' + svgHeader + svg + "</svg>";
                    /*
                    fs.writeFile('badge.'+registrant.registrantId+".svg", svg, function (err) {
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
                      cb(null, data);
                    });
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
                    makeSvg(blks.join(""));
                  }
                );
            }
        ], function (err, pdf) {
          fs.writeFile('badges/badge.'+registrant.registrantId+".pdf", pdf, function (err) {
            if (err) console.log(err);
            cback('badges/badge.'+registrant.registrantId+".pdf");
          });
        });
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

config = nconf
    .argv()
    .env("__")
    .file({ file: configFile });

registrants = Registrants.init({
    "host": config.get("mysql:host") || "localhost",
    "username": config.get("mysql:username"),
    "password": config.get("mysql:password"),
    "database": config.get("mysql:database"),
    "port": config.get("mysql:port") || 3306,
    "logging": true
});

program
  .version('0.0.1')
  .option('-b, --begin [value]', 'Beginning Registrant Id')
  .option('-e, --end [value]', 'Ending Registrant Id')
  .option('-t, --type [value]', 'Type of Registrant (E=Exhibitor, G=General)')
  .parse(process.argv);
count = program.begin;
console.log(program.type, program.begin, program.end, count);
async.whilst(
  function () {
    console.log(count, program.end);
    return count <= program.end; 
  },
  function (callback) {
      var type = (program.type === 'X') ? 'E' : program.type;
      console.log("registrantid", program.type+count.toString());
      registrants.searchAttendees(
        ["registrantid"], 
        type+count.toString(), 
        0, 
        100, 
        false,
        function(registrants) {
          if (registrants[0]) {
            createBadge(
              registrants[0], 
              function(pdf) {
                badges.push(pdf);
                count++;
                callback(null, count);
              }
            );
          } else {
            count++;
            callback(null, count);
          }
        } 
      );
  },
  function (err, n) {
      console.log("badges generated");
      pdfMerge = new PDFMerge(badges);
      pdfMerge.promise().then(
        function(result) {
          fs.writeFile('badges/badges.pdf', result, function (err) {
            if (err) throw err;
            console.log('Badges saved');
            process.exit(0);
          });
          
        }
      ).catch(
        function(error) {
          //Handle error
          console.log(error);
        }
      );
      
  }
);