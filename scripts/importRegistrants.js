const Converter = require("csvtojson").Converter;
const { map, props, mapSeries } = require('awaity');
const gpc = require('generate-pincode');
const converter = new Converter({});
const knex = require('knex');
const fs = require('fs');
const pnf = require('google-libphonenumber').PhoneNumberFormat;
const phoneUtil = require('google-libphonenumber').PhoneNumberUtil.getInstance();
const path = require('path');
const moment = require('moment-timezone');
const config = require('../config');
const mapping = {
  "dtl_r_last_name": "lastname",
  "dtl_r_first_name": "firstname",
  "dtl_r_email": "email",
  "dtl_r_company": "organization",
  "dtl_r_title": "title",
  "dtl_r_work_address": "address",
  "dtl_r_work_city": "city",
  "dtl_r_work_state_prov": "state",
  "dtl_r_work_zip_postal_code": "zip",
  "dtl_cf1001": "phone",
  "dtl_r_primary_registrant_confirmation": "confirmation",
  "dtl_cpC76CB6": "management",
  "dtl_cpD09F43": "siteId",
  "dtl_r_created_date": "createdAt",
  "dtl_r_group_confirm_num": "groupConfirm"
};
const eventIds = {
  "VPPPA Member Option": "f4f1fc6a-0709-11e6-9571-53e72e0ba997",
  "Workshop Presenter Option": "797979fe-070f-11e6-baec-9b71d60d6a06",
  "Non Member Option": "7a0364ac-070f-11e6-99ba-1bc46ece7a2f",
  "OSHA Employee": "95123ef4-17f8-11e6-be73-a7d35618aafa"
};
let db;
let OnsiteAttendees;
let count = 0;
let dupSiteIdField = "dtl_cpC01E7D";
const finish = () => {
  process.exit();
};
const pad = (num, size) => {
  let s = num + "";
  while (s.length < size) { s = "0" + s; }
  return s;
};
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
  
  const reg = await db.from('onsiteAttendees')
    .where(where)
    .catch(e => console.log('db', 'database error', e));

  if (reg.data) {
    console.log("Found record", registrant.confirmation);
    results = await db('onsiteAttendees')
      .where({ id: reg[0].id })
      .update(registrant)
      .then(
        data => db('onsiteAttendees').where({ id: reg[0].id }),
      )
      .catch(e => console.log('db', 'database error', e));
  } else {
    console.log("New record", registrant.confirmation);
    registrant.pin = gpc(4);
    results = await db('onsiteAttendees')
      .insert(registrant)
      .then(
        data => db('onsiteAttendees').where({ id: data[0] }),
      )
      .catch(e => console.log('db', 'database error', e));
  }

  return results;
};

const processRegs = async (results) => {
  //console.log(results);
  const registrants = [];
  results.forEach((reg, index) => {
    let record = {}
    for (let prop in mapping) {
      const key = mapping[prop];
      if (mapping[prop] === "siteId") {
        const siteId = (reg[dupSiteIdField]) ? parseInt(reg[dupSiteIdField], 10) : parseInt(reg[prop], 10);
        //console.log(siteId);
        if (Number.isInteger(siteId)) {
          record[key] = pad(siteId, 6);
        } else {
          record[key] = null;
        }
      } else if(mapping[prop] === "management") {
        const management = (reg[prop] === "Yes") ? true : false;
        record[key] = management;
      } else if(mapping[prop] === "createdAt") {
        const created = moment.tz(reg[prop], "DD-MMM-YYYY h:mmA", "America/Chicago").format("YYYY-MM-DD HH:mm:ss");
        record[key] = created;
        record.updatedAt = created;
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
    if (reg["dtl_r_registration_type"] === "Workshop Presenter") {
      record.speaker = 1;
    } else if (reg["dtl_r_registration_type"] === "OSHA Employee") {
      record.osha = 1;
    }
    
    if (reg["dtl_r_status"] === "Cancelled") {
      const deleted = moment.tz(reg["Last Registration Date"], "MMM D YYYY h:mmA", "America/Chicago").format("YYYY-MM-DD HH:mm:ss");
      // record.deletedAt = deleted;
    } else {
      record.deletedAt = null;
    }
    registrants.push(record);
  });
  
  const res = await map(registrants, updateRegistrant);
  finish();
};

const parseCsv = () => {
  converter.fromFile(
    "tmp/registrants.csv",
    (err, results) => {
      processRegs(results);
    }
  );
};

db = knex({
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

//const hashids = new Hashids(config.get("salt"), 4, "ABCDEFGHJKMNPQRSTUVWXYZ23456789");
parseCsv();

