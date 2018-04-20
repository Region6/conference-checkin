const ApiContracts = require('authorizenet').APIContracts;
const ApiControllers = require('authorizenet').APIControllers;
const SDKConstants = require('authorizenet').Constants;
const config = require('../config');

const getSettledBatchList = () => {
  return new Promise(resolve => {
    const merchantAuthenticationType = new ApiContracts.MerchantAuthenticationType();
    merchantAuthenticationType.setName(config.authorizenet.id);
    merchantAuthenticationType.setTransactionKey(config.authorizenet.key);

    const createRequest = new ApiContracts.GetSettledBatchListRequest();
    createRequest.setMerchantAuthentication(merchantAuthenticationType);
    createRequest.setIncludeStatistics(true);
    createRequest.setFirstSettlementDate('2018-04-01T16:00:00Z');
    createRequest.setLastSettlementDate('2018-04-30T16:00:00Z');

    console.log(JSON.stringify(createRequest.getJSON(), null, 2));
    const ctrl = new ApiControllers.GetSettledBatchListController(createRequest.getJSON());
    ctrl.setEnvironment(SDKConstants.endpoint.production);
    ctrl.execute(() => {
      const apiResponse = ctrl.getResponse();
      const response = new ApiContracts.GetSettledBatchListResponse(apiResponse);
      console.log(JSON.stringify(response, null, 2));
      if (response != null) {
        if (response.getMessages().getResultCode() == ApiContracts.MessageTypeEnum.OK) {
          console.log('Message Code : ' + response.getMessages().getMessage()[0].getCode());
          console.log('Message Text : ' + response.getMessages().getMessage()[0].getText());

          if (response.getBatchList() != null) {
            const batchItems = response.getBatchList().getBatch();
            batchItems.forEach(item => {
              console.log('Batch Id : ' + item.getBatchId());
              console.log('Settlement State : ' + item.getSettlementState());
              console.log('Payment Method : ' + item.getPaymentMethod());
              console.log('Product : ' + item.getProduct());
            });
          }
        } else {
          console.log('Result Code: ' + response.getMessages().getResultCode());
          console.log('Error Code: ' + response.getMessages().getMessage()[0].getCode());
          console.log('Error message: ' + response.getMessages().getMessage()[0].getText());
        }
      } else {
        console.log('Null Response.');
      }

      resolve(response);
    });
  });
}

const run = async () => {
  const results = await getSettledBatchList();
  console.log(results);
  console.log('getSettledBatchList call complete.');
}

run();