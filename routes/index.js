/*jshint esversion: 6 */
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
const email = require('nodemailer');
const async = require('async');
const uuidv4 = require('uuid/v4');
const underscore = require('lodash');
const gpc = require('generate-pincode');
const pdf417 = require('pdf417');
const ipp = require('ipp');
const handlebars = require('handlebars');
const ApiContracts = require('authorizenet').APIContracts;
const ApiControllers = require('authorizenet').APIControllers;
const SDKConstants = require('authorizenet').Constants;
const helpers = require('handlebars-helpers')({
  handlebars: handlebars
});
const csvjson = require('csvtojson')
const moment = require('moment-timezone');
const json2csv = require('json2csv');
const request = require('request');
const pdfjs = require('pdfjs');
const Bus = require('busmq');
const pnf = require('google-libphonenumber').PhoneNumberFormat;
const phoneUtil = require('google-libphonenumber').PhoneNumberUtil.getInstance();
const { map, props, mapSeries } = require('awaity');
const notoSansRegular = fs.readFileSync(path.join(__dirname, '../vendors/fonts/NotoSans.ttf'));
const notoSansBold = fs.readFileSync(path.join(__dirname, '../vendors/fonts/NotoSans-Bold.ttf'));
const font = {
  notosans: {
    regular: new pdfjs.Font(notoSansRegular),
    bold: new pdfjs.Font(notoSansBold)
  }
};
const knex = require('knex');
const svgHeader = fs.readFileSync("./stuff/header.svg", "utf8");
const Rsvg = require('librsvg-prebuilt').Rsvg;
const Registrants = require("node-registrants");
const shortid = require('shortid');

const merchantAuthenticationType = new ApiContracts.MerchantAuthenticationType();
const mappings = {
  general: {
    "Last Name": "lastname",
    "First Name": "firstname",
    "Email Address": "email",
    "Company Name": "organization",
    "Title": "title",
    "Work Address": "address",
    "Work City": "city",
    "Work State/Prov": "state",
    "Work ZIP/Postal Code": "zip",
    "wphone": "phone",
    "Confirmation Number": "confirmation",
    "Managment?": "management",
    "Enter your 6-8 digit VPPPA Member ID": "siteId",
    "Created Date (GMT)": "createdAt",
    "Group Confirmation Number": "groupConfirm",
  },
  exhibitor: {

  }
};
const registrationType = "Registration Type";
let dupSiteIdField = "Enter your 6-8 digit VPPPA Member ID 2";
let registrants;
let nextBadgePrinter = 0;
let opts = {};
let printerUrl = {
  "receipt": [],
  "ebadge": [],
  "gbadge": []
};

let connection = null;
let client = null;
let transport = null;
let acl = null;
let db = {};
let knexDb;
let reconnectTries = 0;
let models = {};
let bus;
let queue;
let channel;
const messageTemplate = {
  status: 'success',
  message: {
    response: null
  }
};

const sendMessage = (type, payload) => {
  console.log('sendMessage');
  const message = {
    id: shortid.generate(),
    type: type,
    date: moment().valueOf(),
    serverId: opts.configs.id,
    payload: payload,
  };
  queue.push(message);
};

const truncate = async (table) => {
  const ret = await knexDb.raw(`TRUNCATE TABLE ${table};`);
  return ret;
};

// Swag.registerHelpers(handlebars);
/**
 * usages (handlebars)
 * {{short_string this}}
 * {{short_string this length=150}}
 * {{short_string this length=150 trailing="---"}}
**/
handlebars.registerHelper('short_string', (context, options) => {
  //console.log(options);
  const maxLength = options.hash.length || 100,
    trailingString = options.hash.trailing || '';
  if (typeof context !== "undefined") {
    if (context.length > maxLength) {
      return context.substring(0, maxLength) + trailingString;
    }
  }
  return context;
});

exports.setKey = (key, value) => {
  opts[key] = value;
};

exports.initialize = () => {
  //Initialize Mysql
  //getConnection();

  merchantAuthenticationType.setName(opts.configs.authorizenet.id);
  merchantAuthenticationType.setTransactionKey(opts.configs.authorizenet.key);

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: opts.configs.firebase.projectId,
      clientEmail: opts.configs.firebase.clientEmail,
      privateKey: opts.configs.firebase.privateKey,
    }),
    databaseURL: opts.configs.firebase.databaseUrl
  });

  knexDb = knex({
    client: 'mysql2',
    connection: {
      host : opts.configs.mysql.host || "localhost",
      user : opts.configs.mysql.username,
      password : opts.configs.mysql.password,
      database : opts.configs.mysql.database,
      port: opts.configs.mysql.port || 3306,
    },
  });
  
  registrants = Registrants.init({
    "host": opts.configs.mysql.host || "localhost",
    "username": opts.configs.mysql.username,
    "password": opts.configs.mysql.password,
    "database": opts.configs.mysql.database,
    "port": opts.configs.mysql.port || 3306,
    "logging": true
  });
  const redisHost = opts.configs.redis.host || 'localhost';
  const redisPort = opts.configs.redis.port || '6379';
  const redisAuth = opts.configs.redis.password || '';

  const connectString = opts.configs.redis.url;
  bus = Bus.create({redis: [connectString]});
  bus.on('error', (err) => {
    console.log(err);
    bus = Bus.create({redis: [connectString]});
  });
  bus.on('offline', () => {
    console.log('offline');
  });
  bus.on('online', () => {
    console.log('bus:online');
    channel = bus.pubsub('checkin-channel');
    channel.on('message', (message) => {
      console.log('received message', message);
    });
    channel.subscribe();
    setInterval(() => { 
        channel.publish('ping');
      }, 
      30000
    );
    queue = bus.queue('checkin');
    queue.on('attached', () => {
      console.log('attached to queue');
      sendMessage('hello', {date: moment().valueOf()});
    });
    queue.on('message', async (payload, id) => {
      const message = JSON.parse(payload);
      console.log('message id:', id);
      console.log('message', message);
      const p = message.payload;
      if (message.serverId !== opts.configs.id && "id" in message) {
        const event = await knexDb.from('eventLogs')
          .where({
            eventId: message.id,
          })
          .catch(e => console.log('db', 'database error', e));
        if (!event.length) {
          const results = await knexDb('eventLogs')
            .insert({ 
              eventId: message.id,
            })
            .then(
              data => knexDb('eventLogs').where({ id: data[0] }),
            )
            .catch(e => console.log('db', 'database error', e));
        }

        switch(message.type) {
          case 'makePayment':
            _makePayment(p.values, true);
            break;
          case 'updateRegistrantValues':
            _updateRegistrantValues(p.type, p.id, p.registrantId, p.values, true);
            break;
          case 'addRegistrant':
            registrants.initRegistrant(p.values);
            break;
          default:
            console.log('Missing message type:', message.type);
        }
      }
    });
    queue.attach();
    queue.consume({remove: false, index: 0});
  });
  bus.connect();
  
  //Initialize Email Client
  transport = email.createTransport(
    {
      sendmail: true,
      args: ["-f noreply@regionvivpp.org"]
    }
  );
};

const createBadge = async (registrant, type) => {
  //console.log("Creating Badge #",index);
  console.log(__dirname);
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
  }
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
  let badge = await knexDb.from('event_badges')
    .where({
      eventId: registrant.eventId,
    })
    .catch(e => console.log('db', 'database error', e));
  badge = badge[0];
  let template = badge.template.toString();

  pageBuilder = handlebars.compile(template);
  let code = `${registrant.paddedRegId}`;
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

  fs.writeFile(`badge.${registrant.registrantId}.svg`, svg, (err) => {
    if (err) throw err;
  });

  if (type === 'svg') {
    svg = new Buffer(svg).toString('base64');  
    retVal = {
      id: registrant.paddedRegId,
      mime: 'image/svg+xml',
      type: registrant.event.reg_type,
      svg,
    };
  } else {
    const pdf = await svgToPdf(svg);
    retVal = {
      id: registrant.paddedRegId,
      mime: 'application/pdf',
      type: registrant.event.reg_type,
      pdf: pdf.toString('base64'),
    };
  }

  return retVal;
};

const saveTransaction = (res, callback) => {
    let sql = "INSERT INTO transactions SET ?";
    let consts = underscore.clone(res.transaction);
    delete consts.batch;
    delete consts.payment;
    delete consts.order;
    delete consts.billTo;
    delete consts.shipTo;
    delete consts.recurringBilling;
    delete consts.customer;
    delete consts.customerIP;
    consts = underscore.extend(consts, res.transaction.batch);
    consts = underscore.extend(consts, res.transaction.order);
    consts = underscore.extend(consts, res.transaction.payment.creditCard);
    consts = underscore.extend(consts, res.transaction.customer);
    consts = underscore.extend(consts, {
      billToFirstName: res.transaction.billTo.firstName,
      billToLastName: res.transaction.billTo.lastName,
      billToAddress: res.transaction.billTo.address,
      billToCity: res.transaction.billTo.city,
      billToState: res.transaction.billTo.state,
      billToZip: res.transaction.billTo.zip,
      billToPhoneNumber: res.transaction.billTo.phoneNumber
    });
    if ("shipTo" in res.transaction) {
      consts = underscore.extend(consts, {
        shipToFirstName: res.transaction.shipTo.firstName,
        shipToLastName: res.transaction.shipTo.lastName,
        shipToAddress: res.transaction.shipTo.address,
        shipToCity: res.transaction.shipTo.city,
        shipToState: res.transaction.shipTo.state,
        shipToZip: res.transaction.shipTo.zip
      });
    }
    /** update/insert */
    connection.query(sql, consts, (err, result) => {
      if (err) { throw err; }
      sendMessage('saveTransaction', consts);
      callback({dbResult: result, creditResult: res});
    });
};

/************
* Routes
*************/

exports.index = (req, res) => {
  const content = `<html><body>api server</body>`;
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.write(content, 'utf-8');
  res.end('\n');
};

//Return documents
exports.registrants = async (req, res) => {
  let filters = [];
  let page = 0;
  let limit = 50;

  const results = await registrants.searchAttendees2(
    filters,
    page,
    limit
  );

  sendBack(res, results, 200);
};

exports.searchRegistrants = async (req, res) => {
  let filters = req.body.filters;
  let sorting = req.body.sorting;
  let exhibitors = req.body.exhibitors;
  let page = req.body.page;
  let limit = req.body.limit;

  const results = await registrants.searchAttendees2(
    filters,
    page,
    limit,
    sorting,
    exhibitors,
  );

  sendBack(res, results, 200);
};

exports.genBadge = async (req, res) =>  {
  let id = req.params.id;
  let action = req.params.action;
  let type = (action === 'print') ? 'svg' : 'pdf';
  let resource = res;
  let payload;

  const printCallback = (type, pdf) => {
    const badgeType = (type === "E") ? "ebadge" : "gbadge";
    const idx = underscore.random(0, (printerUrl[badgeType].length-1));
    const printer = ipp.Printer(printerUrl[badgeType][idx].url);
    const msg = {
      "operation-attributes-tag": {
        "requesting-user-name": "Station",
        "job-name": "Badge Print Job",
        "document-format": "application/pdf"
      },
      data: pdf
    };

    //nextBadgePrinter = ((nextBadgePrinter+1) <= (printerUrl.badge.length-1)) ? nextBadgePrinter + 1 : 0;
    printer.execute("Print-Job", msg, (err, res) => {
      if (err) { console.log(err); }
      resource.setHeader('Cache-Control', 'max-age=0, must-revalidate, no-cache, no-store');
      resource.writeHead(200, { 'Content-type': 'application/json' });
      resource.write(JSON.stringify(res), 'utf-8');
      resource.end('\n');
      console.log(res);
    });
  };
  const filters = [{
    columnName: 'displayId',
    value: id,
  }];
  const results = await registrants.searchAttendees2(
    filters,
    0,
    1,
  );

  if (results.length) {
    payload = await createBadge(results[0], type);
  }

  sendBack(res, payload, 200);
};

exports.genReceipt = (req, res) =>  {
  let id = req.params.id;
  let action = req.params.action;
  let resource = res;
  let receiptFileNameHtml = "";
  let receiptFileNamePdf = "";
  let text;
  const downloadCallback = (pdf) => {
    const data = {id: id, pdf: pdf};
    resource.setHeader('Cache-Control', 'max-age=0, must-revalidate, no-cache, no-store');
    resource.writeHead(200, { 'Content-type': 'application/json' });
    resource.write(JSON.stringify(data), 'utf-8');
    resource.end('\n');
  };
  const printCallback = (pdf) => {
    const data = new Buffer(pdf, 'binary');
    const printer = ipp.Printer(printerUrl.receipt[0].url);
    const msg = {
        "operation-attributes-tag": {
            "requesting-user-name": "Station",
            "job-name": "Receipt Print Job",
            "document-format": "application/pdf"
        },
        data: data
    };
    printer.execute("Print-Job", msg, (err, res) => {
      if (res) {
        resource.setHeader('Cache-Control', 'max-age=0, must-revalidate, no-cache, no-store');
        resource.writeHead(200, { 'Content-type': 'application/json' });
        resource.write(JSON.stringify(res), 'utf-8');
        resource.end('\n');
        console.log(res);
      }
    });
  };
  const registrantCallback = (registrants) => {
    const registrant = registrants[0];
    const doc = pdfjs.createDocument({
      font:  font.notosans.regular,
      width: 612,
      height: 792,
      padding:   20,
      threshold: 20
    });
    const run = (cmd, options, data, callback) => {
      const spawn = require('child_process').spawn;
      const command = spawn(cmd, options);
      const result = new Buffer(0);
      command.stdout.on('data', (data) => {
        result = new Buffer.concat([result, data]);
      });
      command.on('close', function(code) {
        return callback(result);
      });
      command.stdin.on('error', (data) => {
        console.log(data);
      });
      command.stdout.on('error', (data) => {
        console.log(data);
      });
      command.stdin.setEncoding = 'utf-8';
      command.stdin.write(data.toString());
      command.stdin.end();
    };
    const header = () => {
      const header = doc.header();
      let table;
      let tr;
      let td;
      table = header.table({ widths: ['50%', '50%']});
      tr = table.tr({borderBottomWidth: 4});
      tr.td('Invoice', { font: font.notosans.bold, fontSize: 20 });
      tr.td(registrant.biller.confirmNum, { font: font.notosans.bold, textAlign: 'right', fontSize: 20 });
    };
    const payTo = () => {
      let table;
      let tr;
      let td1;
      let td2;
      table = doc.table({ widths: ['60%', '40%']});
      tr = table.tr();
      td1 = tr.td();
      td1.text("Billed to:");
      td1.text(registrant.biller.firstname + " " + registrant.biller.lastname);
      td1.text(registrant.biller.company);
      td1.text(registrant.biller.address);
      td1.text(registrant.biller.city + ", " + registrant.biller.state + " " + registrant.biller.zip);

      td2 = tr.td();
      td2.text("Payment Method: ");
      if (registrant.transactions.length > 0) {
        let lastIdx = registrant.transactions.length - 1;
        td2.text("Type: " + registrant.transactions[lastIdx].cardType);
        td2.text("Card Number: " + registrant.transactions[lastIdx].cardNumber);
        td2.text("Transaction ID: "  + registrant.transactions[lastIdx].transId);
        td2.text("Date: " + moment.tz(registrant.transactions[lastIdx].submitTimeUTC, "America/Chicago").format("MMMM Do YYYY h:mm:ss a"));
      } else {
        let check = (registrant.badge_prefix === "Z") ? registrant.check : registrant.biller.transaction_id;
        td2.text("Check: "+ check);
      }
    };
    const lineItems = () => {
      let table;
      let tr;
      let td;
      let pdf;
      const numLinked = (registrant.linked) ? registrant.linked.length : 0;
      const sum = underscore.sumBy(registrant.transactions, "settleAmount");
      const price = (sum / (numLinked + 1)).toFixed(2);
      const balance = 0;
      table = doc.table({ headerRows: 1, widths: ['15%', '45%', '15%', '25%']});
      tr = table.tr({borderBottomWidth: 1});
      tr.td('Item', { font: font.notosans.bold, fontSize: 12 });
      tr.td('Description', { font: font.notosans.bold, fontSize: 12 });
      tr.td('Quantity', { font: font.notosans.bold, fontSize: 12 });
      tr.td('Price', { font: font.notosans.bold, fontSize: 12 });

      tr = table.tr();
      tr.td(registrant.event.reg_type+registrant.id.toString(), {});
      tr.td(registrant.lastname + ", " + registrant.firstname, {});
      tr.td('1', {});
      tr.td(price, {});
      if (registrant.linked) {
        registrant.linked.forEach((linked, index) => {
          tr = table.tr();
          tr.td(registrant.event.reg_type+linked.id.toString(), {});
          tr.td(linked.lastname + ", " + linked.firstname, {});
          tr.td('1', {});
          tr.td(price, {});
        });
      }
      tr = table.tr({borderTopWidth: 1});
      tr.td("", {});
      tr.td("", {});
      tr.td("TOTAL", { font: font.notosans.bold, fontSize: 12 });
      tr.td(sum, {});

      tr = table.tr();
      tr.td("", {});
      tr.td("", {});
      tr.td("PAID", { font: font.notosans.bold, fontSize: 12 });
      tr.td(sum, {});

      tr = table.tr();
      tr.td("", {});
      tr.td("", {});
      tr.td("BALANCE", { font: font.notosans.bold, fontSize: 12 });
      tr.td(balance, {});
    };

    header();
    payTo();
    text = doc.text();
    text.br();
    lineItems();
    pdf = doc.render();
    if (action === "download") {
      const data = new Buffer(pdf.toString()).toString("base64");
      downloadCallback(data);
    } else {
      run(
        "/usr/bin/pdftocairo",
        ["-pdf", "-", "-"],
        pdf,
        function(result) {
          printCallback(result);
        }
      );
    }
  };
  console.log("Badge action:", action);
  registrants.searchAttendees(["registrantid"], id, 0, 100, false, registrantCallback);
};

exports.getRegistrant = async (req, res) =>  {
  const id = req.params.id;
  const registrant = await registrants.searchAttendees2(
    [{
      columnName: 'displayId',
      value: id,
    }],
    0,
    1
  );

  sendBack(res, registrant, 200);
};

exports.updateRegistrant = async (req, res) =>  {
  const id = req.params.id;
  const registrantId = req.body.registrantId;
  let sid = null;
  const type = req.body.type;
  const values = req.body;
  let registrant;

  if (type === "status") {
    registrant = await registrants.updateAttendee(
      registrantId,
      values
    );
    if ("fields" in values && "attend" in values.fields) {
      if (values.attend) {
        logAction(null, "registrant", id, "attend", "Registrant checked in");
        updateCheckedIn();
      } else {
        logAction(null, "registrant", id, "attend", "Registrant checked out");
        updateCheckedIn();
      }
    }
  } else {
    registrant = await registrants.updateAttendee(
      registrantId,
      values
    );
    logAction(null, "registrant", id, "updated", "Registrant updated");
  }
  
  /*
  sendFCM(
    'updateRegistrant', 
    {
      registrant
    }
  );
  const count = await registrants.getCheckedInCount();
  sendFCM(
    'stats', 
    {
      count
    }
  );
  */
  sendBack(res, registrant, 200);
};

exports.addRegistrant = async (req, res) =>  {
  let values = req.body;
  // sendMessage('addRegistrant', { values });
  const registrant = await registrants.initRegistrant(values);
  sendBack(res, registrant, 200);
};

exports.getExhibitorCompanies = async (req, res) =>  {
  let search = req.query.search;

  const companies = await registrants.getExhibitorCompanies(search);
  sendBack(res, companies, 200);
};

exports.getFields = (req, res) =>  {
  let type = req.params.type;

  const fields = registrants.getFields(type);
  sendBack(res, fields, 200);
};

exports.getOnsiteEvents = async (req, res) =>  {
  const records = await knexDb.from('events')
    .orderBy('id', 'ASC')
    .catch(e => console.log('db', 'database error', e));

  sendBack(res, records, 200);
};

exports.getEvents = async (req, res) =>  {
  const events = await knexDb.from('events')
    .orderBy('id', 'ASC')
    .catch(e => console.log('db', 'database error', e));

  sendBack(res, events, 200);
};

exports.getEventFields = async (req, res) =>  {
  const sid = req.session.id;
  const id = req.params.id;

  const records = await knexDb.from('eventFields')
    .where({ event_id: id })
    .catch(e => console.log('db', 'database error', e));

  sendBack(res, records, 200);
};

const authorizeTransaction = (request) => {
  return new Promise((resolve, reject) => {
    let retVal;
    const ctrl = new ApiControllers.CreateTransactionController(request.getJSON());
    if (!opts.configs.authorizenet.sandbox) {
      ctrl.setEnvironment(SDKConstants.endpoint.production);
    }

    ctrl.execute(() => {
      const apiResponse = ctrl.getResponse();
      const response = new ApiContracts.CreateTransactionResponse(apiResponse);
      if (
        response != null 
        && response.getMessages().getResultCode() == ApiContracts.MessageTypeEnum.OK
        && response.getTransactionResponse().getMessages() != null
      ) {
        resolve(response.getTransactionResponse());
      } else {
        if (response.getTransactionResponse() != null && response.getTransactionResponse().getErrors() != null) {
          reject(response.getTransactionResponse().getErrors().getError());
				}
				else {
          reject(response.getMessages().getMessage());
				}
      }
    });
  });
};

const getTransaction = (trans) => {
  return new Promise((resolve, reject) => {
    let retVal;
    const getRequest = new ApiContracts.GetTransactionDetailsRequest();
    getRequest.setMerchantAuthentication(merchantAuthenticationType);
    const transId = (trans.transactionId) ? trans.transactionId : trans.transId;
    getRequest.setTransId(transId);
    //getRequest.setRefId(trans.journalNumber);
	  const ctrl = new ApiControllers.GetTransactionDetailsController(getRequest.getJSON());
    if (!opts.configs.authorizenet.sandbox) {
      ctrl.setEnvironment(SDKConstants.endpoint.production);
    }
    ctrl.execute(() => {
      const apiResponse = ctrl.getResponse();
      const response = new ApiContracts.GetTransactionDetailsResponse(apiResponse);
      if (
        response != null 
        && response.getMessages().getResultCode() == ApiContracts.MessageTypeEnum.OK
      ) {
        retVal = response.getTransaction();
        resolve(retVal);
      } else {
        reject(response.getMessages().getMessage())
      }
    });
  });
}

const updateTransaction = async (transaction, registrant) => {
  let results;
  const createdAt = moment().format('YYYY-MM-DD HH:mm:ss');
  const regTransRecord = {
    confirmation: registrant.confirmation,
    journalNumber: shortid.generate(),
    type: 'credit',
    transactionId: transaction.transId,
    checkNumber: null,
    amount: (transaction.authAmount) ? transaction.authAmount : null,
    front: null,
    back: null,
    createdAt,
  };

  const record = {
    transId: transaction.transId,
    submitTimeUTC: (transaction.submitTimeUTC) ? moment.tz(transaction.submitTimeUTC, 'UTC').format('YYYY-MM-DD HH:mm:ss') : null,
    submitTimeLocal: (transaction.submitTimeLocal) ? moment(transaction.submitTimeLocal).format('YYYY-MM-DD HH:mm:ss') : null,
    transactionType: (transaction.transactionType) ? transaction.transactionType : null,
    transactionStatus:(transaction.transactionStatus) ? transaction.transactionStatus : null,
    responseCode: (transaction.responseCode) ? transaction.responseCode : null,
    responseReasonCode: (transaction.responseReasonCode) ? transaction.responseReasonCode : null,
    responseReasonDescription: (transaction.responseReasonDescription) ? transaction.responseReasonDescription : null,
    authCode: (transaction.authCode) ? transaction.authCode : null,
    AVSResponse: (transaction.AVSResponse) ? transaction.AVSResponse : null,
    cardCodeResponse: (transaction.cardCodeResponse) ? transaction.cardCodeResponse : null,
    batchId: (transaction.batch && transaction.batch.batchId) ? transaction.batch.batchId : null,
    settlementTimeUTC: (transaction.batch && transaction.batch.settlementTimeUTC) ? moment.tz(transaction.batch.settlementTimeUTC, 'UTC').format('YYYY-MM-DD HH:mm:ss') : null,
    settlementTimeLocal: (transaction.batch && transaction.batch.settlementTimeLocal) ? moment(transaction.batch.settlementTimeLocal).format('YYYY-MM-DD HH:mm:ss') : null,
    invoiceNumber: (transaction.order && transaction.order.invoiceNumber) ? transaction.order.invoiceNumber : null,
    description: (transaction.order && transaction.order.description) ? transaction.order.description : null,
    customerId: (transaction.customer && 'id' in transaction.customer) ? transaction.customer.id : null,
    authAmount: (transaction.authAmount) ? transaction.authAmount : null,
    settleAmount: (transaction.settleAmount) ? transaction.settleAmount : null,
    cardNumber: (transaction.payment && transaction.payment.creditCard) ? transaction.payment.creditCard.cardNumber : null,
    cardType: (transaction.payment && transaction.payment.creditCard) ? transaction.payment.creditCard.cardType : null,
    email: (transaction.customer && transaction.customer.email) ? transaction.customer.email : null,
  };

  const existRegTransaction = await knexDb('registrantTransactions')
    .where({
      transactionId: record.transId,
    })
    .catch(e => console.log('db', 'database error', e));

  if (existRegTransaction.length) {
    results = await knexDb('registrantTransactions')
      .where({ id: existRegTransaction[0].id })
      .update(regTransRecord)
      .then(
        data => knexDb('registrantTransactions').where({ id: existRegTransaction[0].id }),
      )
      .catch(e => console.log('db', 'database error', e));
  } else {
    results = await knexDb('registrantTransactions')
      .insert(regTransRecord)
      .then(
        data => knexDb('registrantTransactions').where({ id: data[0] }),
      )
      .catch(e => console.log('db', 'database error', e));
  }

  const existTransaction = await knexDb('transactions')
    .where({
      transId: record.transId,
    })
    .catch(e => console.log('db', 'database error', e));

  if (existTransaction.length) {
    results = await knexDb('transactions')
      .where({ id: existTransaction[0].id })
      .update(record)
      .then(
        data => knexDb('transactions').where({ id: existTransaction[0].id }),
      )
      .catch(e => console.log('db', 'database error', e));
  } else {
    results = await knexDb('transactions')
      .insert(record)
      .then(
        data => knexDb('transactions').where({ id: data[0] }),
      )
      .catch(e => console.log('db', 'database error', e));
  }

  return results;
}

exports.makePayment = async (req, res) =>  {
  const values = req.body;
  let data;
  let statusCode = 200;
  if (values.type === "check") {
    /** update/insert */
    const result = await registrants.saveCheckTransaction(values);
    const reg = await registrants.searchAttendees2(
      [{
        columnName: 'displayId',
        value: values.registrant.displayId,
      }],
      0,
      1
    );
    data = reg[0];
  } else if (values.type !== "check") {
    let retailInfoType;
    const paymentType = new ApiContracts.PaymentType();
    if (values.transaction.trackOne || values.transaction.trackTwo) {
      const trackData = new ApiContracts.CreditCardTrackType();
      if (values.transaction.trackOne) {
        trackData.setTrack1(values.transaction.trackOne);
      }
      if (values.transaction.trackTwo) {
        trackData.setTrack2(values.transaction.trackTwo);
      }
      paymentType.setTrackData(trackData);

      retailInfoType = new ApiContracts.TransRetailInfoType();
      retailInfoType.marketType = 2;
      retailInfoType.deviceType = 5;

      /*
      transaction.transactionRequest.retail = {
        marketType: 2,
        deviceType: 5
      };
      */
    } else {
      const creditCard = new ApiContracts.CreditCardType();
      creditCard.setCardNumber(values.transaction.cardNumber.replace(/\s+/g, ''));
      const expDate = values.transaction.expirationDate.replace(/\s+/g, '').split('/');
      creditCard.setExpirationDate(`20${expDate[1]}-${expDate[0]}`);
      // Set the token specific info
      creditCard.setCardCode(values.transaction.security.replace(/\s+/g, ''));
      paymentType.setCreditCard(creditCard);
    }

    const orderDetails = new ApiContracts.OrderType();
    orderDetails.setInvoiceNumber(values.registrant.confirmation);
    orderDetails.setDescription(values.registrant.registrantId);

    const billTo = new ApiContracts.CustomerAddressType();
    billTo.setFirstName(values.registrant.firstname);
    billTo.setLastName(values.registrant.lastname);

    const customer = new ApiContracts.CustomerType();
    customer.setType(ApiContracts.CustomerTypeEnum.INDIVIDUAL);
		customer.setId(values.registrant.confirmation);
		customer.setEmail(values.registrant.email);

    const transactionRequestType = new ApiContracts.TransactionRequestType();
    transactionRequestType.setTransactionType(ApiContracts.TransactionTypeEnum.AUTHCAPTURETRANSACTION);
    transactionRequestType.setPayment(paymentType);
    transactionRequestType.setAmount(values.transaction.amount);
    transactionRequestType.setOrder(orderDetails);
    transactionRequestType.setBillTo(billTo);
    transactionRequestType.setCustomer(customer);
    if (retailInfoType) {
      transactionRequestType.setRetail(retailInfoType);
    }

    const createRequest = new ApiContracts.CreateTransactionRequest();
    createRequest.setMerchantAuthentication(merchantAuthenticationType);
    createRequest.setTransactionRequest(transactionRequestType);
    try {
      const transaction = await authorizeTransaction(createRequest);
      let details;
      if (opts.configs.authorizenet.sandbox) {
        details = transaction;
      } else {
        details = await getTransaction(transaction);
      }
      if (details) {
        const results = await updateTransaction(details, values.registrant);
        data = results;
      }
      const reg = await registrants.searchAttendees2(
        [{
          columnName: 'displayId',
          value: values.registrant.displayId,
        }],
        0,
        1
      );
      data = reg[0];
    } catch(e) {
      data = e;
      statusCode = 500;
    }
  }
  sendBack(res, data, statusCode);
}

const _makePayment = (values, remote, callback) => {
  const Request = new AuthorizeRequest({
    api: opts.configs.authorizenet.id,
    key: opts.configs.authorizenet.key,
    rejectUnauthorized: false, // true
    requestCert: false, // false
    agent: false, // http.agent object
    sandbox: opts.configs.authorizenet.sandbox// true
  });

  if (values.type === "check") {
    /** update/insert */
    registrants.saveCheckTransaction(
      values,
      (results) => {
        if (callback) callback(200, results);
      }
    );
  } else if (values.type !== "check") {

    const transaction = {
      transactionRequest: {
        transactionType: "authCaptureTransaction",
        amount: values.transaction.amount,
        payment: null,
        order: {
          invoiceNumber: values.registrant.confirmNum,
          description: values.registrant.event.title
        },
        customer: {
          id: values.registrant.confirmNum,
          email: (values.registrant.email) ? values.registrant.email : 'voss.matthew@gmail.com'
        },
        billTo: null
      }
    };

    if (values.registrant.badge_prefix === "E") {
      transaction.transactionRequest.order.invoiceNumber = values.registrant.confirmation;
    }


    if (values.transaction.track !== null) {
      transaction.transactionRequest.payment = {
        trackData: {
          track1: values.transaction.track
        }
      };
      transaction.transactionRequest.billTo = {
        firstName: values.transaction.firstName,
        lastName: values.transaction.lastName
      };
      transaction.transactionRequest.retail = {
        marketType: 2,
        deviceType: 5
      };
    } else {
      transaction.transactionRequest.payment = {
          creditCard: {
          cardNumber: values.transaction.cardNumber.replace(/\s+/g, ''),
          expirationDate: values.transaction.expirationDate.replace(/\s+/g, ''),
          cardCode: values.transaction.security.replace(/\s+/g, '')
        }
      };
      transaction.transactionRequest.billTo = {
        firstName: values.transaction.name.split(" ")[0],
        lastName: values.transaction.name.split(" ")[1]
      };

    }

    console.log(transaction, transaction.transactionRequest.payment);
    async.waterfall(
      [
        (calback) => {
          Request.send(
            "createTransaction",
            transaction,
            (err, results) => {
              console.log(err, results);
              calback(err, results);
            }
          );
        },
        (results, cback) => {

          let details = {
            transId: results.transactionResponse.transId
          };

          Request.send(
            "getTransactionDetails",
            details,
            (err, transDetails) => {
              console.log(err, transDetails);
              cback(err, transDetails);
            }
          );
        },
        (details, cback) => {
          const trans = {
            registrant: values.registrant,
            transaction: details.transaction
          };
          /** update/insert */
          registrants.saveCreditTransaction(
            trans,
            (dbResults) => {
                /** update/insert */
              registrants.saveAuthorizeNetTransaction(
                trans,
                (results) => {
                  cback(
                    null,
                    results.db
                  );
                }
              );
            }
          );
        }
      ],
      (err, result) => {
        if (err && !remote) {
          callback(500, err);
        } else if (!remote) {
          callback(200, result);
        }
      }
    );
  }
};

exports.downloadTransactions = async (req, res) => {
  let results;
  const transactions = await knexDb('registrantTransactions')
    .whereNot(
      {
        type: 'check',
        transactionId: '',
      }
    )
    .catch(e => console.log('db', 'database error', e));
  if (transactions.length) {
    const details = await map(transactions, getTransaction);
    // console.log(details);
    results = await map(details, updateTransaction);
  }
   
  sendBack(res, results, 200);
}

exports.getStats = async (req, res) =>  {
  const count = await registrants.getCheckedInCount();
  sendBack(res, count, 200);
};

exports.downloadCheckedInAttendees = async (req, res) =>  {
  
  const attendees = await registrants.searchAttendees2(
    [{
      columnName: 'attend',
      value: 1,
    }],
    null,
    null,
  );
  
  json2csv(
    {
      data: attendees, 
      fields: [
        'paddedRegId', 
        'confirmation', 
        'firstname',
        'lastname',
        'title',
        'email',
        'phone',
        'organization',
        'address',
        'address2',
        'city',
        'state',
        'zipcode',
        'siteid'
      ]
    }, 
    (err, csv) => {
      res.writeHead(200, { 'Content-Type': 'text/csv' });
      res.write(csv, 'utf-8');
      res.end('\n');
    }
  );
};

exports.countAttendees = async (req, res) => {
  const exhibitor = (req.params.type === 'exhibitors') ? 1 : 0;
  const results = await knexDb('onsiteAttendees')
    .count('id as total')
    .where({
      exhibitor,
    })
    .catch(e => console.log('db', 'database error', e));

    sendBack(res, results, 200);
}

const updateRegistrant = async (registrant) => {
  let results;
  const where = {
    confirmation: registrant.confirmation
  };

  let phoneNumber;
  let f_val;
  let np;
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
  
  const reg = await knexDb.from('onsiteAttendees')
    .where(where)
    .catch(e => console.log('db', 'database error', e));

  if (reg.length) {
    console.log("Found record", registrant.confirmation);
    results = await knexDb('onsiteAttendees')
      .where({ id: reg[0].id })
      .update(registrant)
      .then(
        data => knexDb('onsiteAttendees').where({ id: reg[0].id }),
      )
      .catch(e => console.log('db', 'database error', e));
  } else {
    console.log("New record", registrant.confirmation);
    registrant.pin = gpc(4);
    results = await knexDb('onsiteAttendees')
      .insert(registrant)
      .then(
        data => knexDb('onsiteAttendees').where({ id: data[0] }),
      )
      .catch(e => console.log('db', 'database error', e));
  }

  return results;
};

const processRegs = async (results) => {
  //console.log(results);
  let registrants = [];
  results.forEach((reg, index) => {
    let record = {}
    for (let prop in mappings.general) {
      const key = mappings.general[prop];
      if (mappings.general[prop] === "siteId") {
        let siteId = (reg[dupSiteIdField]) ? parseInt(reg[dupSiteIdField], 10) : parseInt(reg[prop], 10);
        //console.log(siteId);
        if (Number.isInteger(siteId)) {
          record[key] = pad(siteId, 6);
        } else {
          record[key] = null;
        }
      } else if(mappings.general[prop] === "management") {
        let management = (reg[prop] === "Yes") ? true : false;
        record[key] = management;
      } else if(mappings.general[prop] === "createdAt") {
        let regDate = (reg[prop].length) ? moment.tz(reg[prop], "DD-MMM-YYYY h:mmA") : moment();
        let created = (regDate.isValid()) ? regDate.format("YYYY-MM-DD HH:mm:ss") : moment().format("YYYY-MM-DD HH:mm:ss");
        record[key] = created;
        record.updatedAt = created;
      } else if(key === "state") {
        record[key] = reg[prop][""];
      } else {
        record[key] = reg[prop];
      }
    }
    /*
    record.eventId = eventIds[reg["Registration Path"]];
    if (reg["Registration Path"] === "") {
      record.eventId = "f4f1fc6a-0709-11e6-9571-53e72e0ba997";
    }
    */
    record.eventId = "f4f1fc6a-0709-11e6-9571-53e72e0ba997";
    if (reg[registraionType] === "Workshop Presenter") {
      record.speaker = 1;
    } else if (reg[registrationType] === "OSHA Employee") {
      record.osha = 1;
    }
    
    if (reg["Invitee Status"] === "Cancelled") {
      let deleted = moment.tz(reg["Last Registration Date (GMT)"], "DD-MMM-YYYY h:mmA").format("YYYY-MM-DD HH:mm:ss");
      // record.deletedAt = deleted;
    } else {
      record.deletedAt = null;
    }
    registrants.push(record);
  });
  
  const res = await map(registrants, updateRegistrant);
  return res
};

const updateImportedTransaction = async (trans) => {
  let results;
  let record = {
    id: null,
    confirmation: trans['Primary Registrant Confirmation #'],
    journalNumber: trans['Journal Number'],
    type: (trans['Payment Method'] === 'Check' || trans['Payment Method'] === 'Bank Transfer') ? 'check' : 'credit',
    transactionId: trans['Transaction ID'],
    checkNumber: null,
    amount: trans['Amount'],
    createdAt: moment.tz(trans["Transaction Date (GMT)"]).format("YYYY-MM-DD HH:mm:ss"),
    updatedAt: moment.tz(trans["Transaction Date (GMT)"]).format("YYYY-MM-DD HH:mm:ss"),
  };
  const regTransaction = await knexDb('registrantTransactions')
    .where({
      confirmation: trans['Primary Registrant Confirmation #'],
    })
    .catch(e => console.log('db', 'database error', e));
  if (regTransaction.length) {
    record.id = regTransaction[0].id;
    results = await knexDb('registrantTransactions')
      .where({ id: regTransaction[0].id })
      .update(record)
      .then(
        data => knexDb('registrantTransactions').where({ id: regTransaction[0].id }),
      )
      .catch(e => console.log('db', 'database error', e));
  } else {
    results = await knexDb('registrantTransactions')
      .insert(record)
      .then(
        data => knexDb('registrantTransactions').where({ id: data[0] }),
      )
      .catch(e => console.log('db', 'database error', e));
  }
  
  let result = (results.length) ? results[0] : null;
  return result;
};


const processTransactions = async (transactions) => {
  const results = await map(transactions, updateImportedTransaction);
  return results;
}


exports.importData = async (req, res) => {
  let results = [];
  const finish = async () => {
    if (req.params.type === 'registrants') {
      results = await processRegs(results);
    } else if (req.params.type === 'transactions') {
      results = await processTransactions(results);
    }
    sendBack(res, results, 200);
  };
  const data = req.files.file.data.toString('utf8');
  console.log(data);
  csvjson()
  .fromString(data)
  .on('json', (jsonObj) => {
    results.push(jsonObj);
    console.log(jsonObj);
  })
  .on('done',(error) => {
    finish();
  });
  
}

exports.getSiteIds = async (req, res) =>  {
  const siteids = await knexDb.from('siteIds')
    .orderBy('company', 'ASC')
    .catch(e => console.log('db', 'database error', e));
  sendBack(res, siteids, 200);
};

exports.getUserIds = async (req, res) =>  {
  const userIds = await knexDb.from('exhibitors')
    .orderBy('organization', 'ASC')
    .catch(e => console.log('db', 'database error', e));
  sendBack(res, userIds, 200);
};

exports.findSiteId = async (req, res) =>  {
  const query = req.query.search;
  const siteids = await knexDb.from('siteIds')
    .where('siteId', 'LIKE', `%${query}%`)
    .orderBy('company', 'ASC')
    .catch(e => console.log('db', 'database error', e));
  sendBack(res, siteids, 200);
};

exports.findVotingSiteId = async (req, res) =>  {
  const query = req.query.search;
  const siteids = await knexDb.from('votingSites')
    .where('siteId', 'LIKE', `%${query}%`)
    .orderBy('company', 'ASC')
    .catch(e => console.log('db', 'database error', e));
  sendBack(res, siteids, 200);
};

exports.findCompany = async (req, res) =>  {
  const query = req.params.query;
  const limit = req.body.limit ? req.body.limit : 50;
  const siteids = await knexDb.from('siteIds')
    .where('company', 'LIKE', `%${query}%`)
    .orderBy('company', 'ASC')
    .limit(limit)
    .catch(e => console.log('db', 'database error', e));
  sendBack(res, siteids, 200);
};

exports.findVotingSites = async (req, res) =>  {
  const query = req.params.query;
  const siteids = await knexDb.from('votingSites')
    .where('company', 'LIKE', `%${query}%`)
    .orderBy('company', 'ASC')
    .catch(e => console.log('db', 'database error', e));
  sendBack(res, siteids, 200);
};

exports.getVotingSites = async (req, res) =>  {
  const query = req.query.search;
  const siteids = await knexDb.from('votingSites')
    .orderBy('company', 'ASC')
    .catch(e => console.log('db', 'database error', e));
  sendBack(res, siteids, 200);
};

  //Auth a user
exports.authVoter = async (req, res) =>  {
  let request = req;
  let registrantId = req.params.voterId;
  let regType = registrantId.slice(0,1);
  let regId = parseInt(registrantId.slice(1), 10);
  let normalizedId = regType.toUpperCase() + pad(regId, 5);
  let errorMsg = {
    status: "error",
    message: {
      response: null
    }
  };
  
  const vote = await knexDb.from('votes')
    .where({ registrantid: normalizedId })
    .catch(e => console.log('db', 'database error', e));

  if (!vote.length) {
    const filters = [{
      columnName: 'displayId',
      value: normalizedId,
    }];
    const member = await registrants.searchAttendees2(
      filters,
      0,
      1,
    );
    if (member.length && "id" in member[0]) {
      //console.log("member", member);
      member[0].siteId = ("siteid" in member[0]) ? member[0].siteid : member[0].siteId;
      if (member[0].siteId !== "") {
        let site = await getVotingSiteInfo(member[0].siteId);
        member[0].voterType = null;
        member[0].votes = [];
        site = (site.length) ? site[0] : {};
        member[0].site = site;
        member[0].registrantId = normalizedId;
        sendBack(res, member[0], 200);
      } else {
        member[0].voterType = null;
        member[0].votes = [];
        member[0].registrantId = normalizedId;
        member[0].site = {};
        sendBack(res, member[0], 200);
      }
    } else {
      errorMsg.message.response = "No record of that registrant id exists.";
      sendBack(res, errorMsg, 401);
    }
  } else {
    errorMsg.message.response = "You have already voted.";
    sendBack(res, errorMsg, 401);
  }
};

exports.verifyVoterPin = async (req, res) =>  {
  let request = req;
  let registrantId = req.params.voterId;
  let pin = req.params.pin;
  let regType = registrantId.slice(0,1);
  let regId = parseInt(registrantId.slice(1), 10);
  let errorMsg = {
    status: "error",
    message: {
      response: null
    }
  };
  const member = await registrants.getAttendee(registrantId);
  if (member.pin === pin) {
    member.voterType = null;
    member.votes = [];
    member.registrantId = registrantId;
    member.site = {};
    sendBack(res, member, 200);
  } else {
    errorMsg.message.response = "Invalid Pin";
    sendBack(res, errorMsg, 401);
  }
};

//Log out the current user
exports.logoutVoter = (req, res) =>  {
  req.session.destroy(() => {
    res.clearCookie('connect.sid', { path: '/' });
    sendBack(res, {logout: true}, 200);
  });
};

exports.verifySiteId = async (req, res) =>  {
  let retVal = [];
  const siteId = req.params.siteId;
  let site = await getVotingSiteInfo(siteId);
  if (site.length) {
    retVal = site[0];
    const voters = await getSiteVoters(retVal.siteId);
    retVal.voters = voters;
  }
  sendBack(res, retVal, 200);
};

exports.addVoterType = (req, res) =>  {
  const member = req.body;
  req.session.voter.voterType = member.voterType;
  req.session.voter.votes = member.votes;
  member = req.session.voter;
  sendBack(res, member, 200);
};

exports.castVotes = async (req, res) =>  {
  let status = 200;
  let user = req.body;
  let uid = uuidv4();
  let msg = Object.assign(
    {},
    messageTemplate,
  );
  const recordVote = async (office) => {
    const vote = office;
    /*
    vote.datecast = new Date();
    vote.uuid = uid;
    vote.registrantid = user.registrantId;
    vote.siteid = user.siteId;
    vote.votertype = user.voterType;
    vote.candidateid = vote.id;
    */
    /** update/insert */
    const result = await knexDb('votes')
      .insert(vote)
      .then(
        data => knexDb('votes').where({ id: data[0] }),
      )
      .catch(e => console.log('db', 'database error', e));
    
    return result;
  };

  const vote = await knexDb.from('votes')
    .where({ registrantid: user.registrantId })
    .catch(e => console.log('db', 'database error', e));

  if (vote && vote.length) {
    msg.status = 'error'
    msg.message.response = "You have already voted.";
    status = 401;
  } else {
    const votesCast = await map(
      user.votes, 
      recordVote
    ); 
    msg.message.response = votesCast;
    await updateVoteTotals();
  }

  sendBack(res, msg, status);
};

exports.offices = async (req, res) =>  {
  let offices = await knexDb.from('electionOffices')
    .catch(e => console.log('db', 'database error', e));

  offices = await map(
    offices,
    async (office) => {
      office.candidates = await knexDb.from('electionOfficeCandidates')
        .where({ electionId: office.id })
        .catch(e => console.log('db', 'database error', e));
      return office;
    }
  );

  sendBack(res, offices, 200);
};

exports.addDeviceToken = async (req, res) =>  {
  const token = req.params.token;
  const response = await subscribeFcmTopic(token);
  sendBack(res, response, 200);
};

const updateCheckedIn = async () => {
  const count = await registrants.getCheckedInCount();

  logAction(0, "updates", count, "checkedIn", "Number checked in");
};

const getSiteInfo = async (siteId) => {
  const site = await knexDb.from('sites')
    .where({ siteId })
    .catch(e => console.log('db', 'database error', e));
  return site;
};

const getVotingSiteInfo = async (siteId) => {
  const site = await knexDb.from('votingSites')
    .where({ siteId })
    .catch(e => console.log('db', 'database error', e));
  return site;
};

const updateVoteTotals = async () => {
  let offices = await knexDb.from('electionOffices')
    .catch(e => console.log('db', 'database error', e));

  offices = await map(
    offices,
    async (office) => {
      office.candidates = await knexDb.from('electionOfficeCandidates')
        .where({ electionId: office.id })
        .catch(e => console.log('db', 'database error', e));
      return office;
    }
  );
  const votes = knexDb('votes')
    .select(knex.raw('count(*) as count, candidateid'))
    .groupBy('candidateid')
    .catch(e => console.log('db', 'database error', e));

  const results = {
    votes,
    offices,
  };
};

const getSiteVoters = async (siteId) => {
  const votes = await knexDb.from('votes')
    .where({ siteid: siteId })
    .groupBy('registrantid')
    .groupBy('votertype')
    .groupBy('datecast')
    .catch(e => console.log('db', 'database error', e));

  const voters = await map(
    votes,
    async (vote) => {
      const registrantId = vote.registrantid;
      const regType = registrantId.slice(0,1);
      const regId = parseInt(registrantId.slice(1), 10);

      const member = await registrants.getAttendee(registrantId);
      member.voterType = vote.votertype;
      member.dateCast = vote.datecast;

      return member;
    }
  );
  return voters;
};

const sendBack = (res, data, status) => {
  status = status || 200;
  res.setHeader('Cache-Control', 'max-age=0, must-revalidate, no-cache, no-store');
  res.writeHead(status, { 'Content-type': 'application/json' });
  res.write(JSON.stringify(data), 'utf-8');
  res.end('\n');
};

//Helpers
const getConnection = () => {
  // Test connection health before returning it to caller.
  if ((connection) && (connection._socket) &&
      (connection._socket.readable) &&
      (connection._socket.writable)) {
    return connection;
  }
  console.log(((connection) ?
    "UNHEALTHY SQL CONNECTION; RE" : "") + "CONNECTING TO SQL.");
  connection = mysql.createConnection(opts.configs.mysql);
  connection.connect((err) => {
    if (err) {
      console.log("(Retry: "+reconnectTries+") SQL CONNECT ERROR: " + err);
      reconnectTries++;
      const timeOut = ((reconnectTries * 50) < 30000) ? reconnectTries * 50 : 30000;
      if (reconnectTries === 50) {
          /**
          const mailOptions = {
              from: "VPPPA Site ID Lookup <noreply@vpppa.org>", // sender address
              to: "problem@griffinandassocs.com", // list of receivers
              subject: "VPPPA Site ID Lookup DB Issue", // Subject line
              text: "The VPPPA Site ID Lookup is unable to connect to the mysql db server.", // plaintext body
              html: "<b>The VPPPA Site ID Lookup is unable to connect to the mysql db server.</b>" // html body
          };

          transport.sendMail(mailOptions, function(error, response){
              if(error){
                  console.log(error);
              }else{
                  console.log("Message sent: " + response.message);
              }

              // if you don't want to use this transport object anymore, uncomment following line
              //smtpTransport.close(); // shut down the connection pool, no more messages
          });
          **/
      }
      setTimeout(getConnection, timeOut);
    } else {
      console.log("SQL CONNECT SUCCESSFUL.");
      reconnectTries = 0;
      handleDisconnect(connection);
    }
  });
  connection.on("close", function (err) {
    console.log("SQL CONNECTION CLOSED.");
  });
  connection.on("error", function (err) {
    console.log("SQL CONNECTION ERROR: " + err);
  });
  connection = connection;
  return connection;
};


const handleDisconnect = (connection) => {
  connection.on('error', (err) => {
    if (!err.fatal) {
      return;
    }

    if (err.code !== 'PROTOCOL_CONNECTION_LOST') {
      throw err;
    }
    console.log('Re-connecting lost connection: ' + err.stack);
    getConnection();
  });
};

const logAction = (uid, objType, objId, modType, desc) => {
  const logData = {
      objectType: objType,
      objectId: objId,
      uid: uid,
      modType: modType,
      description: desc
  };
  // opts.io.emit("talk", logData);
};

const subscribeFcmTopic = async (token) => {
  const topic = 'region-6-updates';
  const tokens = [token];

  let response;
  // Send a message to devices subscribed to the provided topic.
  try {
    response = await admin.messaging().subscribeToTopic(tokens, topic);
  } catch(e) {
    console.log('Error sending message:', e);
    response = e;
  }

  return response;
} 

const sendFCM = async (type, payload) => {
  // The topic name can be optionally prefixed with "/topics/".
  const topic = 'region-6-updates';

  // See documentation on defining a message payload.
  const message = {
    data: {
      type,
      payload: JSON.stringify(payload),
    },
    topic: topic
  };

  let response;
  // Send a message to devices subscribed to the provided topic.
  try {
    response = await admin.messaging().send(message);
  } catch(e) {
    console.log('Error sending message:', e);
  }

  return response;
}

const pad = (num, size) => {
  let s = num + "";
  while (s.length < size) { s = "0" + s; }
  return s;
};
