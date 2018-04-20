/*jshint esversion: 6 */
const fs = require('fs');
const path = require('path');
const mysql = require('mysql');
const email = require('nodemailer');
const crypto = require('crypto');
const spawn = require('child_process').spawn;
const execFile = require('child_process').execFile;
const async = require('async');
const Acl = require('acl');
const uuidv4 = require('uuid/v4');
const glob = require('glob');
const underscore = require('lodash');
const pdf417 = require('pdf417');
const ipp = require('ipp');
const handlebars = require('handlebars');
const ApiContracts = require('authorizenet').APIContracts;
const ApiControllers = require('authorizenet').APIControllers;
const SDKConstants = require('authorizenet').Constants;
const helpers = require('handlebars-helpers')({
  handlebars: handlebars
});
const moment = require('moment-timezone');
const json2csv = require('json2csv');
const request = require('request');
const parser = require('xml2json');
const parseString = require('xml2js').parseString;
const pdfjs = require('pdfjs');
const Bus = require('busmq');
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
const Sequelize = require("sequelize");
const svgHeader = fs.readFileSync("./header.svg", "utf8");
const receipt = fs.readFileSync("./assets/templates/receipt.html", "utf8");
const Rsvg = require('librsvg-prebuilt').Rsvg;
const Registrants = require("node-registrants");
const shortid = require('shortid');

const merchantAuthenticationType = new ApiContracts.MerchantAuthenticationType();

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

const getPrinter = (callback) => {
  const addPrinter = (item, cb) => {
    //console.log("printer", item);
    printerUrl[item.type].push({url: "http://" + item.host +item.uri});
    cb(null);
  };
  models.Printers.findAll(
    {
      order: [
        ['type', 'ASC']
      ]
    }
  )
  .then(
    (printers) => {
      async.each(printers, addPrinter, (err) => {
        //console.log(err);
        callback();
      });
    },
    (err) => {
      
    }
  );
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

  db.checkin = new Sequelize(
    opts.configs.mysql.database,
    opts.configs.mysql.username,
    opts.configs.mysql.password,
    opts.configs.mysql,
  );

  merchantAuthenticationType.setName(opts.configs.authorizenet.id);
  merchantAuthenticationType.setTransactionKey(opts.configs.authorizenet.key);

  knexDb = knex({
    client: 'mysql2',
    connection: {
      host : opts.configs.mysql.host || "localhost",
      user : opts.configs.mysql.username,
      password : opts.configs.mysql.password,
      database : opts.configs.mysql.database,
      port: opts.configs.mysql.port || 3306,
    },
    debug: ['ComQueryPacket'],
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

  const connectString = opts.configs.redis.url2;
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
    queue.on('message', (payload, id) => {
      const message = JSON.parse(payload);
      console.log('message id:', id);
      console.log('message', message);
      const p = message.payload;
      if (message.serverId !== opts.configs.id && "id" in message) {
        models.eventLogs.find({
          where: {
            eventId: message.id
          }
        })
        .then(
          (event) => {
            if (!event) {
              return models.eventLogs.create(
                { 
                  eventId: message.id
                }
              );
            } else {
              return;
            }
          }
        ).then(
          (event) => {
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
        );
      }
    });
    queue.attach();
    queue.consume({remove: false, index: 0});
  });
  bus.connect();

  models.Events = db.checkin.define('events', {
    slabId:                   { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    local_slabId :              { type: Sequelize.INTEGER },
    eventId:              { type: Sequelize.STRING(36) },
    local_eventId :              { type: Sequelize.INTEGER },
    title:              { type: Sequelize.STRING(255) },
    dtstart:             { type: Sequelize.DATE },
    dtend:             { type: Sequelize.DATE },
    dtstarttime :             { type: Sequelize.TEXT },
    dtendtime :             { type: Sequelize.TEXT },
    latefee :          { type: Sequelize.DECIMAL(10, 2) },
    latefeedate:             { type: Sequelize.DATE },
    email:             { type: Sequelize.TEXT },
    max_registrations :              { type: Sequelize.INTEGER },
    registration_type:              { type: Sequelize.STRING(50) },
    topmsg:             { type: Sequelize.TEXT },
    cut_off_date:             { type: Sequelize.DATE },
    discount_type :              { type: Sequelize.INTEGER(2) },
    discount_amount :          { type: Sequelize.DECIMAL(10, 2) },
    thksmsg:             { type: Sequelize.TEXT },
    thksmsg_set :              { type: Sequelize.INTEGER(4) },
    event_describe:             { type: Sequelize.TEXT },
    event_describe_set :              { type: Sequelize.INTEGER(4) },
    terms_conditions_set :              { type: Sequelize.INTEGER(4) },
    terms_conditions_msg:             { type: Sequelize.TEXT },
    category :              { type: Sequelize.INTEGER(1) },
    max_group_size :              { type: Sequelize.INTEGER(5) },
    ordering :              { type: Sequelize.INTEGER(7) },
    waiting_list :              { type: Sequelize.INTEGER(1) },
    public :              { type: Sequelize.INTEGER(1) },
    export :              { type: Sequelize.INTEGER(2) },
    use_discountcode :              { type: Sequelize.INTEGER(3) },
    article_id :              { type: Sequelize.INTEGER(11) },
    detail_link_show :              { type: Sequelize.INTEGER(2) },
    show_registrant :              { type: Sequelize.INTEGER(4) },
    publish :              { type: Sequelize.INTEGER(4) },
    startdate:             { type: Sequelize.DATE },
    bird_discount_type :              { type: Sequelize.INTEGER(2) },
    bird_discount_amount:              { type: Sequelize.STRING(12) },
    bird_discount_date:             { type: Sequelize.DATE },
    payment_option :              { type: Sequelize.INTEGER(2) },
    location_id :              { type: Sequelize.INTEGER(11) },
    archive :              { type: Sequelize.INTEGER(2) },
    partial_payment :              { type: Sequelize.INTEGER(2) },
    partial_amount:              { type: Sequelize.STRING(20) },
    partial_minimum_amount:              { type: Sequelize.STRING(20) },
    edit_fee :              { type: Sequelize.INTEGER(2) },
    cancelfee_enable :              { type: Sequelize.INTEGER(2) },
    cancel_date:              { type: Sequelize.STRING(30) },
    cancel_refund_status :              { type: Sequelize.INTEGER(1) },
    excludeoverlap :              { type: Sequelize.INTEGER(2) },
    pay_later_thk_msg_set :              { type: Sequelize.INTEGER(2) },
    pay_later_thk_msg:             { type: Sequelize.TEXT },
    thanksmsg_set :              { type: Sequelize.INTEGER(2) },
    thanksmsg:             { type: Sequelize.TEXT },
    change_date:              { type: Sequelize.STRING(20) },
    detail_itemid :              { type: Sequelize.INTEGER(4) },
    tax_enable :              { type: Sequelize.INTEGER(2) },
    tax_amount :          { type: Sequelize.DECIMAL(8, 2) },
    payment_id :              { type: Sequelize.INTEGER(4) },
    repetition_id :              { type: Sequelize.INTEGER(7) },
    parent_id :              { type: Sequelize.INTEGER(7) },
    usercreation :              { type: Sequelize.INTEGER(3) },
    imagepath:              { type: Sequelize.STRING(255) },
    timeformat :              { type: Sequelize.INTEGER(2) },
    latefeetime :             { type: Sequelize.TEXT },
    bird_discount_time :             { type: Sequelize.TEXT },
    starttime :             { type: Sequelize.TEXT },
    cut_off_time :             { type: Sequelize.TEXT },
    change_time :             { type: Sequelize.TEXT },
    cancel_time :             { type: Sequelize.TEXT },
    user_id :              { type: Sequelize.INTEGER(7) },
    changefee_enable :              { type: Sequelize.INTEGER(2) },
    changefee_type :              { type: Sequelize.INTEGER(2) },
    changefee :          { type: Sequelize.DECIMAL(8, 2) },
    cancelfee_type :              { type: Sequelize.INTEGER(2) },
    cancelfee :          { type: Sequelize.DECIMAL(8, 2) },
    usetimecheck :              { type: Sequelize.INTEGER(1) },
    group_registration_type:              { type: Sequelize.STRING(20) },
    cancel_enable :              { type: Sequelize.INTEGER(1) },
    min_group_size :              { type: Sequelize.INTEGER(4) },
    admin_notification_set :              { type: Sequelize.INTEGER(2) },
    admin_notification:             { type: Sequelize.TEXT },
    partial_payment_enable :              { type: Sequelize.INTEGER(1) },
    prevent_duplication :              { type: Sequelize.INTEGER(1) },
    event_admin_email_set :              { type: Sequelize.INTEGER(4) },
    event_admin_email_from_name:              { type: Sequelize.STRING(100) },
    event_admin_email_from_email:              { type: Sequelize.STRING(100) },
    thanks_redirection :              { type: Sequelize.INTEGER(2) },
    thanks_redirect_url:              { type: Sequelize.STRING(255) },
    pay_later_redirection :              { type: Sequelize.INTEGER(2) },
    pay_later_redirect_url:              { type: Sequelize.STRING(255) },
    timezone:              { type: Sequelize.STRING(255) },
    registering:             { type: Sequelize.TEXT },
    uid:              { type: Sequelize.STRING(100)},
    usergroup:             { type: Sequelize.TEXT },
    discount_code_usagetype :              { type: Sequelize.INTEGER(2) },
    confirm_number_prefix:              { type: Sequelize.STRING(20) },
    badge_prefix:              { type: Sequelize.STRING(20) },
    reg_type:              { type: Sequelize.STRING(100) },
    member :              { type: Sequelize.INTEGER(1) },
    tax_exemption_allow :              { type: Sequelize.INTEGER(2) },
    tax_code_field_type:              { type: Sequelize.STRING(20) },
    tax_code_values:              { type: Sequelize.STRING(100) }
  });

  models.CheckinMemberFieldValues = db.checkin.define('member_field_values', {
    id:                   { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    local_id:             { type: Sequelize.INTEGER },
    event_id:             { type: Sequelize.STRING(36) },
    field_id:             { type: Sequelize.INTEGER },
    member_id:            { type: Sequelize.INTEGER },
    value:                { type: Sequelize.TEXT }
  });

  models.CheckinGroupMembers = db.checkin.define('group_members', {
    id:                   { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    groupMemberId :       { type: Sequelize.INTEGER },
    event_id :            { type: Sequelize.STRING(36) },
    groupUserId :         { type: Sequelize.INTEGER },
    created :             { type: Sequelize.DATE },
    confirmnum :          { type: Sequelize.STRING(100) },
    attend:               { type: Sequelize.BOOLEAN },
    discount_code_id :    { type: Sequelize.INTEGER },
    checked_in_time :     { type: Sequelize.DATE }
  });

  models.CheckinEventFields = db.checkin.define('event_fields', {
    id:             { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    local_id :       { type: Sequelize.INTEGER },
    event_id :       { type: Sequelize.STRING(36) },
    field_id :       { type: Sequelize.INTEGER },
    local_event_id :       { type: Sequelize.INTEGER },
    badge_order :       { type: Sequelize.INTEGER },
    class :       { type: Sequelize.TEXT },
    name :       { type: Sequelize.STRING(50) },
    label :       { type: Sequelize.STRING(255) },
    field_size:       { type: Sequelize.INTEGER },
    description :       { type: Sequelize.STRING(255) },
    ordering :       { type: Sequelize.INTEGER },
    published :       { type: Sequelize.INTEGER },
    required:       { type: Sequelize.INTEGER },
    values :       { type: Sequelize.TEXT },
    type :       { type: Sequelize.INTEGER },
    selected :       { type: Sequelize.STRING(255) },
    rows:       { type: Sequelize.INTEGER },
    cols:       { type: Sequelize.INTEGER },
    fee_field:       { type: Sequelize.INTEGER },
    fees :       { type: Sequelize.TEXT },
    new_line:       { type: Sequelize.INTEGER },
    textual :       { type: Sequelize.TEXT },
    export_individual :       { type: Sequelize.BOOLEAN },
    export_group :       { type: Sequelize.BOOLEAN },
    attendee_list :       { type: Sequelize.BOOLEAN },
    usagelimit :       { type: Sequelize.TEXT },
    fee_type :       { type: Sequelize.BOOLEAN },
    filetypes :       { type: Sequelize.TEXT },
    upload :       { type: Sequelize.BOOLEAN },
    filesize :       { type: Sequelize.INTEGER },
    hidden :       { type: Sequelize.BOOLEAN },
    allevent :       { type: Sequelize.BOOLEAN },
    maxlength :       { type: Sequelize.INTEGER },
    date_format :       { type: Sequelize.STRING(25) },
    parent_id :       { type: Sequelize.INTEGER },
    selection_values :       { type: Sequelize.TEXT },
    textareafee :       { type: Sequelize.TEXT },
    showcharcnt :       { type: Sequelize.BOOLEAN },
    default :       { type: Sequelize.BOOLEAN },
    confirmation_field :       { type: Sequelize.BOOLEAN },
    listing :       { type: Sequelize.TEXT },
    textualdisplay :       { type: Sequelize.BOOLEAN },
    applychangefee :       { type: Sequelize.BOOLEAN },
    tag :       { type: Sequelize.STRING(255) },
    all_tag_enable :       { type: Sequelize.BOOLEAN },
    minimum_group_size :       { type: Sequelize.INTEGER },
    max_group_size :       { type: Sequelize.INTEGER },
    discountcode_depend :       { type: Sequelize.BOOLEAN },
    discount_codes :       { type: Sequelize.TEXT },
    showed :       { type: Sequelize.INTEGER },
    group_behave :       { type: Sequelize.INTEGER }
  });

  models.CheckinBiller = db.checkin.define('biller', {
    id:                   { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    userId :              { type: Sequelize.INTEGER },
    eventId :             { type: Sequelize.STRING(36) },
    local_eventId :       { type: Sequelize.INTEGER },
    type :                { type: Sequelize.ENUM('I', 'G') },
    register_date :       { type: Sequelize.DATE },
    payment_type :        { type: Sequelize.STRING(100) },
    due_amount :          { type: Sequelize.DECIMAL(10, 2) },
    pay_later_option:     { type: Sequelize.INTEGER },
    confirmNum :          { type: Sequelize.STRING(50) },
    user_id :             { type: Sequelize.INTEGER },
    payment_verified :    { type: Sequelize.INTEGER },
    pay_later_paid:       { type: Sequelize.INTEGER },
    discount_code_id :    { type: Sequelize.INTEGER },
    billing_firstname :   { type: Sequelize.STRING(150) },
    billing_lastname :    { type: Sequelize.STRING(150) },
    billing_address :     { type: Sequelize.STRING(255) },
    billing_city :        { type: Sequelize.STRING(150) },
    billing_state :       { type: Sequelize.STRING(150) },
    billing_zipcode :     { type: Sequelize.STRING(10) },
    billing_email :       { type: Sequelize.STRING(150) },
    due_payment :         { type: Sequelize.DECIMAL(10, 2) },
    status :              { type: Sequelize.INTEGER },
    attend :              { type: Sequelize.BOOLEAN },
    paid_amount :         { type: Sequelize.STRING(30) },
    transaction_id :      { type: Sequelize.STRING(255) },
    memtot :              { type: Sequelize.INTEGER },
    cancel :              { type: Sequelize.INTEGER }
  });

  models.CheckinEventFees = db.checkin.define('event_fees', {
    id:                   { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    local_id :            { type: Sequelize.INTEGER },
    event_id :            { type: Sequelize.STRING(36) },
    user_id :             { type: Sequelize.INTEGER },
    basefee :             { type: Sequelize.STRING(20) },
    memberdiscount :      { type: Sequelize.STRING(12) },
    latefee :             { type: Sequelize.STRING(12) },
    birddiscount :        { type: Sequelize.STRING(12) },
    discountcodefee :     { type: Sequelize.STRING(12) },
    customfee :           { type: Sequelize.STRING(12) },
    tax :                 { type: Sequelize.STRING(12) },
    fee :                 { type: Sequelize.STRING(12) },
    paid_amount :         { type: Sequelize.STRING(12) },
    status :              { type: Sequelize.STRING(12), defaultValue: '0' },
    due:                  { type: Sequelize.STRING(20), defaultValue: '0' },
    payment_method:       { type: Sequelize.STRING(20), defaultValue: '0' },
    feedate :             { type: Sequelize.DATE },
    changefee :           { type: Sequelize.STRING(12), defaultValue: '0' },
    cancelfee :           { type: Sequelize.STRING(12), defaultValue: '0' }
  });

  models.CheckinBillerFieldValues = db.checkin.define('biller_field_values', {
    id:                   { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    local_id :            { type: Sequelize.INTEGER },
    event_id :            { type: Sequelize.STRING(36) },
    field_id :            { type: Sequelize.INTEGER },
    user_id :             { type: Sequelize.INTEGER },
    value :               { type: Sequelize.TEXT }
  });

  models.ElectionOffices = db.checkin.define('electionOffices', {
    id :                    { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    conferenceid :          { type: Sequelize.INTEGER },
    position :              { type: Sequelize.INTEGER },
    title :                 { type: Sequelize.STRING(255) },
    description :           { type: Sequelize.STRING(255) }
  });

  models.ElectionOfficeCandidates = db.checkin.define('electionOfficeCandidates', {
    id :                    { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    electionid :            { type: Sequelize.INTEGER },
    position :              { type: Sequelize.INTEGER },
    name :                  { type: Sequelize.STRING(255) },
    company :               { type: Sequelize.STRING(255) }
  });

  models.ElectionOffices.hasMany(models.ElectionOfficeCandidates, {as: 'Candidates', foreignKey: 'electionid'});

  models.Votes = db.checkin.define('votes', {
    id :                    { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    uuid :                  { type: Sequelize.UUIDV4 },
    siteid :                { type: Sequelize.STRING(255) },
    electionid :            { type: Sequelize.INTEGER },
    registrantid :          { type: Sequelize.STRING(25) },
    candidateid :           { type: Sequelize.INTEGER },
    votertype:              { type: Sequelize.ENUM('management', 'non-management') },
    datecast :              { type: Sequelize.DATE }
  });

  models.Printers = db.checkin.define('printers', {
    id :                    { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    conferenceid :          { type: Sequelize.INTEGER(11) },
    name :                  { type: Sequelize.TEXT },
    type :                  { type: Sequelize.ENUM('receipt', 'ebadge', 'gbadge', 'other'), default: 'receipt'  },
    host :                  { type: Sequelize.TEXT },
    uri :                   { type: Sequelize.TEXT }
  });

  models.CheckinExhibitorAttendeeNumber = db.checkin.define('exhibitorAttendeeNumber', {
    id:                   { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    userId :              { type: Sequelize.INTEGER },
    eventId :             { type: Sequelize.STRING(255) },
    attendees :           { type: Sequelize.INTEGER }
  });

  models.CheckinExhibitorAttendees = db.checkin.define('exhibitorAttendees', {
    id:                   { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    userId :              { type: Sequelize.INTEGER },
    eventId :             { type: Sequelize.STRING(36) },
    pin:                  { type: Sequelize.STRING(4) },
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
    createdAt :           { type: Sequelize.DATE },
    updatedAt :           { type: Sequelize.DATE },
    deletedAt :           { type: Sequelize.DATE },
    siteId :              { type: Sequelize.STRING(10) }
  });

  models.Sites = db.checkin.define('siteIds', {
    id:                   { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    chapter:              { type: Sequelize.INTEGER(6) },
    memberType:           { type: Sequelize.STRING(255) },
    company:              { type: Sequelize.STRING(255) },
    street1:              { type: Sequelize.STRING(255) },
    street2:              { type: Sequelize.STRING(255) },
    city:                 { type: Sequelize.STRING(255) },
    state:                { type: Sequelize.STRING(255) },
    zipCode:              { type: Sequelize.STRING(255) },
    joinDate:             { type: Sequelize.DATE },
    paidDate:             { type: Sequelize.DATE },
    siteId:               { type: Sequelize.STRING(255) }
  });
  
  models.Badges = db.checkin.define('event_badges', {
    id :                    { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    eventId :               { type: Sequelize.STRING(36) },
    template :              { type: Sequelize.TEXT }
  });
  
  models.Sites = db.checkin.define('siteIds', {
    id:                   { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    company:              { type: Sequelize.STRING(255) },
    street1:              { type: Sequelize.STRING(255) },
    street2:              { type: Sequelize.STRING(255) },
    city:                 { type: Sequelize.STRING(255) },
    state:                { type: Sequelize.STRING(255) },
    zipCode:              { type: Sequelize.STRING(255) },
    siteId:               { type: Sequelize.STRING(255) }
  });
  
    models.VotingSites = db.checkin.define('votingSiteIds', {
    id:                   { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    company:              { type: Sequelize.STRING(255) },
    street1:              { type: Sequelize.STRING(255) },
    street2:              { type: Sequelize.STRING(255) },
    city:                 { type: Sequelize.STRING(255) },
    state:                { type: Sequelize.STRING(255) },
    zipCode:              { type: Sequelize.STRING(255) },
    siteId:               { type: Sequelize.STRING(255) }
  });

  models.eventLogs = db.checkin.define('eventLogs', {
    id:                   { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    eventId:              { type: Sequelize.INTEGER },
    createdAt :           { type: Sequelize.DATE },
    updatedAt :           { type: Sequelize.DATE },
    deletedAt :           { type: Sequelize.DATE }
  });
  
  getPrinter(() => {
    console.log("got printers");
  });
  //Initialize Email Client
  transport = email.createTransport(
    {
      sendmail: true,
      args: ["-f noreply@regionvivpp.org"]
    }
  );
};

const processGroupMembers = (extra, members, registrants, index, cb) => {
    let sql = "";
    let member = members[index];
    let ignoreNames = ["firstname", "lastname"];
    index = index || 0;
    let consts = [ 
      member.event_id,
      parseInt(member.groupUserId),
      member.event_id,
      member.event_id,
      parseInt(member.groupMemberId),
      member.event_id,
      member.event_id,
      parseInt(member.groupUserId),
      member.event_id,
      member.event_id,
      member.event_id,
      member.event_id,
      member.event_id,
      member.event_id,
      member.event_id,
      parseInt(member.groupUserId),
      member.event_id,
      member.event_id,
      member.event_id,
      parseInt(member.groupUserId),
      member.event_id,
      parseInt(member.groupUserId),
      member.event_id,
      member.event_id
    ];
    sql = " (SELECT 'b'as typeRow, biller_field_values.user_id as userId, biller_field_values.value, event_fields.*"+
          " FROM biller_field_values"+
          " JOIN event_fields ON (biller_field_values.field_id = event_fields.local_id AND event_fields.event_id = ?)"+
          " WHERE user_id = ? AND biller_field_values.event_id = ?)"+
          " UNION"+
          " (SELECT 'g'as typeRow, member_field_values.member_id as userId, member_field_values.value, event_fields.*"+
          " FROM member_field_values"+
          " JOIN event_fields ON (member_field_values.field_id = event_fields.local_id AND event_fields.event_id = ?)"+
          " WHERE member_id = ? AND member_field_values.event_id = ?) ORDER BY ordering ASC;"+
          " SELECT biller_field_values.user_id as userId, biller_field_values.value, event_fields.*"+
          " FROM biller_field_values"+
          " JOIN event_fields ON (biller_field_values.field_id = event_fields.local_id AND event_fields.event_id = ?)"+
          " WHERE user_id = ? AND biller_field_values.event_id = ? ORDER BY ordering ASC;"+
          " SELECT id, groupUserId, attend, checked_in_time, confirmnum, "+
          " (SELECT value "+
          " FROM member_field_values "+
          " LEFT JOIN event_fields ON (member_field_values.field_id = event_fields.local_id AND event_fields.event_id = ?)"+
          " WHERE event_fields.event_id = ? AND event_fields.class = 'firstname' AND member_field_values.member_id = group_members.groupMemberId LIMIT 1) as firstname,"+
          " (SELECT value "+
          " FROM member_field_values "+
          " LEFT JOIN event_fields ON (member_field_values.field_id = event_fields.local_id AND event_fields.event_id = ?)"+
          " WHERE event_fields.event_id = ? AND event_fields.class = 'lastname' AND member_field_values.member_id = group_members.groupMemberId LIMIT 1) as lastname,"+
          " (SELECT value "+
          " FROM member_field_values "+
          " LEFT JOIN event_fields ON (member_field_values.field_id = event_fields.local_id AND event_fields.event_id = ?)"+
          " WHERE event_fields.event_id = ? AND event_fields.class = 'company' AND member_field_values.member_id = group_members.groupMemberId LIMIT 1) as company"+
          " FROM group_members"+
          " WHERE groupUserId = ? AND event_id = ?;"+
          " SELECT * FROM event_fields WHERE event_id = ? AND badge_order > 0 ORDER BY badge_order ASC;"+
          " SELECT event_fees.*, biller.transaction_id FROM event_fees LEFT JOIN biller ON event_fees.user_id = biller.user_id WHERE event_fees.event_id = ? AND event_fees.user_id = ? ORDER BY event_fees.id ASC;"+
          " SELECT * FROM biller WHERE eventId = ? AND userId = ? ORDER BY id ASC;"+
          " SELECT * FROM event WHERE eventId = ?;"+
          " SELECT * FROM event_fields WHERE event_id = ? ORDER BY ordering ASC;";
    if (extra) {
      sql += " SELECT * FROM transactions WHERE invoiceNumber = ? ORDER BY submitTimeUTC ASC;";
      consts.push(member.billerConfirm);
    }
    //console.log(sql);
    connection.query(sql, consts, (err, results) => {
        if (err) { throw err; }
        if (results[0]) {
          const ba = [];
          const exhibitorFields = ["firstname", "lastname", "email", "phone", "title"];
          const reg = {
              event: results[6][0],
              fields: {
                  userId: results[0][0].userId,
                  infoField: '',
                  manageField: '<div class="btn-group"><button class="btn dropdown-toggle" data-toggle="dropdown">Manage <span class="caret"></span></button><ul class="dropdown-menu"><li>'
              },
              biller: {
                  schema:{},
                  fieldset:[]
              },
              badgeFields:[],
              linked: results[2],
              payment: results[4],
              local_id: member.groupMemberId,
              id: member.id,
              event_id: member.event_id,
              registrantId: member.badge_prefix+"-"+member.id,
              confirmation: member.confirmnum || results[5][0].confirmNum,
              paid: false,
              checked_in: member.attend,
              checked_in_time: member.checked_in_time,
              schema:{},
              fieldset:[],
              firstname: "",
              lastname: "",
              company: "",
              badge_prefix: member.badge_prefix,
              biller_id: results[5][0].userId
          };
          const types = ['Text','Select','TextArea','Checkbox','Select','Text','Text','Text','Text'];
          if (member.attend) {
            reg.fields.infoField += '<i class="icon-ok icon-large" style="color: #468847;"></i>';
            reg.fields.manageField += '<a href="#" class="checkoutRegistrant">Check Out</a>';
          } else {
            reg.fields.infoField += '<i class="icon-remove icon-large" style="color: #b94a48;"></i>';
            reg.fields.manageField += '<a href="#" class="checkinRegistrant">Check In</a>';
          }
          reg.fields.manageField += '</li><li class="divider"></li><li><a href="#" class="editRegistrant">Edit</a></li><li><a href="#" class="printBadge">Print Badge</a></li><li><a href="#" class="downloadBadge">Download Badge</a></li><li class="divider"></li><li><a href="#" class="printReceipt">Print Receipt</a></li><li><a href="#" class="viewReceipt">View Receipt</a></li></ul></div>';
          results[7].forEach((row, index) => {
            let schemaRow = {
              "title": row.label,
              "type": types[row.type]
            };
            if (row.values && (row.type === 4 || row.type === 1)) {
              let values = row.values.split("|");
              values.unshift("");
              schemaRow.options = values;
            }
            reg.schema["fields."+row.name] = schemaRow;
            reg.fieldset.push("fields."+row.name);
          });
          results[0].forEach((row, index) => {
            if (row.values && (row.type === 4 || row.type === 1)) {
              let values = row.values.split("|");
              reg.fields[row.name] = values[parseInt(row.value)];
            } else  {
              reg.fields[row.name] = row.value;
            }

            if (row.class) {
              if (underscore.contains(ba, row.class) === false) {
                reg[row.class] = reg.fields[row.name];
              }
            }
          });
          results[1].forEach((row, index) => {
            let schemaRow = {
              "title": row.label,
              "type": types[row.type],
            };
            if (row.values && (row.type === 4 || row.type === 1)) {
              let values = row.values.split("|");
              schemaRow.options = values;
              reg.biller[row.name] = values[parseInt(row.value)];
            } else  {
              reg.biller[row.name] = row.value;
            }
            reg.biller.schema[row.name] = schemaRow;
            reg.biller.fieldset.push(row.name);
          });
          results[3].forEach((row, index) => {
            reg.badgeFields.push(row.class);
          });
          results[4].forEach((row, index) => {
            row.fee = parseFloat(row.fee);
            row.paid_amount = parseFloat(row.paid_amount);
            reg.paid = (row.fee > row.paid_amount) ? false : true;
          });

          reg.linked.forEach((row, index) => {
            row.badge_prefix = member.badge_prefix;
            row.company = reg.company;
            row.confirmation = row.confirmnum || results[5][0].confirmNum;
          });
          if (reg.paid) {
            reg.fields.infoField += '&nbsp; <i class="icon-money icon-large" style="color: #468847;"></i>';
          } else {
            reg.fields.infoField += '&nbsp; <i class="icon-money icon-large" style="color: #b94a48;"></i>';
          }
          reg.payment = results[4];
          if (extra) {
            console.log("credit card");
            console.log(results[8]);
            reg.transactions = results[8];
          }
          //console.log(reg);
          registrants[1].push(reg);
        }
        index++;
        //console.log(index);
        if (members.length >= (index + 1)) {
          processGroupMembers(extra, members, registrants, index, cb);
        } else {
          cb(registrants);
        }
    });

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
  const badge = await models.Badges.find({
    where: {
      eventId: registrant.eventId,
    }
  });
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
  let page = req.body.page;
  let limit = req.body.limit;

  const results = await registrants.searchAttendees2(
    filters,
    page,
    limit
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

  sendMessage(
    'updateRegistrantValues', 
    {
      type,
      registrantId,
      id,
      values
    }
  );

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

  sendBack(res, registrant, 200);
};

exports.addRegistrant = async (req, res) =>  {
  let values = req.body;
  sendMessage('addRegistrant', { values });
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
	  getRequest.setTransId(trans.transId);
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

const updateTransaction = async (transaction) => {
  let results;
  const record = {
    transId: transaction.transId,
    submitTimeUTC: moment.tz(transaction.submitTimeUTC, 'UTC').format('YYYY-MM-DD HH:mm:ss'),
    submitTimeLocal: moment(transaction.submitTimeLocal).format('YYYY-MM-DD HH:mm:ss'),
    transactionType: transaction.transactionType,
    transactionStatus: transaction.transactionStatus,
    responseCode: transaction.responseCode,
    responseReasonCode: transaction.responseReasonCode,
    responseReasonDescription: transaction.responseReasonDescription,
    authCode: transaction.authCode,
    AVSResponse: transaction.AVSResponse,
    cardCodeResponse: transaction.cardCodeResponse,
    batchId: transaction.batch.batchId,
    settlementTimeUTC: moment.tz(transaction.batch.settlementTimeUTC, 'UTC').format('YYYY-MM-DD HH:mm:ss'),
    settlementTimeLocal: moment(transaction.batch.settlementTimeLocal).format('YYYY-MM-DD HH:mm:ss'),
    invoiceNumber: transaction.order.invoiceNumber,
    customerId: ('id' in transaction.customer) ? transaction.customer.id : null,
    authAmount: transaction.authAmount,
    settleAmount: transaction.settleAmount,
    cardNumber: (transaction.payment && transaction.payment.creditCard) ? transaction.payment.creditCard.cardNumber : null,
    cardType: (transaction.payment && transaction.payment.creditCard) ? transaction.payment.creditCard.cardType : null,
    email: transaction.customer.email,
  };

  const existTransaction = await dbKnex('transactions')
    .where({
      transId: record.transId,
    })
    .catch(e => console.log('db', 'database error', e));
  if (existTransaction.length) {
    results = await dbKnex('transactions')
      .where({ id: existTransaction[0].id })
      .update(record)
      .then(
        data => dbKnex('transactions').where({ id: existTransaction[0].id }),
      )
      .catch(e => console.log('db', 'database error', e));
  } else {
    results = await dbKnex('transactions')
      .insert(record)
      .then(
        data => dbKnex('transactions').where({ id: data[0] }),
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
    const results = await registrants.saveCheckTransaction(values);
  } else if (values.type !== "check") {
    var paymentType = new ApiContracts.PaymentType();
    if (values.transaction.track && values.transaction.track.length) {
      const trackData = new ApiContracts.CreditCardTrackType();
      trackData.setTrack1(values.transaction.track[0]);
      trackData.setTrack2(values.transaction.track[1]);
      paymentType.setTrackData(trackData);
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

    const createRequest = new ApiContracts.CreateTransactionRequest();
    createRequest.setMerchantAuthentication(merchantAuthenticationType);
    createRequest.setTransactionRequest(transactionRequestType);
    try {
      const transaction = await authorizeTransaction(createRequest);
      const details = await getTransaction(transaction);
      if (details) {
        const results = await updateTransaction(details);
        data = results;
      }
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

exports.getNumberCheckedIn = async (req, res) =>  {
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

exports.getSiteIds = async (req, res) =>  {
  const siteids = await knexDb.from('siteIds')
    .orderBy('company', 'ASC')
    .catch(e => console.log('db', 'database error', e));
  sendBack(res, siteids, 200);
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

  if (vote === null) {
    const member = await registrants.getAttendee(normalizedId);
    if ("id" in member) {
      //console.log("member", member);
      member.siteId = ("siteid" in member) ? member.siteid : member.siteId;
      if (member.siteId !== "") {
        const site = await getVotingSiteInfo(member.siteId);
        member.voterType = null;
        member.votes = [];
        site = (site) ? site.toJSON() : {};
        member.site = site;
        member.registrantId = normalizedId;
        sendBack(res, member, 200);
      } else {
        member.voterType = null;
        member.votes = [];
        member.registrantId = normalizedId;
        member.site = {};
        sendBack(res, member, 200);
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
  const siteId = req.params.siteId;
  const site = await getVotingSiteInfo(siteId);
  if (site) {
    site = site.toJSON();
    const voters = await getSiteVoters(site.siteId);
    site.voters = voters;
  }
  sendBack(res, site, 200);
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
    const result = await this.knex('votes')
      .insert(vote)
      .then(
        data => self.knex('votes').where({ id: data[0] }),
      )
      .catch(e => error('db', 'database error', e));
    
    return result;
  };

  const vote = await knexDb.from('votes')
    .where({ registrantid: user.registrantId })
    .catch(e => console.log('db', 'database error', e));

  if (vote.length) {
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
  opts.io.emit("talk", logData);
};

const pad = (num, size) => {
  const s = num + "";
  while (s.length < size) { s = "0" + s; }
  return s;
};
