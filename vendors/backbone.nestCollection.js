function nestCollection(model, attributeName, nestedCollection) {
    //setup nested references
    for (var i = 0; i < nestedCollection.length; i++) {
        model.attributes[attributeName][i] = nestedCollection.at(i).attributes;
        var nc = nestedCollection.at(i);
        nc['parent'] = model;
    }
    //create empty arrays if none
    nestedCollection['parent'] = model;
    nestedCollection.bind('add', function (initiative) {
        if (!model.get(attributeName)) {
            model.attributes[attributeName] = [];
        }
        model.get(attributeName).push(initiative.attributes);
        initiative['parent'] = model;
    });

    nestedCollection.bind('remove', function (initiative) {
        var updateObj = {};
        updateObj[attributeName] = _.without(model.get(attributeName), initiative.attributes);
        model.set(updateObj);
    });

    nestedCollection.on('sync', function (newModel, resp, options)  {
        model.attributes[attributeName] = [];
        for (var i = 0; i < newModel.length; i++) {
            model.attributes[attributeName][i] = newModel.at(i).attributes;
            var nc = newModel.at(i);
            nc['parent'] = model;
        }
    });

    nestedCollection.on('reset', function (newModel, resp, options)  {
        model.attributes[attributeName] = [];
        for (var i = 0; i < newModel.length; i++) {
            model.attributes[attributeName][i] = newModel.at(i).attributes;
            var nc = newModel.at(i);
            nc['parent'] = model;
        }
    });

    nestedCollection.on("change", function (item) {
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

        _.each(item.changed, function(attr) {

        });


    });

    return nestedCollection;

}
