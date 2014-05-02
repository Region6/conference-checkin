(function(){
  "use strict";

var fs = require('fs'),
    path = require('path'),
    mysql = require('mysql'),
    email = require('nodemailer'),
    crypto = require('crypto'),
    spawn = require('child_process').spawn,
    execFile = require('child_process').execFile,
    async = require('async'),
    Acl = require('acl'),
    uuid = require("node-uuid"),
    glob = require('glob'),
    underscore = require('underscore'),
    pdf417 = require('pdf417'),
    ipp = require('ipp'),
    handlebars = require('handlebars'),
    authnet = require('authnet'),
    request = require('request'),
    parser = require('xml2json'),
    NodePDF = require('nodepdf'),
    Swag = require('../vendors/swag'),
    Sequelize = require("sequelize"),
    svgHeader = fs.readFileSync("./header.svg", "utf8"),
    receipt = fs.readFileSync("./assets/templates/receipt.html", "utf8"),
    hummus          = require('hummus'),
    Rsvg            = require('rsvg').Rsvg,
    Registrants = require("node-registrants"),
    registrants,
    opts = {},
    printerUrl = {
      "receipt": [],
      "badge": []
    },
    connection = null,
    client = null,
    transport = null,
    acl = null,
    db = {},
    reconnectTries = 0,
    models = {} ;

/**
 * usages (handlebars)
 * {{short_string this}}
 * {{short_string this length=150}}
 * {{short_string this length=150 trailing="---"}}
**/
handlebars.registerHelper('short_string', function(context, options){
    //console.log(options);
    var maxLength = options.hash.length || 100;
    var trailingString = options.hash.trailing || '';
    if (typeof context != "undefined") {
        if(context.length > maxLength){
            return context.substring(0, maxLength) + trailingString;
        }
    }
    return context;
});

exports.setKey = function(key, value) {
    opts[key] = value;
};

exports.initialize = function() {
    //Initialize Mysql
    //getConnection();

    db.checkin = new Sequelize(
      opts.configs.get("mysql:database"),
      opts.configs.get("mysql:username"),
      opts.configs.get("mysql:password"),
      {
          dialect: 'mysql',
          omitNull: true,
          host: opts.configs.get("mysql:host") || "localhost",
          port: opts.configs.get("mysql:port") || 3306,
          pool: { maxConnections: 5, maxIdleTime: 30},
          define: {
            freezeTableName: true,
            timestamps: false
          }
    });

    registrants = Registrants.init({
      "host": opts.configs.get("mysql:host") || "localhost",
      "username": opts.configs.get("mysql:username"),
      "password": opts.configs.get("mysql:password"),
      "database": opts.configs.get("mysql:database"),
      "port": opts.configs.get("mysql:port") || 3306
    });

    models.Events = db.checkin.define('event', {
      slabId:                   { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      local_slabId :              { type: Sequelize.INTEGER },
      eventId:              { type: Sequelize.STRING(36) },
      local_eventId :              { type: Sequelize.INTEGER },
      title:              { type: Sequelize.STRING(255) },
      dtstart:             { type: Sequelize.DATE },
      dtend:             { type: Sequelize.DATE },
      dtstarttime :             { type: Sequelize.TEXT },
      dtendtime :             { type: Sequelize.TEXT },
      latefee :          { type: Sequelize.DECIMAL(10,2) },
      latefeedate:             { type: Sequelize.DATE },
      email:             { type: Sequelize.TEXT },
      max_registrations :              { type: Sequelize.INTEGER },
      registration_type:              { type: Sequelize.STRING(50) },
      topmsg:             { type: Sequelize.TEXT },
      cut_off_date:             { type: Sequelize.DATE },
      discount_type :              { type: Sequelize.INTEGER(2) },
      discount_amount :          { type: Sequelize.DECIMAL(10,2) },
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
      tax_amount :          { type: Sequelize.DECIMAL(8,2) },
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
      changefee :          { type: Sequelize.DECIMAL(8,2) },
      cancelfee_type :              { type: Sequelize.INTEGER(2) },
      cancelfee :          { type: Sequelize.DECIMAL(8,2) },
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
      type :                { type: Sequelize.ENUM('I','G') },
      register_date :       { type: Sequelize.DATE },
      payment_type :        { type: Sequelize.STRING(100) },
      due_amount :          { type: Sequelize.DECIMAL(10,2) },
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
      due_payment :         { type: Sequelize.DECIMAL(10,2) },
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
      votertype:              { type: Sequelize.ENUM('management','non-management') },
      datecast :              { type: Sequelize.DATE }
    });

    models.Printers = db.checkin.define('printers', {
      id :                    { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      conferenceid :          { type: Sequelize.INTEGER(11) },
      name :                  { type: Sequelize.TEXT },
      type :                  { type: Sequelize.ENUM('receipt','badge','other'), default: 'receipt'  },
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

    models.Badges = db.checkin.define('event_badge', {
      id :                    { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      eventId :               { type: Sequelize.STRING(36) },
      template :              { type: Sequelize.TEXT }
    });

    getPrinter(function() {
        console.log("got printers");
    });
    //Initialize Email Client
    transport = email.createTransport("sendmail", {
        args: ["-f noreply@regionvivpp.org"]
    });
};

var getPrinter = function(callback) {
    var addPrinter = function(item, cb) {
          printerUrl[item.type].push({url:"http://"+item.host+item.uri});
        };
    models.Printers.findAll(
      {
        order: 'type ASC'
      }
    )
    .success(function(printers) {
      async.each(printers, addPrinter, function(err){
        callback();
      });
    });
};

var processGroupMembers = function(extra, members, registrants, index, cb) {
    var sql = "",
        member = members[index],
        ignoreNames = ["firstname", "lastname"];
    index = index || 0;
    var vars = [ member.event_id,
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
        vars.push(member.billerConfirm);
    }
    //console.log(sql);
    connection.query(sql, vars, function(err, results) {
        if (err) throw err;
        if (results[0]) {
            var ba = [],
                exhibitorFields = ["firstname", "lastname", "email", "phone", "title"],
                reg = {
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
                },
                types = ['Text','Select','TextArea','Checkbox','Select','Text','Text','Text','Text'];
            if (member.attend) {
                reg.fields.infoField += '<i class="icon-ok icon-large" style="color: #468847;"></i>';
                reg.fields.manageField += '<a href="#" class="checkoutRegistrant">Check Out</a>';
            } else {
                reg.fields.infoField += '<i class="icon-remove icon-large" style="color: #b94a48;"></i>';
                reg.fields.manageField += '<a href="#" class="checkinRegistrant">Check In</a>';
            }
            reg.fields.manageField += '</li><li class="divider"></li><li><a href="#" class="editRegistrant">Edit</a></li><li><a href="#" class="printBadge">Print Badge</a></li><li><a href="#" class="downloadBadge">Download Badge</a></li><li class="divider"></li><li><a href="#" class="printReceipt">Print Receipt</a></li><li><a href="#" class="viewReceipt">View Receipt</a></li></ul></div>';
            results[7].forEach(function(row, index) {
                var schemaRow = {
                    "title": row.label,
                    "type": types[row.type]
                };
                if (row.values && (row.type == 4 || row.type == 1)) {
                    var values = row.values.split("|");
                    values.unshift("");
                    schemaRow.options = values;
                }
                reg.schema["fields."+row.name] = schemaRow;
                reg.fieldset.push("fields."+row.name);
            });
            results[0].forEach(function(row, index) {
                if (row.values && (row.type == 4 || row.type == 1)) {
                    var values = row.values.split("|");
                    reg.fields[row.name] = values[parseInt(row.value)];
                } else  {
                    //console.log(row.typeRow, row.name);
                    reg.fields[row.name] = row.value;
                }

                if (row.class) {
                    if (underscore.contains(ba, row.class) === false) {
                        reg[row.class] = reg.fields[row.name];
                    }
                }

                //console.log(row.class);
                /*
                if (underscore.contains(exhibitorFields, row.class.slice(3))) {
                    ba.push(row.class.slice(3));
                    reg[row.class.slice(3)] = reg.fields[row.name];
                }
                */
            });
            results[1].forEach(function(row, index) {
                var schemaRow = {
                    "title": row.label,
                    "type": types[row.type]
                };
                if (row.values && (row.type == 4 || row.type == 1)) {
                    var values = row.values.split("|");
                    schemaRow.options = values;
                    reg.biller[row.name] = values[parseInt(row.value)];
                } else  {
                    //console.log(row.typeRow, row.name);
                    reg.biller[row.name] = row.value;
                }
                reg.biller.schema[row.name] = schemaRow;
                reg.biller.fieldset.push(row.name);
            });
            results[3].forEach(function(row, index) {
                reg.badgeFields.push(row.class);
            });
            results[4].forEach(function(row, index) {
                row.fee = parseFloat(row.fee);
                row.paid_amount = parseFloat(row.paid_amount);
                reg.paid = (row.fee > row.paid_amount) ? false : true;
            });

            reg.linked.forEach(function(row, index) {
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
                reg.creditCardTrans = results[8];
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

var createBadge = function(registrant, callback) {
  //console.log("Creating Badge #",index);
  console.log(__dirname);
  var pageBuilder = null,
      code = registrant.id+"|"+registrant.confirmation,
      pdfData = "",
      exhibitorFields = ["firstname", "lastname", "email", "phone", "title"];

  async.waterfall([
      function(cb){
        models.Badges.find({
          where: {
            eventId: registrant.event_id
          }
        })
        .success(function(badge) {
          cb(null, badge.template.toString());
        });
      },
      function(template, cb){
       // console.log(template);
        pageBuilder = handlebars.compile(template);

        code = registrant.registrantId+"|"+registrant.confirmation;
        registrant.badgeFields.forEach(function(field, index) {
            code += "|" + registrant[field];
        });
        var barcode = pdf417.barcode(code, 5);
        var y = 0,
            bw = 1.25,
            bh = 0.75,
            svgbcode = "",
            rect = 32000;
        // for each row
        for (var r = 0; r < barcode.num_rows; r++) {
            var x = 0;
            // for each column
            for (var c = 0; c < barcode.num_cols; c++) {
                if (barcode.bcode[r][c] == 1) {
                    svgbcode += '<rect id="rect'+rect+'" height="'+bh+'" width="'+bw+'" y="'+y+'" x="'+x+'" />';
                    rect++;
                }
                x += bw;
            }
            y += bh;
        }
        var svgBarcode = '<g id="elements" style="fill:#000000;stroke:none" x="23.543152" y="295" transform="translate(60,300)">'+svgbcode;
        svgBarcode += '<text xml:space="preserve" style="font-size:12px;font-style:normal;font-variant:normal;font-weight:normal;font-stretch:normal;text-align:start;line-height:125%;writing-mode:lr-tb;text-anchor:start;font-family:Liberation Sans;-inkscape-font-specification:Liberation Sans" id="text29057" sodipodi:linespacing="125%" x="0" y="'+(y+10)+'">'+registrant.registrantId+'</text></g>';
        registrant.barcode = svgBarcode;

        var svg = pageBuilder(registrant);
        svg = '<?xml version="1.0" encoding="UTF-8" standalone="no"?>' + svgHeader + svg + "</svg>";
        var rsvg = new Rsvg();
        rsvg.on('finish', function() {
          var pdf = rsvg.render({
                format: 'pdf',
                height: 792,
                width: 612
              }).data;
          cb(null, pdf);
        });
        rsvg.write(svg);
        rsvg.end();

      }
  ], function (err, pdf) {
    callback(pdf);
  });
};

var saveTransaction = function(res, callback) {
    var sql = "INSERT INTO transactions SET ?",
        vars = underscore.clone(res.transaction);
    delete vars.batch;
    delete vars.payment;
    delete vars.order;
    delete vars.billTo;
    delete vars.shipTo;
    delete vars.recurringBilling;
    delete vars.customer;
    delete vars.customerIP;
    vars = underscore.extend(vars, res.transaction.batch);
    vars = underscore.extend(vars, res.transaction.order);
    vars = underscore.extend(vars, res.transaction.payment.creditCard);
    vars = underscore.extend(vars, res.transaction.customer);
    vars = underscore.extend(vars, {
        billToFirstName: res.transaction.billTo.firstName,
        billToLastName: res.transaction.billTo.lastName,
        billToAddress: res.transaction.billTo.address,
        billToCity: res.transaction.billTo.city,
        billToState: res.transaction.billTo.state,
        billToZip: res.transaction.billTo.zip,
        billToPhoneNumber: res.transaction.billTo.phoneNumber
    });
    if ("shipTo" in res.transaction) {
        vars = underscore.extend(vars, {
            shipToFirstName: res.transaction.shipTo.firstName,
            shipToLastName: res.transaction.shipTo.lastName,
            shipToAddress: res.transaction.shipTo.address,
            shipToCity: res.transaction.shipTo.city,
            shipToState: res.transaction.shipTo.state,
            shipToZip: res.transaction.shipTo.zip
        });
    }
    connection.query(sql, vars, function(err, result) {
        if (err) throw err;
        callback({dbResult:result, creditResult:res});
    });
};

/************
* Routes
*************/

exports.index = function(req, res){
    var sid = (typeof req.session != "undefined") ? req.session.id : null;
    //Regenerates the JS/template file
    //if (req.url.indexOf('/bundle') === 0) { bundle(); }

    //Don't process requests for API endpoints
    if (req.url.indexOf('/api') === 0 ) { return next(); }
    console.log("[index] session id:", sid);

    var init = "$(document).ready(function() { App.initialize(); });";
    //if (typeof req.session.user !== 'undefined') {
        init = "$(document).ready(function() { App.uid = '" + sid + "'; App.initialize(); });";
    //}
    fs.readFile(__dirname + '/../assets/templates/index.html', 'utf8', function(error, content) {
        if (error) { console.log(error); }
        content = content.replace("{{init}}", init);
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.write(content, 'utf-8');
        res.end('\n');
    });
};

//Return documents
exports.registrants = function(req, res) {
    var category = req.params.category,
        cat = [],
        search = req.params.search,
        page = req.query.page,
        limit = req.query.per_page,
        callback = function(registrants) {
            //if (err) console.log(err);
            res.setHeader('Cache-Control', 'max-age=0, must-revalidate, no-cache, no-store');
            res.writeHead(200, { 'Content-type': 'application/json' });
            res.write(JSON.stringify(registrants), 'utf-8');
            res.end('\n');
        };

    console.log("[registrants] session id:", req.session.id);
    /**
    if (typeof req.session.user_id === 'undefined') {
        res.writeHead(401, { 'Content-type': 'text/html' });
        res.end();
        return;
    }
    **/
    if (category == "name") {
        cat = ["lastname", "firstname"];
    } else if (category == "company") {
        cat = ["company"];
    } else if (category == "confirmation") {
        cat = ["confirmation"];
    } else if (category == "registrantid") {
        if (search.indexOf("-") !== -1) {
            search = search.split("-")[1];
        }
        cat = ["registrantid"];
    }

    registrants.searchAttendees(
     cat,
     search,
     page,
     limit,
     null,
     callback
    );


};

exports.genBadge = function(req, res) {

    var id = req.params.id,
        action = req.params.action,
        resource = res,
        downloadCallback = function(pdf) {
            //if (err) console.log(err);
            res.setHeader('Cache-Control', 'max-age=0, must-revalidate, no-cache, no-store');
            res.writeHead(200, {
                'Content-Disposition': 'inline; filename="badge.'+id+'.pdf"',
                'Content-type': 'application/pdf'
            });
            res.end(pdf, 'binary');
        },
        printCallback = function(pdf) {
            console.log(printerUrl);
            var printer = ipp.Printer(printerUrl.badge[0].url);
            var msg = {
                "operation-attributes-tag": {
                    "requesting-user-name": "Station",
                    "job-name": "Badge Print Job",
                    "document-format": "application/pdf"
                },
                data: pdf
            };
            printer.execute("Print-Job", msg, function(err, res){
                if (err) console.log(err);
                resource.setHeader('Cache-Control', 'max-age=0, must-revalidate, no-cache, no-store');
                resource.writeHead(200, { 'Content-type': 'application/json' });
                resource.write(JSON.stringify(res), 'utf-8');
                resource.end('\n');
                console.log(res);
            });
        },
        registrantCallback = function(registrants) {
          if (action == "print") {
            createBadge(registrants[1][0], printCallback);
          } else if (action == "download") {
            createBadge(registrants[1][0], downloadCallback);
          }
        };

    /**
    if (typeof req.session.user_id === 'undefined') {
        res.writeHead(401, { 'Content-type': 'text/html' });
        res.end();
        return;
    }
    **/
    console.log("[genBadge] session id:", req.session.id);
    console.log("Badge action:", action);
    registrants.searchAttendees(["registrantid"], id, 0, 20, false, registrantCallback);


};

exports.genReceipt = function(req, res) {

    var id = req.params.id,
        action = req.params.action,
        resource = res,
        receiptFileNameHtml = "",
        receiptFileNamePdf = "",
        downloadCallback = function(html) {
            //if (err) console.log(err);
            res.setHeader('Cache-Control', 'max-age=0, must-revalidate, no-cache, no-store');
            resource.writeHead(200, { 'Content-type': 'text/html' });
            resource.write(html, 'utf-8');
            resource.end('\n');
        },
        printCallback = function(pdf) {
            console.log(printerUrl.receipt[0]);
            console.log(pdf);
            var printer = ipp.Printer(printerUrl.receipt[0].url);
            var msg = {
                "operation-attributes-tag": {
                    "requesting-user-name": "Station",
                    "job-name": "Receipt Print Job",
                    "document-format": "application/pdf"
                },
                data: pdf
            };
            printer.execute("Print-Job", msg, function(err, res){
                resource.setHeader('Cache-Control', 'max-age=0, must-revalidate, no-cache, no-store');
                resource.writeHead(200, { 'Content-type': 'application/json' });
                resource.write(JSON.stringify(res), 'utf-8');
                resource.end('\n');
                console.log(res);
            });
        },
        registrantCallback = function(registrants) {
          var pageBuilder = handlebars.compile(receipt),
              html = pageBuilder(registrants[1][0]);
          if (action == "view") {
              downloadCallback(html);
          } else {
            var random = crypto.randomBytes(4).readUInt32LE(0);
            receiptFileNamePdf = path.normalize(__dirname + '/../tmp/receipt.'+random+'.pdf');
            var pdf = new NodePDF(
              null,
              receiptFileNamePdf,
              {
                'content': html,
                'viewportSize': {
                  width:670,
                  height:1160
                },
                'paperSize': {
                  'format': 'Letter',
                  'orientation': 'portrait'
                }
              }
            );

            pdf.on('error', function(msg){
                console.log(msg);
            });

            pdf.on('done', function(pathToFile){
                console.log(pathToFile);
                fs.readFile(receiptFileNamePdf, function (err, data) {
                    if (err) console.log(err);
                    /**
                    fs.unlink(pathToFile, function(err) {
                        if (err) console.log(err);
                    });
                    fs.unlink(receiptFileNameHtml, function(err) {
                        if (err) console.log(err);
                    });
                    **/
                    printCallback(data);
                });
            });
          }
        };

    /**
    if (typeof req.session.user_id === 'undefined') {
        res.writeHead(401, { 'Content-type': 'text/html' });
        res.end();
        return;
    }
    **/
    console.log("[genBadge] session id:", req.session.id);
    console.log("Badge action:", action);
    registrants.searchAttendees(["registrantid"], id, 0, 20, false, registrantCallback);


};

exports.getRegistrant = function(req, res) {
    var id = req.params.id,
        callback = function(registrant) {
            //if (err) console.log(err);
            res.setHeader('Cache-Control', 'max-age=0, must-revalidate, no-cache, no-store');
            res.writeHead(200, { 'Content-type': 'application/json' });
            res.write(JSON.stringify(registrants), 'utf-8');
            res.end('\n');
        };

    console.log("[getRegistrant] session id:", req.session.id);
    registrants.getAttendee(id, callback);
};

exports.updateRegistrantValues = function(req, res) {
    var sid = req.session.id,
        id = req.params.id,
        values = req.body;

    registrants.updateAttendeeValues(
      id,
      values,
      function(registrant) {
        res.setHeader('Cache-Control', 'max-age=0, must-revalidate, no-cache, no-store');
        res.writeHead(200, { 'Content-type': 'application/json' });
        res.write(JSON.stringify(values), 'utf-8');
        res.end('\n');
        logAction(sid, "registrant", id, "updated", "Registrant updated");
      }
    );
};

exports.updateRegistrant = function(req, res) {

    var id = req.params.id,
        sid = req.session.id,
        values = req.body,
        sql = "UPDATE group_members SET ? WHERE id = "+id;

    console.log("[updateRegistrant] session id:", req.session.id);
    //console.log(values);
    registrants.updateAttendee(id, values, function(registrant) {
        //if (err) throw err;
        if ("attend" in values) {
          if (values.attend) {
              logAction(sid, "registrant", id, "attend", "Registrant checked in");
              updateCheckedIn();
          } else {
              logAction(sid, "registrant", id, "attend", "Registrant checked out");
              updateCheckedIn();
          }
        }
        res.setHeader('Cache-Control', 'max-age=0, must-revalidate, no-cache, no-store');
        res.writeHead(200, { 'Content-type': 'application/json' });
        res.write(JSON.stringify(registrant), 'utf-8');
        res.end('\n');
    });



};

exports.addRegistrant = function(req, res) {

    var sid = req.session.id,
        values = req.body,
        sql =   "SELECT *  "+
                "FROM biller  "+
                "WHERE eventId = ? "+
                "ORDER BY userId DESC LIMIT 1; "+
                "SELECT * "+
                "FROM group_members  "+
                "WHERE event_id = ?  "+
                "ORDER BY groupMemberId DESC LIMIT 1; "+
                "SELECT * FROM event WHERE eventId = ?; "+
                "SELECT * FROM event_fields WHERE event_id = ?;",
        vars = [values.eventId, values.eventId, values.eventId, values.eventId],
        retCallback = function(registrants) {
            //if (err) console.log(err);
            res.setHeader('Cache-Control', 'max-age=0, must-revalidate, no-cache, no-store');
            res.writeHead(200, { 'Content-type': 'application/json' });
            res.write(JSON.stringify(registrants[1][0]), 'utf-8');
            res.end('\n');
        };
    //console.log(values);
    connection.query(sql, vars, function(err, results) {
        if (err) throw err;
        //console.log(results);
        var userId = results[0][0].userId + 1,
            memberId = results[1][0].groupMemberId + 1,
            confirmNum = results[2][0].confirm_number_prefix+(parseInt(results[1][0].confirmnum.split("-")[1])+1);

        async.waterfall([
            function(callback){
                var vars = {
                        "userId": userId,
                        "eventId": values.eventId,
                        "local_eventId": values.slabId,
                        "type": "G",
                        "register_date": "0000-00-00 00:00:00",
                        "due_amount": 0.00,
                        "confirmNum": confirmNum,
                        "status": 1,
                        "memtot": 1
                    },
                    sql = "INSERT INTO biller SET ?";
                connection.query(sql, vars, function(err, insertResults) {
                    if (err) throw err;
                    callback(null, vars, memberId);

                });
            },
            function(vars, memberId, callback){
                var oldVars = vars,
                    sql = "INSERT INTO group_members SET ?";
                vars = {
                    "groupMemberId": memberId,
                    "event_id": oldVars.eventId,
                    "groupUserId": oldVars.userId,
                    "confirmnum": oldVars.confirmNum,
                };
                connection.query(sql, vars, function(err, insertResults) {
                    if (err) throw err;
                    callback(null, vars, insertResults.insertId);

                });
            },
            function(vars, memberId, callback){
                var oldVars = vars,
                    sql = "",
                    fvars;
                vars = [];
                results[3].forEach(function(field, index) {
                    if (typeof values[field.name] != "undefined") {
                        sql += "INSERT INTO member_field_values SET value = ?, event_id = ?, field_id = ?, member_id = ?; ";
                        if (field.values) {
                            fValues = field.values.split("|");
                            values[field.name] = fValues.indexOf(values[field.name]);
                        }
                        vars.push(values[field.name], values.eventId, field.local_id, oldVars.groupMemberId);
                        sql += "INSERT INTO biller_field_values SET value = ?, event_id = ?, field_id = ?, user_id = ?; ";
                        if (field.values) {
                            fValues = field.values.split("|");
                            values[field.name] = fValues.indexOf(values[field.name]);
                        }
                        vars.push(values[field.name], values.eventId, field.local_id, oldVars.groupUserId);
                        //console.log(values.fields[field.name], values.event_id, field.local_id, values.local_id);
                    }
                });
                connection.query(sql, vars, function(err, insertResults) {
                    if (err) throw err;
                    callback(null, memberId);
                });
            }
        ], function (err, result) {
            //console.log(result);
            registrants.searchAttendees(["registrantid"], result, 0, 20, false, retCallback);
        });
    });
};

exports.getEvents = function(req, res) {
  var sid = req.session.id,
      id = req.params.id;

  console.log("[getEvents] session id:", req.session.id);
  models.Events.findAll(
    {
      order: 'slabId ASC'
    }
  )
  .success(function(events) {
    var types = ['Text','Select','TextArea','Checkbox','Select','Text','Text','Text','Text'],
        fields = {},
        fieldset = [],
        getFields = function(event, callback) {
          models.CheckinEventFields.findAll(
            {
              where: {
                event_id: event.eventId,
                showed: 3
              },
              order: 'ordering ASC'
            }
          ).success(function(evFields) {
            fields = {};
            fieldset = [];
            async.each(evFields, makeFieldset, function(err) {
              //console.log(fields);
              event.fields = fields;
              event.fieldset = fieldset;
              callback(null, event);
            });
          });
        },
        makeFieldset = function(field, cb) {
          var schemaRow = {
              "title": field.label,
              "type": types[field.type]
          };
          if (field.values) {
              var values = field.values.split("|");
              schemaRow.options = values;
          }
          fields[field.name] = schemaRow;
          fieldset.push(field.name);
          cb(null);
        };

    async.map(events, getFields, function(err, results){
      //console.log(results);
      res.setHeader('Cache-Control', 'max-age=0, must-revalidate, no-cache, no-store');
      res.writeHead(200, { 'Content-type': 'application/json' });
      res.write(JSON.stringify(results), 'utf-8');
      res.end('\n');
    });
  });
};

exports.getEventFields = function(req, res) {
  var sid = req.session.id,
      id = req.params.id;

  console.log("[getEventField] session id:", req.session.id);
  models.CheckinEventFields.findAll({
    where: {
      event_id: id
    }
  }).success(function(fields) {
    res.setHeader('Cache-Control', 'max-age=0, must-revalidate, no-cache, no-store');
    res.writeHead(200, { 'Content-type': 'application/json' });
    res.write(JSON.stringify(fields), 'utf-8');
    res.end('\n');
  });
};

exports.makePayment = function(req, res) {

    var values = req.body,
        sql = "",
        transAction = values.transaction,
        payments = authnet.aim({
            id: opts.configs.authorizenet.id,
            key: opts.configs.authorizenet.key,
            env: opts.configs.authorizenet.env
        }),
        transactions = authnet.td(opts.configs.authorizenet),
        successCallback = function(result) {
            res.setHeader('Cache-Control', 'max-age=0, must-revalidate, no-cache, no-store');
            res.writeHead(200, { 'Content-type': 'application/json' });
            res.write(JSON.stringify(result), 'utf-8');
            res.end('\n');
        };
    if (values.type == "check") {
        sql = "UPDATE biller SET transaction_id = ? WHERE eventId = ? AND userId = ?";
        var vars = [values.transaction.payment.checkNumber, values.registrant.event_id, values.registrant.biller_id];
        connection.query(sql, vars, function(err, results) {
            if (err) console.log(err);
            sql = "SELECT * FROM event_fees WHERE event_id = ? AND user_id = ?";
            var vars = [values.registrant.event_id, values.registrant.biller_id];
            connection.query(sql, vars, function(err, rows) {
                if (err) console.log(err);
                var vars = [transAction.amount, transAction.amount, transAction.amount, 1, "2", values.registrant.event_id, values.registrant.biller_id];
                if (rows.length > 0) {
                    sql = "UPDATE";
                } else {
                    sql = "INSERT INTO";
                }
                sql += " event_fees SET basefee = ?, fee = ?, paid_amount = ?, status = ?, payment_method = ? WHERE event_id = ? AND user_id = ?";

                connection.query(sql, vars, function(err, result) {
                    if (err) console.log(err);
                    successCallback({dbResult:result});
                });
            });
        });
      } else if (values.type != "check") {

        payments.createTransaction(transAction, function (err, results){
            console.log(results);
            if (results.code == "I00001") {
                var trans = {
                        transId: results.transactionResponse.transId
                    };
                transactions.getTransactionDetails(trans, function (err, result){
                    var transactionDetails = result;
                    sql = "UPDATE biller SET transaction_id = ? WHERE eventId = ? AND userId = ?";
                    var vars = [result.transaction.transId, values.registrant.event_id, values.registrant.biller_id];
                    connection.query(sql, vars, function(err, results) {
                        if (err) console.log(err);
                        console.log(results);
                        sql = "SELECT * FROM event_fees WHERE event_id = ? AND user_id = ?";
                        var vars = [values.registrant.event_id, values.registrant.biller_id];
                        connection.query(sql, vars, function(err, rows) {
                            if (err) console.log("SELECT Event Fees:", err);
                            console.log(rows);
                            var vars = [transAction.amount, transAction.amount, transAction.amount, 1, "authorizenet", values.registrant.event_id, values.registrant.biller_id];
                            if (rows.length > 0) {
                                sql = "UPDATE";
                            } else {
                                sql = "INSERT INTO";
                            }
                            sql += " event_fees SET basefee = ?, fee = ?, paid_amount = ?, status = ?, payment_method = ?";
                            if (rows.length > 0) {
                                sql += " WHERE event_id = ? AND user_id = ?";
                            } else {
                                sql += ", event_id = ?, user_id = ?";
                            }
                            //console.log(sql, vars);
                            connection.query(sql, vars, function(err, result) {
                                if (err) console.log("Insert Event Fees:", err);
                                console.log(result);
                                saveTransaction(transactionDetails, successCallback);
                            });
                        });
                    });
                });
            } else {
                res.setHeader('Cache-Control', 'max-age=0, must-revalidate, no-cache, no-store');
                res.writeHead(200, { 'Content-type': 'application/json' });
                res.write(JSON.stringify(results), 'utf-8');
                res.end('\n');
            }
        });
    }

};

exports.getNumberCheckedIn = function(req, res) {
  registrants.getCheckedInCount(function(count) {
    res.setHeader('Cache-Control', 'max-age=0, must-revalidate, no-cache, no-store');
    res.writeHead(200, { 'Content-type': 'application/json' });
    res.write(JSON.stringify({"checkedIn": count}), 'utf-8');
    res.end('\n');
  });
};

var updateCheckedIn = function() {
  registrants.getCheckedInCount(function(count) {
    logAction(0, "updates", count, "checkedIn", "Number checked in");
  });
};

//Helpers
var getConnection = function() {
    // Test connection health before returning it to caller.
    if ((connection) && (connection._socket) &&
        (connection._socket.readable) &&
        (connection._socket.writable)) {
      return connection;
    }
    console.log(((connection) ?
            "UNHEALTHY SQL CONNECTION; RE" : "") + "CONNECTING TO SQL.");
    connection = mysql.createConnection(opts.configs.mysql);
    connection.connect(function(err) {
        if (err) {
            console.log("(Retry: "+reconnectTries+") SQL CONNECT ERROR: " + err);
            reconnectTries++;
            var timeOut = ((reconnectTries * 50) < 30000) ? reconnectTries * 50 : 30000;
            if (reconnectTries == 50) {
                /**
                var mailOptions = {
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


var handleDisconnect = function (connection) {
  connection.on('error', function(err) {
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

function logAction(uid, objType, objId, modType, desc) {
    var logData = {
            objectType: objType,
            objectId: objId,
            uid: uid,
            modType: modType,
            description: desc
        };

    opts.io.broadcast('talk', logData);
}

function pad(num, size) {
    var s = num+"";
    while (s.length < size) s = "0" + s;
    return s;
}

}());
