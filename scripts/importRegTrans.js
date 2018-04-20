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
let emailField = "Email Address";
let transField = "Transaction ID";

const updateTransaction = async (trans) => {
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
  const regTransaction = await db('registrantTransactions')
    .where({
      confirmation: trans['Primary Registrant Confirmation #'],
    })
    .catch(e => console.log('db', 'database error', e));
  if (regTransaction.length) {
    results = await db('registrantTransactions')
      .where({ id: reg[0].id })
      .update(record)
      .then(
        data => db('registrantTransactions').where({ id: reg[0].id }),
      )
      .catch(e => console.log('db', 'database error', e));
  } else {
    results = await db('registrantTransactions')
      .insert(record)
      .then(
        data => db('registrantTransactions').where({ id: data[0] }),
      )
      .catch(e => console.log('db', 'database error', e));
  }

  return results;
};

const processTransactions = async (transactions) => {
  const results = await map(transactions, updateTransaction);
  finish();
}

converter.fromFile(
  "tmp/transactions.csv",
  (err, results) => {
    processTransactions(results);
  }
);