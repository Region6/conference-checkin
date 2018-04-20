const fs = require('fs');
const path = require('path');
const async = require('async');
const program = require('commander');
const { map, props, mapSeries } = require('awaity');
const underscore = require('lodash');
const pdf417 = require('pdf417');
const handlebars = require('handlebars');
const helpers = require('handlebars-helpers')({
  handlebars: handlebars
});
const moment = require('moment-timezone');
const PDFMerge = require('pdf-merge');
const knex = require('knex');
const svgHeader = fs.readFileSync("./header.svg", "utf8");
const Rsvg = require('librsvg-prebuilt').Rsvg;
const Registrants = require("node-registrants");
const config = require('../config');

const db = knex({
  client: 'mysql2',
  connection: {
    host : config.mysql.host || "localhost",
    user : config.mysql.username,
    password : config.mysql.password,
    database : config.mysql.database,
    port: config.mysql.port || 3306,
  },
  debug: ['ComQueryPacket'],
});
const finish = () => {
  process.exit();
};
const pad = (num, size) => {
  let s = num + "";
  while (s.length < size) { s = "0" + s; }
  return s;
};
let registrants = Registrants.init(config.mysql);
const badges = [];
let count = 0;

const createBadge = async (id) => {
  let retVal;
  const badgeFields = [
    "confirmation",
    "firstname",
    "lastname",
    "title",
    "email",
    "phone",
    "organization",
    "address",
    "address2",
    "city",
    "state",
    "zip"
  ];
  let pageBuilder = null;
  let pdfData = "";
  const svgToPdf = (svg) => {
    return new Promise(resolve => {
      const svgPdf = new Rsvg(svg);
      svgPdf.on('load', () => {
        const data = svgPdf.render({
          format: 'pdf',
          height: 792,
          width: 612
        }).data;
        resolve(data);
      });
    });
  };

  const writeFile = (registrant, pdf) => {
    return new Promise(resolve => {
      const fileName = `tmp/badges/badge.${registrant.registrantId}.pdf`;
      fs.writeFile(
        fileName,
        pdf,
        function (err) {
          if (err) console.log(err);
          resolve(fileName);
        }
      );
    })
  };

  const reg = await db.from('onsiteAttendees')
    .where({
      id: id,
    })
    .catch(e => console.log('db', 'database error', e));
  if (reg.length) {
    const prefix = (reg[0].exhibitor) ? 'E' : 'G';
    const filters = [
      {
        columnName: 'displayId',
        value: `${prefix}-${id}`
      }
    ];
    let registrant = await registrants.searchAttendees2(
      filters,
      0,
      1
    );
    registrant = registrant[0];
    let badge = await db.from('event_badges')
      .where({
        eventId: registrant.eventId,
      })
      .catch(e => console.log('db', 'database error', e));
    badge = badge[0];
    let template = badge.template.toString();

    pageBuilder = handlebars.compile(template);
    let code = `${registrant.registrantId}`;
    badgeFields.forEach(
      (field, index) => {
        code += `|${registrant[field]}`;
      }
    );
    console.log(code);

    let barcode = pdf417.barcode(code, 5);
    let y = 0;
    const bw = 1.25;
    const bh = 0.75;
    let rect = 32000;
    let blocks = [];
    let svgBarcode = "";

    const badgeStr = await mapSeries(
      barcode.bcode,
      async (row) => {
        y += bh;
        let x = 0;
        let colStr = await mapSeries(
          row,
          async (col) => {
            let block = "";
            if (parseInt(col, 10) === 1) {
              block = `<rect id="rect${rect}" height="${bh}" width="${bw}" y="${y}" x="${x}" />`;
            }
            x += bw;
            return block;
          }
        );
        return colStr.join("");
      } 
    );

    svgBarcode = `<g id="barcode" style="fill:#000000;stroke:none" x="23.543152" y="295" transform="translate(64,320)">${badgeStr.join('')}</g>`;
    registrant.barcode = svgBarcode;
    // registrant.fields.id = registrant.registrantId;
    // registrant.paddedRegId = registrant.registrantId;
    let svg = pageBuilder(registrant);
    let shiftG = '<g id="shiftBox" transform="translate(-15,-15)">';
    svg = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>${svgHeader}${svg}</svg>`;

    const pdf = await svgToPdf(svg);
    retVal = await writeFile(registrant, pdf);
  }

  return retVal;
};

const getRegistrants = async (regs) => {
  const badges = await mapSeries(regs, createBadge);
  const pdf = await PDFMerge(badges);
  fs.writeFile(
    'tmp/badges/badges.pdf',
    pdf,
    (err) => {
      if (err) throw err;
      console.log('Badges saved');
      finish();
    }
  );
}

program
  .version('0.0.1')
  .option('-b, --begin [value]', 'Beginning Registrant Id')
  .option('-e, --end [value]', 'Ending Registrant Id')
  .option('-t, --type [value]', 'Type of Registrant (E=Exhibitor, G=General)')
  .parse(process.argv);

const begin = (program.begin) ? program.begin : 1;
const end = (program.end) ? program.end : 10;
count = begin;
console.log(begin, end, count);
const regArr = [];
for (let i = begin; i <= end; i++) {
  regArr.push(i);
}

getRegistrants(regArr);