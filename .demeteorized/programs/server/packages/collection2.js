(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var SimpleSchema = Package['simple-schema'].SimpleSchema;
var MongoObject = Package['simple-schema'].MongoObject;
var _ = Package.underscore._;
var Deps = Package.deps.Deps;
var check = Package.check.check;
var Match = Package.check.Match;
var MongoInternals = Package['mongo-livedata'].MongoInternals;
var EJSON = Package.ejson.EJSON;

(function () {

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                    //
// packages/collection2/collection2.js                                                                                //
//                                                                                                                    //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                      //
// Extend the schema options allowed by SimpleSchema                                                                  // 1
SimpleSchema.extendOptions({                                                                                          // 2
  index: Match.Optional(Match.OneOf(Number, String, Boolean)),                                                        // 3
  unique: Match.Optional(Boolean),                                                                                    // 4
  denyInsert: Match.Optional(Boolean),                                                                                // 5
  denyUpdate: Match.Optional(Boolean)                                                                                 // 6
});                                                                                                                   // 7
                                                                                                                      // 8
// Define some extra validation error messages                                                                        // 9
SimpleSchema.messages({                                                                                               // 10
  notUnique: "[label] must be unique",                                                                                // 11
  insertNotAllowed: "[label] cannot be set during an insert",                                                         // 12
  updateNotAllowed: "[label] cannot be set during an update"                                                          // 13
});                                                                                                                   // 14
                                                                                                                      // 15
/*                                                                                                                    // 16
 * Public API                                                                                                         // 17
 */                                                                                                                   // 18
                                                                                                                      // 19
var constructor = Meteor.Collection;                                                                                  // 20
Meteor.Collection = function c2CollectionConstructor(name, options) {                                                 // 21
  var self = this, ss;                                                                                                // 22
  options = options || {};                                                                                            // 23
                                                                                                                      // 24
  if (options.schema) {                                                                                               // 25
    ss = options.schema;                                                                                              // 26
    delete options.schema;                                                                                            // 27
  }                                                                                                                   // 28
                                                                                                                      // 29
  if (options.virtualFields) {                                                                                        // 30
    throw new Error('Collection2: Sorry, the virtualFields option is no longer supported.');                          // 31
  }                                                                                                                   // 32
                                                                                                                      // 33
  // Call original Meteor.Collection constructor                                                                      // 34
  constructor.call(self, name, options);                                                                              // 35
                                                                                                                      // 36
  // Attach schema                                                                                                    // 37
  ss && self.attachSchema(ss);                                                                                        // 38
};                                                                                                                    // 39
                                                                                                                      // 40
// Make sure prototype and normal properties are kept                                                                 // 41
Meteor.Collection.prototype = constructor.prototype;                                                                  // 42
                                                                                                                      // 43
for (var prop in constructor) {                                                                                       // 44
  if (constructor.hasOwnProperty(prop)) {                                                                             // 45
    Meteor.Collection[prop] = constructor[prop];                                                                      // 46
  }                                                                                                                   // 47
}                                                                                                                     // 48
                                                                                                                      // 49
if (Meteor.isServer) {                                                                                                // 50
  // A function passed to Meteor.startup is only run on the server if                                                 // 51
  // the process has not yet started up. So we need a flag to tell                                                    // 52
  // us whether to wrap in Meteor.startup or not                                                                      // 53
  var hasStartedUp = false;                                                                                           // 54
  Meteor.startup(function () {                                                                                        // 55
    hasStartedUp = true;                                                                                              // 56
  });                                                                                                                 // 57
}                                                                                                                     // 58
                                                                                                                      // 59
/**                                                                                                                   // 60
 * Meteor.Collection.prototype.attachSchema                                                                           // 61
 * @param  {SimpleSchema|Object} ss - SimpleSchema instance or a schema definition object from which to create a new SimpleSchema instance
 * @return {undefined}                                                                                                // 63
 *                                                                                                                    // 64
 * Use this method to attach a schema to a collection created by another package,                                     // 65
 * such as Meteor.users. It is most likely unsafe to call this method more than                                       // 66
 * once for a single collection, or to call this for a collection that had a                                          // 67
 * schema object passed to its constructor.                                                                           // 68
 */                                                                                                                   // 69
Meteor.Collection.prototype.attachSchema = function c2AttachSchema(ss) {                                              // 70
  var self = this;                                                                                                    // 71
                                                                                                                      // 72
  if (!(ss instanceof SimpleSchema)) {                                                                                // 73
    ss = new SimpleSchema(ss);                                                                                        // 74
  }                                                                                                                   // 75
                                                                                                                      // 76
  self._c2 = {};                                                                                                      // 77
  self._c2._simpleSchema = ss;                                                                                        // 78
                                                                                                                      // 79
  // Loop over fields definitions and ensure collection indexes (server side only)                                    // 80
  _.each(ss.schema(), function(definition, fieldName) {                                                               // 81
    if (Meteor.isServer && ('index' in definition || definition.unique === true)) {                                   // 82
                                                                                                                      // 83
      function setUpIndex() {                                                                                         // 84
        var index = {}, indexValue;                                                                                   // 85
        // If they specified `unique: true` but not `index`, we assume `index: 1` to set up the unique index in mongo // 86
        if ('index' in definition) {                                                                                  // 87
          indexValue = definition['index'];                                                                           // 88
          if (indexValue === true) {                                                                                  // 89
            indexValue = 1;                                                                                           // 90
          }                                                                                                           // 91
        } else {                                                                                                      // 92
          indexValue = 1;                                                                                             // 93
        }                                                                                                             // 94
        var indexName = 'c2_' + fieldName;                                                                            // 95
        // In the index object, we want object array keys without the ".$" piece                                      // 96
        var idxFieldName = fieldName.replace(/\.\$\./g, ".");                                                         // 97
        index[idxFieldName] = indexValue;                                                                             // 98
        var unique = !!definition.unique && (indexValue === 1 || indexValue === -1);                                  // 99
        var sparse = !!definition.optional && unique;                                                                 // 100
        if (indexValue !== false) {                                                                                   // 101
          self._collection._ensureIndex(index, {                                                                      // 102
            background: true,                                                                                         // 103
            name: indexName,                                                                                          // 104
            unique: unique,                                                                                           // 105
            sparse: sparse                                                                                            // 106
          });                                                                                                         // 107
        } else {                                                                                                      // 108
          try {                                                                                                       // 109
            self._collection._dropIndex(indexName);                                                                   // 110
          } catch (err) {                                                                                             // 111
            console.warn("Collection2: Tried to drop mongo index " + indexName + ", but there is no index with that name");
          }                                                                                                           // 113
        }                                                                                                             // 114
      }                                                                                                               // 115
                                                                                                                      // 116
      if (hasStartedUp) {                                                                                             // 117
        setUpIndex();                                                                                                 // 118
      } else {                                                                                                        // 119
        Meteor.startup(setUpIndex);                                                                                   // 120
      }                                                                                                               // 121
                                                                                                                      // 122
    }                                                                                                                 // 123
  });                                                                                                                 // 124
                                                                                                                      // 125
  // Set up additional checks                                                                                         // 126
  ss.validator(function() {                                                                                           // 127
    var test, totalUsing, totalWillUse, sel;                                                                          // 128
    var def = this.definition;                                                                                        // 129
    var val = this.value;                                                                                             // 130
    var op = this.operator;                                                                                           // 131
    var key = this.key;                                                                                               // 132
                                                                                                                      // 133
    if (def.denyInsert && val !== void 0 && !op) {                                                                    // 134
      // This is an insert of a defined value into a field where denyInsert=true                                      // 135
      return "insertNotAllowed";                                                                                      // 136
    }                                                                                                                 // 137
                                                                                                                      // 138
    if (def.denyUpdate && op) {                                                                                       // 139
      // This is an insert of a defined value into a field where denyUpdate=true                                      // 140
      if (op !== "$set" || (op === "$set" && val !== void 0)) {                                                       // 141
        return "updateNotAllowed";                                                                                    // 142
      }                                                                                                               // 143
    }                                                                                                                 // 144
                                                                                                                      // 145
    return true;                                                                                                      // 146
  });                                                                                                                 // 147
                                                                                                                      // 148
  // First define deny functions to extend doc with the results of clean                                              // 149
  // and autovalues. This must be done with "transform: null" or we would be                                          // 150
  // extending a clone of doc and therefore have no effect.                                                           // 151
  self.deny({                                                                                                         // 152
    insert: function(userId, doc) {                                                                                   // 153
      // If _id has already been added, remove it temporarily if it's                                                 // 154
      // not explicitly defined in the schema.                                                                        // 155
      var id;                                                                                                         // 156
      if (Meteor.isServer && doc._id && !ss.allowsKey("_id")) {                                                       // 157
        id = doc._id;                                                                                                 // 158
        delete doc._id;                                                                                               // 159
      }                                                                                                               // 160
                                                                                                                      // 161
      // Referenced doc is cleaned in place                                                                           // 162
      ss.clean(doc, {                                                                                                 // 163
        isModifier: false,                                                                                            // 164
        // We don't remove empty string here; they are removed on client if desired                                   // 165
        removeEmptyStrings: false,                                                                                    // 166
        extendAutoValueContext: {                                                                                     // 167
          isInsert: true,                                                                                             // 168
          isUpdate: false,                                                                                            // 169
          isUpsert: false,                                                                                            // 170
          userId: userId,                                                                                             // 171
          isFromTrustedCode: false                                                                                    // 172
        }                                                                                                             // 173
      });                                                                                                             // 174
                                                                                                                      // 175
      // Add the ID back                                                                                              // 176
      if (id) {                                                                                                       // 177
        doc._id = id;                                                                                                 // 178
      }                                                                                                               // 179
                                                                                                                      // 180
      return false;                                                                                                   // 181
    },                                                                                                                // 182
    update: function(userId, doc, fields, modifier) {                                                                 // 183
                                                                                                                      // 184
      // Referenced modifier is cleaned in place                                                                      // 185
      ss.clean(modifier, {                                                                                            // 186
        isModifier: true,                                                                                             // 187
        // We don't remove empty string here; they are removed on client if desired                                   // 188
        removeEmptyStrings: false,                                                                                    // 189
        extendAutoValueContext: {                                                                                     // 190
          isInsert: false,                                                                                            // 191
          isUpdate: true,                                                                                             // 192
          isUpsert: false,                                                                                            // 193
          userId: userId,                                                                                             // 194
          isFromTrustedCode: false                                                                                    // 195
        }                                                                                                             // 196
      });                                                                                                             // 197
                                                                                                                      // 198
      return false;                                                                                                   // 199
    },                                                                                                                // 200
    fetch: [],                                                                                                        // 201
    transform: null                                                                                                   // 202
  });                                                                                                                 // 203
                                                                                                                      // 204
  // Second define deny functions to validate again on the server                                                     // 205
  // for client-initiated inserts and updates. These should be                                                        // 206
  // called after the clean/autovalue functions since we're adding                                                    // 207
  // them after. These must *not* have "transform: null" because                                                      // 208
  // we need to pass the doc through any transforms to be sure                                                        // 209
  // that custom types are properly recognized for type validation.                                                   // 210
  self.deny({                                                                                                         // 211
    insert: function(userId, doc) {                                                                                   // 212
      // We pass removeEmptyStrings: false because we will have removed on client if desired                          // 213
      doValidate.call(self, "insert", [doc, {removeEmptyStrings: false}, function(error) {                            // 214
          if (error) {                                                                                                // 215
            throw new Meteor.Error(400, 'Bad Request', "INVALID: " + EJSON.stringify(error.invalidKeys));             // 216
          }                                                                                                           // 217
        }], true, userId, false);                                                                                     // 218
                                                                                                                      // 219
      return false;                                                                                                   // 220
    },                                                                                                                // 221
    update: function(userId, doc, fields, modifier) {                                                                 // 222
      // NOTE: This will never be an upsert because client-side upserts                                               // 223
      // are not allowed once you define allow/deny functions.                                                        // 224
      // We pass removeEmptyStrings: false because we will have removed on client if desired                          // 225
      doValidate.call(self, "update", [null, modifier, {removeEmptyStrings: false}, function(error) {                 // 226
          if (error) {                                                                                                // 227
            throw new Meteor.Error(400, 'Bad Request', "INVALID: " + EJSON.stringify(error.invalidKeys));             // 228
          }                                                                                                           // 229
        }], true, userId, false);                                                                                     // 230
                                                                                                                      // 231
      return false;                                                                                                   // 232
    },                                                                                                                // 233
    fetch: []                                                                                                         // 234
  });                                                                                                                 // 235
                                                                                                                      // 236
  // If insecure package is in use, we need to add allow rules that return                                            // 237
  // true. Otherwise, it would seemingly turn off insecure mode.                                                      // 238
  if (Package && Package.insecure) {                                                                                  // 239
    self.allow({                                                                                                      // 240
      insert: function() {                                                                                            // 241
        return true;                                                                                                  // 242
      },                                                                                                              // 243
      update: function() {                                                                                            // 244
        return true;                                                                                                  // 245
      },                                                                                                              // 246
      fetch: [],                                                                                                      // 247
      transform: null                                                                                                 // 248
    });                                                                                                               // 249
  }                                                                                                                   // 250
  // If insecure package is NOT in use, then adding the two deny functions                                            // 251
  // does not have any effect on the main app's security paradigm. The                                                // 252
  // user will still be required to add at least one allow function of her                                            // 253
  // own for each operation for this collection. And the user may still add                                           // 254
  // additional deny functions, but does not have to.                                                                 // 255
};                                                                                                                    // 256
                                                                                                                      // 257
Meteor.Collection.prototype.simpleSchema = function c2SS() {                                                          // 258
  var self = this;                                                                                                    // 259
  return self._c2 ? self._c2._simpleSchema : null;                                                                    // 260
};                                                                                                                    // 261
                                                                                                                      // 262
// Wrap DB write operation methods                                                                                    // 263
_.each(['insert', 'update', 'upsert'], function(methodName) {                                                         // 264
  var _super = Meteor.Collection.prototype[methodName];                                                               // 265
  Meteor.Collection.prototype[methodName] = function () {                                                             // 266
    var self = this, args = _.toArray(arguments);                                                                     // 267
    if (self._c2) {                                                                                                   // 268
      args = doValidate.call(self, methodName, args, false,                                                           // 269
        (Meteor.isClient && Meteor.userId && Meteor.userId()) || null, Meteor.isServer);                              // 270
      if (!args) {                                                                                                    // 271
        // doValidate already called the callback or threw the error                                                  // 272
        if (methodName === "insert") {                                                                                // 273
          // insert should always return an ID to match core behavior                                                 // 274
          return self._makeNewID();                                                                                   // 275
        } else {                                                                                                      // 276
          return;                                                                                                     // 277
        }                                                                                                             // 278
      }                                                                                                               // 279
    }                                                                                                                 // 280
    return _super.apply(self, args);                                                                                  // 281
  };                                                                                                                  // 282
});                                                                                                                   // 283
                                                                                                                      // 284
/*                                                                                                                    // 285
 * Private                                                                                                            // 286
 */                                                                                                                   // 287
                                                                                                                      // 288
function doValidate(type, args, skipAutoValue, userId, isFromTrustedCode) {                                           // 289
  var self = this, schema = self._c2._simpleSchema,                                                                   // 290
      doc, callback, error, options, isUpsert, selector;                                                              // 291
                                                                                                                      // 292
  if (!args.length) {                                                                                                 // 293
    throw new Error(type + " requires an argument");                                                                  // 294
  }                                                                                                                   // 295
                                                                                                                      // 296
  // Gather arguments and cache the selector                                                                          // 297
  if (type === "insert") {                                                                                            // 298
    doc = args[0];                                                                                                    // 299
    options = args[1];                                                                                                // 300
    callback = args[2];                                                                                               // 301
                                                                                                                      // 302
    // The real insert doesn't take options                                                                           // 303
    if (typeof options === "function") {                                                                              // 304
      args = [doc, options];                                                                                          // 305
    } else if (typeof callback === "function") {                                                                      // 306
      args = [doc, callback];                                                                                         // 307
    } else {                                                                                                          // 308
      args = [doc];                                                                                                   // 309
    }                                                                                                                 // 310
                                                                                                                      // 311
  } else if (type === "update" || type === "upsert") {                                                                // 312
    selector = args[0];                                                                                               // 313
    doc = args[1];                                                                                                    // 314
    options = args[2];                                                                                                // 315
    callback = args[3];                                                                                               // 316
  } else {                                                                                                            // 317
    throw new Error("invalid type argument");                                                                         // 318
  }                                                                                                                   // 319
                                                                                                                      // 320
  // Support missing options arg                                                                                      // 321
  if (!callback && typeof options === "function") {                                                                   // 322
    callback = options;                                                                                               // 323
    options = {};                                                                                                     // 324
  }                                                                                                                   // 325
  options = options || {};                                                                                            // 326
                                                                                                                      // 327
  // If update was called with upsert:true or upsert was called, flag as an upsert                                    // 328
  isUpsert = (type === "upsert" || (type === "update" && options.upsert === true));                                   // 329
                                                                                                                      // 330
  // Add a default callback function if we're on the client and no callback was given                                 // 331
  if (Meteor.isClient && !callback) {                                                                                 // 332
    // Client can't block, so it can't report errors by exception,                                                    // 333
    // only by callback. If they forget the callback, give them a                                                     // 334
    // default one that logs the error, so they aren't totally                                                        // 335
    // baffled if their writes don't work because their database is                                                   // 336
    // down.                                                                                                          // 337
    callback = function(err) {                                                                                        // 338
      if (err)                                                                                                        // 339
        Meteor._debug(type + " failed: " + (err.reason || err.stack));                                                // 340
    };                                                                                                                // 341
  }                                                                                                                   // 342
                                                                                                                      // 343
  // If client validation is fine or is skipped but then something                                                    // 344
  // is found to be invalid on the server, we get that error back                                                     // 345
  // as a special Meteor.Error that we need to parse.                                                                 // 346
  if (Meteor.isClient) {                                                                                              // 347
    var last = args.length - 1;                                                                                       // 348
    if (typeof args[last] === 'function') {                                                                           // 349
      callback = args[last] = wrapCallbackForParsingServerErrors(self, options.validationContext, callback);          // 350
    }                                                                                                                 // 351
  }                                                                                                                   // 352
                                                                                                                      // 353
  if (options.validate === false) {                                                                                   // 354
    return args;                                                                                                      // 355
  }                                                                                                                   // 356
                                                                                                                      // 357
  // If _id has already been added, remove it temporarily if it's                                                     // 358
  // not explicitly defined in the schema.                                                                            // 359
  var id;                                                                                                             // 360
  if (Meteor.isServer && doc._id && !schema.allowsKey("_id")) {                                                       // 361
    id = doc._id;                                                                                                     // 362
    delete doc._id;                                                                                                   // 363
  }                                                                                                                   // 364
                                                                                                                      // 365
  function doClean(docToClean, getAutoValues, filter, autoConvert, removeEmptyStrings) {                              // 366
    // Clean the doc/modifier in place (removes any virtual fields added                                              // 367
    // by the deny transform, too)                                                                                    // 368
    schema.clean(docToClean, {                                                                                        // 369
      filter: filter,                                                                                                 // 370
      autoConvert: autoConvert,                                                                                       // 371
      getAutoValues: getAutoValues,                                                                                   // 372
      isModifier: (type !== "insert"),                                                                                // 373
      removeEmptyStrings: removeEmptyStrings,                                                                         // 374
      extendAutoValueContext: {                                                                                       // 375
        isInsert: (type === "insert"),                                                                                // 376
        isUpdate: (type === "update" && options.upsert !== true),                                                     // 377
        isUpsert: isUpsert,                                                                                           // 378
        userId: userId,                                                                                               // 379
        isFromTrustedCode: isFromTrustedCode                                                                          // 380
      }                                                                                                               // 381
    });                                                                                                               // 382
  }                                                                                                                   // 383
                                                                                                                      // 384
  // Preliminary cleaning on both client and server. On the server, automatic                                         // 385
  // values will also be set at this point.                                                                           // 386
  doClean(doc, (Meteor.isServer && !skipAutoValue), true, true, options.removeEmptyStrings !== false);                // 387
                                                                                                                      // 388
  // On the server, upserts are possible; SimpleSchema handles upserts pretty                                         // 389
  // well by default, but it will not know about the fields in the selector,                                          // 390
  // which are also stored in the database if an insert is performed. So we                                           // 391
  // will allow these fields to be considered for validation by adding them                                           // 392
  // to the $set in the modifier. This is no doubt prone to errors, but there                                         // 393
  // probably isn't any better way right now.                                                                         // 394
  var docToValidate = _.clone(doc);                                                                                   // 395
  if (Meteor.isServer && isUpsert && _.isObject(selector)) {                                                          // 396
    var set = docToValidate.$set || {};                                                                               // 397
    docToValidate.$set = _.clone(selector);                                                                           // 398
    _.extend(docToValidate.$set, set);                                                                                // 399
  }                                                                                                                   // 400
                                                                                                                      // 401
  // Set automatic values for validation on the client.                                                               // 402
  // On the server, we already updated doc with auto values, but on the client,                                       // 403
  // we will add them to docToValidate for validation purposes only.                                                  // 404
  // This is because we want all actual values generated on the server.                                               // 405
  if (Meteor.isClient) {                                                                                              // 406
    doClean(docToValidate, true, false, false, false);                                                                // 407
  }                                                                                                                   // 408
                                                                                                                      // 409
  // Validate doc                                                                                                     // 410
  var ctx = schema.namedContext(options.validationContext);                                                           // 411
  var isValid = ctx.validate(docToValidate, {                                                                         // 412
    modifier: (type === "update" || type === "upsert"),                                                               // 413
    upsert: isUpsert,                                                                                                 // 414
    extendedCustomContext: {                                                                                          // 415
      isInsert: (type === "insert"),                                                                                  // 416
      isUpdate: (type === "update" && options.upsert !== true),                                                       // 417
      isUpsert: isUpsert,                                                                                             // 418
      userId: userId,                                                                                                 // 419
      isFromTrustedCode: isFromTrustedCode                                                                            // 420
    }                                                                                                                 // 421
  });                                                                                                                 // 422
                                                                                                                      // 423
  if (isValid) {                                                                                                      // 424
    // Add the ID back                                                                                                // 425
    if (id) {                                                                                                         // 426
      doc._id = id;                                                                                                   // 427
    }                                                                                                                 // 428
    // Update the args to reflect the cleaned doc                                                                     // 429
    if (type === "insert") {                                                                                          // 430
      args[0] = doc;                                                                                                  // 431
    } else {                                                                                                          // 432
      args[1] = doc;                                                                                                  // 433
    }                                                                                                                 // 434
                                                                                                                      // 435
    // If callback, set invalidKey when we get a mongo unique error                                                   // 436
    if (Meteor.isServer) {                                                                                            // 437
      var last = args.length - 1;                                                                                     // 438
      if (typeof args[last] === 'function') {                                                                         // 439
        args[last] = wrapCallbackForParsingMongoValidationErrors(self, doc, options.validationContext, args[last]);   // 440
      }                                                                                                               // 441
    }                                                                                                                 // 442
    return args;                                                                                                      // 443
  } else {                                                                                                            // 444
    var invalidKeys = ctx.invalidKeys();                                                                              // 445
    var message = "failed validation";                                                                                // 446
    if (invalidKeys.length) {                                                                                         // 447
      var badKey = invalidKeys[0].name;                                                                               // 448
      message += ": " + badKey + ": " + ctx.keyErrorMessage(badKey);                                                  // 449
    }                                                                                                                 // 450
    error = new Error(message);                                                                                       // 451
    error.invalidKeys = invalidKeys;                                                                                  // 452
    if (callback) {                                                                                                   // 453
      // insert/update/upsert pass `false` when there's an error, so we do that                                       // 454
      callback(error, false);                                                                                         // 455
    } else {                                                                                                          // 456
      throw error;                                                                                                    // 457
    }                                                                                                                 // 458
  }                                                                                                                   // 459
}                                                                                                                     // 460
                                                                                                                      // 461
function addUniqueError(context, errorMessage) {                                                                      // 462
  var name = errorMessage.split('c2_')[1].split(' ')[0];                                                              // 463
  var val = errorMessage.split('dup key:')[1].split('"')[1];                                                          // 464
  context.addInvalidKeys([{                                                                                           // 465
    name: name,                                                                                                       // 466
    type: 'notUnique',                                                                                                // 467
    value: val                                                                                                        // 468
  }]);                                                                                                                // 469
}                                                                                                                     // 470
                                                                                                                      // 471
function wrapCallbackForParsingMongoValidationErrors(col, doc, vCtx, cb) {                                            // 472
  return function wrappedCallbackForParsingMongoValidationErrors(error) {                                             // 473
    if (error && ((error.name === "MongoError" && error.code === 11001) || error.message.indexOf('MongoError: E11000' !== -1)) && error.message.indexOf('c2_') !== -1) {
      addUniqueError(col.simpleSchema().namedContext(vCtx), error.message);                                           // 475
    }                                                                                                                 // 476
    return cb.apply(this, arguments);                                                                                 // 477
  };                                                                                                                  // 478
}                                                                                                                     // 479
                                                                                                                      // 480
function wrapCallbackForParsingServerErrors(col, vCtx, cb) {                                                          // 481
  return function wrappedCallbackForParsingServerErrors(error) {                                                      // 482
    // Handle our own validation errors                                                                               // 483
    var context = col.simpleSchema().namedContext(vCtx);                                                              // 484
    if (error instanceof Meteor.Error && error.error === 400 && error.details && error.details.slice(0, 8) === "INVALID:") {
      var invalidKeysFromServer = EJSON.parse(error.details.slice(9));                                                // 486
      context.addInvalidKeys(invalidKeysFromServer);                                                                  // 487
    }                                                                                                                 // 488
    // Handle Mongo unique index errors, which are forwarded to the client as 409 errors                              // 489
    else if (error instanceof Meteor.Error && error.error === 409 && error.reason && error.reason.indexOf('E11000') !== -1 && error.reason.indexOf('c2_') !== -1) {
      addUniqueError(context, error.reason);                                                                          // 491
    }                                                                                                                 // 492
    return cb.apply(this, arguments);                                                                                 // 493
  };                                                                                                                  // 494
}                                                                                                                     // 495
                                                                                                                      // 496
// Meteor.Collection2 is deprecated                                                                                   // 497
Meteor.Collection2 = function () {                                                                                    // 498
  throw new Error("Collection2: Doing `new Meteor.Collection2` no longer works. Just use a normal `new Meteor.Collection` call.");
};                                                                                                                    // 500
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);


/* Exports */
if (typeof Package === 'undefined') Package = {};
Package.collection2 = {};

})();
