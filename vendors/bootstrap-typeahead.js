Typeahead = Backbone.View.extend({
    tagName: 'input',
    attributes: {"data-provide": "typeahead", "type": "text"},
    initialize: function(options){
        this.property = this.options.property;
        this.keyValue = this.options.keyValue;
    },
    render: function() {
        this.$el.typeahead({
            source: this.collection.models,
            property: this.property,
            keyValue: this.keyValue,
            matcher: function(model) {
                if(_.isEmpty(this.query)) return [];
                for(var key in model.attributes){
                    if(~model.get(key).toLowerCase().indexOf(this.query.toLowerCase())) return true;
                }
                return false;
            },
            sorter: function(items) {
                var beginswith = []
                , caseSensitive = []
                , caseInsensitive = []
                , item

                while (item = items.shift()) {
                    if (!item.get(this.options.property).toLowerCase().indexOf(this.query.toLowerCase())) beginswith.push(item);
                    else if (~item.get(this.options.property).indexOf(this.query)) caseSensitive.push(item)
                    else caseInsensitive.push(item)
                }

                return beginswith.concat(caseSensitive, caseInsensitive)
            },
            highlighter: function(item){
                var query = this.query.replace(/[\-\[\]{}()*+?.,\\\^$|#\s]/g, '\\$&')
                return item.get(this.options.property).replace(new RegExp('(' + query + ')', 'ig'), function ($1, match) {
                    return '<strong>' + match + '</strong>'
                })
            },
            getValue: function(item) {
                return item.get(this.options.keyValue)
            },
            updater: function(item) {
                var selected = _.find(this.source, function (model){
                    if(~model.get(this.options.keyValue).indexOf(item)) return true; return false;
                }, this)
                return selected.get(this.options.property)
            }
        });
        return this;
    }
});
