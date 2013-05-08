var DashboardView = Backbone.View.extend({
    events: {
        "click .search"             :   "search",
        "click .clear"              :   "clearSearch",
        "click .addNewRegistrant"   :   "addNewRegistrant",
        "keypress #searchText"      :   "searchOnEnter"
    },

    initialize: function() {
        _.bindAll(this, 'fetch', 'render', 'unrender', "addDocument", "search", "searchOnEnter", "addNewRegistrant", "clearSearch");

        this.registrantsView = new RegistrantsView({parent: this});
        //this.timelineView = new TimelineView({parent: this});

    },

    fetch: function(options) {

    },

    assign : function (view, selector) {
        view.setElement(this.$(selector)).render();
    },

    render: function() {
        var source = Templates.dashboard,
            template = Handlebars.compile(source),
            html = template(),
            view = this;

        this.$el.html(html);
        $('#app').append(this.el);
        //this.timelineView.fetch();
        //$("#timelineHolder", this.$el).append(this.timelineView.el);
        //this.registrantsView.fetch();
        $("#regTable", this.$el).append(this.registrantsView.render().$el);
        $('.selectpicker', this.$el).selectpicker();
        $('#searchText', this.$el).focus();
        return this;

    },

    addNewRegistrant: function(e) {
        var newReg = new Registrant();
            view = new AddRegistrantView({parent: this, model:newReg});
        this.addRegModal = new Backbone.BootstrapModal({ title: 'Add Registrant', content: view });
        this.addRegModal.open();

    },

    search: function(e) {
        e.preventDefault();
        var term = $("#searchText", this.$el).val(),
            category = $("#category", this.$el).val();
        App.Models.registrants.state.currentPage = 0;
        if (term.indexOf("|") != -1) {
            term = term.split("|")[0];
            category = "registrantid";
        }
        App.Models.registrants.fetch({ data: { category: category, term: term } });
    },

    searchOnEnter: function(e) {
        if (e.keyCode != 13) return;
        this.search(e);
    },

    clearSearch: function(e) {
        $("#searchText", this.$el).val("");
    },

    unrender: function () {

        console.log('Kill: ', this.cid);

        this.trigger('close:all');
        this.unbind(); // Unbind all local event bindings
        //this.model.unbind( 'change', this.render, this ); // Unbind reference to the model
        //this.options.parent.unbind( 'close:all', this.close, this ); // Unbind reference to the parent view

        this.remove(); // Remove view from DOM

        delete this.$el; // Delete the jQuery wrapped object variable
        delete this.el; // Delete the variable reference to this node

    },

    addDocument: function(e) {
        var action = "project";
        if (e.srcElement.attributes["data-id"].value == "project") {
            action = "project";
        } else if (e.srcElement.attributes["data-id"].value == "item") {
            action = "item";
        } else {
            action = e.srcElement.attributes["data-id"].value;
        }
        App.router.navigate("add/document/"+action, true);
    }

});
