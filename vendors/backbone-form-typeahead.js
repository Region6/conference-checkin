/**
 * Select2
 *
 * Renders Select2 - jQuery based replacement for select boxes
 *
 * Simply pass a 'config' object on your schema, with any options to pass into Select2.
 * See http://ivaynberg.github.com/select2/#documentation
 */

Backbone.Form.editors.Select2 = Backbone.Form.editors.Base.extend({

  /**
   * @param {Object} options.schema.config    Options to pass to select2. See http://ivaynberg.github.com/select2/#documentation
   */
  initialize: function(options) {
    Backbone.Form.editors.Base.prototype.initialize.call(this, options);

    var schema = this.schema;
    this.config = schema.config || {};
    this.config.ajax = this.config.ajax || {
        url: this.config.url,
        dataType: 'json',
        data: function (term, page) {
            return {
                search: term, // search term
                page_limit: 10
            };
        },
        results: function (data, page) { // parse the results into the format expected by Select2.
            // since we are using custom formatting functions we do not need to alter remote JSON data
            return {results: data};
        }
    };

    this.config.formatResult = this.config.formatResult || function (result) {
        return result.tamuedupersonofficialname + ", " + result.mail + " - " +  result.tamuedupersonprimarymembername;
    };

    this.config.formatSelection = this.config.formatSelection || function (result) {
        return result.tamuedupersonofficialname;
    };

    this.config.id = this.config.id || function (result) {
        return result.tamuedupersonuin;
    };

  },

  events: {
      'change': function(event) {
        this.trigger('change', this);
      },
      'focus':  function(event) {
        this.trigger('focus', this);
      },
      'blur':   function(event) {
        this.trigger('blur', this);
      }
  },

  render: function() {
    var self = this;

    setTimeout(function() {
      self.$el.select2(self.config);
    }, 0);

    return this;
  },

  getValue: function() {
    return this.$el.val();
  },

  setValue: function(val) {
    this.$el.val(val);
  }

});
