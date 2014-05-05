var RegistrantsView = Backbone.View.extend({
    events: {

    },

    initialize: function() {
        _.bindAll(this, 'fetch', 'render', 'unrender', 'savedRegistrant', 'renderRow');

        this.collection = new Registrants();
        App.Models.registrants = this.collection;
        //this.collection.on('reset', this.render, this); // Event listener on collection
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
        var template = Templates.registrants(),
            view = this,
            HtmlCell = Backgrid.StringCell.extend({
                render: function () {
                    this.$el.html(this.model.get(this.column.get("name")));
                    return this;
                }
            }),
            columns = [
                {
                    name: "fields.infoField", // The key of the model attribute
                    label: "Status", // The name to display in the header
                    editable: false, // By default every cell in a column is editable, but *ID* shouldn't be
                    // Defines a cell type, and ID is displayed as an integer without the ',' separating 1000s.
                    cell:  Backgrid.StringCell.extend({
                        render: function () {
                            //this.$el.empty();
                            var values = {
                                    "attend": this.model.get("attend"),
                                    "paid": this.model.get("paid")
                                },
                                html = Templates.infoField(values);
                            this.$el.html(html);
                            //this.delegateEvents();
                            return this;
                        }
                    })
                },
                {
                    name: "displayId",
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
                    name: "action",
                    label: "",
                    editable: false,
                    cell: Backgrid.Cell.extend({
                        events: {
                          "dblclick":               "edit",
                          "click .printBadge":      "printBadge",
                          "click .downloadBadge":   "downloadBadge",
                          "click .viewReceipt":     "viewReceipt",
                          "click .printReceipt":    "printReceipt",
                          "click .editRegistrant":  "editRegistrant",
                          "click .checkinRegistrant":  "checkinRegistrant",
                          "click .checkoutRegistrant": "checkoutRegistrant"
                        },
                        // Copy/paste Backgrid's render in here
                        render: function () {
                            //this.$el.children().detach();
                            var values = {
                                    "attend": this.model.get("attend"),
                                    "paid": this.model.get("paid")
                                },
                                html = Templates.documentDropdown(values);
                            this.$el.html(html);
                            this.delegateEvents();
                            return this;
                        },

                        printBadge: function(e) {
                            e.preventDefault();
                            $.getJSON("registrant/"+this.model.id+"/badge/print", function(data) {
                                console.log(data);
                            });
                        },

                        downloadBadge: function(e) {
                            e.preventDefault();
                            window.open("registrant/"+this.model.id+"/badge/download", '_blank');
                        },

                        viewReceipt: function(e) {
                            e.preventDefault();
                            window.open("registrant/"+this.model.id+"/receipt/view", '_blank');
                        },

                        printReceipt: function(e) {
                            e.preventDefault();
                            $.getJSON("registrant/"+this.model.id+"/receipt/print", function(data) {
                                console.log(data);
                            });
                        },

                        editRegistrant: function(e) {
                            e.preventDefault();
                            App.Router.navigate("registrant/"+this.model.id, true);
                        },

                        checkinRegistrant: function(e) {
                            e.preventDefault();
                            this.model.save({'fields': {"attend": true}}, {patch: true, success: function(model, response) {
                                view.renderRow(model, view);
                            }});
                        },

                        checkoutRegistrant: function(e) {
                            e.preventDefault();
                            this.model.save({'fields': {"attend": false}}, {patch: true, success: function(model, response) {
                                view.renderRow(model, view);
                            }});
                        }


                    })
                }
            ];
        Backbone.on("menuclicked", function (e, model, view) {
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
                model.save({'fields': {"attend": true}}, {patch: true, success: function(model, response) {
                    view.savedRegistrant(model, view);
                }});
            } else if (e.target.className == "checkoutRegistrant") {
                model.save({'fields': {"attend": false}}, {patch: true, success: function(model, response) {
                    view.savedRegistrant(model, view);
                }});
            } else {
                App.Router.navigate("registrant/"+model.id, true);
            }
        });
        this.pageableGrid = new Backgrid.Grid({
            columns: columns,
            collection: this.collection
        });

        this.paginator = new Backgrid.Extension.Paginator({

          // If you anticipate a large number of pages, you can adjust
          // the number of page handles to show. The sliding window
          // will automatically show the next set of page handles when
          // you click next at the end of a window.
          windowSize: 10, // Default is 10

          // Used to multiple windowSize to yield a number of pages to slide,
          // in the case the number is 5
          slideScale: 0.5, // Default is 0.5

          // Whether sorting should go back to the first page
          goBackFirstOnSort: true, // Default is true

          collection: this.collection
        });

        this.$el.append(this.pageableGrid.render().$el);
        this.$el.append(this.paginator.render().el);
        this.collection.initialize({ data: { category: 'all', term: 'all' }});
        this.collection.fetch({
            success: function() {

            }
        });
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
        model.fetch({success: function(model, response, options) {
            view.pageableGrid.body.rows[view.collection.indexOf(model)].render();
        }});
    },

    renderRow: function(model, view) {
        view.pageableGrid.body.rows[this.collection.indexOf(model)].render();
    }

});
