/* global require */

/*  ==============================================================
    Include required packages
=============================================================== */

 var session = require('express-session'),
    cors = require('cors'),
    crypto = require('crypto'),
    bodyParser = require('body-parser'),
    methodOverride = require('method-override'),
    errorhandler = require('errorhandler'),
    cookieParser = require('cookie-parser'),
    favicon = require('serve-favicon'),
    compression = require('compression'),
    morgan = require('morgan'),
    fs = require('fs'),
    nconf = require('nconf'),
    path = require('path'),
    redis = require("redis"),
    url = require('url'),
    opts = {},
    configFile, config;

/*  ==============================================================
    Configuration
=============================================================== */

//used for session and password hashes
var salt = '20sdkfjk23';

fs.exists(__dirname + '/tmp', function (exists) {
  if (!exists) {
    fs.mkdir(__dirname + '/tmp', function (d) {
      console.log("temp directory created");
    });
  }
});

if (process.argv[2]) {
  if (fs.lstatSync(process.argv[2])) {
    configFile = require(process.argv[2]);
  } else {
    configFile = process.cwd() + '/config/settings.json';
  }
} else {
  configFile = process.cwd()+'/config/settings.json';
}

config = nconf
    .argv()
    .env("__")
    .file({ file: configFile });

if (config.get("log")) {
  var access_logfile = fs.createWriteStream(config.get("log"), {flags: 'a'});
}

if (config.get("ssl")) {
  if (config.get("ssl:key")) {
    opts.key = fs.readFileSync(config.get("ssl:key"));
  }

  if (config.get("ssl:cert")) {
    opts.cert = fs.readFileSync(config.get("ssl:cert"));
  }

  if (config.get("ssl:ca")) {
    opts.ca = [];
    config.get("ssl:ca").forEach(function (ca, index, array) {
        opts.ca.push(fs.readFileSync(ca));
    });
  }

  console.log("Express will listen: https");
}

if (config.get("salt")) {
  salt = config.get("salt");
} else {
  salt = crypto.randomBytes(16).toString('base64');
}

//Session Conf
if (config.get("redis")) {
  redisConfig = config.get("redis");
}

var redisClient = redis.createClient(redisConfig.port, redisConfig.host),
    RedisStore = require('connect-redis')(session),
    allowCrossDomain = function(req, res, next) {
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

var app = module.exports = require("sockpress").init(opts),
    router = app.express.Router(),
    apiRouter = app.express.Router();

// Express Configuration
var oneDay = 86400000;

app.use(compression());
/**
if ("log" in config) {
  app.use(app.express.logger({stream: access_logfile }));
}
**/
app.use(cookieParser());
//app.use(favicon(path.join(__dirname, 'assets','images','favicon.ico')));
app.use(app.express.static(__dirname + '/public'));     // set the static files location
app.use('/css', app.express.static(__dirname + '/public/css'));
app.use('/js', app.express.static(__dirname + '/public/js'));
app.use('/images', app.express.static(__dirname + '/public/images'));
app.use('/img', app.express.static(__dirname + '/public/images'));
app.use('/fonts', app.express.static(__dirname + '/public/fonts'));
app.use('/css/lib/fonts', app.express.static(__dirname + '/public/fonts'));
app.use('/assets', app.express.static(__dirname + '/assets'));
app.use('/lib', app.express.static(__dirname + '/lib'));
app.use('/bower_components', app.express.static(__dirname + '/bower_components'));
app.use(morgan('dev')); // log every request to the console
app.use(bodyParser.urlencoded({'extended':'true'})); // parse application/x-www-form-urlencoded
app.use(bodyParser.json()); // parse application/json
app.use(bodyParser.json({ type: 'application/vnd.api+json' })); // parse application/vnd.api+json as json
app.use(methodOverride('X-HTTP-Method-Override')); // override with the X-HTTP-Method-Override header in the request
app.use(cors());

var routes = require('./routes'),
    ioEvents = require('./ioEvents');

routes.setKey("configs", config);
routes.initialize();
ioEvents.initialize(config);

/*  ==============================================================
    Routes
=============================================================== */

//Standard Routes
router.get('/', routes.index);
app.use('/', router);

// API:Registrants
apiRouter.get('/registrants', routes.registrants);
apiRouter.get('/registrants/:id', routes.getRegistrant);
apiRouter.get('/download/checkedin', routes.downloadCheckedInAttendees);
apiRouter.put('/registrants/:id', routes.updateRegistrantValues);
apiRouter.post('/registrants', routes.addRegistrant);
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
apiRouter.get('/company', routes.findCompany);
apiRouter.get('/siteid', routes.findSiteId);
apiRouter.get('/voter/:voterId', routes.authVoter);
apiRouter.put('/voter/:voterId', routes.verifySiteId);
apiRouter.put('/voter/voter-type/:voterId', routes.addVoterType);
apiRouter.delete('/voter/:voterId', routes.logoutVoter);
apiRouter.put('/castVote/:id', routes.castVotes);
apiRouter.get('/offices', routes.offices);

app.use('/api', apiRouter);

/*  ==============================================================
    Socket.IO Routes
=============================================================== */

routes.setKey("io", app.io);
app.io.route('ready', ioEvents.connection);

/*  ==============================================================
    Launch the server
=============================================================== */
var port = (config.get("port")) ? config.get("port") : 3001;
app.listen(port);
