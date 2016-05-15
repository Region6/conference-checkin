(function () {
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
      notoSansRegular = fs.readFileSync(path.join(__dirname, '../vendors/fonts/NotoSans.ttf')),
      notoSansBold = fs.readFileSync(path.join(__dirname, '../vendors/fonts/NotoSans-Bold.ttf')),
      font = {
        notosans: {
          regular: pdfjs.createTTFFont(notoSansRegular),
          bold:    pdfjs.createTTFFont(notoSansBold)
        }
      },
      Swag = require('swag'),
      Sequelize = require("sequelize"),
      svgHeader = fs.readFileSync("./header.svg", "utf8"),
      receipt = fs.readFileSync("./assets/templates/receipt.html", "utf8"),
      qr              = require('qr-image'),
      hummus          = require('hummus'),
      Rsvg            = require('librsvg').Rsvg,
      Registrants = require("node-registrants"),
      registrants,
      nextBadgePrinter = 0,
      opts = {},
      printerUrl = {
        "receipt": [],
        "ebadge": [],
        "gbadge": []
      },
      connection = null,
      client = null,
      transport = null,
      acl = null,
      db = {},
      reconnectTries = 0,
      models = {},
      getPrinter = function (callback) {
        var addPrinter = function(item, cb) {
              //console.log("printer", item);
              printerUrl[item.type].push({url: "http://" + item.host +item.uri});
              cb(null);
            };
        models.Printers.findAll(
          {
            order: 'type ASC'
          }
        )
        .then(
          function(printers) {
            async.each(printers, addPrinter, function(err){
              //console.log(err);
              callback();
            });
          },
          function(err) {
            
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

  exports.setKey = function (key, value) {
    opts[key] = value;
  };

  exports.initialize = function () {
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
      }
    );

    registrants = Registrants.init({
      "host": opts.configs.get("mysql:host") || "localhost",
      "username": opts.configs.get("mysql:username"),
      "password": opts.configs.get("mysql:password"),
      "database": opts.configs.get("mysql:database"),
      "port": opts.configs.get("mysql:port") || 3306,
      "logging": true
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
    
    getPrinter(function() {
      console.log("got printers");
    });
    //Initialize Email Client
    transport = email.createTransport("sendmail", {
      args: ["-f noreply@regionvivpp.org"]
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
          if (err) { throw err; }
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
                  if (row.values && (row.type === 4 || row.type === 1)) {
                      var values = row.values.split("|");
                      values.unshift("");
                      schemaRow.options = values;
                  }
                  reg.schema["fields."+row.name] = schemaRow;
                  reg.fieldset.push("fields."+row.name);
              });
              results[0].forEach(function(row, index) {
                  if (row.values && (row.type === 4 || row.type === 1)) {
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
                  if (row.values && (row.type === 4 || row.type === 1)) {
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

  var createBadge = function(registrant, callback) {
    //console.log("Creating Badge #",index);
    console.log(__dirname);
    var pageBuilder = null,
        pdfData = "",
        exhibitorFields = ["firstname", "lastname", "email", "phone", "title"];

    async.waterfall([
        function(cb){
          models.Badges.find({
            where: {
              eventId: registrant.event_id
            }
          })
          .then(
            function(badge) {
              cb(null, badge.template.toString());
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
             
                fs.writeFile('badge.'+registrant.registrantId+".svg", svg, function (err) {
                  if (err) throw err;
                  console.log('It\'s saved!');
                });
             
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
         /*
          parseString(
            svgBarcode,
            function (err, result) {
              registrant.barcode = result.svg.path[0].$.d;
              registrant.fields.id = registrant.registrantId;
              var svg = pageBuilder(registrant);
              svg = '<?xml version="1.0" encoding="UTF-8" standalone="no"?>' + svgHeader + svg + "</svg>";
              //fs.writeFileSync(barcodeFileName, svgBarcode);
              //fs.writeFileSync(svgFileName, svg);
              //svgPaths[pathIndex].push(svgFileName);
              var svgPdf = new Rsvg(svg);
              svgPdf.on('load', function() {
                var data = svgPdf.render({
                      format: 'pdf',
                      height: 792,
                      width: 612
                    }).data;
                cb(null, {id: registrant.registrantId, pdf: data.toString('base64')});
             });
            }
          );
          */
        }
    ], function (err, pdf) {
      callback(registrant.event.reg_type, pdf);
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
          if (err) { throw err; }
          callback({dbResult:result, creditResult:res});
      });
  };

  /************
  * Routes
  *************/

  exports.index = function(req, res){
      var sid = (typeof req.session !== "undefined") ? req.session.id : null;
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
      var category = req.query.category,
          cat = [],
          search = req.query.search,
          page = req.query.page,
          limit = req.query.per_page,
          callback = function(registrants) {
              //if (err) console.log(err);
              res.setHeader('Cache-Control', 'max-age=0, must-revalidate, no-cache, no-store');
              res.writeHead(200, { 'Content-type': 'application/json' });
              res.write(JSON.stringify(registrants), 'utf-8');
              res.end('\n');
          };

      //console.log("[registrants] session id:", req.session.id);
      /**
      if (typeof req.session.user_id === 'undefined') {
          res.writeHead(401, { 'Content-type': 'text/html' });
          res.end();
          return;
      }
      **/
      if (category === "name") {
          cat = ["lastname", "firstname"];
      } else if (category === "company") {
          cat = ["company"];
      } else if (category === "confirmation") {
          cat = ["confirmation"];
      } else if (category === "registrantid") {
          if (search.indexOf("-") !== -1) {
              search = search.replace("-", "");
          }
          cat = ["registrantid"];
      } else {
        cat = [category];
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
          downloadCallback = function(type, pdf) {
              var data = {id: id, pdf: pdf.toString('base64')};
              resource.setHeader('Cache-Control', 'max-age=0, must-revalidate, no-cache, no-store');
              resource.writeHead(200, { 'Content-type': 'application/json' });
              resource.write(JSON.stringify(data), 'utf-8');
              resource.end('\n');
          },
          printCallback = function(type, pdf) {
              var badgeType = (type === "E") ? "ebadge" : "gbadge", 
                  printer = ipp.Printer(printerUrl[badgeType][0].url),
                  msg = {
                    "operation-attributes-tag": {
                      "requesting-user-name": "Station",
                      "job-name": "Badge Print Job",
                      "document-format": "application/pdf"
                    },
                    data: pdf
                  };

              //nextBadgePrinter = ((nextBadgePrinter+1) <= (printerUrl.badge.length-1)) ? nextBadgePrinter + 1 : 0;
              printer.execute("Print-Job", msg, function(err, res){
                  if (err) { console.log(err); }
                  resource.setHeader('Cache-Control', 'max-age=0, must-revalidate, no-cache, no-store');
                  resource.writeHead(200, { 'Content-type': 'application/json' });
                  resource.write(JSON.stringify(res), 'utf-8');
                  resource.end('\n');
                  console.log(res);
              });
          },
          registrantCallback = function(registrants) {
            if (action === "print") {
              createBadge(registrants[0], printCallback);
            } else if (action === "download") {
              createBadge(registrants[0], downloadCallback);
            }
          };

      /**
      if (typeof req.session.user_id === 'undefined') {
          res.writeHead(401, { 'Content-type': 'text/html' });
          res.end();
          return;
      }
      **/
      console.log("[genBadge] session id:", null);
      console.log("Badge action:", action);
      registrants.searchAttendees(["registrantid"], id, 0, 100, false, registrantCallback);


  };

  exports.genReceipt = function(req, res) {

      var id = req.params.id,
          action = req.params.action,
          resource = res,
          receiptFileNameHtml = "",
          receiptFileNamePdf = "",
          downloadCallback = function(pdf) {
            var data = {id: id, pdf: pdf};
            resource.setHeader('Cache-Control', 'max-age=0, must-revalidate, no-cache, no-store');
            resource.writeHead(200, { 'Content-type': 'application/json' });
            resource.write(JSON.stringify(data), 'utf-8');
            resource.end('\n');
          },
          printCallback = function(pdf) {
            var data = new Buffer(pdf, 'binary');
            var printer = ipp.Printer(printerUrl.receipt[0].url);
            var msg = {
                "operation-attributes-tag": {
                    "requesting-user-name": "Station",
                    "job-name": "Receipt Print Job",
                    "document-format": "application/pdf"
                },
                data: data
            };
            printer.execute("Print-Job", msg, function(err, res){
              if (res) {
                resource.setHeader('Cache-Control', 'max-age=0, must-revalidate, no-cache, no-store');
                resource.writeHead(200, { 'Content-type': 'application/json' });
                resource.write(JSON.stringify(res), 'utf-8');
                resource.end('\n');
                console.log(res);
              }
            });
          },
          registrantCallback = function(registrants) {
            var registrant = registrants[0],
                doc = pdfjs.createDocument({
                  font:  font.notosans.regular,
                  width: 612,
                  height: 792,
                  padding:   20,
                  threshold: 20
                }),
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
                },
                text,
                header = function () {
                  var header = doc.header(),
                      table, tr, td;
                  table = header.table({ widths: ['50%', '50%']});
                  tr = table.tr({borderBottomWidth: 4});
                  tr.td('Invoice', { font: font.notosans.bold, fontSize: 20 });
                  tr.td(registrant.biller.confirmNum, { font: font.notosans.bold, textAlign: 'right', fontSize: 20 });
                },
                payTo = function () {
                  var table, tr, td1, td2;
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
                    var lastIdx = registrant.transactions.length - 1;
                    td2.text("Type: " + registrant.transactions[lastIdx].cardType);
                    td2.text("Card Number: " + registrant.transactions[lastIdx].cardNumber);
                    td2.text("Transaction ID: "  + registrant.transactions[lastIdx].transId);
                    td2.text("Date: " + moment.tz(registrant.transactions[lastIdx].submitTimeUTC, "America/Chicago").format("MMMM Do YYYY h:mm:ss a"));
                  } else {
                    var check = (registrant.badge_prefix === "Z") ? registrant.check : registrant.biller.transaction_id;
                    td2.text("Check: "+ check);
                  }
                },
                lineItems = function () {
                  var table, tr, td,
                      numLinked = (registrant.linked) ? registrant.linked.length : 0,
                      sum = underscore.sumBy(registrant.transactions, "settleAmount"),
                      price = (sum / (numLinked + 1)).toFixed(2),
                      balance = 0;
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
                    registrant.linked.forEach(function(linked, index) {
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
                }, pdf;

              header();
              payTo();
              text = doc.text();
              text.br();
              lineItems();
              pdf = doc.render();
              if (action === "download") {
                var data = new Buffer(pdf.toString()).toString("base64");
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
              //fs.writeFile('test.receipt.pdf', pdf.toString(), 'binary');


          };

      /**
      if (typeof req.session.user_id === 'undefined') {
          res.writeHead(401, { 'Content-type': 'text/html' });
          res.end();
          return;
      }
      **/
      //console.log("[genBadge] session id:", req.session.id);
      console.log("Badge action:", action);
      registrants.searchAttendees(["registrantid"], id, 0, 100, false, registrantCallback);


  };

  exports.getRegistrant = function(req, res) {
    var id = req.params.id,
        callback = function(registrant) {
          //if (err) console.log(err);
          res.setHeader('Cache-Control', 'max-age=0, must-revalidate, no-cache, no-store');
          res.writeHead(200, { 'Content-type': 'application/json' });
          res.write(JSON.stringify(registrant), 'utf-8');
          res.end('\n');
        };

      //console.log("[getRegistrant] session id:", req.session.id);
      registrants.searchAttendees(["registrantid"], id, 0, 100, false, callback);
  };

  exports.updateRegistrantValues = function(req, res) {
    var id = req.params.id,
        registrantId = req.body.registrantId,
        sid = null,
        type = req.body.type,
        values = req.body;

    if (type === "status") {
      registrants.updateAttendee(
        registrantId,
        values,
        function(registrant) {
          //if (err) throw err;
          console.log(values.fields);
          if ("fields" in values && "attend" in values.fields) {
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
        }
      );
    } else {
      registrants.updateAttendeeValues(
        registrantId,
        values,
        function(registrant) {
          res.setHeader('Cache-Control', 'max-age=0, must-revalidate, no-cache, no-store');
          res.writeHead(200, { 'Content-type': 'application/json' });
          res.write(JSON.stringify(registrant), 'utf-8');
          res.end('\n');
          logAction(null, "registrant", id, "updated", "Registrant updated");
        }
      );
    }
  };

  exports.updateRegistrant = function(req, res) {

      var id = req.params.id,
          sid = req.session.id,
          values = req.body,
          sql = "UPDATE group_members SET ? WHERE id = "+id;

      console.log("[updateRegistrant] session id:", req.session.id);
      //console.log(values);

  };

  exports.addRegistrant = function(req, res) {

    var values = req.body,
        retCallback = function(registrants) {
            //if (err) console.log(err);
            res.setHeader('Cache-Control', 'max-age=0, must-revalidate, no-cache, no-store');
            res.writeHead(200, { 'Content-type': 'application/json' });
            res.write(JSON.stringify(registrants), 'utf-8');
            res.end('\n');
        };

    registrants.initRegistrant(values, retCallback);
  };

  exports.getExhibitorCompanies = function(req, res) {

    var search = req.query.search,
        retCallback = function(companies) {
            //if (err) console.log(err);
            res.setHeader('Cache-Control', 'max-age=0, must-revalidate, no-cache, no-store');
            res.writeHead(200, { 'Content-type': 'application/json' });
            res.write(JSON.stringify(companies), 'utf-8');
            res.end('\n');
        };

    registrants.getExhibitorCompanies(search, retCallback);
  };

  exports.getFields = function(req, res) {
    var type = req.params.type,
        retCallback = function(fields) {
            //if (err) console.log(err);
            res.setHeader('Cache-Control', 'max-age=0, must-revalidate, no-cache, no-store');
            res.writeHead(200, { 'Content-type': 'application/json' });
            res.write(JSON.stringify(fields), 'utf-8');
            res.end('\n');
        };

    registrants.getFields(type, retCallback);
  };

  exports.getOnsiteEvents = function(req, res) {
    models.Events.findAll(
      {
        order: 'slabId ASC'
      }
    )
    .then(
      function(events) {
        res.setHeader('Cache-Control', 'max-age=0, must-revalidate, no-cache, no-store');
        res.writeHead(200, { 'Content-type': 'application/json' });
        res.write(JSON.stringify(events), 'utf-8');
        res.end('\n');
      }
    );
  };

  exports.getEvents = function(req, res) {
    models.Events.findAll(
      {
        order: 'slabId ASC'
      }
    )
    .then(
      function(events) {
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
              ).then(
                function(evFields) {
                  fields = {};
                  fieldset = [];
                  async.each(evFields, makeFieldset, function(err) {
                    //console.log(fields);
                    event.fields = fields;
                    event.fieldset = fieldset;
                    callback(null, event);
                  });
                }
              );
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
      }
    );
  };

  exports.getEventFields = function(req, res) {
    var sid = req.session.id,
        id = req.params.id;

    console.log("[getEventField] session id:", req.session.id);
    models.CheckinEventFields.findAll({
      where: {
        event_id: id
      }
    }).then(
      function(fields) {
        res.setHeader('Cache-Control', 'max-age=0, must-revalidate, no-cache, no-store');
        res.writeHead(200, { 'Content-type': 'application/json' });
        res.write(JSON.stringify(fields), 'utf-8');
        res.end('\n');
      }
    );
  };

  exports.makePayment = function(req, res) {
      var values = req.body,
          transAction = values.transaction,
          Request = new AuthorizeRequest({
            api: opts.configs.get("authorizenet:id"),
            key: opts.configs.get("authorizenet:key"),
            rejectUnauthorized: false, // true
            requestCert: false, // false
            agent: false, // http.agent object
            sandbox: opts.configs.get("authorizenet:sandbox")// true
          }),
          successCallback = function(result) {
            res.setHeader('Cache-Control', 'max-age=0, must-revalidate, no-cache, no-store');
            res.writeHead(200, { 'Content-type': 'application/json' });
            res.write(JSON.stringify(result), 'utf-8');
            res.end('\n');
          };
      if (values.type === "check") {
        registrants.saveCheckTransaction(
          values,
          function(results) {
            successCallback(results);
          }
        );
      } else if (values.type !== "check") {

        var transaction = {
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
          transaction.transactionRequest.order.invoiceNumber = values.registrant.biller.confirmNum;
          transaction.transactionRequest.customer.email = values.registrant.biller.email;
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
            function(callback) {
              Request.send(
                "createTransaction",
                transaction,
                function(err, results) {
                  console.log(err, results);
                  callback(err, results);
                }
              );
            },
            function(results, callback) {

              var details = {
                transId: results.transactionResponse.transId
              };

              Request.send(
                "getTransactionDetails",
                details,
                function(err, transDetails) {
                  console.log(err, transDetails);
                  callback(err, transDetails);
                }
              );
            },
            function(details, callback) {
              var trans = {
                registrant: values.registrant,
                transaction: details.transaction
              };
              registrants.saveCreditTransaction(
                trans,
                function(dbResults) {
                  registrants.saveAuthorizeNetTransaction(
                    trans,
                    function(results) {
                      callback(
                        null,
                        results.db
                      );
                    }
                  );
                }
              );
            }
          ],
          function(err, result) {
            if (err) {
              sendBack(res, err, 500);
            } else {
              sendBack(res, result, 200);
            }
          }
        );
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

  exports.downloadCheckedInAttendees = function(req, res) {
    
    registrants.searchAttendees(
      ['attend'],
      null,
      1,
      null,
      null,
      function(attendees) {
        console.log(attendees[0]);
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
              'company',
              'address',
              'address2',
              'city',
              'state',
              'zipcode',
              'siteid'
            ]
          }, 
          function(err, csv) {
            res.writeHead(200, { 'Content-Type': 'text/csv' });
            res.write(csv, 'utf-8');
            res.end('\n');
          }
        );
        
     }
    );

  };
  
  exports.findSiteId = function(req, res) {
    var query = req.query.search;
     models.Sites
    .findAll({ where: ["siteId LIKE ?", "%"+query+"%"] })
    .then(
      function(siteids) {
        sendBack(res, siteids, 200);
      }
     );
  };
  
  exports.findVotingSiteId = function(req, res) {
    var query = req.query.search;
     models.VotingSites
    .findAll({ where: ["siteId LIKE ?", "%"+query+"%"] })
    .then(
      function(siteids) {
        sendBack(res, siteids, 200);
      }
     );
  };
  
  exports.findCompany = function(req, res) {
    var query = req.query.search;
     models.Sites
    .findAll({ where: ["company LIKE ?", "%"+query+"%"] })
    .then(
      function(siteids) {
        sendBack(res, siteids, 200);
      }
     );
  };
  
    //Auth a user
  exports.authVoter = function(req, res) {
    var request = req,
        registrantId = req.params.voterId,
        regType = registrantId.slice(0,1),
        regId = parseInt(registrantId.slice(1), 10),
        errorMsg = {
          status: "error",
          message: {
            response: null
          }
        };
    models.Votes.find({ where: {registrantid: registrantId} }).then(function(vote) {
      if (vote === null) {
        registrants.getAttendee(
          registrantId, 
          function(member) {
            if ("id" in member) {
              //console.log("member", member);
              member.siteId = ("siteid" in member) ? member.siteid : member.siteId;
              if (member.siteId !== "") {
                getVotingSiteInfo(
                  member.siteId, 
                  function(site) {
                    member.voterType = null;
                    member.votes = [];
                    site = (site) ? site.toJSON() : {};
                    member.site = site;
                    member.registrantId = registrantId;
                    sendBack(res, member, 200);
                  }
                );
              } else {
                member.voterType = null;
                member.votes = [];
                member.registrantId = registrantId;
                member.site = {};
                sendBack(res, member, 200);
              }
            } else {
              errorMsg.message.response = "No record of that registrant id exists.";
              sendBack(res, errorMsg, 401);
            }
          }
        );
      } else {
        errorMsg.message.response = "You have already voted.";
        sendBack(res, errorMsg, 401);
      }
    });
  };

  //Log out the current user
  exports.logoutVoter = function(req, res) {
   req.session.destroy(function () {
      res.clearCookie('connect.sid', { path: '/' });
      sendBack(res, {logout: true}, 200);
    });
  };

  exports.verifySiteId = function(req, res) {
    var member = req.body;
     async.waterfall([
      function(callback){
        getVotingSiteInfo(
          member.siteId, 
          function(site) {
            site = site.toJSON();
            callback(null, site);
          }
        );
      },
      function(site, callback){
        getSiteVoters(
          site.siteId, 
          function(voters) {
            site.voters = voters;
            callback(null, site);
          }
        );
      }
    ],function(err, site) {
      member.site = site;
      member.siteId = site.siteId;
      sendBack(res, member, 200);
    });
  };

  exports.addVoterType = function(req, res) {
    var member = req.body;
    req.session.voter.voterType = member.voterType;
    req.session.voter.votes = member.votes;
    member = req.session.voter;
    sendBack(res, member, 200);
  };

  exports.castVotes = function(req, res) {
    var user = req.body,
        uid = uuid.v4(),
        errorMsg = {
          status: "error",
          message: {
            response: null
          }
        },
        recordVote = function(office, cb) {
          var vote = office.vote;
          vote.datecast = new Date();
          vote.uuid = uid;
          vote.registrantid = user.registrantId;
          vote.siteid = user.siteId;
          vote.votertype = user.voterType;
          vote.candidateid = vote.id;
          models.Votes
            .create(
              vote, 
              [
                "uuid", 
                "siteid", 
                "electionid", 
                "registrantid", 
                "candidateid", 
                "votertype", 
                "datecast"
              ]
            )
            .then(
              function(results) {
                cb(null, results);
              }
            );
        };
    models.Votes.find({ where: {registrantid: user.registrantId} }).then(function(vote) {
      if (vote === null) {
        async.map(
          user.votes, 
          recordVote, 
          function(err, items) {
            var message = {
                  "status": "votes cast"
                };
            updateVoteTotals();
            sendBack(res, items, 200);
          }
        );
      } else {
        errorMsg.message.response = "You have already voted.";
        sendBack(res, errorMsg, 401);
      }
    });
  };

  exports.offices = function(req, res) {
    models.ElectionOffices
      .findAll({ include: [{model:models.ElectionOfficeCandidates, as:"Candidates"}] })
      .then(
        function(offices) {
          sendBack(res, offices, 200);
        }
      );
  };

  var updateCheckedIn = function() {
    registrants.getCheckedInCount(function(count) {
      console.log("Update checked in");
      logAction(0, "updates", count, "checkedIn", "Number checked in");
    });
  };
  
  var getSiteInfo = function(siteId, cb) {
     models.Sites.find({ where: { siteId: siteId } }).then(
      function(site) {
        cb(site);
      }
     );
  };
  
  var getVotingSiteInfo = function(siteId, cb) {
     models.VotingSites.find({ where: { siteId: siteId } }).then(
      function(site) {
        cb(site);
      }
     );
  };
  
  var updateVoteTotals = function() {
    async.waterfall([
      function(callback){
        models.ElectionOffices
        .findAll({ include: [{model:models.ElectionOfficeCandidates, as:"Candidates"}] })
        .then(
          function(offices) {
            var result = {
              offices: offices
            };
            callback(null, result); 
          }
        );
      },
      function(result, callback){
        models.Votes.findAll({
          attributes: ['candidateid', [Sequelize.fn('count', Sequelize.col('candidateid')), 'count']],
          group: ['candidateid']
        }).then(
          function(votes) {
            result.votes = votes;
            callback(null, result);
          }
        );
      }
    ],function(err, result) {
      logAction(0, "updates", result, "votes", "Vote total");
    });
    
    
  };
  
  var getSiteVoters = function(siteId, cb) {

    async.waterfall([
      function(callback){
        models.Votes
        .findAll(
          {
            where: { siteid: siteId },
            group: 'registrantid'
          }
        )
        .then(
          function(votes) {
            callback(null, votes);
          }
        );
      },
      function(votes, callback){
        async.map(
          votes,
          function(vote, mapCb) {
            var registrantId = vote.registrantid,
                regType = registrantId.slice(0,1),
                regId = parseInt(registrantId.slice(1), 10);

            registrants.getAttendee(registrantId, function(member) {
                member.voterType = vote.votertype;
                member.dateCast = vote.datecast;
                mapCb(null, member);
            });
          }, function(err, voters){
            if( err ) {
              callback(err, null);
            } else {
              callback(null, voters);
            }
          }
        );
      },
    ],function(err, voters) {
      if (err) console.log("error:", err);
      cb(voters);
    });


  };
  
  var sendBack = function(res, data, status) {
    status = status || 200;
    res.setHeader('Cache-Control', 'max-age=0, must-revalidate, no-cache, no-store');
    res.writeHead(status, { 'Content-type': 'application/json' });
    res.write(JSON.stringify(data), 'utf-8');
    res.end('\n');
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
              if (reconnectTries === 50) {
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

      opts.io.emit("talk", logData);
  }

  function pad(num, size) {
      var s = num+"";
      while (s.length < size) { s = "0" + s; }
      return s;
  }

}());
