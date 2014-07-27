(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var _ = Package.underscore._;

(function () {

//////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                  //
// packages/collection-helpers/collection-helpers.js                                                //
//                                                                                                  //
//////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                    //
var Document = {};                                                                                  // 1
Meteor.Collection.prototype.helpers = function(helpers) {                                           // 2
  var self = this;                                                                                  // 3
  if (! Document[self._name]) Document[self._name] = function(doc) { return _.extend(this, doc); }; // 4
  if (! self._transform) self._transform = function(doc) { return new Document[self._name](doc); }; // 5
  _.each(helpers, function(helper, key) {                                                           // 6
    Document[self._name].prototype[key] = helper;                                                   // 7
  });                                                                                               // 8
};                                                                                                  // 9
                                                                                                    // 10
//////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);


/* Exports */
if (typeof Package === 'undefined') Package = {};
Package['collection-helpers'] = {};

})();
