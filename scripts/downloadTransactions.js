const ApiContracts = require('authorizenet').APIContracts;
const ApiControllers = require('authorizenet').APIControllers;
const SDKConstants = require('authorizenet').Constants;
const { map, props, mapSeries } = require('awaity');
const knex = require('knex');
const moment = require('moment-timezone');

const config = require('../config');
const fields =[
  'transId',
  'submitTimeUTC',
  'submitTimeLocal',
  'transactionType',
  'transactionStatus',
  'responseCode',
  'responseReasonCode',
  'responseReasonDescription',
  'authCode',
  'AVSResponse',
  'cardCodeResponse',
  'batchId',
  'settlementTimeUTC',
  'settlementTimeLocal',
  'invoiceNumber',
  'customerId',
  'description',
  'authAmount',
  'settleAmount',
  'cardNumber',
  'cardType',
  'email',
];
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

const merchantAuthenticationType = new ApiContracts.MerchantAuthenticationType();
merchantAuthenticationType.setName(config.authorizenet.id);
merchantAuthenticationType.setTransactionKey(config.authorizenet.key);

const getBatchIds = (batch) => {
  return new Promise(resolve => {
    let retVal;
    const date = moment(batch.batchDate).format('YYYY-MM-DD');
    const firstSettlementDate = `${date}T00:00:00`;
    const lastSettlementDate = `${date}T23:59:59`;
    const createRequest = new ApiContracts.GetSettledBatchListRequest();
    createRequest.setMerchantAuthentication(merchantAuthenticationType);
    createRequest.setIncludeStatistics(true);
    createRequest.setFirstSettlementDate(firstSettlementDate);
    createRequest.setLastSettlementDate(lastSettlementDate);

    const ctrl = new ApiControllers.GetSettledBatchListController(createRequest.getJSON());
    ctrl.setEnvironment(SDKConstants.endpoint.production);
    ctrl.execute(() => {
      const apiResponse = ctrl.getResponse();
      const response = new ApiContracts.GetSettledBatchListResponse(apiResponse);
      if (
        response != null 
        && response.getMessages().getResultCode() == ApiContracts.MessageTypeEnum.OK
        && response.getBatchList() != null
      ) {
        const batchItems = response.getBatchList().getBatch();
        if (batchItems.length) {
          retVal = batchItems[0].getBatchId();
        }
      }

      resolve(retVal);
    });
  });
}

const getTransaction = (trans) => {
  return new Promise(resolve => {
    let retVal;
    const getRequest = new ApiContracts.GetTransactionDetailsRequest();
	  getRequest.setMerchantAuthentication(merchantAuthenticationType);
	  getRequest.setTransId(trans.transId);
	  const ctrl = new ApiControllers.GetTransactionDetailsController(getRequest.getJSON());
    ctrl.setEnvironment(SDKConstants.endpoint.production);
    ctrl.execute(() => {
      const apiResponse = ctrl.getResponse();
      const response = new ApiContracts.GetTransactionDetailsResponse(apiResponse);
      if (
        response != null 
        && response.getMessages().getResultCode() == ApiContracts.MessageTypeEnum.OK
      ) {
        retVal = response.getTransaction();
      }
      resolve(retVal);
    });
  });
}
const getTransactions = (batchId) => {
  var sql = "INSERT INTO batchesDownloaded SET ?",
        record = {'batchDate': batchId};
  return new Promise(resolve => {
    let retVal;
    const getRequest = new ApiContracts.GetTransactionListRequest();
    getRequest.setMerchantAuthentication(merchantAuthenticationType);
    getRequest.setBatchId(batchId);
    const ctrl = new ApiControllers.GetTransactionListController(getRequest.getJSON());
    ctrl.setEnvironment(SDKConstants.endpoint.production);
    ctrl.execute(() => {
      const apiResponse = ctrl.getResponse();
      const response = new ApiContracts.GetTransactionListResponse(apiResponse);
      if (
        response != null 
        && response.getMessages().getResultCode() == ApiContracts.MessageTypeEnum.OK
        && response.getTransactions() != null
      ) {
        const transactions = response.getTransactions().getTransaction();
        retVal = transactions;
        /*
        transactions.forEach(t => {
          retVal = transactions;
        })
        */
      }
      resolve(retVal);
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

  const existTransaction = await db('transactions')
    .where({
      transId: record.transId,
    })
    .catch(e => console.log('db', 'database error', e));
  if (existTransaction.length) {
    results = await db('transactions')
      .where({ id: existTransaction[0].id })
      .update(record)
      .then(
        data => db('transactions').where({ id: existTransaction[0].id }),
      )
      .catch(e => console.log('db', 'database error', e));
  } else {
    results = await db('transactions')
      .insert(record)
      .then(
        data => db('transactions').where({ id: data[0] }),
      )
      .catch(e => console.log('db', 'database error', e));
  }

  return results;
}

const getBatchDates = async () => {
  const dates = await db('onsiteAttendees')
    .select('createdAt as batchDate')
    .distinct()
    .orderBy('batchDate', 'ASC')
    .catch(e => console.log('db', 'database error', e));
  
  if (dates.length) {
    const batches = await map(dates, getBatchIds);
    const filtered = [...new Set(batches)].filter(r => typeof r !== 'undefined');
    // console.log(filtered);
    let transactions = await map(filtered, getTransactions);
    const filteredTrans = [];
    transactions.forEach(batch => {
      batch.forEach(t => {
        filteredTrans.push(t);
      })
    })
    // console.log(filteredTrans);
    const details = await map(filteredTrans, getTransaction);
    console.log(details);
    const results = await map(details, updateTransaction);
  }

  finish();
};

getBatchDates();
