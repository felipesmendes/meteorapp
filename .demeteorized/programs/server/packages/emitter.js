(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;

/* Package-scope variables */
var EventEmitter;

(function () {

///////////////////////////////////////////////////////////////////////
//                                                                   //
// packages/emitter/emitter.server.js                                //
//                                                                   //
///////////////////////////////////////////////////////////////////////
                                                                     //
EventEmitter = Npm.require('events').EventEmitter;                   // 1
///////////////////////////////////////////////////////////////////////

}).call(this);


/* Exports */
if (typeof Package === 'undefined') Package = {};
Package.emitter = {
  EventEmitter: EventEmitter
};

})();
