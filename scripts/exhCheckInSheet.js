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
    pdfjs = require('pdfjs'),
    notoSansRegular = fs.readFileSync(path.join(__dirname, '../vendors/fonts/NotoSans.ttf')),
    notoSansBold = fs.readFileSync(path.join(__dirname, '../vendors/fonts/NotoSans-Bold.ttf')),
    wingding = fs.readFileSync(path.join(__dirname, '../vendors/fonts/wingding.ttf')),
    barcode = fs.readFileSync(path.join(__dirname, '../vendors/fonts/fre3of9x.ttf')),
    font = {
      notosans: {
        regular: pdfjs.createTTFFont(notoSansRegular),
        bold:    pdfjs.createTTFFont(notoSansBold)
      },
      wingding: {
        regular: pdfjs.createTTFFont(wingding)
      },
      barcode: {
        regular: pdfjs.createTTFFont(barcode)
      }
    },
    eventIds = {
      "VPPPA Member": "f4f1fc6a-0709-11e6-9571-53e72e0ba997",
      "Workshop Presenter": "797979fe-070f-11e6-baec-9b71d60d6a06",
      "Non Member": "7a0364ac-070f-11e6-99ba-1bc46ece7a2f",
    },
    config, OnsiteAttendees, RegistrantTransactions, Exhibitors, doc,
    configFile = process.cwd()+'/config/settings.json',
    finish = function() {
      process.exit();
    },
    pad = function(num, size) {
      var s = num+"";
      while (s.length < size) { s = "0" + s; }
      return s;
    }, 
    header = function (exhibitor, attendees, cback) {
      console.log("write header");
      var table, tr, td;
      table = doc.table({ widths: ['70%', '30%']});
      tr = table.tr({borderBottomWidth: 6});
      tr.td(exhibitor.organization, { font: font.notosans.bold, fontSize: 20 });
      tr.td(attendees.length+"/"+exhibitor.attendees, { font: font.notosans.bold, textAlign: 'right', fontSize: 20 });
      cback();
    },
    renderAttendees = function(exhibitor, attendees, cback) {
      console.log("render attendees");
      doc.text().br();
      var table, tr, td;
      table = doc.table({ headerRows: 1, widths: ['15%', '45%', '15%', '25%']});
      tr = table.tr({borderBottomWidth: 2});
      tr.td('Present', { font: font.notosans.bold, fontSize: 12 });
      tr.td('Name', { font: font.notosans.bold, fontSize: 12 });
      tr.td('Number', { font: font.notosans.bold, fontSize: 12 });
      tr.td('Barcode', { font: font.notosans.bold, fontSize: 12 });
      
      async.each(
        attendees,
        function(attendee, cb) {
          tr = table.tr({borderBottomWidth: 0.5});
          tr.td("o", { font: font.wingding.regular, textAlign: 'center', fontSize: 24, paddingTop: 8});
          tr.td(attendee.lastname + ", " + attendee.firstname, {lineHeight: 2.0});
          tr.td("E" + pad(attendee.id, 5), {lineHeight: 2.0});
          tr.td("*E"+ pad(attendee.id, 5)+"*", {font: font.barcode.regular, fontSize: 18, lineHeight: 2.0});
          cb();
        },
        function() {
          cback();
        }
      );
    },
    renderOpenSlots = function(exhibitor, attendees, cback) {
      console.log("render open slots");
      doc.text().br();
      doc.text(
        'Open Slots', 
        {
          font: font.notosans.bold, 
          fontSize: 15
        }
      ).br();
      var table, tr, td,
          count = 0,
          open = exhibitor.attendees - attendees.length;
      table = doc.table({ headerRows: 1, widths: ['15%', '85%']});
      tr = table.tr({borderBottomWidth: 2});
      tr.td('', { font: font.notosans.bold, fontSize: 12 });
      tr.td('Name', { font: font.notosans.bold, fontSize: 12 });
      
      async.whilst(
        function () { return count < open; },
        function (callback) {
          tr = table.tr({borderBottomWidth: 0.5});
          tr.td("#"+(count+1).toString(), { lineHeight: 2.0 });
          tr.td("", {lineHeight: 2.0});
          count++;
          callback();
        },
        function (err, n) {
          cback();
        }
      );
    },
    checkbox = pdfjs.createImage(fs.readFileSync(path.join(__dirname, '../assets/images/unchecked_checkbox.jpg'))),
    run = function(cmd, options, data, callback) {
      var spawn = require('child_process').spawn,
          command = spawn(cmd, options),
          result = new Buffer(0);
      command.stdout.on('data', function(data) {
        result = new Buffer.concat([result, data]);
      });
      command.on('close', function(code) {
        return callback(result);
      });
      command.stdin.on('error', function(data) {
        console.log(data);
      });
      command.stdout.on('error', function(data) {
        console.log(data);
      });
      command.stdin.setEncoding = 'utf-8';
      command.stdin.write(data.toString());
      command.stdin.end();
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

Exhibitors = checkin.define('exhibitors', {
  id:                   { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
  confirmation :        { type: Sequelize.STRING(255) },
  booths :              { type: Sequelize.STRING(255) },
  attendees:             { type: Sequelize.INTEGER, defaultValue: 0},
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
  siteId :              { type: Sequelize.STRING(10) }
},{
  timestamps: false
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
},{
  timestamps: false
});

doc = pdfjs.createDocument({
  font:  font.notosans.regular,
  width: 612,
  height: 792,
  padding:   20,
  threshold: 500
});

Exhibitors
.findAll()
.then(
  function(exhibitors) {
    async.eachSeries(
      exhibitors,
      function(exhibitor, cb) {
        async.waterfall(
          [
            function(cback) {
              ExhibitorAttendees
              .findAll(
                {
                  where: {
                    userId: exhibitor.id
                  },
                  order: 'lastname, firstname ASC'
                }
              )
              .then(
                function(attendees) {
                  cback(null, attendees);
                },
                function(error) {
                  cback(error);
                }
              );
            },
            function(attendees, cback) {
              header(
                exhibitor, 
                attendees,
                function(){
                  cback(null, attendees);
                }
              );
              
            },
            function(attendees, cback) {
              renderAttendees(
                exhibitor, 
                attendees,
                function(){
                  cback(null, attendees);
                }
              );
            },
            function(attendees, cback) {
              renderOpenSlots(
                exhibitor, 
                attendees,
                function(){
                  cback(null, attendees);
                }
              );
            }
          ],
          function(err, result) {
            doc.pageBreak();
            console.log("Finish Exhibitor");
            if (err) console.log(err);
            cb();
          }
        )
      },
      function(error) {
        console.log("Finished Generating PDF");
        if(error) console.log("Error:", error);
        //console.log(doc);
        var pdf = doc.render();
        //console.log(pdf.toString());
        run(
          "/usr/bin/pdftocairo",
          ["-pdf", "-", "-"],
          pdf.toString(),
          function(result) {
            fs.writeFile(
              'exhibitor.checkin.sheet.pdf', 
              result, 
              'binary',
              function(err) {
                if (err) console.log(err);
                finish();
              }
            );
          }
        );
      }
    );
  },
  function(err) {
    console.log("Error:", err);
    finish();
  }
);