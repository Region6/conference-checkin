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
    opts = {},
    connection = null,
    client = null,
    transport = null,
    acl = null,
    db = null,
    reconnectTries = 0;


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

var getEventGroupMembers = function(cb) {
    var sql = "SELECT *"+
              " FROM group_members"+
              " WHERE event_id = ? LIMIT 20",
        vars = [config.uuid];

    connection.query(sql, vars, function(err, rows) {
        if (err) throw err;
        //console.log(rows.length);
        processGroupMembers(rows, [], 0, cb);
    });
}

var processGroupMembers = function(members, registrants, index, cb) {
    var sql = "",
        index = index || 0,
        member = members[index];
    var vars = [config.uuid, parseInt(member.groupMemberId), config.uuid, parseInt(member.groupUserId) ];
    sql = "(SELECT 'g'as type, member_field_values.member_id as userId, member_field_values.value, event_fields.*"+
          " FROM member_field_values"+
          " JOIN event_fields ON (member_field_values.field_id = event_fields.local_id AND event_fields.event_id = ?)"+
          " WHERE member_id = ?)"+
          " UNION"+
          " (SELECT 'b'as type, biller_field_values.user_id as userId, biller_field_values.value, event_fields.*"+
          " FROM biller_field_values"+
          " JOIN event_fields ON (biller_field_values.field_id = event_fields.local_id AND event_fields.event_id = ?)"+
          " WHERE user_id = ?)";
    connection.query(sql, vars, function(err, rows) {
        if (err) throw err;
        var reg = {
            fields: {
                userId: rows[0].userId
            },
            id: rows[0].userId
        };
        rows.forEach(function(row, index) {
            if (row.values) {
                var values = row.values.split("|");
                reg.fields[row.name] = values[parseInt(row.value)];
            } else {
                reg.fields[row.name] = row.value;
            }
        });
        //console.log(reg);
        registrants.push(reg);
        index++;
        //console.log(index);
        if (members.length >= (index + 1)) {
            processGroupMembers(members, registrants, index, cb);
        } else {
            callback(registrants);
        }
    });

}

/************
* Routes
*************/

exports.index = function(req, res){
    //Regenerates the JS/template file
    //if (req.url.indexOf('/bundle') === 0) { bundle(); }

    //Don't process requests for API endpoints
    if (req.url.indexOf('/api') === 0 ) { return next(); }

    var init = "$(document).ready(function() { App.initialize(); });";
    //if (typeof req.session.user !== 'undefined') {
        init = "$(document).ready(function() { App.uid = " + uuid.v1() + "; App.initialize(); });";
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
        search = req.params.search;
        callback = function(registrants) {
            if (err) console.log(err);
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
    getEventGroupMembers(callback);


};

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

function logAction(uin, docId, versionId, objType, objId, modType, desc) {
    var logData = {
            docId: docId,
            versionId: versionId,
            objectType: objType,
            objectId: objId,
            uin: uin,
            modType: modType,
            description: desc
        };

    var newLog = new Models.log(logData);
    newLog.save(function(err, log) {
        var uins = [log.get("uin")];

        var gotUins = function(rows) {
            logData["user"] = rows;
            Models.docs
                .findById(logData.docId, {versions:{$slice: 1}})
                .exec(function (err, doc) {
                    if (err) console.log(err);
                    logData["doc"] = doc;
                    if (modType == "submitted") {
                        logData["type"] = "review-submitted";
                    } else {
                        logData["type"] = "model-update";
                    }
                    opts.io.broadcast('talk', logData);

                   return log;

            });

        };

        getUins(uins, gotUins);

    });
}

function pad(num, size) {
    var s = num+"";
    while (s.length < size) s = "0" + s;
    return s;
}
