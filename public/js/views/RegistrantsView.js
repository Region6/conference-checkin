var RegistrantsView = Backbone.View.extend({
    events: {

    },

    initialize: function() {
        _.bindAll(this, 'fetch', 'render', 'unrender', 'savedRegistrant', 'renderRow');

        this.collection = new Registrants();
        App.Models.registrants = this.collection;
        this.collection.on('reset', this.render, this); // Event listener on collection
        //this.collection.on("sync", this.render, this);
        Backbone.on("updateGrid", this.renderRow, this);

        //this.options.parent.on('close:all', this.unrender, this); // Event listener on parent

    },

    fetch: function(options) {
        this.search = false;
        if (typeof options != 'undefined') {
            this.search = true;
        }
        this.collection.fetch(options);
    },

    render: function() {
        var source = Templates.registrants,
            template = Handlebars.compile(source),
            self = this,
            HtmlCell = Backgrid.StringCell.extend({
                render: function () {
                    this.$el.html(this.model.get(this.column.get("name")));
                    return this;
                }
            }),
            columns = [
                {
                    name: "fields.infoField", // The key of the model attribute
                    label: " ", // The name to display in the header
                    editable: false, // By default every cell in a column is editable, but *ID* shouldn't be
                    // Defines a cell type, and ID is displayed as an integer without the ',' separating 1000s.
                    cell:  Backgrid.StringCell.extend({
                        render: function () {
                            this.$el.html(this.model.get(this.column.get("name")));
                            return this;
                        }
                    })
                },
                {
                    name: "registrantId",
                    label: "ID",
                    editable: false,
                    // The cell type can be a reference of a Backgrid.Cell subclass, any Backgrid.Cell subclass instances like *id* above, or a string
                    cell: "string" // This is converted to "StringCell" and a corresponding class in the Backgrid package namespace is looked up
                },
                {
                    name: "confirmation",
                    label: "Confirmation",
                    editable: false,
                    // The cell type can be a reference of a Backgrid.Cell subclass, any Backgrid.Cell subclass instances like *id* above, or a string
                    cell: "string" // This is converted to "StringCell" and a corresponding class in the Backgrid package namespace is looked up
                },
                {
                    name: "lastname",
                    label: "Last Name",
                    editable: false,
                    // The cell type can be a reference of a Backgrid.Cell subclass, any Backgrid.Cell subclass instances like *id* above, or a string
                    cell: "string" // This is converted to "StringCell" and a corresponding class in the Backgrid package namespace is looked up
                },
                {
                  name: "firstname",
                  label: "First Name",
                  editable: false,
                  cell: "string"
                },
                {
                  name: "company",
                  label: "Company",
                  editable: false,
                  cell: "string" // A cell type for floating point value, defaults to have a precision 2 decimal numbers
                },
                {
                    name: "fields.manageField", // The key of the model attribute
                    label: " ", // The name to display in the header
                    editable: false, // By default every cell in a column is editable, but *ID* shouldn't be
                    // Defines a cell type, and ID is displayed as an integer without the ',' separating 1000s.
                    cell:  Backgrid.StringCell.extend({
                        render: function () {
                            var model = this.model;
                            this.$el.html(this.model.get(this.column.get("name")));
                            $(".dropdown-menu", this.$el).click(function(e) {
                                Backbone.trigger("menuclicked", e, model, self);
                            });
                            return this;
                        }
                    })
                }
            ];
        Backbone.on("menuclicked", function (e, model, view) {
            var view = view;
            console.log(e, model);
            if (e.target.className == "printBadge") {
                $.getJSON("registrant/"+model.id+"/badge/print", function(data) {
                    console.log(data);
                });
            } else if (e.target.className == "downloadBadge") {
                window.open("registrant/"+model.id+"/badge/download", '_blank');
            } else if (e.target.className == "viewReceipt") {
                window.open("registrant/"+model.id+"/receipt/view", '_blank');
            } else if (e.target.className == "printReceipt") {
                $.getJSON("registrant/"+model.id+"/receipt/print", function(data) {
                    console.log(data);
                });
            } else if (e.target.className == "editRegistrant") {
                App.Router.navigate("registrant/"+model.id, true);
            } else if (e.target.className == "checkinRegistrant") {
                model.save({"attend": 1}, {patch: true, success: function(model, response) {
                    view.savedRegistrant(model, view);
                }});
            } else if (e.target.className == "checkoutRegistrant") {
                model.save({"attend": 0}, {patch: true, success: function(model, response) {
                    view.savedRegistrant(model, view);
                }});
            } else {
                App.Router.navigate("registrant/"+model.id, true);
            }
        });
        this.pageableGrid = new Backgrid.Grid({
            columns: columns,
            collection: this.collection,
            footer: Backgrid.Extension.Paginator.extend({

                // If you anticipate a large number of pages, you can adjust
                // the number of page handles to show. The sliding window
                // will automatically show the next set of page handles when
                // you click next at the end of a window.
                windowSize: 20, // Default is 10

                // If you anticipate a small number of pages, you can choose
                // to disable the rendering of fast forward handles to save
                // space.
                hasFastForward: true, // true is the default

                fastForwardHandleLabels: {
                  prev: "<",
                  next: ">"
                }
            })
        });
        this.$el.append(this.pageableGrid.render().$el);
        this.collection.initialize({ data: { category: 'all', term: 'all' }});
        this.collection.fetch();
        return this;
    },

    unrender: function() {
        console.log('Kill: ', this.cid);

        this.trigger('close:all');
        this.unbind(); // Unbind all local event bindings
        //this.collection.unbind( 'change', this.render, this ); // Unbind reference to the model
        this.collection.unbind( 'reset', this.render, this ); // Unbind reference to the model
        this.collection.unbind( 'fetch', this.render, this ); // Unbind reference to the model
        //this.options.parent.unbind( 'close:all', this.close, this ); // Unbind reference to the parent view
        Backbone.off("updateGrid");

        this.remove(); // Remove view from DOM

        delete this.$el; // Delete the jQuery wrapped object variable
        delete this.el; // Delete the variable reference to this node
    },

    savedRegistrant: function(model, view) {
        var view = view;
        model.fetch({success: function(model, response, options) {
            view.pageableGrid.body.rows[view.collection.indexOf(model)].render();
        }});
    },

    renderRow: function(model) {
        this.pageableGrid.body.rows[this.collection.indexOf(model)].render();
    }

});
