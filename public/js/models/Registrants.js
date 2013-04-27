var Registrants = Backbone.PageableCollection.extend({
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
    },

    url: function() {
        var url = '';
        if (this.term && this.category) {
            // pass ids as you would a multi-select so the server will parse them into
            // a list for you.  if it's rails you'd do: id[]=
            url = '/api/registrants/'+this.category+'/'+this.term;
            // clear out send_ids
            this.search = undefined;
        } else {
            url = '/api/registrants/all/all';
        }
        return url;
    },

    // Any `state` or `queryParam` you override in a subclass will be merged with
    // the defaults in `Backbone.PageableCollection` 's prototype.
    state: {

        // You can use 0-based or 1-based indices, the default is 1-based.
        // You can set to 0-based by setting ``firstPage`` to 0.
        firstPage: 0,

        // Set this to the initial page index if different from `firstPage`. Can
        // also be 0-based or 1-based.
        currentPage: 0,

        // Required under server-mode
        totalRecords: null,
        pageSize: 10
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
            opts.data = undefined;
        }
        return Backbone.PageableCollection.prototype.fetch.call(this, opts);
    }
});
