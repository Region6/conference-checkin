var AuthorizeRequest = require('auth-net-request'),
    mysql       = require('mysql'),
    underscore  = require('underscore'),
    config      = require(process.cwd()+'/config/settings.json');

console.log(config);
var connection = mysql.createConnection({
        host     : config.mysql.host,
        database : config.mysql.database,
        user     : config.mysql.username,
        password : config.mysql.password
    }),
    Request = new AuthorizeRequest({
      api: config.authorizenet.id,
      key: config.authorizenet.key,
      rejectUnauthorized: false, // true
      requestCert: false, // false
      agent: false, // http.agent object
      sandbox: false // true
    });

var getBatchDates = function() {
    var sql =   "select * " +
                "from ( " +
                "( " +
                "SELECT DISTINCT DATE_FORMAT(createdAt, '%Y-%m-%d') as batchDate " +
                "FROM onsiteAttendees  " +
                "LEFT OUTER JOIN batchesDownloaded on DATE_FORMAT(onsiteAttendees.createdAt, '%Y-%m-%d') = batchesDownloaded.batchDate  " +
                "WHERE batchesDownloaded.batchDate is null " +
                ") " +
                "UNION ALL " +
                "( " +
                "SELECT DISTINCT DATE_FORMAT(createdAt, '%Y-%m-%d') as batchDate " +
                "FROM exhibitors  " +
                "LEFT OUTER JOIN batchesDownloaded on DATE_FORMAT(exhibitors.createdAt, '%Y-%m-%d') = batchesDownloaded.batchDate  " +
                "WHERE batchesDownloaded.batchDate is null " +
                ") ) a " +
                "WHERE batchDate IS NOT NULL " +
                "order by batchDate ASC";
    connection.query(sql, function(err, rows, fields) {
        if (err) throw err;
        getTransactions(rows, 0);
    });
}

var getTransactions = function(batchDates, index) {
    var batch = batchDates[index],
        batches = {
            includeStatistics: true,
            firstSettlementDate: batch.batchDate+'T00:00:00',
            lastSettlementDate: batch.batchDate+'T23:59:59'
        },
        callback = function() {
            var sql = "INSERT INTO batchesDownloaded SET ?",
                record = {'batchDate': batch.batchDate}
            connection.query(sql, record, function(err, rows, fields) {
                if (err) throw err;
                index++;
                if (index < batchDates.length) {
                    getTransactions(batchDates, index);
                } else {
                    end();
                }
            });
        };
    console.log(batch);

    Request.send("getSettledBatchList", batches, function (err, res){
        console.log(err);
        if ("batchList" in res) {
            var batchid = {batchId: res.batchList.batch.batchId};
            Request.send("getTransactionList", batchid, function (err, res){
                if (res.transactions.transaction.length > 0) {
                    getTransaction(res.transactions.transaction, 0, callback);
                } else {
                    var trans = [res.transactions.transaction];
                    getTransaction(trans, 0, callback);
                }
            });
        } else {
            callback();
        }
    });
}

var getTransaction = function(trans, index, cb) {
    var transaction = trans[index],
        transactionid = {transId: transaction.transId};
     Request.send("getTransactionDetails", transactionid, function (err, res){
        var sql = "INSERT INTO transactions SET ?",
            record = underscore.clone(res.transaction);
        console.log(JSON.stringify(record, null, 3));
        delete record.batch;
        delete record.payment;
        delete record.order;
        delete record.billTo
        delete record.shipTo
        delete record.recurringBilling;
        delete record.customer;
        delete record.product;
        delete record.marketType;
        delete record.customerIP;
        delete record.entryMethod;
        delete record.solution;
        //console.log("customer", Object.keys(res.transaction.customer));
       //console.log("batch", Object.keys(res.transaction.batch));
       //console.log("order", Object.keys(res.transaction.order));
       //console.log("payment", Object.keys(res.transaction.payment));
        if ("customer" in res.transaction && "email" in res.transaction.customer) {
          record = underscore.extend(record, {
            customerId: res.transaction.customer.id,
            email: res.transaction.customer.email
          });
        }
        record = underscore.extend(record, {
          invoiceNumber: ("order" in res.transaction) ? res.transaction.order.invoiceNumber : null
        });
        record = underscore.extend(record, res.transaction.payment.creditCard);
        record = underscore.extend(record, res.transaction.batch);
        record = underscore.extend(record, {
            billToFirstName: res.transaction.billTo.firstName,
            billToLastName: res.transaction.billTo.lastName,
            billToAddress: res.transaction.billTo.address,
            billToCity: res.transaction.billTo.city,
            billToState: res.transaction.billTo.state,
            billToZip: res.transaction.billTo.zip,
            billToPhoneNumber: res.transaction.billTo.phoneNumber
        });
        if ("shipTo" in res.transaction) {
            record = underscore.extend(record, {
                shipToFirstName: res.transaction.shipTo.firstName,
                shipToLastName: res.transaction.shipTo.lastName,
                shipToAddress: res.transaction.shipTo.address,
                shipToCity: res.transaction.shipTo.city,
                shipToState: res.transaction.shipTo.state,
                shipToZip: res.transaction.shipTo.zip
            });
        }
        connection.query(sql, record, function(err, rows, fields) {
            if (err) throw err;
            /*
            console.log(res.transaction);
            if ("creditCard" in res.transaction.payment) {
                console.log(res.transaction.payment.creditCard);
            }
            */
            index++;
            //console.log(trans.length, index);
            if (index < trans.length) {
                getTransaction(trans, index, cb);
            } else {
                cb();
            }
        });
    });
}

var end = function() {
    connection.end();
}

getBatchDates();
