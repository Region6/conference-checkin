(function(_, Backbone) {
    _.extend(Backbone.Model.prototype, {
        get: function(key) {
            return _.reduce(key.split('.'), function(attr, key) {
                if (attr instanceof Backbone.Model)
                    return attr.attributes[key];

                if (typeof attr != "undefined")
                    return (key in attr) ? attr[key] : undefined;

                return undefined;
            }, this.attributes);
        },
        set: function(key, val, options) {
          var attr, attrs, unset, changes, silent, changing, prev, current;
          if (key == null) return this;

          var getVal = function(model, key) {
            return _.reduce(key.split('.'), function(model, key) {
                if (model instanceof Object)
                    return model[key];

                if (typeof model != "undefined")
                    return (key in model) ? model[key] : undefined;

                return undefined;
            }, model);
          }

          var setVal = function(model, keyPath, value) {
                // split keyPath into an array of keys
                var keys = keyPath.split('.');
                var key; // used in loop
                var isNumber = function(n) {
                  return !isNaN(parseFloat(n)) && isFinite(n);
                }
                // the current level of object we are drilling into.
                // Starts as the main root config object.
                var currentObj = model;

                // Loop through all keys in the key path, except the last one (note the -1).
                // This creates the object structure implied by the key path.
                // We want to do something different on the last iteration.
                for (var i=0; i < keys.length-1; i++) {

                  // Get the current key we are looping
                  key = keys[i];

                  // If the requested level on the current object doesn't exist,
                  // make a blank object.
                  if (typeof currentObj[key] === 'undefined') {
                    currentObj[key] = (isNumber(key)) ? [] : {};
                  }

                  // Set the current object to the next level of the keypath,
                  // allowing us to drill in.
                  currentObj = currentObj[key];
                }

                // Our loop doesn't handle the last key, because that's when we
                // want to set the actual value. So find the last key in the path.
                var lastKey = keys[keys.length-1]

                // Set the property of the deepest object to the value.
                currentObj[lastKey] = value;
          }

          var delVal = function(model, key) {
            return _.reduce(key.split('.'), function(model, key) {
                if (model instanceof Object)
                    return model[key];

                if (typeof model != "undefined")
                    return (key in model) ? delete model[key] : undefined;

                return undefined;
            }, model);
          }

          // Handle both `"key", value` and `{key: value}` -style arguments.
          if (typeof key === 'object') {
            attrs = key;
            options = val;
          } else {
            (attrs = {})[key] = val;
          }

          options || (options = {});

          // Run validation.
          if (!this._validate(attrs, options)) return false;

          // Extract attributes and options.
          unset           = options.unset;
          silent          = options.silent;
          changes         = [];
          changing        = this._changing;
          this._changing  = true;

          if (!changing) {
            this._previousAttributes = _.clone(this.attributes);
            this.changed = {};
          }
          current = this.attributes, prev = this._previousAttributes;

          // Check for changes of `id`.
          if (this.idAttribute in attrs) this.id = attrs[this.idAttribute];

          // For each `set` attribute, update or delete the current value.
          for (attr in attrs) {
            val = attrs[attr];
            if (!_.isEqual(getVal(current,attr), val)) changes.push(attr);
            if (!_.isEqual(getVal(prev,attr), val)) {
              this.changed[attr] = val;
            } else {
              delete this.changed[attr];
            }
            unset ? delVal(current, attr) : setVal(current, attr, val);
          }

          // Trigger all relevant attribute changes.
          if (!silent) {
            if (changes.length) this._pending = true;
            for (var i = 0, l = changes.length; i < l; i++) {
              this.trigger('change:' + changes[i], this, current[changes[i]], options);
            }
          }

          // You might be wondering why there's a `while` loop here. Changes can
          // be recursively nested within `"change"` events.
          if (changing) return this;
          if (!silent) {
            while (this._pending) {
              this._pending = false;
              this.trigger('change', this, options);
            }
          }
          this._pending = false;
          this._changing = false;
          return this;
        }
    });
})(window._, window.Backbone);
