/* global require */

/*  ==============================================================
    Include required packages
=============================================================== */

const http = require('http');
const express = require('express');
const bearerToken = require('express-bearer-token');
const session = require('express-session');
const cors = require('cors');
const crypto = require('crypto');
const bodyParser = require('body-parser');
const methodOverride = require('method-override');
const errorhandler = require('errorhandler');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const morgan = require('morgan');
const fs = require('fs');
const nconf = require('nconf');
const path = require('path');
const redis = require("redis");
const url = require('url');

const config = require('./config');
let opts = {};

/*  ==============================================================
    Configuration
=============================================================== */

if (config.salt) {
  salt = config.salt;
} else {
  salt = crypto.randomBytes(16).toString('base64');
}

//Session Conf
if (config.redis) {
  redisConfig = config.redis;
}

const redisClient = redis.createClient(
  redisConfig.url+'/'+parseInt(redisConfig.db, 10),
  {
    retry_strategy: (options) => {
      console.log('redis retry');
      if (options.error && options.error.code === 'ECONNREFUSED') {
        // End reconnecting on a specific error and flush all commands with a individual error
        return new Error('The server refused the connection');
      }
      if (options.total_retry_time > 1000 * 60 * 60) {
        // End reconnecting after a specific timeout and flush all commands with a individual error
        return new Error('Retry time exhausted');
      }
      if (options.attempt > 1000) {
        // End reconnecting with built in error
        return undefined;
      }
      // reconnect after
      return Math.min(options.attempt * 100, 3000);
    }
  }
);
const RedisStore = require('connect-redis')(session);
const allowCrossDomain = (req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', '*');
  res.header('Access-Control-Allow-Headers', '*');

  // intercept OPTIONS method
  if ('OPTIONS' === req.method) {
    res.send(200);
  }
  else {
    next();
  }
};
opts.secret = salt;
opts.store = new RedisStore(redisConfig);
const app = express(opts);
const server = http.createServer(app);
//const app = module.exports = require("sockpress").init(opts);
const router = express.Router();
const apiRouter = express.Router();

// Express Configuration
const oneDay = 86400000;
app.use(require('express-domain-middleware'));
app.use(bearerToken());
app.use(compression());
/**
if ("log" in config) {
  app.use(app.express.logger({stream: access_logfile }));
}
**/
app.use(cookieParser());
app.use(express.static(__dirname + '/public'));     // set the static files location
app.use('/css', express.static(__dirname + '/public/css'));
app.use('/js', express.static(__dirname + '/public/js'));
app.use('/images', express.static(__dirname + '/public/images'));
app.use('/img', express.static(__dirname + '/public/images'));
app.use('/fonts', express.static(__dirname + '/public/fonts'));
app.use('/css/lib/fonts', express.static(__dirname + '/public/fonts'));
app.use('/assets', express.static(__dirname + '/assets'));
app.use('/lib', express.static(__dirname + '/lib'));
app.use('/bower_components', express.static(__dirname + '/bower_components'));
app.use(morgan('dev')); // log every request to the console
app.use(bodyParser.json({limit: '50mb'}));
app.use(bodyParser.urlencoded({limit: '50mb', extended: true}));
app.use(bodyParser.json({ type: 'application/vnd.api+json' })); // parse application/vnd.api+json as json
app.use(methodOverride('X-HTTP-Method-Override')); // override with the X-HTTP-Method-Override header in the request
app.use(cors());

const routes = require('./routes');

routes.setKey("configs", config);
routes.initialize();

/*  ==============================================================
    Routes
=============================================================== */

//Standard Routes
router.get('/', routes.index);
app.use('/', router);

//Check Bearer Token
apiRouter.use((req, res, next) => {
  const token = req.token;

  if (token === config.authToken) {
    next();
  } else {
    res.status(403).json({
      success: false,
      message: 'Failed to authenticate token.'
    });
  }
});

// API:Registrants
apiRouter.get('/registrants', routes.registrants);
apiRouter.get('/registrants/:id', routes.getRegistrant);
apiRouter.get('/download/checkedin', routes.downloadCheckedInAttendees);
apiRouter.put('/registrants/:id', routes.updateRegistrant);
apiRouter.post('/registrants', routes.addRegistrant);
apiRouter.post('/search', routes.searchRegistrants);
apiRouter.patch('/registrants/:id', routes.updateRegistrant);
apiRouter.get('/fields/:type', routes.getFields);
apiRouter.get('/exhibitors/companies', routes.getExhibitorCompanies);

// Generate Badge
apiRouter.get('/registrants/:id/badge/:action', routes.genBadge);

// Generate Receipt
apiRouter.get('/registrants/:id/receipt/:action', routes.genReceipt);

//API:Events
apiRouter.get('/events', routes.getEvents);
apiRouter.get('/events/:id/fields', routes.getEventFields);
apiRouter.get('/events/onsite', routes.getOnsiteEvents);

apiRouter.post('/payment', routes.makePayment);
apiRouter.get('/getNumberCheckedIn', routes.getNumberCheckedIn);
apiRouter.post('/company/:query', routes.findCompany);
apiRouter.get('/siteid', routes.findSiteId);
apiRouter.get('/siteids', routes.getSiteIds);
apiRouter.get('/votingSite/:query', routes.findVotingSites);
apiRouter.get('/votingSites', routes.getVotingSites);
apiRouter.get('/votingSiteId', routes.findVotingSiteId);
apiRouter.get('/voter/:voterId', routes.authVoter);
apiRouter.get('/voter/:voterId/pin/:pin', routes.verifyVoterPin);
apiRouter.get('/site/:siteId', routes.verifySiteId);
apiRouter.put('/voter/voter-type/:voterId', routes.addVoterType);
apiRouter.delete('/voter/:voterId', routes.logoutVoter);
apiRouter.post('/castVote', routes.castVotes);
apiRouter.get('/offices', routes.offices);

app.use('/api', apiRouter);

app.use((err, req, res, next) => {
  console.log('error on request %d %s %s', process.domain.id, req.method, req.url);
  console.log(err.stack);
  res.send(500, "Something bad happened. :(");
  if (err.domain) {
    //you should think about gracefully stopping & respawning your server
    //since an unhandled error might put your application into an unknown state
    process.exit(0);
  }
});


/*  ==============================================================
    Launch the server
=============================================================== */
const port = (config.port) ? config.port : 3001;
server.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});

