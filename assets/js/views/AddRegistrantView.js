var AddRegistrantView = Backbone.View.extend({
    events: {
        "change #eventSelect"        :   "changeForm"
    },

    initialize: function(opts) {
        _.bindAll(this, 'render', 'okClicked', "changeForm", 'renderForm', 'renderEventSel');
        this.parent = opts.parent;
        this.bind("ok", this.okClicked);
        var search = (opts.eventId) ? {eventId: opts.eventId} : {reg_type: "general", member: 1};
        this.genEvent = App.Models.events.where(search)[0];
    },

    render: function() {
        var vars        = this.model.attributes,
            html        = Templates.addRegistrant(vars),
            view        = this;

        this.$el.html(html);
        this.renderForm();
        this.renderEventSel();
        return this;
    },

    renderForm: function() {
        this.form = new Backbone.Form({
            schema: this.genEvent.get('fields'),
            fieldsets: [{
                "fields": this.genEvent.get("fieldset")
            }]
        }).render();

        $(".addRegForm", this.$el).html(this.form.$el);
    },

    renderEventSel: function() {
        var eventSel = '<select data-width="450px" class="evSelectPicker" id="eventSelect">';
        _(App.Models.events.models).each(function(event) {
            eventSel += '<option value="'+event.get("eventId")+'">'+event.get("title")+'</option>';
        });
        eventSel += '</select><br />';
        $(".eventSelect", this.$el).html(eventSel);
        $('.evSelectPicker', this.$el).selectpicker();
    },

    unrender: function() {
        console.log('Kill: ', this.cid);

        this.trigger('close:all');
        this.unbind(); // Unbind all local event bindings
        //this.collection.unbind( 'change', this.render, this ); // Unbind reference to the model
        //this.collection.unbind( 'reset', this.render, this ); // Unbind reference to the model
        //this.options.parent.unbind( 'close:all', this.close, this ); // Unbind reference to the parent view

        this.remove(); // Remove view from DOM

        delete this.$el; // Delete the jQuery wrapped object variable
        delete this.el; // Delete the variable reference to this node
    },

    okClicked: function (modal) {
        this.model.set(this.form.getValue()); // runs schema validation
        this.model.set({
            "eventId": this.genEvent.get('eventId'),
            "slabId": this.genEvent.get('local_slabId')
        });
        this.model.save({}, {success: function(model, response, options) {
            App.Models.registrants.reset(model);
            App.Router.navigate("registrant/"+model.id, true);
        }});
    },

    changeForm: function(e) {
        var eventId = e.target.value,
            search = {eventId: eventId};
        this.genEvent = App.Models.events.where(search)[0];
        this.renderForm();
    }

});
