const Converter = require("csvtojson").Converter;
const { map, props, mapSeries } = require('awaity');
const gpc = require('generate-pincode');
const converter = new Converter({});
const knex = require('knex');
const fs = require('fs');
const pnf = require('google-libphonenumber').PhoneNumberFormat;
const phoneUtil = require('google-libphonenumber').PhoneNumberUtil.getInstance();
const path = require('path');
const mysql = require('mysql');
const nconf = require('nconf');
const async = require('async');
const moment = require('moment-timezone');
const config = require('../config');

const finish = () => {
  process.exit();
};

const updateReg = async (reg) => {
  reg.pin = gpc(4);
  reg.exhibitor = 1;
  reg.eventId = 'f4f1fc6a-0709-11e6-9571-53e72e0ba997';
  reg.createdAt = reg.updatedAt;
  const exhibitor = await db('exhibitors')
    .where({
      id: reg.userId,
    })
    .catch(e => console.log('db', 'database error', e));
  if (exhibitor.length) {
    reg.confirmation = exhibitor[0].confirmation;
    reg.groupConfirm = exhibitor[0].confirmation;
  }
  const result = await db('onsiteAttendees')
    .where({ id: reg.id })
    .update(reg)
    .then(
      data => db('onsiteAttendees').where({ id: reg.id }),
    )
    .catch(e => console.log('db', 'database error', e));
  return result;
};

const fixPins = async () => {
  const attendees = await db('onsiteAttendees')
    .catch(e => console.log('db', 'database error', e));

  const results = await map(attendees, updateReg);
  finish();
}

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

fixPins();