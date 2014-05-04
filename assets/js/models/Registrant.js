var Registrant = Backbone.SuperModel.extend({
  //urlRoot: '/api/registrant',
  idAttribute: "registrantId",
  urlRoot: "/api/registrant/",
  relations: {
    'linked': Registrant,
    'payments': Payment,
    'biller': Biller
  }
});
