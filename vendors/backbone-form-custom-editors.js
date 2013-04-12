var editors = Backbone.Form.editors;

// like 'Select' editor, but will always return a boolean (true or false)
editors.BooleanSelect = editors.Select.extend({
    initialize: function(options) {
        options.schema.options = [
            { val: '1', label: 'Yes' },
            { val: '', label: 'No' }
        ];
        editors.Select.prototype.initialize.call(this, options);
    },
    getValue: function() {
        return !!editors.Select.prototype.getValue.call(this);
    },
    setValue: function(value) {
        value = value ? '1' : '';
        editors.Select.prototype.setValue.call(this, value);
    }
});

// like the 'Select' editor, except will always return a number (int or float)
editors.NumberSelect = editors.Select.extend({
    getValue: function() {
        return parseFloat(editors.Select.prototype.getValue.call(this));
    },
    setValue: function(value) {
        editors.Select.prototype.setValue.call(this, parseFloat(value));
    }
});

// https://github.com/eternicode/bootstrap-datepicker/
editors.DatePicker = editors.Text.extend({
    initialize: function(options) {
        editors.Text.prototype.initialize.call(this, options);
        this.$el.addClass('datepicker-input');
    },

    getValue: function() {
        var value = this.$el.val();
        if (value) {
            return moment(value, 'MM/DD/YYYY').format();
        } else {
            return '';
        }
    },

    setValue: function(value) {
        if (value) {
            var formatted = moment(value).utc().format('MM/DD/YYYY');
            this.$el.val(formatted);
        } else {
            this.$el.val('');
        }
    },

    render: function() {
        editors.Text.prototype.render.apply(this, arguments);
        this.$el.datepicker({
            autoclose: true
        });
        return this;
    }
});

// https://github.com/jonthornton/jquery-timepicker
editors.TimePicker = editors.Text.extend({
    initialize: function(options) {
        editors.Text.prototype.initialize.call(this, options);
        this.$el.addClass('timepicker-input');
    },

    render: function() {
        editors.Text.prototype.render.apply(this, arguments);
        this.$el.timepicker({
            minTime: this.options.schema.minTime,
            maxTime: this.options.schema.maxTime
        });
        return this;
    },

    setValue: function(value) {
        if (!value) value = '';
        this.value = value;
        var ret = editors.Text.prototype.setValue.apply(this, arguments);
        return ret;
    }
});

// Show both a date and time field
// https://github.com/eternicode/bootstrap-datepicker/
// https://github.com/jonthornton/jquery-timepicker
editors.DateTimePicker = editors.Base.extend({
    events: {
        'changeDate': 'updateHidden',
        'changeTime': 'updateHidden',
        'input input': 'updateHidden' // so that clearing time works
    },
    initialize: function(options) {
        options = options || {};
        editors.Base.prototype.initialize.call(this, options);

        // Option defaults
        this.options = _.extend({
            DateEditor: editors.DatePicker,
            TimeEditor: editors.TimePicker
        }, options);

        // Schema defaults
        this.schema = _.extend({
            minsInterval: 15,
            minTime: '4:00am',
            maxTime: '11:00pm'
        }, options.schema || {});

        this.dateEditor = new this.options.DateEditor(options);
        this.dateEditor.$el.removeAttr('name');

        var timeOptions = _(options).clone();
        timeOptions.schema = _(this.schema).clone();
        timeOptions.schema.editorAttrs.placeholder = 'Any time';
        timeOptions.model = null;
        this.timeEditor = new this.options.TimeEditor(timeOptions);
        this.timeEditor.$el.removeAttr('name');

        this.$hidden = $('<input>', { type: 'hidden', name: options.key });

        this.value = this.dateEditor.value;
        this.setValue(this.value);
    },

    getValue: function() {
        return this.$hidden.val();
    },

    parseTimeValue: function(value) {
        return time;
    },

    setValue: function(value) {
        this.dateEditor.setValue(value);
        // pull the time portion of an ISO formatted string
        var time = '';
        if (_.isString(value) && value.indexOf('T') !== -1) {
            var m = moment(value);
            time = m ? m.format('h:mma') : '';
        }
        this.timeEditor.setValue(time);
    },

    updateHidden: function() {
        // update the hidden input with the value we want the server to see
        // if a date and time were chosen, include ISO formatted datetime with TZ offset
        // if no time was chosen, include only the date
        var date = moment(this.dateEditor.getValue());
        var time = this.timeEditor.getValue() ? this.timeEditor.$el.timepicker('getTime') : null;
        if (date && time) {
            date.hours(time.getHours());
            date.minutes(time.getMinutes());
        }
        var value = date ? date.format() : '';
        if (value && !time) {
            value = value.substr(0, value.indexOf('T'));
        }
        this.$hidden.val(value);
    },

    render: function() {
        editors.Base.prototype.render.apply(this, arguments);

        this.$el.append(this.dateEditor.render().el);
        this.$el.append(this.timeEditor.render().el);
        this.updateHidden();
        this.$el.append(this.$hidden);
        return this;
    }
});

editors.Range = editors.Text.extend({
    events: _.extend({}, editors.Text.prototype.events, {
        'change': function(event) {
            this.trigger('change', this);
        }
    }),

    initialize: function(options) {
      editors.Text.prototype.initialize.call(this, options);

      this.$el.attr('type', 'range');

      if (this.schema.appendToLabel) {
          this.updateLabel();
          this.on('change', this.updateLabel, this);
      }
    },
    getValue: function() {
        var val = editors.Text.prototype.getValue.call(this);
        return parseInt(val, 10);
    },

    updateLabel: function() {
        _(_(function() {
            var $label = this.$el.parents('.bbf-field').find('label');
            $label.text(this.schema.title + ': ' + this.getValue() + (this.schema.valueSuffix || ''));
        }).bind(this)).defer();
    }
});
