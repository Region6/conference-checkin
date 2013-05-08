var App = {

    initialize: function() {
        _.bindAll(this, "ioEvent", "fetchCheckedIn");

        //Initialize Socket.IO
        this.Io = io.connect();
        // Listen for the talk event.
        this.Io.on('talk', this.ioEvent);

        //If Backbone sync gets an unauthorized header, it means the user's
        //session has expired, so send them back to the homepage
        var sync = Backbone.sync;
        Backbone.sync = function(method, model, options) {
            options.error = function(xhr, ajaxOptions, thrownError) {
                if (xhr.status == 401) {
                    window.location = '/';
                }
            }
            sync(method, model, options);
        };
        this.fetchCheckedIn();
        this.Models = {};
        this.Router = new Router();
        Backbone.history.start({pushState: true});
        this.Models.events = new Events();
        this.Models.events.fetch();
        var self = this;

    },

    ioEvent: function(data) {
        console.log(data);

        if (App.uid != data.uid) {
            if (data.objectType == "registrant") {
                var model = App.Models.registrants.get(parseInt(data.objectId));
                if (model) {
                    if ("fetch" in model) {
                        model.fetch({success: function(model, response, options){
                            Backbone.trigger("updateGrid", model);
                        }});
                    } else {
                        console.log("missing model:", data.objectId);
                    }
                } else {
                    console.log("missing model:", data.objectId);
                }

                //this.Models.registrants.unshift(data);
            } else if (data.objectType == "updates") {
                if (data.modType == "checkedIn") {
                    $(".checkedInNumber").text(data.objectId);
                }
            }
        }
        /*
        if (data.type == "review-submitted") {
            var message = data.doc.versions[0].personnel[0].uinName + " was submitted for review.";
            $('.top-right').notify({ message: { text: message }, type: 'bangTidy', fadeOut: { enabled: true, delay: 8000 } }).show();
        }
        */

    },

    fetchCheckedIn: function() {
        $.getJSON('/api/getNumberCheckedIn', function(data) {
            $(".checkedInNumber").text(data.checkedIn);
        });
    }

};

//  format an ISO date using Moment.js
//  http://momentjs.com/
//  moment syntax example: moment(Date("2011-07-18T15:50:52")).format("MMMM YYYY")
//  usage: {{dateFormat creation_date format="MMMM YYYY"}}
Handlebars.registerHelper('dateFormat', function(context, block) {
  if (window.moment && context != null) {
    var f = block.hash.format || "MMM Do, YYYY";
    //return moment(context.replace("Z","")).format(f);
    return moment(context).format(f);
  }else{
    return context;   //  moment plugin not available. return data as is.
  };
});

// usage: {{fromNow date}}
Handlebars.registerHelper('fromNow', function(date) {
    return moment(date).fromNow();
});


// Comparison Helper for handlebars.js
// Pass in two values that you want and specify what the operator should be
// e.g. {{#compare val1 val2 operator="=="}}{{/compare}}

Handlebars.registerHelper('compare', function(lvalue, rvalue, options) {

    if (arguments.length < 3)
        throw new Error("Handlerbars Helper 'compare' needs 2 parameters");

    operator = options.hash.operator || "==";

    var operators = {
        '==':       function(l,r) { return l == r; },
        '===':      function(l,r) { return l === r; },
        '!=':       function(l,r) { return l != r; },
        '<':        function(l,r) { return l < r; },
        '>':        function(l,r) { return l > r; },
        '<=':       function(l,r) { return l <= r; },
        '>=':       function(l,r) { return l >= r; },
        'typeof':   function(l,r) { return typeof l == r; }
    }

    if (!operators[operator])
        throw new Error("Handlerbars Helper 'compare' doesn't know the operator "+operator);

    var result = operators[operator](lvalue,rvalue);

    if( result ) {
        return options.fn(this);
    } else {
        return options.inverse(this);
    }
});

Handlebars.registerHelper('iter', function(context, options) {
    var fn = options.fn, inverse = options.inverse;
    var ret = "";

    if(context && context.length > 0) {
        for(var i=0, j=context.length; i<j; i++) {
            ret = ret + fn(_.extend({}, context[i], { i: i, iPlus1: i + 1 }));
        }
    } else {
        ret = inverse(this);
    }
    return ret;
});

function isNumber(n) {
    return !isNaN(parseFloat(n)) && isFinite(n);
}
