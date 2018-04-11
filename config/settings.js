const path = require('path');
// Main server/app configuration
module.exports = {
  mysql: {
    host     : 'localhost',
    username : 'checkin',
    password : 'L3GqF25LtPrESaJC',
    database : 'checkin',
    multipleStatements: true
  },
  redis: {
    url: "redis://test:JSSJncNkt3jWR2mvn7nk92XiMX6owosDVghZFW5OiL4aG3OdStSOZoHGr3zdLbGgAtj90ZgeXXlUwkAdhgoRvJh4eTjFKzlH4eybO2zFriny584HDAKOtdkDz0Nn3Iat@abrender.8xmedia.com:6379",
    url2: "redis://JSSJncNkt3jWR2mvn7nk92XiMX6owosDVghZFW5OiL4aG3OdStSOZoHGr3zdLbGgAtj90ZgeXXlUwkAdhgoRvJh4eTjFKzlH4eybO2zFriny584HDAKOtdkDz0Nn3Iat@abrender.8xmedia.com:6379",
    host: "localhost",
    port: "6379",
    password: null,
    ttl: 43200,
    db: 0
  },
  authorizenet: {
    id:  "6Byf2f5THtr",
    key: "6422pPETW5sv8VYB",
    sandbox: false
  },
  backup: {
    id:  "64UhjakS7g", 
    key: "938Bs7La64UtbRFD", 
    sandbox: true
  },
  id: "73cf6c9a-2507-11e7-a9e0-c3691fb37801",
  port: 3001,
  salt: "2315e798-1e09-11e7-bcd8-23e16d1fd1d3",
}
