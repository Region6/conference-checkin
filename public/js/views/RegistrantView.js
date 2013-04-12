var RegistrantView = Backbone.View.extend({
    tagName: 'tr',
    events: {
      "dblclick":                   "edit",
      "click .edit":                "edit",
      "click .review":              "review",
      "click .delete":              "del",
      "click .tag":                 "filter",
      "click .dialog-primary":      "closeDialog",
      "click .versions":            "displayDocVersions"
    },

    initialize: function() {
        _.bindAll(this, 'render', 'edit', 'del', 'filter', 'closeDialog', 'displayDocVersions', 'renderDocVersions');
        this.model.bind('change', this.render);
        $(this.el).addClass('registrant');
    },

    render: function() {
        var source = Templates.registrant,
            template = Handlebars.compile(source),
            vars = {};
        _.extend(vars, this.model.attributes);
        var html = template(vars);
        $(this.el).html(html);
    },

    edit: function(e) {
        e.preventDefault();
        App.currentDoc = this.model;
        App.router.navigate();
        App.router.navigate('document/' + this.model.attributes._id, true);
    },

    review: function(e) {
        e.preventDefault();
        App.currentDoc = this.model;
        App.router.navigate();
        App.router.navigate('review/' + this.model.attributes._id, true);
    },

    del: function(e) {
        e.preventDefault();
        //var del = confirm('Are you sure you want to delete this document?');

        var source = Templates.dialog;
        var template = Handlebars.compile(source);
        var vars = {
            "header": "Confirm Delete",
            "body": "Are you sure you want to delete this document?",
            "primaryButton": "Delete"
        };
        var html = template(vars);
        $(this.el).append(html);
        this.dialogType = "delete";
        $('#dialog').modal("show");

    },

    filter: function(e) {
        e.preventDefault();
        var tag = $(e.target).html();
        App.router.navigate('tag/' + tag, true);
    },

    closeDialog: function(e) {

        e.preventDefault();
        var test = e;
        $('#dialog').modal("hide").remove();

        if (this.dialogType == "delete") {
            App.router.view.body.collection.remove(this.model);
            this.model.destroy();
            $(this.el).remove();
            $(App.router.view.body.el).masonry('reload');
        }

        this.dialogType = null;
    },

    displayDocVersions: function(e, options) {

        e.preventDefault();

        this.versions = new DocumentVersionsCollection([], {id: this.model.id, model:Version});
        this.versions.bind('reset', this.renderDocVersions, this);
        this.versions.bind('add', this.renderDocVersions, this);
        this.versions.fetch();
    },

    renderDocVersions: function(e) {

        //e.preventDefault();
        new VersionsView({ collection: this.versions }).render();

    }

});
