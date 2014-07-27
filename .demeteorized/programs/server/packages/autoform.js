(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var SimpleSchema = Package['simple-schema'].SimpleSchema;
var MongoObject = Package['simple-schema'].MongoObject;
var check = Package.check.check;
var Match = Package.check.Match;

(function () {

///////////////////////////////////////////////////////////////////////
//                                                                   //
// packages/autoform/autoform-common.js                              //
//                                                                   //
///////////////////////////////////////////////////////////////////////
                                                                     //
// Extend the schema options allowed by SimpleSchema                 // 1
SimpleSchema.extendOptions({                                         // 2
  autoform: Match.Optional(Object)                                   // 3
});                                                                  // 4
///////////////////////////////////////////////////////////////////////

}).call(this);


/* Exports */
if (typeof Package === 'undefined') Package = {};
Package.autoform = {};

})();
