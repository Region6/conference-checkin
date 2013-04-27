"use strict";

var fs = require('fs'),
    path = require('path'),
    ldap = require('ldapjs'),
    mysql = require('mysql'),
    email = require('nodemailer'),
    crypto = require('crypto'),
    spawn = require('child_process').spawn,
    async = require('async'),
    Acl = require('acl'),
    uuid = require("node-uuid"),
    glob = require('glob'),
    underscore = require('underscore'),
    pdf417 = require('pdf417'),
    ipp = require('ipp'),
    handlebars = require('handlebars'),
    authnet = require('authnet'),
    svgHeader = fs.readFileSync("./header.svg", "utf8"),
    opts = {},
    connection = null,
    client = null,
    transport = null,
    acl = null,
    db = null,
    reconnectTries = 0;

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
    if(context.length > maxLength){
        return context.substring(0, maxLength) + trailingString;
    }
    return context;
});

exports.setKey = function(key, value) {
    opts[key] = value;
};

exports.initialize = function() {
    //Initialize Mysql
    getConnection();

    //Initialize Email Client
    transport = email.createTransport("sendmail", {
        args: ["-f noreply@vpr.tamu.edu"]
    });

};

var getEventGroupMembers = function(fields, search, page, limit, cb) {
    var sql = "",
        fields = fields || [],
        search = search || "all",
        page = page || 0,
        limit = limit || 20,
        vars = [];

    if (fields.length == 0) {
        //console.log(page, start, limit);
        sql = "SELECT COUNT(*) as count FROM group_members";
    } else if (underscore.indexOf(fields, "confirmation") !== -1) {
        sql = "SELECT *"+
              " FROM group_members"+
              " WHERE confirmnum LIKE ?";
        vars.push("%"+search+"%");
    } else if (underscore.indexOf(fields, "registrantid") !== -1) {
        sql = "SELECT *"+
              " FROM group_members"+
              " WHERE id = ?";
        vars.push(search);
    } else {
        sql = "(SELECT group_members.* "+
                  " FROM event_fields  "+
                  " LEFT JOIN member_field_values ON (event_fields.local_id = member_field_values.field_id AND event_fields.event_id = member_field_values.event_id) "+
                  " LEFT JOIN group_members ON (member_field_values.member_id = group_members.groupMemberId  AND member_field_values.event_id = group_members.event_id) "+
                  " WHERE member_field_values.value LIKE ? AND (";
        vars.push("%"+search+"%");
        fields.forEach(function(field, index) {
            if (index > 0) {
                sql += " OR ";
            }
            sql += "event_fields.class = ?";
            vars.push(field);
        });
        sql += ")) UNION (";
        sql += "SELECT group_members.* "+
              " FROM event_fields  "+
              " LEFT JOIN biller_field_values ON (event_fields.local_id = biller_field_values.field_id AND event_fields.event_id = biller_field_values.event_id) "+
              " LEFT JOIN group_members ON (biller_field_values.user_id = group_members.groupUserId AND biller_field_values.event_id = group_members.event_id) "+
              " WHERE biller_field_values.value LIKE ? AND (";
        vars.push("%"+search+"%");
        fields.forEach(function(field, index) {
            if (index > 0) {
                sql += " OR ";
            }
            sql += "event_fields.class = ?";
            vars.push(field);
        });
        sql += "))";
    }

    connection.query(sql, vars, function(err, rows) {
        if (err) throw err;
        var start = page * limit,
            registrants = [
              {"total_entries": 0},
              []
            ],
            vars = [];
        if (fields.length == 0) {
            registrants[0].total_entries = rows[0].count;
            //console.log(page, start, limit);
            sql = "SELECT group_members.*, event.confirm_number_prefix, event.badge_prefix "+
                  " FROM group_members"+
                  " LEFT JOIN event ON group_members.event_id = event.eventId"+
                  " LIMIT "+start+","+limit;
        } else if (underscore.indexOf(fields, "confirmation") !== -1) {
            registrants[0].total_entries = rows.length;
            sql = "SELECT group_members.*, event.confirm_number_prefix, event.badge_prefix "+
                  " FROM group_members"+
                  " LEFT JOIN event ON group_members.event_id = event.eventId"+
                  " WHERE confirmnum LIKE ?"+
                  " LIMIT "+start+","+limit;
            vars.push("%"+search+"%");
        } else if (underscore.indexOf(fields, "registrantid") !== -1) {
            registrants[0].total_entries = rows.length;
            sql = "SELECT group_members.*, event.confirm_number_prefix, event.badge_prefix "+
              " FROM group_members"+
              " LEFT JOIN event ON group_members.event_id = event.eventId"+
              " WHERE id = ?";
            vars.push(search);
        } else {
            registrants[0].total_entries = rows.length;
            sql = "(SELECT group_members.*, event.confirm_number_prefix, event.badge_prefix "+
                  " FROM event_fields  "+
                  " LEFT JOIN member_field_values ON (event_fields.local_id = member_field_values.field_id AND event_fields.event_id = member_field_values.event_id) "+
                  " LEFT JOIN group_members ON (member_field_values.member_id = group_members.groupMemberId  AND member_field_values.event_id = group_members.event_id)"+
                  " LEFT JOIN event ON group_members.event_id = event.eventId"+
                  " WHERE member_field_values.value LIKE ? AND (";
            vars.push("%"+search+"%");
            fields.forEach(function(field, index) {
                if (index > 0) {
                    sql += " OR ";
                }
                sql += "event_fields.class = ?";
                vars.push(field);
            });
            sql += ")) UNION (";
            sql += "SELECT group_members.*, event.confirm_number_prefix, event.badge_prefix "+
                  " FROM event_fields  "+
                  " LEFT JOIN biller_field_values ON (event_fields.local_id = biller_field_values.field_id AND event_fields.event_id = biller_field_values.event_id) "+
                  " LEFT JOIN group_members ON (biller_field_values.user_id = group_members.groupUserId AND biller_field_values.event_id = group_members.event_id)"+
                  " LEFT JOIN event ON group_members.event_id = event.eventId"+
                  " WHERE biller_field_values.value LIKE ? AND (";
            vars.push("%"+search+"%");
            fields.forEach(function(field, index) {
                if (index > 0) {
                    sql += " OR ";
                }
                sql += "event_fields.class = ?";
                vars.push(field);
            });
            sql += ")) LIMIT "+start+","+limit;
        }
        //console.log(sql);
        connection.query(sql, vars, function(err, rows) {
            if (err) throw err;
            //console.log(rows.length);
            if (rows.length > 0) {
                console.log("Total Registrants:", registrants[0]);
                processGroupMembers(rows, registrants, 0, cb);
            } else {
                registrants[0].total_entries = 0;
                cb(registrants);
            }
        });
    });
}

var processGroupMembers = function(members, registrants, index, cb) {
    var sql = "",
        index = index || 0,
        member = members[index],
        ignoreNames = ["firstname", "lastname"];
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
                parseInt(member.groupUserId)
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
          " SELECT id, groupUserId,"+
          " (SELECT value "+
          " FROM member_field_values "+
          " LEFT JOIN event_fields ON (member_field_values.field_id = event_fields.local_id AND event_fields.event_id = ?)"+
          " WHERE event_fields.event_id = ? AND event_fields.class = 'firstname' AND member_field_values.member_id = group_members.groupMemberId) as firstname,"+
          " (SELECT value "+
          " FROM member_field_values "+
          " LEFT JOIN event_fields ON (member_field_values.field_id = event_fields.local_id AND event_fields.event_id = ?)"+
          " WHERE event_fields.event_id = ? AND event_fields.class = 'lastname' AND member_field_values.member_id = group_members.groupMemberId) as lastname,"+
          " (SELECT value "+
          " FROM member_field_values "+
          " LEFT JOIN event_fields ON (member_field_values.field_id = event_fields.local_id AND event_fields.event_id = ?)"+
          " WHERE event_fields.event_id = ? AND event_fields.class = 'company' AND member_field_values.member_id = group_members.groupMemberId) as company"+
          " FROM group_members"+
          " WHERE groupUserId = ? AND event_id = ?;"+
          " SELECT * FROM event_fields WHERE event_id = ? AND badge_order > 0 ORDER BY badge_order ASC;"+
          " SELECT * FROM event_fees WHERE event_id = ? AND user_id = ? ORDER BY id ASC;"+
          " SELECT * FROM biller WHERE eventId = ? AND userId = ? ORDER BY id ASC";

    //console.log(sql);
    connection.query(sql, vars, function(err, results) {
        if (err) throw err;
        if (results[0]) {
            var reg = {
                    fields: {
                        userId: results[0][0].userId,
                        infoField: '',
                        manageField: '<div class="btn-group"><button class="btn dropdown-toggle" data-toggle="dropdown">Manage <span class="caret"></span></button><ul class="dropdown-menu"><li><a href="#" class="checkinRegistrant">Checkin</a></li><li class="divider"></li><li><a href="#" class="editRegistrant">Edit</a></li><li><a href="#" class="printBadge">Print Badge</a></li><li><a href="#" class="downloadBadge">Download Badge</a></li></ul></div>'
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
                    checked_in: member.checked_in,
                    checked_in_time: member.checked_in_time,
                    schema:{},
                    fieldset:[],
                    firstname: "",
                    lastname: "",
                    company: "",
                    badge_prefix: member.badge_prefix
                },
                types = ['Text','Select','TextArea','Checkbox','Select','Text','Text','Text','Text'];
            if (member.checked_in) {
                reg.fields.infoField += '<i class="icon-ok icon-large" style="color: #468847;"></i>';
            } else {
                reg.fields.infoField += '<i class="icon-remove icon-large" style="color: #b94a48;"></i>';
            }
            results[0].forEach(function(row, index) {
                var schemaRow = {
                    "title": row.label,
                    "type": types[row.type]
                };
                if (row.values) {
                    var values = row.values.split("|");
                    schemaRow.options = values;
                    reg.fields[row.name] = values[parseInt(row.value)];
                } else  {
                    //console.log(row.typeRow, row.name);
                    reg.fields[row.name] = row.value;
                }

                if (row.class == "company") {
                    reg.company = reg.fields[row.name];
                } else if (row.class == "firstname") {
                    reg.firstname = reg.fields[row.name];
                } else if (row.class == "lastname") {
                    reg.lastname = reg.fields[row.name];
                } else if (row.class == "street1") {
                    reg.street1 = reg.fields[row.name];
                } else if (row.class == "street2") {
                    reg.street2 = reg.fields[row.name];
                } else if (row.class == "city") {
                    reg.city = reg.fields[row.name];
                } else if (row.class == "state") {
                    reg.state = reg.fields[row.name];
                } else if (row.class == "zipcode") {
                    reg.zipcode = reg.fields[row.name];
                } else if (row.class == "email") {
                    reg.email = reg.fields[row.name];
                } else if (row.class == "title") {
                    reg.title = reg.fields[row.name];
                } else if (row.class == "phone") {
                    reg.phone = reg.fields[row.name];
                }

                reg.schema["fields."+row.name] = schemaRow;
                reg.fieldset.push("fields."+row.name);
            });
            results[1].forEach(function(row, index) {
                var schemaRow = {
                    "title": row.label,
                    "type": types[row.type]
                };
                if (row.values) {
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
                reg.badgeFields.push(row.name);
            });
            results[4].forEach(function(row, index) {
                row.fee = parseFloat(row.fee);
                row.paid_amount = parseFloat(row.paid_amount);
                reg.paid = (row.fee > row.paid_amount) ? false : true;
            });

            reg.linked.forEach(function(row, index) {
                row.badge_prefix = member.badge_prefix;
                row.company = reg.company;
            });
            if (reg.paid) {
                reg.fields.infoField += '&nbsp; <i class="icon-money icon-large" style="color: #468847;"></i>';
            } else {
                reg.fields.infoField += '&nbsp; <i class="icon-money icon-large" style="color: #b94a48;"></i>';
            }
            reg.payment = results[4];
            //console.log(reg);
            registrants[1].push(reg);
        }
        index++;
        //console.log(index);
        if (members.length >= (index + 1)) {
            processGroupMembers(members, registrants, index, cb);
        } else {
            cb(registrants);
        }
    });

}

var createBadge = function(registrant, template, cb) {

    var pageBuilder = handlebars.compile(template);
    var code = registrant.id+"|"+registrant.confirmation;

    registrant.badgeFields.forEach(function(field, index) {
        code += "|" + registrant.fields[field];
    });
    var barcode = pdf417.barcode(code, 5);
    var y = 0,
        bw = 1.25,
        bh = 0.75,
        svgBarcode = "",
        rect = 32000;
    // for each row
    for (var r = 0; r < barcode['num_rows']; r++) {
        var x = 0;
        // for each column
        for (var c = 0; c < barcode['num_cols']; c++) {
            if (barcode['bcode'][r][c] == 1) {
                svgBarcode += '<rect id="rect'+rect+'" height="'+bh+'" width="'+bw+'" y="'+y+'" x="'+x+'" />';
                rect++;
            }
            x += bw;
        }
        y += bh;
    }
    svgBarcode = '<g id="elements" style="fill:#000000;stroke:none" x="23.543152" y="295" transform="translate(28,300)">'+svgBarcode;
    svgBarcode += '</g>';
    registrant.fields["barcode"] = svgBarcode;
    registrant.fields.id = registrant.registrantId;
    var svg = pageBuilder(registrant.fields),
        i = [];
    svg = svgHeader + svg + "</svg>";
    //fs.writeFileSync(__dirname + '/badges/badge.'+registrant.id+'.svg', svg);
    var rsvg = spawn('rsvg-convert', ['-z', '0.80', '-f', 'pdf']);

    rsvg.on('exit', function (code) {
        if(code == 0) {
            var d = Buffer.concat(i);
            cb(d);
        } else {
            console.log(pdfData);
        }
    });
    rsvg.stdout.on('data', function (data) {
        i.push(data);
    });
    rsvg.stderr.on('data', function (data) {
        //pdfData = data;
    });

    rsvg.stdin.write(svg);
    rsvg.stdin.end();
}

var saveTransaction = function(transaction, callback) {
    var sql = "INSERT INTO transactions SET ?",
        vars = underscore.clone(res.transaction);
    delete vars.batch;
    delete vars.payment;
    delete vars.order;
    delete vars.billTo
    delete vars.shipTo
    delete vars.recurringBilling;
    delete vars.customer;
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
    connection.query(sql, vars, function(err, rows, fields) {
        if (err) throw err;

    })
}

/************
* Routes
*************/

exports.index = function(req, res){
    var sid = req.sessionID;
    //Regenerates the JS/template file
    //if (req.url.indexOf('/bundle') === 0) { bundle(); }

    //Don't process requests for API endpoints
    if (req.url.indexOf('/api') === 0 ) { return next(); }
    console.log("session id:", sid);

    var init = "$(document).ready(function() { App.initialize(); });";
    //if (typeof req.session.user !== 'undefined') {
        init = "$(document).ready(function() { App.uid = '" + sid + "'; App.initialize(); });";
    //}
    fs.readFile(__dirname + '/../public/templates/index.html', 'utf8', function(error, content) {
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
        cat = ["registrantid"];
    }
    getEventGroupMembers(cat, search, page, limit, callback);


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
            var printer = ipp.Printer("http://mediaserver.local.:631/printers/HP_HP_Photosmart_8400_series");
            var msg = {
                "operation-attributes-tag": {
                    "requesting-user-name": "Station",
                    "job-name": "Badge Print Job",
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
            var sql = "SELECT * FROM event_badge WHERE eventId = ?",
                vars = [registrants[1][0].event_id]

            connection.query(sql, vars, function(err, rows) {
                if (err) throw err;
                if (action == "print") {
                    createBadge(registrants[1][0], rows[0].template, printCallback);
                } else if (action == "download") {
                    createBadge(registrants[1][0], rows[0].template, downloadCallback);
                }
            });
        };

    /**
    if (typeof req.session.user_id === 'undefined') {
        res.writeHead(401, { 'Content-type': 'text/html' });
        res.end();
        return;
    }
    **/

    getEventGroupMembers(["registrantid"], id, 0, 20, registrantCallback);


};

exports.getRegistrant = function(req, res) {
    var id = req.params.id,
        callback = function(registrants) {
            //if (err) console.log(err);
            res.setHeader('Cache-Control', 'max-age=0, must-revalidate, no-cache, no-store');
            res.writeHead(200, { 'Content-type': 'application/json' });
            res.write(JSON.stringify(registrants[1][0]), 'utf-8');
            res.end('\n');
        };

    getEventGroupMembers(["registrantid"], id, 0, 20, callback);
};

exports.updateRegistrantValues = function(req, res) {

    var sid = req.sessionID,
        id = req.params.id,
        values = req.body,
        sql = "SELECT * FROM event_fields WHERE event_id = ?;",
        vars = [values.event_id];

    console.log("id", id);
    console.log(values);
    connection.query(sql, vars, function(err, rows) {
        var vars = [],
            sql = "";
        if (err) throw err;
        rows.forEach(function(field, index) {

            if (typeof values.fields[field.name] != "undefined") {
                sql += "UPDATE member_field_values SET value = ? WHERE event_id = ? AND field_id = ? AND member_id = ?;";
                if (field.values) {
                    var fValues = field.values.split("|");
                    values.fields[field.name] = fValues.indexOf(values.fields[field.name]);
                }
                vars.push(values.fields[field.name], values.event_id, field.local_id, values.local_id);
                console.log(values.fields[field.name], values.event_id, field.local_id, values.local_id);
            }
        })
        connection.query(sql, vars, function(err, results) {
            if (err) throw err;
            console.log(results);
            res.setHeader('Cache-Control', 'max-age=0, must-revalidate, no-cache, no-store');
            res.writeHead(200, { 'Content-type': 'application/json' });
            res.write(JSON.stringify(values), 'utf-8');
            res.end('\n');
            logAction(sid, "registrant", id, "updated", "Registrant updated");
        });
    });
};

exports.updateRegistrant = function(req, res) {

    var id = req.params.id,
        sid = req.sessionID,
        values = req.body,
        sql = "UPDATE group_members SET ? WHERE id = "+id;

    console.log(values);
    connection.query(sql, values, function(err, results) {
        if (err) throw err;
        console.log(results);
        res.setHeader('Cache-Control', 'max-age=0, must-revalidate, no-cache, no-store');
        res.writeHead(200, { 'Content-type': 'application/json' });
        res.write(JSON.stringify(values), 'utf-8');
        res.end('\n');
    });

    if ("checked_in" in values) {
        logAction(sid, "registrant", id, "checked_in", "Registrant checked in");
    }

};

exports.addRegistrant = function(req, res) {

    var sid = req.sessionID,
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
                    vars = {
                        "groupMemberId": memberId,
                        "event_id": oldVars.eventId,
                        "groupUserId": oldVars.userId,
                        "confirmnum": oldVars.confirmNum,
                    },
                    sql = "INSERT INTO group_members SET ?";
                connection.query(sql, vars, function(err, insertResults) {
                    if (err) throw err;
                    callback(null, vars, insertResults.insertId);

                });
            },
            function(vars, memberId, callback){
                var oldVars = vars,
                    sql = "",
                    vars = [];

                results[3].forEach(function(field, index) {
                    if (typeof values[field.name] != "undefined") {
                        sql += "INSERT INTO member_field_values SET value = ?, event_id = ?, field_id = ?, member_id = ?; ";
                        if (field.values) {
                            var fValues = field.values.split("|");
                            values[field.name] = fValues.indexOf(values[field.name]);
                        }
                        vars.push(values[field.name], values.eventId, field.local_id, oldVars.groupMemberId);
                        //console.log(values.fields[field.name], values.event_id, field.local_id, values.local_id);
                    }
                });
                connection.query(sql, vars, function(err, insertResults) {
                    if (err) throw err;
                    callback(null, memberId);
                });
            }
        ], function (err, result) {
            console.log(result);

            getEventGroupMembers(["registrantid"], result, 0, 20, retCallback);
        });
    });
};

exports.getEvents = function(req, res) {

    var sid = req.sessionID,
        id = req.params.id,
        sql = "SELECT * FROM event ORDER BY slabId ASC;";

    connection.query(sql, function(err, rows) {
        if (err) throw err;
        var getFields = function(event, callback) {
            var sql = "SELECT * FROM event_fields WHERE event_id = ? AND showed = 3 ORDER BY ordering ASC;",
                vars = [event.eventId];

            connection.query(sql, vars, function(err, rows) {
                var types = ['Text','Select','TextArea','Checkbox','Select','Text','Text','Text','Text'],
                    fields = {},
                    fieldset = [];

                rows.forEach(function(row, index) {
                    var schemaRow = {
                        "title": row.label,
                        "type": types[row.type]
                    };
                    if (row.values) {
                        var values = row.values.split("|");
                        schemaRow.options = values;
                    }
                    fields[row.name] = schemaRow;
                    fieldset.push(row.name);
                });
                console.log(fields);
                event.fields = fields;
                event.fieldset = fieldset;
                callback(null, event);
            });
        };

        async.map(rows, getFields, function(err, results){
            //console.log(results);
            res.setHeader('Cache-Control', 'max-age=0, must-revalidate, no-cache, no-store');
            res.writeHead(200, { 'Content-type': 'application/json' });
            res.write(JSON.stringify(results), 'utf-8');
            res.end('\n');
        });

    });

}

exports.getEventFields = function(req, res) {

    var sid = req.sessionID,
        id = req.params.id,
        sql = "SELECT * FROM event_fields WHERE event_id = ?;",
        vars = [id];

    connection.query(sql, vars, function(err, rows) {
        if (err) throw err;
        console.log(rows);
        res.setHeader('Cache-Control', 'max-age=0, must-revalidate, no-cache, no-store');
        res.writeHead(200, { 'Content-type': 'application/json' });
        res.write(JSON.stringify(rows), 'utf-8');
        res.end('\n');
    });

};

exports.makePayment = function(req, res) {
    var values = req.body,
        payments = authnet.aim({
            id: opts.configs.authorizenet.id,
            key: opts.configs.authorizenet.key,
            env: opts.configs.authorizenet.env
        }),
        transactions = authnet.td(opts.configs.authorizenet);

    payments.createTransaction(values, function (err, results){
        console.log(results);
        if (results.code == "I00001") {
            var trans = {
                    transId: results.transactionResponse.transId
                };
            transactions.getTransactionDetails(trans, function (err, result){
                res.setHeader('Cache-Control', 'max-age=0, must-revalidate, no-cache, no-store');
                res.writeHead(200, { 'Content-type': 'application/json' });
                res.write(JSON.stringify(result), 'utf-8');
                res.end('\n');
            });
        } else {
            res.setHeader('Cache-Control', 'max-age=0, must-revalidate, no-cache, no-store');
            res.writeHead(200, { 'Content-type': 'application/json' });
            res.write(JSON.stringify(results), 'utf-8');
            res.end('\n');
        }
    });

}

//Helpers
var getConnection = function() {
    // Test connection health before returning it to caller.
    if ((connection) && (connection._socket)
            && (connection._socket.readable)
            && (connection._socket.writable)) {
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
}


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
