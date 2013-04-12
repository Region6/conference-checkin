var RegistrantsCollection = Backbone.Collection.extend({
    model: Registrant,
    urlRoot: '/api/registrants',
    initialize: function(models, opts) {
        opts = (typeof opts != 'undefined') ? opts : {};
        if ("term" in opts) {
            this.term = opts.term;
        }
        if ("category" in opts) {
            this.category = opts.category;
        }
        if ("page" in opts) {
            this.page = opts.page;
        }
    },

    url: function() {
        var url = '';
        if (this.term && this.category) {
            // pass ids as you would a multi-select so the server will parse them into
            // a list for you.  if it's rails you'd do: id[]=
            url = '/api/registrants/'+this.category+'/'+this.term+'/'+this.page;
            // clear out send_ids
            this.search = undefined;
        } else {
            url = '/api/registrants/all/all/1';
        }
        return url;
    },

    fetch: function(opts) {
        opts = (typeof opts != 'undefined') ? opts : {};
        if ("data" in opts) {
            if ("term" in opts.data) {
                this.term = opts.data.term;
            }
            if ("category" in opts.data) {
                this.category = opts.data.category;
            }
            if ("page" in opts.data) {
                this.page = opts.data.page;
            }
            opts.data = undefined;
        }
        return Backbone.Collection.prototype.fetch.call(this, opts);
    }
});
