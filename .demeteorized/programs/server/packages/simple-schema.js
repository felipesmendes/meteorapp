(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var Deps = Package.deps.Deps;
var _ = Package.underscore._;
var check = Package.check.check;
var Match = Package.check.Match;
var Random = Package.random.Random;

/* Package-scope variables */
var SimpleSchema, MongoObject, Utility, S, doValidation1, doValidation2, SimpleSchemaValidationContext;

(function () {

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                    //
// packages/simple-schema/mongo-object.js                                                                             //
//                                                                                                                    //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                      //
/*                                                                                                                    // 1
 * @constructor                                                                                                       // 2
 * @param {Object} objOrModifier                                                                                      // 3
 * @param {string[]} blackBoxKeys - A list of the names of keys that shouldn't be traversed                           // 4
 * @returns {undefined}                                                                                               // 5
 *                                                                                                                    // 6
 * Creates a new MongoObject instance. The object passed as the first argument                                        // 7
 * will be modified in place by calls to instance methods. Also, immediately                                          // 8
 * upon creation of the instance, the object will have any `undefined` keys                                           // 9
 * removed recursively.                                                                                               // 10
 */                                                                                                                   // 11
MongoObject = function(objOrModifier, blackBoxKeys) {                                                                 // 12
  var self = this;                                                                                                    // 13
  self._obj = objOrModifier;                                                                                          // 14
  self._affectedKeys = {};                                                                                            // 15
  self._genericAffectedKeys = {};                                                                                     // 16
  self._parentPositions = [];                                                                                         // 17
  self._positionsInsideArrays = [];                                                                                   // 18
  self._objectPositions = [];                                                                                         // 19
                                                                                                                      // 20
  function parseObj(val, currentPosition, affectedKey, operator, adjusted, isWithinArray) {                           // 21
                                                                                                                      // 22
    // Adjust for first-level modifier operators                                                                      // 23
    if (!operator && affectedKey && affectedKey.substring(0, 1) === "$") {                                            // 24
      operator = affectedKey;                                                                                         // 25
      affectedKey = null;                                                                                             // 26
    }                                                                                                                 // 27
                                                                                                                      // 28
    var affectedKeyIsBlackBox = false;                                                                                // 29
    var affectedKeyGeneric;                                                                                           // 30
    var stop = false;                                                                                                 // 31
    if (affectedKey) {                                                                                                // 32
                                                                                                                      // 33
      // Adjust for $push and $addToSet and $pull and $pop                                                            // 34
      if (!adjusted) {                                                                                                // 35
        if (operator === "$push" || operator === "$addToSet" || operator === "$pop") {                                // 36
          // Adjust for $each                                                                                         // 37
          // We can simply jump forward and pretend like the $each array                                              // 38
          // is the array for the field. This has the added benefit of                                                // 39
          // skipping past any $slice, which we also don't care about.                                                // 40
          if (isBasicObject(val) && "$each" in val) {                                                                 // 41
            val = val.$each;                                                                                          // 42
            currentPosition = currentPosition + "[$each]";                                                            // 43
          } else {                                                                                                    // 44
            affectedKey = affectedKey + ".0";                                                                         // 45
          }                                                                                                           // 46
          adjusted = true;                                                                                            // 47
        } else if (operator === "$pull") {                                                                            // 48
          affectedKey = affectedKey + ".0";                                                                           // 49
          if (isBasicObject(val)) {                                                                                   // 50
            stop = true;                                                                                              // 51
          }                                                                                                           // 52
          adjusted = true;                                                                                            // 53
        }                                                                                                             // 54
      }                                                                                                               // 55
                                                                                                                      // 56
      // Make generic key                                                                                             // 57
      affectedKeyGeneric = makeGeneric(affectedKey);                                                                  // 58
                                                                                                                      // 59
      // Determine whether affected key should be treated as a black box                                              // 60
      affectedKeyIsBlackBox = _.contains(blackBoxKeys, affectedKeyGeneric);                                           // 61
                                                                                                                      // 62
      // Mark that this position affects this generic and non-generic key                                             // 63
      if (currentPosition) {                                                                                          // 64
        self._affectedKeys[currentPosition] = affectedKey;                                                            // 65
        self._genericAffectedKeys[currentPosition] = affectedKeyGeneric;                                              // 66
                                                                                                                      // 67
        // If we're within an array, mark this position so we can omit it from flat docs                              // 68
        isWithinArray && self._positionsInsideArrays.push(currentPosition);                                           // 69
      }                                                                                                               // 70
    }                                                                                                                 // 71
                                                                                                                      // 72
    if (stop)                                                                                                         // 73
      return;                                                                                                         // 74
                                                                                                                      // 75
    // Loop through arrays                                                                                            // 76
    if (_.isArray(val) && !_.isEmpty(val)) {                                                                          // 77
      if (currentPosition) {                                                                                          // 78
        // Mark positions with arrays that should be ignored when we want endpoints only                              // 79
        self._parentPositions.push(currentPosition);                                                                  // 80
      }                                                                                                               // 81
                                                                                                                      // 82
      // Loop                                                                                                         // 83
      _.each(val, function(v, i) {                                                                                    // 84
        parseObj(v, (currentPosition ? currentPosition + "[" + i + "]" : i), affectedKey + '.' + i, operator, adjusted, true);
      });                                                                                                             // 86
    }                                                                                                                 // 87
                                                                                                                      // 88
    // Loop through object keys, only for basic objects,                                                              // 89
    // but always for the passed-in object, even if it                                                                // 90
    // is a custom object.                                                                                            // 91
    else if ((isBasicObject(val) && !affectedKeyIsBlackBox) || !currentPosition) {                                    // 92
      if (currentPosition && !_.isEmpty(val)) {                                                                       // 93
        // Mark positions with objects that should be ignored when we want endpoints only                             // 94
        self._parentPositions.push(currentPosition);                                                                  // 95
        // Mark positions with objects that should be left out of flat docs.                                          // 96
        self._objectPositions.push(currentPosition);                                                                  // 97
      }                                                                                                               // 98
      // Loop                                                                                                         // 99
      _.each(val, function(v, k) {                                                                                    // 100
        if (v === void 0) {                                                                                           // 101
          delete val[k];                                                                                              // 102
        } else if (k !== "$slice") {                                                                                  // 103
          parseObj(v, (currentPosition ? currentPosition + "[" + k + "]" : k), appendAffectedKey(affectedKey, k), operator, adjusted, isWithinArray);
        }                                                                                                             // 105
      });                                                                                                             // 106
    }                                                                                                                 // 107
                                                                                                                      // 108
  }                                                                                                                   // 109
  parseObj(self._obj);                                                                                                // 110
                                                                                                                      // 111
  function reParseObj() {                                                                                             // 112
    self._affectedKeys = {};                                                                                          // 113
    self._genericAffectedKeys = {};                                                                                   // 114
    self._parentPositions = [];                                                                                       // 115
    self._positionsInsideArrays = [];                                                                                 // 116
    self._objectPositions = [];                                                                                       // 117
    parseObj(self._obj);                                                                                              // 118
  }                                                                                                                   // 119
                                                                                                                      // 120
  /**                                                                                                                 // 121
   * @method MongoObject.forEachNode                                                                                  // 122
   * @param {Function} func                                                                                           // 123
   * @param {Object} [options]                                                                                        // 124
   * @param {Boolean} [options.endPointsOnly=true] - Only call function for endpoints and not for nodes that contain other nodes
   * @returns {undefined}                                                                                             // 126
   *                                                                                                                  // 127
   * Runs a function for each endpoint node in the object tree, including all items in every array.                   // 128
   * The function arguments are                                                                                       // 129
   * (1) the value at this node                                                                                       // 130
   * (2) a string representing the node position                                                                      // 131
   * (3) the representation of what would be changed in mongo, using mongo dot notation                               // 132
   * (4) the generic equivalent of argument 3, with "$" instead of numeric pieces                                     // 133
   */                                                                                                                 // 134
  self.forEachNode = function(func, options) {                                                                        // 135
    if (typeof func !== "function")                                                                                   // 136
      throw new Error("filter requires a loop function");                                                             // 137
                                                                                                                      // 138
    options = _.extend({                                                                                              // 139
      endPointsOnly: true                                                                                             // 140
    }, options);                                                                                                      // 141
                                                                                                                      // 142
    var updatedValues = {};                                                                                           // 143
    _.each(self._affectedKeys, function(affectedKey, position) {                                                      // 144
      if (options.endPointsOnly && _.contains(self._parentPositions, position))                                       // 145
        return; //only endpoints                                                                                      // 146
      func.call({                                                                                                     // 147
        value: self.getValueForPosition(position),                                                                    // 148
        operator: extractOp(position),                                                                                // 149
        position: position,                                                                                           // 150
        key: affectedKey,                                                                                             // 151
        genericKey: self._genericAffectedKeys[position],                                                              // 152
        updateValue: function(newVal) {                                                                               // 153
          updatedValues[position] = newVal;                                                                           // 154
        },                                                                                                            // 155
        remove: function() {                                                                                          // 156
          updatedValues[position] = void 0;                                                                           // 157
        }                                                                                                             // 158
      });                                                                                                             // 159
    });                                                                                                               // 160
                                                                                                                      // 161
    // Actually update/remove values as instructed                                                                    // 162
    _.each(updatedValues, function(newVal, position) {                                                                // 163
      self.setValueForPosition(position, newVal);                                                                     // 164
    });                                                                                                               // 165
                                                                                                                      // 166
  };                                                                                                                  // 167
                                                                                                                      // 168
  self.getValueForPosition = function(position) {                                                                     // 169
    var subkey, subkeys = position.split("["), current = self._obj;                                                   // 170
    for (var i = 0, ln = subkeys.length; i < ln; i++) {                                                               // 171
      subkey = subkeys[i];                                                                                            // 172
      // If the subkey ends in "]", remove the ending                                                                 // 173
      if (subkey.slice(-1) === "]") {                                                                                 // 174
        subkey = subkey.slice(0, -1);                                                                                 // 175
      }                                                                                                               // 176
      current = current[subkey];                                                                                      // 177
      if (!_.isArray(current) && !isBasicObject(current) && i < ln - 1) {                                             // 178
        return;                                                                                                       // 179
      }                                                                                                               // 180
    }                                                                                                                 // 181
    return current;                                                                                                   // 182
  };                                                                                                                  // 183
                                                                                                                      // 184
  /**                                                                                                                 // 185
   * @method MongoObject.prototype.setValueForPosition                                                                // 186
   * @param {String} position                                                                                         // 187
   * @param {Any} value                                                                                               // 188
   * @returns {undefined}                                                                                             // 189
   */                                                                                                                 // 190
  self.setValueForPosition = function(position, value) {                                                              // 191
    var nextPiece, subkey, subkeys = position.split("["), current = self._obj;                                        // 192
                                                                                                                      // 193
    for (var i = 0, ln = subkeys.length; i < ln; i++) {                                                               // 194
      subkey = subkeys[i];                                                                                            // 195
      // If the subkey ends in "]", remove the ending                                                                 // 196
      if (subkey.slice(-1) === "]") {                                                                                 // 197
        subkey = subkey.slice(0, -1);                                                                                 // 198
      }                                                                                                               // 199
      // If we've reached the key in the object tree that needs setting or                                            // 200
      // deleting, do it.                                                                                             // 201
      if (i === ln - 1) {                                                                                             // 202
        current[subkey] = value;                                                                                      // 203
        //if value is undefined, delete the property                                                                  // 204
        if (value === void 0)                                                                                         // 205
          delete current[subkey];                                                                                     // 206
      }                                                                                                               // 207
      // Otherwise attempt to keep moving deeper into the object.                                                     // 208
      else {                                                                                                          // 209
        // If we're setting (as opposed to deleting) a key and we hit a place                                         // 210
        // in the ancestor chain where the keys are not yet created, create them.                                     // 211
        if (current[subkey] === void 0 && value !== void 0) {                                                         // 212
          //see if the next piece is a number                                                                         // 213
          nextPiece = subkeys[i + 1];                                                                                 // 214
          nextPiece = parseInt(nextPiece, 10);                                                                        // 215
          current[subkey] = isNaN(nextPiece) ? {} : [];                                                               // 216
        }                                                                                                             // 217
                                                                                                                      // 218
        // Move deeper into the object                                                                                // 219
        current = current[subkey];                                                                                    // 220
                                                                                                                      // 221
        // If we can go no further, then quit                                                                         // 222
        if (!_.isArray(current) && !isBasicObject(current) && i < ln - 1) {                                           // 223
          return;                                                                                                     // 224
        }                                                                                                             // 225
      }                                                                                                               // 226
    }                                                                                                                 // 227
                                                                                                                      // 228
    reParseObj();                                                                                                     // 229
  };                                                                                                                  // 230
                                                                                                                      // 231
  /**                                                                                                                 // 232
   * @method MongoObject.prototype.removeValueForPosition                                                             // 233
   * @param {String} position                                                                                         // 234
   * @returns {undefined}                                                                                             // 235
   */                                                                                                                 // 236
  self.removeValueForPosition = function(position) {                                                                  // 237
    self.setValueForPosition(position, void 0);                                                                       // 238
  };                                                                                                                  // 239
                                                                                                                      // 240
  /**                                                                                                                 // 241
   * @method MongoObject.prototype.getKeyForPosition                                                                  // 242
   * @param {String} position                                                                                         // 243
   * @returns {undefined}                                                                                             // 244
   */                                                                                                                 // 245
  self.getKeyForPosition = function(position) {                                                                       // 246
    return self._affectedKeys[position];                                                                              // 247
  };                                                                                                                  // 248
                                                                                                                      // 249
  /**                                                                                                                 // 250
   * @method MongoObject.prototype.getGenericKeyForPosition                                                           // 251
   * @param {String} position                                                                                         // 252
   * @returns {undefined}                                                                                             // 253
   */                                                                                                                 // 254
  self.getGenericKeyForPosition = function(position) {                                                                // 255
    return self._genericAffectedKeys[position];                                                                       // 256
  };                                                                                                                  // 257
                                                                                                                      // 258
  /**                                                                                                                 // 259
   * @method MongoObject.getInfoForKey                                                                                // 260
   * @param {String} key - Non-generic key                                                                            // 261
   * @returns {undefined|Object}                                                                                      // 262
   *                                                                                                                  // 263
   * Returns the value and operator of the requested non-generic key.                                                 // 264
   * Example: {value: 1, operator: "$pull"}                                                                           // 265
   */                                                                                                                 // 266
  self.getInfoForKey = function(key) {                                                                                // 267
    // Get the info                                                                                                   // 268
    var position = self.getPositionForKey(key);                                                                       // 269
    if (position) {                                                                                                   // 270
      return {                                                                                                        // 271
        value: self.getValueForPosition(position),                                                                    // 272
        operator: extractOp(position)                                                                                 // 273
      };                                                                                                              // 274
    }                                                                                                                 // 275
                                                                                                                      // 276
    // If we haven't returned yet, check to see if there is an array value                                            // 277
    // corresponding to this key                                                                                      // 278
    // We find the first item within the array, strip the last piece off the                                          // 279
    // position string, and then return whatever is at that new position in                                           // 280
    // the original object.                                                                                           // 281
    var positions = self.getPositionsForGenericKey(key + ".$"), p, v;                                                 // 282
    for (var i = 0, ln = positions.length; i < ln; i++) {                                                             // 283
      p = positions[i];                                                                                               // 284
      v = self.getValueForPosition(p) || self.getValueForPosition(p.slice(0, p.lastIndexOf("[")));                    // 285
      if (v) {                                                                                                        // 286
        return {                                                                                                      // 287
          value: v,                                                                                                   // 288
          operator: extractOp(p)                                                                                      // 289
        };                                                                                                            // 290
      }                                                                                                               // 291
    }                                                                                                                 // 292
  };                                                                                                                  // 293
                                                                                                                      // 294
  /**                                                                                                                 // 295
   * @method MongoObject.getPositionForKey                                                                            // 296
   * @param {String} key - Non-generic key                                                                            // 297
   * @returns {undefined|String} Position string                                                                      // 298
   *                                                                                                                  // 299
   * Returns the position string for the place in the object that                                                     // 300
   * affects the requested non-generic key.                                                                           // 301
   * Example: 'foo[bar][0]'                                                                                           // 302
   */                                                                                                                 // 303
  self.getPositionForKey = function(key) {                                                                            // 304
    // Get the info                                                                                                   // 305
    for (var position in self._affectedKeys) {                                                                        // 306
      if (self._affectedKeys.hasOwnProperty(position)) {                                                              // 307
        if (self._affectedKeys[position] === key) {                                                                   // 308
          // We return the first one we find. While it's                                                              // 309
          // possible that multiple update operators could                                                            // 310
          // affect the same non-generic key, we'll assume that's not the case.                                       // 311
          return position;                                                                                            // 312
        }                                                                                                             // 313
      }                                                                                                               // 314
    }                                                                                                                 // 315
                                                                                                                      // 316
    // If we haven't returned yet, we need to check for affected keys                                                 // 317
  };                                                                                                                  // 318
                                                                                                                      // 319
  /**                                                                                                                 // 320
   * @method MongoObject.getPositionsForGenericKey                                                                    // 321
   * @param {String} key - Generic key                                                                                // 322
   * @returns {String[]} Array of position strings                                                                    // 323
   *                                                                                                                  // 324
   * Returns an array of position strings for the places in the object that                                           // 325
   * affect the requested generic key.                                                                                // 326
   * Example: ['foo[bar][0]']                                                                                         // 327
   */                                                                                                                 // 328
  self.getPositionsForGenericKey = function(key) {                                                                    // 329
    // Get the info                                                                                                   // 330
    var list = [];                                                                                                    // 331
    for (var position in self._genericAffectedKeys) {                                                                 // 332
      if (self._genericAffectedKeys.hasOwnProperty(position)) {                                                       // 333
        if (self._genericAffectedKeys[position] === key) {                                                            // 334
          list.push(position);                                                                                        // 335
        }                                                                                                             // 336
      }                                                                                                               // 337
    }                                                                                                                 // 338
                                                                                                                      // 339
    return list;                                                                                                      // 340
  };                                                                                                                  // 341
                                                                                                                      // 342
  /**                                                                                                                 // 343
   * @deprecated Use getInfoForKey                                                                                    // 344
   * @method MongoObject.getValueForKey                                                                               // 345
   * @param {String} key - Non-generic key                                                                            // 346
   * @returns {undefined|Any}                                                                                         // 347
   *                                                                                                                  // 348
   * Returns the value of the requested non-generic key                                                               // 349
   */                                                                                                                 // 350
  self.getValueForKey = function(key) {                                                                               // 351
    var position = self.getPositionForKey(key);                                                                       // 352
    if (position) {                                                                                                   // 353
      return self.getValueForPosition(position);                                                                      // 354
    }                                                                                                                 // 355
  };                                                                                                                  // 356
                                                                                                                      // 357
  /**                                                                                                                 // 358
   * @method MongoObject.prototype.addKey                                                                             // 359
   * @param {String} key - Key to set                                                                                 // 360
   * @param {Any} val - Value to give this key                                                                        // 361
   * @param {String} op - Operator under which to set it, or `null` for a non-modifier object                         // 362
   * @returns {undefined}                                                                                             // 363
   *                                                                                                                  // 364
   * Adds `key` with value `val` under operator `op` to the source object.                                            // 365
   */                                                                                                                 // 366
  self.addKey = function(key, val, op) {                                                                              // 367
    var position = op ? op + "[" + key + "]" : MongoObject._keyToPosition(key);                                       // 368
    self.setValueForPosition(position, val);                                                                          // 369
  };                                                                                                                  // 370
                                                                                                                      // 371
  /**                                                                                                                 // 372
   * @method MongoObject.prototype.removeGenericKeys                                                                  // 373
   * @param {String[]} keys                                                                                           // 374
   * @returns {undefined}                                                                                             // 375
   *                                                                                                                  // 376
   * Removes anything that affects any of the generic keys in the list                                                // 377
   */                                                                                                                 // 378
  self.removeGenericKeys = function(keys) {                                                                           // 379
    for (var position in self._genericAffectedKeys) {                                                                 // 380
      if (self._genericAffectedKeys.hasOwnProperty(position)) {                                                       // 381
        if (_.contains(keys, self._genericAffectedKeys[position])) {                                                  // 382
          self.removeValueForPosition(position);                                                                      // 383
        }                                                                                                             // 384
      }                                                                                                               // 385
    }                                                                                                                 // 386
  };                                                                                                                  // 387
                                                                                                                      // 388
  /**                                                                                                                 // 389
   * @method MongoObject.removeGenericKey                                                                             // 390
   * @param {String} key                                                                                              // 391
   * @returns {undefined}                                                                                             // 392
   *                                                                                                                  // 393
   * Removes anything that affects the requested generic key                                                          // 394
   */                                                                                                                 // 395
  self.removeGenericKey = function(key) {                                                                             // 396
    for (var position in self._genericAffectedKeys) {                                                                 // 397
      if (self._genericAffectedKeys.hasOwnProperty(position)) {                                                       // 398
        if (self._genericAffectedKeys[position] === key) {                                                            // 399
          self.removeValueForPosition(position);                                                                      // 400
        }                                                                                                             // 401
      }                                                                                                               // 402
    }                                                                                                                 // 403
  };                                                                                                                  // 404
                                                                                                                      // 405
  /**                                                                                                                 // 406
   * @method MongoObject.removeKey                                                                                    // 407
   * @param {String} key                                                                                              // 408
   * @returns {undefined}                                                                                             // 409
   *                                                                                                                  // 410
   * Removes anything that affects the requested non-generic key                                                      // 411
   */                                                                                                                 // 412
  self.removeKey = function(key) {                                                                                    // 413
    // We don't use getPositionForKey here because we want to be sure to                                              // 414
    // remove for all positions if there are multiple.                                                                // 415
    for (var position in self._affectedKeys) {                                                                        // 416
      if (self._affectedKeys.hasOwnProperty(position)) {                                                              // 417
        if (self._affectedKeys[position] === key) {                                                                   // 418
          self.removeValueForPosition(position);                                                                      // 419
        }                                                                                                             // 420
      }                                                                                                               // 421
    }                                                                                                                 // 422
  };                                                                                                                  // 423
                                                                                                                      // 424
  /**                                                                                                                 // 425
   * @method MongoObject.removeKeys                                                                                   // 426
   * @param {String[]} keys                                                                                           // 427
   * @returns {undefined}                                                                                             // 428
   *                                                                                                                  // 429
   * Removes anything that affects any of the non-generic keys in the list                                            // 430
   */                                                                                                                 // 431
  self.removeKeys = function(keys) {                                                                                  // 432
    for (var i = 0, ln = keys.length; i < ln; i++) {                                                                  // 433
      self.removeKey(keys[i]);                                                                                        // 434
    }                                                                                                                 // 435
  };                                                                                                                  // 436
                                                                                                                      // 437
  /**                                                                                                                 // 438
   * @method MongoObject.filterGenericKeys                                                                            // 439
   * @param {Function} test - Test function                                                                           // 440
   * @returns {undefined}                                                                                             // 441
   *                                                                                                                  // 442
   * Passes all affected keys to a test function, which                                                               // 443
   * should return false to remove whatever is affecting that key                                                     // 444
   */                                                                                                                 // 445
  self.filterGenericKeys = function(test) {                                                                           // 446
    var gk, checkedKeys = [], keysToRemove = [];                                                                      // 447
    for (var position in self._genericAffectedKeys) {                                                                 // 448
      if (self._genericAffectedKeys.hasOwnProperty(position)) {                                                       // 449
        gk = self._genericAffectedKeys[position];                                                                     // 450
        if (!_.contains(checkedKeys, gk)) {                                                                           // 451
          checkedKeys.push(gk);                                                                                       // 452
          if (gk && !test(gk)) {                                                                                      // 453
            keysToRemove.push(gk);                                                                                    // 454
          }                                                                                                           // 455
        }                                                                                                             // 456
      }                                                                                                               // 457
    }                                                                                                                 // 458
                                                                                                                      // 459
    _.each(keysToRemove, function(key) {                                                                              // 460
      self.removeGenericKey(key);                                                                                     // 461
    });                                                                                                               // 462
  };                                                                                                                  // 463
                                                                                                                      // 464
  /**                                                                                                                 // 465
   * @method MongoObject.setValueForKey                                                                               // 466
   * @param {String} key                                                                                              // 467
   * @param {Any} val                                                                                                 // 468
   * @returns {undefined}                                                                                             // 469
   *                                                                                                                  // 470
   * Sets the value for every place in the object that affects                                                        // 471
   * the requested non-generic key                                                                                    // 472
   */                                                                                                                 // 473
  self.setValueForKey = function(key, val) {                                                                          // 474
    // We don't use getPositionForKey here because we want to be sure to                                              // 475
    // set the value for all positions if there are multiple.                                                         // 476
    for (var position in self._affectedKeys) {                                                                        // 477
      if (self._affectedKeys.hasOwnProperty(position)) {                                                              // 478
        if (self._affectedKeys[position] === key) {                                                                   // 479
          self.setValueForPosition(position, val);                                                                    // 480
        }                                                                                                             // 481
      }                                                                                                               // 482
    }                                                                                                                 // 483
  };                                                                                                                  // 484
                                                                                                                      // 485
  /**                                                                                                                 // 486
   * @method MongoObject.setValueForGenericKey                                                                        // 487
   * @param {String} key                                                                                              // 488
   * @param {Any} val                                                                                                 // 489
   * @returns {undefined}                                                                                             // 490
   *                                                                                                                  // 491
   * Sets the value for every place in the object that affects                                                        // 492
   * the requested generic key                                                                                        // 493
   */                                                                                                                 // 494
  self.setValueForGenericKey = function(key, val) {                                                                   // 495
    // We don't use getPositionForKey here because we want to be sure to                                              // 496
    // set the value for all positions if there are multiple.                                                         // 497
    for (var position in self._genericAffectedKeys) {                                                                 // 498
      if (self._genericAffectedKeys.hasOwnProperty(position)) {                                                       // 499
        if (self._genericAffectedKeys[position] === key) {                                                            // 500
          self.setValueForPosition(position, val);                                                                    // 501
        }                                                                                                             // 502
      }                                                                                                               // 503
    }                                                                                                                 // 504
  };                                                                                                                  // 505
                                                                                                                      // 506
  /**                                                                                                                 // 507
   * @method MongoObject.getObject                                                                                    // 508
   * @returns {Object}                                                                                                // 509
   *                                                                                                                  // 510
   * Get the source object, potentially modified by other method calls on this                                        // 511
   * MongoObject instance.                                                                                            // 512
   */                                                                                                                 // 513
  self.getObject = function() {                                                                                       // 514
    return self._obj;                                                                                                 // 515
  };                                                                                                                  // 516
                                                                                                                      // 517
  /**                                                                                                                 // 518
   * @method MongoObject.getFlatObject                                                                                // 519
   * @returns {Object}                                                                                                // 520
   *                                                                                                                  // 521
   * Gets a flat object based on the MongoObject instance.                                                            // 522
   * In a flat object, the key is the name of the non-generic affectedKey,                                            // 523
   * with mongo dot notation if necessary, and the value is the value for                                             // 524
   * that key.                                                                                                        // 525
   *                                                                                                                  // 526
   * With `keepArrays: true`, we don't flatten within arrays. Currently                                               // 527
   * MongoDB does not see a key such as `a.0.b` and automatically assume                                              // 528
   * an array. Instead it would create an object with key "0" if there                                                // 529
   * wasn't already an array saved as the value of `a`, which is rarely                                               // 530
   * if ever what we actually want. To avoid this confusion, we                                                       // 531
   * set entire arrays.                                                                                               // 532
   */                                                                                                                 // 533
  self.getFlatObject = function(options) {                                                                            // 534
    options = options || {};                                                                                          // 535
    var newObj = {};                                                                                                  // 536
    _.each(self._affectedKeys, function(affectedKey, position) {                                                      // 537
      if (typeof affectedKey === "string" &&                                                                          // 538
        (options.keepArrays === true && !_.contains(self._positionsInsideArrays, position) && !_.contains(self._objectPositions, position)) ||
        (!options.keepArrays && !_.contains(self._parentPositions, position))                                         // 540
        ) {                                                                                                           // 541
        newObj[affectedKey] = self.getValueForPosition(position);                                                     // 542
      }                                                                                                               // 543
    });                                                                                                               // 544
    return newObj;                                                                                                    // 545
  };                                                                                                                  // 546
                                                                                                                      // 547
  /**                                                                                                                 // 548
   * @method MongoObject.affectsKey                                                                                   // 549
   * @param {String} key                                                                                              // 550
   * @returns {Object}                                                                                                // 551
   *                                                                                                                  // 552
   * Returns true if the non-generic key is affected by this object                                                   // 553
   */                                                                                                                 // 554
  self.affectsKey = function(key) {                                                                                   // 555
    return !!self.getPositionForKey(key);                                                                             // 556
  };                                                                                                                  // 557
                                                                                                                      // 558
  /**                                                                                                                 // 559
   * @method MongoObject.affectsGenericKey                                                                            // 560
   * @param {String} key                                                                                              // 561
   * @returns {Object}                                                                                                // 562
   *                                                                                                                  // 563
   * Returns true if the generic key is affected by this object                                                       // 564
   */                                                                                                                 // 565
  self.affectsGenericKey = function(key) {                                                                            // 566
    for (var position in self._genericAffectedKeys) {                                                                 // 567
      if (self._genericAffectedKeys.hasOwnProperty(position)) {                                                       // 568
        if (self._genericAffectedKeys[position] === key) {                                                            // 569
          return true;                                                                                                // 570
        }                                                                                                             // 571
      }                                                                                                               // 572
    }                                                                                                                 // 573
    return false;                                                                                                     // 574
  };                                                                                                                  // 575
                                                                                                                      // 576
  /**                                                                                                                 // 577
   * @method MongoObject.affectsGenericKeyImplicit                                                                    // 578
   * @param {String} key                                                                                              // 579
   * @returns {Object}                                                                                                // 580
   *                                                                                                                  // 581
   * Like affectsGenericKey, but will return true if a child key is affected                                          // 582
   */                                                                                                                 // 583
  self.affectsGenericKeyImplicit = function(key) {                                                                    // 584
    for (var position in self._genericAffectedKeys) {                                                                 // 585
      if (self._genericAffectedKeys.hasOwnProperty(position)) {                                                       // 586
        var affectedKey = self._genericAffectedKeys[position];                                                        // 587
                                                                                                                      // 588
        // If the affected key is the test key                                                                        // 589
        if (affectedKey === key) {                                                                                    // 590
          return true;                                                                                                // 591
        }                                                                                                             // 592
                                                                                                                      // 593
        // If the affected key implies the test key because the affected key                                          // 594
        // starts with the test key followed by a period                                                              // 595
        if (affectedKey.substring(0, key.length + 1) === key + ".") {                                                 // 596
          return true;                                                                                                // 597
        }                                                                                                             // 598
                                                                                                                      // 599
        // If the affected key implies the test key because the affected key                                          // 600
        // starts with the test key and the test key ends with ".$"                                                   // 601
        var lastTwo = key.slice(-2);                                                                                  // 602
        if (lastTwo === ".$" && key.slice(0, -2) === affectedKey) {                                                   // 603
          return true;                                                                                                // 604
        }                                                                                                             // 605
      }                                                                                                               // 606
    }                                                                                                                 // 607
    return false;                                                                                                     // 608
  };                                                                                                                  // 609
};                                                                                                                    // 610
                                                                                                                      // 611
/** Takes a string representation of an object key and its value                                                      // 612
 *  and updates "obj" to contain that key with that value.                                                            // 613
 *                                                                                                                    // 614
 *  Example keys and results if val is 1:                                                                             // 615
 *    "a" -> {a: 1}                                                                                                   // 616
 *    "a[b]" -> {a: {b: 1}}                                                                                           // 617
 *    "a[b][0]" -> {a: {b: [1]}}                                                                                      // 618
 *    "a[b.0.c]" -> {a: {'b.0.c': 1}}                                                                                 // 619
 */                                                                                                                   // 620
                                                                                                                      // 621
/** Takes a string representation of an object key and its value                                                      // 622
 *  and updates "obj" to contain that key with that value.                                                            // 623
 *                                                                                                                    // 624
 *  Example keys and results if val is 1:                                                                             // 625
 *    "a" -> {a: 1}                                                                                                   // 626
 *    "a[b]" -> {a: {b: 1}}                                                                                           // 627
 *    "a[b][0]" -> {a: {b: [1]}}                                                                                      // 628
 *    "a[b.0.c]" -> {a: {'b.0.c': 1}}                                                                                 // 629
 *                                                                                                                    // 630
 * @param {any} val                                                                                                   // 631
 * @param {String} key                                                                                                // 632
 * @param {Object} obj                                                                                                // 633
 * @returns {undefined}                                                                                               // 634
 */                                                                                                                   // 635
MongoObject.expandKey = function(val, key, obj) {                                                                     // 636
  var nextPiece, subkey, subkeys = key.split("["), current = obj;                                                     // 637
  for (var i = 0, ln = subkeys.length; i < ln; i++) {                                                                 // 638
    subkey = subkeys[i];                                                                                              // 639
    if (subkey.slice(-1) === "]") {                                                                                   // 640
      subkey = subkey.slice(0, -1);                                                                                   // 641
    }                                                                                                                 // 642
    if (i === ln - 1) {                                                                                               // 643
      //last iteration; time to set the value; always overwrite                                                       // 644
      current[subkey] = val;                                                                                          // 645
      //if val is undefined, delete the property                                                                      // 646
      if (val === void 0)                                                                                             // 647
        delete current[subkey];                                                                                       // 648
    } else {                                                                                                          // 649
      //see if the next piece is a number                                                                             // 650
      nextPiece = subkeys[i + 1];                                                                                     // 651
      nextPiece = parseInt(nextPiece, 10);                                                                            // 652
      if (!current[subkey]) {                                                                                         // 653
        current[subkey] = isNaN(nextPiece) ? {} : [];                                                                 // 654
      }                                                                                                               // 655
    }                                                                                                                 // 656
    current = current[subkey];                                                                                        // 657
  }                                                                                                                   // 658
};                                                                                                                    // 659
                                                                                                                      // 660
MongoObject._keyToPosition = function keyToPosition(key, wrapAll) {                                                   // 661
  var position = '';                                                                                                  // 662
  _.each(key.split("."), function (piece, i) {                                                                        // 663
    if (i === 0 && !wrapAll) {                                                                                        // 664
      position += piece;                                                                                              // 665
    } else {                                                                                                          // 666
      position += "[" + piece + "]";                                                                                  // 667
    }                                                                                                                 // 668
  });                                                                                                                 // 669
  return position;                                                                                                    // 670
};                                                                                                                    // 671
                                                                                                                      // 672
/**                                                                                                                   // 673
 * @method MongoObject._positionToKey                                                                                 // 674
 * @param {String} position                                                                                           // 675
 * @returns {String} The key that this position in an object would affect.                                            // 676
 *                                                                                                                    // 677
 * This is different from MongoObject.prototype.getKeyForPosition in that                                             // 678
 * this method does not depend on the requested position actually being                                               // 679
 * present in any particular MongoObject.                                                                             // 680
 */                                                                                                                   // 681
MongoObject._positionToKey = function positionToKey(position) {                                                       // 682
  //XXX Probably a better way to do this, but this is                                                                 // 683
  //foolproof for now.                                                                                                // 684
  var mDoc = new MongoObject({});                                                                                     // 685
  mDoc.setValueForPosition(position, 1); //value doesn't matter                                                       // 686
  var key = mDoc.getKeyForPosition(position);                                                                         // 687
  mDoc = null;                                                                                                        // 688
  return key;                                                                                                         // 689
};                                                                                                                    // 690
                                                                                                                      // 691
var isArray = _.isArray;                                                                                              // 692
                                                                                                                      // 693
var isObject = function(obj) {                                                                                        // 694
  return obj === Object(obj);                                                                                         // 695
};                                                                                                                    // 696
                                                                                                                      // 697
// getPrototypeOf polyfill                                                                                            // 698
if (typeof Object.getPrototypeOf !== "function") {                                                                    // 699
  if (typeof "".__proto__ === "object") {                                                                             // 700
    Object.getPrototypeOf = function(object) {                                                                        // 701
      return object.__proto__;                                                                                        // 702
    };                                                                                                                // 703
  } else {                                                                                                            // 704
    Object.getPrototypeOf = function(object) {                                                                        // 705
      // May break if the constructor has been tampered with                                                          // 706
      return object.constructor.prototype;                                                                            // 707
    };                                                                                                                // 708
  }                                                                                                                   // 709
}                                                                                                                     // 710
                                                                                                                      // 711
/* Tests whether "obj" is an Object as opposed to                                                                     // 712
 * something that inherits from Object                                                                                // 713
 *                                                                                                                    // 714
 * @param {any} obj                                                                                                   // 715
 * @returns {Boolean}                                                                                                 // 716
 */                                                                                                                   // 717
var isBasicObject = function(obj) {                                                                                   // 718
  return isObject(obj) && Object.getPrototypeOf(obj) === Object.prototype;                                            // 719
};                                                                                                                    // 720
                                                                                                                      // 721
/* Takes a specific string that uses mongo-style dot notation                                                         // 722
 * and returns a generic string equivalent. Replaces all numeric                                                      // 723
 * "pieces" with a dollar sign ($).                                                                                   // 724
 *                                                                                                                    // 725
 * @param {type} name                                                                                                 // 726
 * @returns {unresolved}                                                                                              // 727
 */                                                                                                                   // 728
var makeGeneric = function makeGeneric(name) {                                                                        // 729
  if (typeof name !== "string")                                                                                       // 730
    return null;                                                                                                      // 731
  return name.replace(/\.[0-9]+\./g, '.$.').replace(/\.[0-9]+/g, '.$');                                               // 732
};                                                                                                                    // 733
                                                                                                                      // 734
var appendAffectedKey = function appendAffectedKey(affectedKey, key) {                                                // 735
  if (key === "$each") {                                                                                              // 736
    return affectedKey;                                                                                               // 737
  } else {                                                                                                            // 738
    return (affectedKey ? affectedKey + "." + key : key);                                                             // 739
  }                                                                                                                   // 740
};                                                                                                                    // 741
                                                                                                                      // 742
// Extracts operator piece, if present, from position string                                                          // 743
var extractOp = function extractOp(position) {                                                                        // 744
  var firstPositionPiece = position.slice(0, position.indexOf("["));                                                  // 745
  return (firstPositionPiece.substring(0, 1) === "$") ? firstPositionPiece : null;                                    // 746
};                                                                                                                    // 747
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                    //
// packages/simple-schema/simple-schema-utility.js                                                                    //
//                                                                                                                    //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                      //
Utility = {                                                                                                           // 1
	appendAffectedKey: function appendAffectedKey(affectedKey, key) {                                                    // 2
		if (key === "$each") {                                                                                              // 3
			return affectedKey;                                                                                                // 4
		} else {                                                                                                            // 5
			return (affectedKey ? affectedKey + "." + key : key);                                                              // 6
		}                                                                                                                   // 7
	},                                                                                                                   // 8
	shouldCheck: function shouldCheck(key) {                                                                             // 9
		if (key === "$pushAll") {                                                                                           // 10
			throw new Error("$pushAll is not supported; use $push + $each");                                                   // 11
		}                                                                                                                   // 12
		return !_.contains(["$pull", "$pullAll", "$pop", "$slice"], key);                                                   // 13
	},                                                                                                                   // 14
	isBlank: function isBlank(str) {                                                                                     // 15
		if (typeof str !== "string") {                                                                                      // 16
			return false;                                                                                                      // 17
		}                                                                                                                   // 18
		return (/^\s*$/).test(str);                                                                                         // 19
	},                                                                                                                   // 20
	isBlankNullOrUndefined: function isBlankNullOrUndefined(str) {                                                       // 21
		return (str === void 0 || str === null || Utility.isBlank(str));                                                    // 22
	},                                                                                                                   // 23
	isBlankOrNull: function isBlankOrNull(str) {                                                                         // 24
		return (str === null || Utility.isBlank(str));                                                                      // 25
	},                                                                                                                   // 26
	errorObject: function errorObject(errorType, keyName, keyValue, def, ss) {                                           // 27
	  return {name: keyName, type: errorType, value: keyValue};                                                          // 28
	},                                                                                                                   // 29
	// Tests whether it's an Object as opposed to something that inherits from Object                                    // 30
	isBasicObject: function isBasicObject(obj) {                                                                         // 31
		return _.isObject(obj) && Object.getPrototypeOf(obj) === Object.prototype;                                          // 32
	},                                                                                                                   // 33
	// The latest Safari returns false for Uint8Array, etc. instanceof Function                                          // 34
	// unlike other browsers.                                                                                            // 35
	safariBugFix: function safariBugFix(type) {                                                                          // 36
		return (typeof Uint8Array !== "undefined" && type === Uint8Array)                                                   // 37
		|| (typeof Uint16Array !== "undefined" && type === Uint16Array)                                                     // 38
		|| (typeof Uint32Array !== "undefined" && type === Uint32Array)                                                     // 39
		|| (typeof Uint8ClampedArray !== "undefined" && type === Uint8ClampedArray);                                        // 40
	},                                                                                                                   // 41
	isNotNullOrUndefined: function isNotNullOrUndefined(val) {                                                           // 42
		return val !== void 0 && val !== null;                                                                              // 43
	},                                                                                                                   // 44
	// Extracts operator piece, if present, from position string                                                         // 45
    extractOp: function extractOp(position) {                                                                         // 46
	    var firstPositionPiece = position.slice(0, position.indexOf("["));                                               // 47
	    return (firstPositionPiece.substring(0, 1) === "$") ? firstPositionPiece : null;                                 // 48
	},                                                                                                                   // 49
	deleteIfPresent: function deleteIfPresent(obj, key) {                                                                // 50
		if (key in obj) {                                                                                                   // 51
			delete obj[key];                                                                                                   // 52
		}                                                                                                                   // 53
	},                                                                                                                   // 54
	looksLikeModifier: function looksLikeModifier(obj) {                                                                 // 55
	  for (var key in obj) {                                                                                             // 56
	    if (obj.hasOwnProperty(key) && key.substring(0, 1) === "$") {                                                    // 57
	      return true;                                                                                                   // 58
	    }                                                                                                                // 59
	  }                                                                                                                  // 60
	  return false;                                                                                                      // 61
	},                                                                                                                   // 62
	dateToDateString: function dateToDateString(date) {                                                                  // 63
	  var m = (date.getUTCMonth() + 1);                                                                                  // 64
	  if (m < 10) {                                                                                                      // 65
	    m = "0" + m;                                                                                                     // 66
	  }                                                                                                                  // 67
	  var d = date.getUTCDate();                                                                                         // 68
	  if (d < 10) {                                                                                                      // 69
	    d = "0" + d;                                                                                                     // 70
	  }                                                                                                                  // 71
	  return date.getUTCFullYear() + '-' + m + '-' + d;                                                                  // 72
	}                                                                                                                    // 73
};                                                                                                                    // 74
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                    //
// packages/simple-schema/simple-schema.js                                                                            //
//                                                                                                                    //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                      //
if (Meteor.isServer) {                                                                                                // 1
  S = Npm.require("string");                                                                                          // 2
}                                                                                                                     // 3
if (Meteor.isClient) {                                                                                                // 4
  S = window.S;                                                                                                       // 5
}                                                                                                                     // 6
                                                                                                                      // 7
var schemaDefinition = {                                                                                              // 8
  type: Match.Any,                                                                                                    // 9
  label: Match.Optional(Match.OneOf(String, Function)),                                                               // 10
  optional: Match.Optional(Match.OneOf(Boolean, Function)),                                                           // 11
  min: Match.Optional(Match.OneOf(Number, Date, Function)),                                                           // 12
  max: Match.Optional(Match.OneOf(Number, Date, Function)),                                                           // 13
  minCount: Match.Optional(Match.OneOf(Number, Function)),                                                            // 14
  maxCount: Match.Optional(Match.OneOf(Number, Function)),                                                            // 15
  allowedValues: Match.Optional(Match.OneOf([Match.Any], Function)),                                                  // 16
  decimal: Match.Optional(Boolean),                                                                                   // 17
  regEx: Match.Optional(Match.OneOf(RegExp, [RegExp])),                                                               // 18
  custom: Match.Optional(Function),                                                                                   // 19
  blackbox: Match.Optional(Boolean),                                                                                  // 20
  autoValue: Match.Optional(Function),                                                                                // 21
  defaultValue: Match.Optional(Match.Any)                                                                             // 22
};                                                                                                                    // 23
                                                                                                                      // 24
//exported                                                                                                            // 25
SimpleSchema = function(schemas, options) {                                                                           // 26
  var self = this;                                                                                                    // 27
  var firstLevelSchemaKeys = [];                                                                                      // 28
  var requiredSchemaKeys = [], firstLevelRequiredSchemaKeys = [];                                                     // 29
  var customSchemaKeys = [], firstLevelCustomSchemaKeys = [];                                                         // 30
  var fieldNameRoot;                                                                                                  // 31
  options = options || {};                                                                                            // 32
  schemas = schemas || {};                                                                                            // 33
                                                                                                                      // 34
  if (!_.isArray(schemas)) {                                                                                          // 35
    schemas = [schemas];                                                                                              // 36
  }                                                                                                                   // 37
                                                                                                                      // 38
  // adjust and store a copy of the schema definitions                                                                // 39
  self._schema = mergeSchemas(schemas);                                                                               // 40
                                                                                                                      // 41
  // store the list of defined keys for speedier checking                                                             // 42
  self._schemaKeys = [];                                                                                              // 43
                                                                                                                      // 44
  // store autoValue functions by key                                                                                 // 45
  self._autoValues = {};                                                                                              // 46
                                                                                                                      // 47
  // store the list of blackbox keys for passing to MongoObject constructor                                           // 48
  self._blackboxKeys = [];                                                                                            // 49
                                                                                                                      // 50
  // a place to store custom validators for this instance                                                             // 51
  self._validators = [];                                                                                              // 52
                                                                                                                      // 53
  // a place to store custom error messages for this schema                                                           // 54
  self._messages = {};                                                                                                // 55
                                                                                                                      // 56
  self._depsMessages = new Deps.Dependency;                                                                           // 57
  self._depsLabels = {};                                                                                              // 58
                                                                                                                      // 59
  _.each(self._schema, function(definition, fieldName) {                                                              // 60
    // Validate the field definition                                                                                  // 61
    if (!Match.test(definition, schemaDefinition)) {                                                                  // 62
      throw new Error('Invalid definition for ' + fieldName + ' field.');                                             // 63
    }                                                                                                                 // 64
                                                                                                                      // 65
    fieldNameRoot = fieldName.split(".")[0];                                                                          // 66
                                                                                                                      // 67
    self._schemaKeys.push(fieldName);                                                                                 // 68
                                                                                                                      // 69
    // We support defaultValue shortcut by converting it immediately into an                                          // 70
    // autoValue.                                                                                                     // 71
    if ('defaultValue' in definition) {                                                                               // 72
      if ('autoValue' in definition) {                                                                                // 73
        console.warn('SimpleSchema: Found both autoValue and defaultValue options for "' + fieldName + '". Ignoring defaultValue.');
      } else {                                                                                                        // 75
        if (fieldName.slice(-2) === ".$") {                                                                           // 76
          throw new Error('An array item field (one that ends with ".$") cannot have defaultValue.')                  // 77
        }                                                                                                             // 78
        self._autoValues[fieldName] = (function defineAutoValue(v) {                                                  // 79
          return function() {                                                                                         // 80
            if (this.operator === null && !this.isSet) {                                                              // 81
              return v;                                                                                               // 82
            }                                                                                                         // 83
          };                                                                                                          // 84
        })(definition.defaultValue);                                                                                  // 85
      }                                                                                                               // 86
    }                                                                                                                 // 87
                                                                                                                      // 88
    if ('autoValue' in definition) {                                                                                  // 89
      if (fieldName.slice(-2) === ".$") {                                                                             // 90
        throw new Error('An array item field (one that ends with ".$") cannot have autoValue.')                       // 91
      }                                                                                                               // 92
      self._autoValues[fieldName] = definition.autoValue;                                                             // 93
    }                                                                                                                 // 94
                                                                                                                      // 95
    self._depsLabels[fieldName] = new Deps.Dependency;                                                                // 96
                                                                                                                      // 97
    if (definition.blackbox === true) {                                                                               // 98
      self._blackboxKeys.push(fieldName);                                                                             // 99
    }                                                                                                                 // 100
                                                                                                                      // 101
    if (!_.contains(firstLevelSchemaKeys, fieldNameRoot)) {                                                           // 102
      firstLevelSchemaKeys.push(fieldNameRoot);                                                                       // 103
      if (!definition.optional) {                                                                                     // 104
        firstLevelRequiredSchemaKeys.push(fieldNameRoot);                                                             // 105
      }                                                                                                               // 106
                                                                                                                      // 107
      if (definition.custom) {                                                                                        // 108
        firstLevelCustomSchemaKeys.push(fieldNameRoot);                                                               // 109
      }                                                                                                               // 110
    }                                                                                                                 // 111
                                                                                                                      // 112
    if (!definition.optional) {                                                                                       // 113
      requiredSchemaKeys.push(fieldName);                                                                             // 114
    }                                                                                                                 // 115
                                                                                                                      // 116
    if (definition.custom) {                                                                                          // 117
      customSchemaKeys.push(fieldName);                                                                               // 118
    }                                                                                                                 // 119
                                                                                                                      // 120
  });                                                                                                                 // 121
                                                                                                                      // 122
                                                                                                                      // 123
  // Cache these lists                                                                                                // 124
  self._firstLevelSchemaKeys = firstLevelSchemaKeys;                                                                  // 125
  //required                                                                                                          // 126
  self._requiredSchemaKeys = requiredSchemaKeys;                                                                      // 127
  self._firstLevelRequiredSchemaKeys = firstLevelRequiredSchemaKeys;                                                  // 128
  self._requiredObjectKeys = getObjectKeys(self._schema, requiredSchemaKeys);                                         // 129
  //custom                                                                                                            // 130
  self._customSchemaKeys = customSchemaKeys;                                                                          // 131
  self._firstLevelCustomSchemaKeys = firstLevelCustomSchemaKeys;                                                      // 132
  self._customObjectKeys = getObjectKeys(self._schema, customSchemaKeys);                                             // 133
                                                                                                                      // 134
  // We will store named validation contexts here                                                                     // 135
  self._validationContexts = {};                                                                                      // 136
};                                                                                                                    // 137
                                                                                                                      // 138
// This allows other packages or users to extend the schema                                                           // 139
// definition options that are supported.                                                                             // 140
SimpleSchema.extendOptions = function(options) {                                                                      // 141
  _.extend(schemaDefinition, options);                                                                                // 142
};                                                                                                                    // 143
                                                                                                                      // 144
// regex for email validation after RFC 5322                                                                          // 145
// the obsolete double quotes and square brackets are left out                                                        // 146
// read: http://www.regular-expressions.info/email.html                                                               // 147
var RX_MAIL_NAME = '[a-z0-9!#$%&\'*+\\/=?^_`{|}~-]+(?:\\.[a-z0-9!#$%&\'*+\\/=?^_`{|}~-]+)*';                          // 148
// this domain regex matches all domains that have at least one .                                                     // 149
// sadly IPv4 Adresses will be caught too but technically those are valid domains                                     // 150
// this expression is extracted from the original RFC 5322 mail expression                                            // 151
// a modification enforces that the tld consists only of characters                                                   // 152
var RX_DOMAIN = '(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\\.)+[a-z](?:[a-z-]*[a-z])?';                                      // 153
// this domain regex matches everythign that could be a domain in intranet                                            // 154
// that means "localhost" is a valid domain                                                                           // 155
var RX_NAME_DOMAIN = '(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\\.|$))+';                                                 // 156
// strict IPv4 expression which allows 0-255 per oktett                                                               // 157
var RX_IPv4 = '(?:(?:[0-1]?\\d{1,2}|2[0-4]\\d|25[0-5])(?:\\.|$)){4}';                                                 // 158
// strict IPv6 expression which allows (and validates) all shortcuts                                                  // 159
var RX_IPv6 = '(?:(?:[\\dA-Fa-f]{1,4}(?::|$)){8}' // full adress                                                      // 160
  + '|(?=(?:[^:\\s]|:[^:\\s])*::(?:[^:\\s]|:[^:\\s])*$)' // or min/max one '::'                                       // 161
  + '[\\dA-Fa-f]{0,4}(?:::?(?:[\\dA-Fa-f]{1,4}|$)){1,6})'; // and short adress                                        // 162
// this allows domains (also localhost etc) and ip adresses                                                           // 163
var RX_WEAK_DOMAIN = '(?:' + [RX_NAME_DOMAIN,RX_IPv4,RX_IPv6].join('|') + ')';                                        // 164
                                                                                                                      // 165
SimpleSchema.RegEx = {                                                                                                // 166
  Email: new RegExp('^' + RX_MAIL_NAME + '@' + RX_DOMAIN + '$'),                                                      // 167
  WeakEmail: new RegExp('^' + RX_MAIL_NAME + '@' + RX_WEAK_DOMAIN + '$'),                                             // 168
                                                                                                                      // 169
  Domain: new RegExp('^' + RX_DOMAIN + '$'),                                                                          // 170
  WeakDomain: new RegExp('^' + RX_WEAK_DOMAIN + '$'),                                                                 // 171
                                                                                                                      // 172
  IP: new RegExp('^(?:' + RX_IPv4 + '|' + RX_IPv6 + ')$'),                                                            // 173
  IPv4: new RegExp('^' + RX_IPv4 + '$'),                                                                              // 174
  IPv6: new RegExp('^' + RX_IPv6 + '$'),                                                                              // 175
  // URL RegEx from https://gist.github.com/dperini/729294                                                            // 176
  // http://mathiasbynens.be/demo/url-regex                                                                           // 177
  Url: /^(?:(?:https?|ftp):\/\/)(?:\S+(?::\S*)?@)?(?:(?!10(?:\.\d{1,3}){3})(?!127(?:\.\d{1,3}){3})(?!169\.254(?:\.\d{1,3}){2})(?!192\.168(?:\.\d{1,3}){2})(?!172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})(?:[1-9]\d?|1\d\d|2[01]\d|22[0-3])(?:\.(?:1?\d{1,2}|2[0-4]\d|25[0-5])){2}(?:\.(?:[1-9]\d?|1\d\d|2[0-4]\d|25[0-4]))|(?:(?:[a-z\u00a1-\uffff0-9]+-?)*[a-z\u00a1-\uffff0-9]+)(?:\.(?:[a-z\u00a1-\uffff0-9]+-?)*[a-z\u00a1-\uffff0-9]+)*(?:\.(?:[a-z\u00a1-\uffff]{2,})))(?::\d{2,5})?(?:\/[^\s]*)?$/i,
  // unique id from the random package also used by minimongo                                                         // 179
  // character list: https://github.com/meteor/meteor/blob/release/0.8.0/packages/random/random.js#L88                // 180
  // string length: https://github.com/meteor/meteor/blob/release/0.8.0/packages/random/random.js#L143                // 181
  Id: /^[23456789ABCDEFGHJKLMNPQRSTWXYZabcdefghijkmnopqrstuvwxyz]{17}$/                                               // 182
};                                                                                                                    // 183
                                                                                                                      // 184
SimpleSchema._makeGeneric = function(name) {                                                                          // 185
  if (typeof name !== "string")                                                                                       // 186
    return null;                                                                                                      // 187
                                                                                                                      // 188
  return name.replace(/\.[0-9]+\./g, '.$.').replace(/\.[0-9]+/g, '.$');                                               // 189
};                                                                                                                    // 190
                                                                                                                      // 191
SimpleSchema._depsGlobalMessages = new Deps.Dependency;                                                               // 192
                                                                                                                      // 193
// Inherit from Match.Where                                                                                           // 194
// This allow SimpleSchema instance to be recognized as a Match.Where instance as well                                // 195
// as a SimpleSchema instance                                                                                         // 196
SimpleSchema.prototype = new Match.Where();                                                                           // 197
                                                                                                                      // 198
// If an object is an instance of Match.Where, Meteor built-in check API will look at                                 // 199
// the function named `condition` and will pass it the document to validate                                           // 200
SimpleSchema.prototype.condition = function(obj) {                                                                    // 201
  var self = this;                                                                                                    // 202
                                                                                                                      // 203
  //determine whether obj is a modifier                                                                               // 204
  var isModifier, isNotModifier;                                                                                      // 205
  _.each(obj, function(val, key) {                                                                                    // 206
    if (key.substring(0, 1) === "$") {                                                                                // 207
      isModifier = true;                                                                                              // 208
    } else {                                                                                                          // 209
      isNotModifier = true;                                                                                           // 210
    }                                                                                                                 // 211
  });                                                                                                                 // 212
                                                                                                                      // 213
  if (isModifier && isNotModifier)                                                                                    // 214
    throw new Match.Error("Object cannot contain modifier operators alongside other keys");                           // 215
                                                                                                                      // 216
  if (!self.newContext().validate(obj, {modifier: isModifier, filter: false, autoConvert: false}))                    // 217
    throw new Match.Error("One or more properties do not match the schema.");                                         // 218
                                                                                                                      // 219
  return true;                                                                                                        // 220
};                                                                                                                    // 221
                                                                                                                      // 222
function logInvalidKeysForContext(context, name) {                                                                    // 223
  Meteor.startup(function() {                                                                                         // 224
    Deps.autorun(function() {                                                                                         // 225
      if (!context.isValid()) {                                                                                       // 226
        console.log('SimpleSchema invalid keys for "' + name + '" context:', context.invalidKeys());                  // 227
      }                                                                                                               // 228
    });                                                                                                               // 229
  });                                                                                                                 // 230
}                                                                                                                     // 231
                                                                                                                      // 232
SimpleSchema.prototype.namedContext = function(name) {                                                                // 233
  var self = this;                                                                                                    // 234
  if (typeof name !== "string") {                                                                                     // 235
    name = "default";                                                                                                 // 236
  }                                                                                                                   // 237
  if (!self._validationContexts[name]) {                                                                              // 238
    self._validationContexts[name] = new SimpleSchemaValidationContext(self);                                         // 239
                                                                                                                      // 240
    // In debug mode, log all invalid key errors to the browser console                                               // 241
    if (SimpleSchema.debug && Meteor.isClient) {                                                                      // 242
      Deps.nonreactive(function() {                                                                                   // 243
        logInvalidKeysForContext(self._validationContexts[name], name);                                               // 244
      });                                                                                                             // 245
    }                                                                                                                 // 246
  }                                                                                                                   // 247
  return self._validationContexts[name];                                                                              // 248
};                                                                                                                    // 249
                                                                                                                      // 250
// Global custom validators                                                                                           // 251
SimpleSchema._validators = [];                                                                                        // 252
SimpleSchema.addValidator = function(func) {                                                                          // 253
  SimpleSchema._validators.push(func);                                                                                // 254
};                                                                                                                    // 255
                                                                                                                      // 256
// Instance custom validators                                                                                         // 257
// validator is deprecated; use addValidator                                                                          // 258
SimpleSchema.prototype.addValidator = SimpleSchema.prototype.validator = function(func) {                             // 259
  this._validators.push(func);                                                                                        // 260
};                                                                                                                    // 261
                                                                                                                      // 262
/**                                                                                                                   // 263
 * @method SimpleSchema.prototype.clean                                                                               // 264
 * @param {Object} doc - Document or modifier to clean. Referenced object will be modified in place.                  // 265
 * @param {Object} [options]                                                                                          // 266
 * @param {Boolean} [options.filter=true] - Do filtering?                                                             // 267
 * @param {Boolean} [options.autoConvert=true] - Do automatic type converting?                                        // 268
 * @param {Boolean} [options.removeEmptyStrings=true] - Remove keys in normal object or $set where the value is an empty string?
 * @param {Boolean} [options.getAutoValues=true] - Inject automatic and default values?                               // 270
 * @param {Boolean} [options.isModifier=false] - Is doc a modifier object?                                            // 271
 * @param {Object} [options.extendAutoValueContext] - This object will be added to the `this` context of autoValue functions.
 * @returns {Object} The modified doc.                                                                                // 273
 *                                                                                                                    // 274
 * Cleans a document or modifier object. By default, will filter, automatically                                       // 275
 * type convert where possible, and inject automatic/default values. Use the options                                  // 276
 * to skip one or more of these.                                                                                      // 277
 */                                                                                                                   // 278
SimpleSchema.prototype.clean = function(doc, options) {                                                               // 279
  var self = this;                                                                                                    // 280
                                                                                                                      // 281
  // By default, doc will be filtered and autoconverted                                                               // 282
  options = _.extend({                                                                                                // 283
    filter: true,                                                                                                     // 284
    autoConvert: true,                                                                                                // 285
    removeEmptyStrings: true,                                                                                         // 286
    getAutoValues: true,                                                                                              // 287
    isModifier: false,                                                                                                // 288
    extendAutoValueContext: {}                                                                                        // 289
  }, options || {});                                                                                                  // 290
                                                                                                                      // 291
  // Convert $pushAll (deprecated) to $push with $each                                                                // 292
  if ("$pushAll" in doc) {                                                                                            // 293
    console.warn("SimpleSchema.clean: $pushAll is deprecated; converting to $push with $each");                       // 294
    doc.$push = doc.$push || {};                                                                                      // 295
    for (var field in doc.$pushAll) {                                                                                 // 296
      doc.$push[field] = doc.$push[field] || {};                                                                      // 297
      doc.$push[field].$each = doc.$push[field].$each || [];                                                          // 298
      for (var i = 0, ln = doc.$pushAll[field].length; i < ln; i++) {                                                 // 299
        doc.$push[field].$each.push(doc.$pushAll[field][i]);                                                          // 300
      }                                                                                                               // 301
      delete doc.$pushAll;                                                                                            // 302
    }                                                                                                                 // 303
  }                                                                                                                   // 304
                                                                                                                      // 305
  var mDoc = new MongoObject(doc, self._blackboxKeys);                                                                // 306
                                                                                                                      // 307
  // Filter out anything that would affect keys not defined                                                           // 308
  // or implied by the schema                                                                                         // 309
  options.filter && mDoc.filterGenericKeys(function(genericKey) {                                                     // 310
    var allowed = self.allowsKey(genericKey);                                                                         // 311
    if (!allowed && SimpleSchema.debug) {                                                                             // 312
      console.info('SimpleSchema.clean: filtered out value that would have affected key "' + genericKey + '", which is not allowed by the schema');
    }                                                                                                                 // 314
    return allowed;                                                                                                   // 315
  });                                                                                                                 // 316
                                                                                                                      // 317
  // Autoconvert values if requested and if possible                                                                  // 318
  (options.autoConvert || options.removeEmptyStrings) && mDoc.forEachNode(function() {                                // 319
    if (this.genericKey) {                                                                                            // 320
      var def = self._schema[this.genericKey];                                                                        // 321
      var val = this.value;                                                                                           // 322
      if (def && val !== void 0) {                                                                                    // 323
        var wasAutoConverted = false;                                                                                 // 324
        if (options.autoConvert) {                                                                                    // 325
          var newVal = typeconvert(val, def.type);                                                                    // 326
          if (newVal !== void 0 && newVal !== val) {                                                                  // 327
            SimpleSchema.debug && console.info('SimpleSchema.clean: autoconverted value ' + val + ' from ' + typeof val + ' to ' + typeof newVal + ' for ' + this.genericKey);
            this.updateValue(newVal);                                                                                 // 329
            wasAutoConverted = true;                                                                                  // 330
            // remove empty strings                                                                                   // 331
            if (options.removeEmptyStrings && (!this.operator || this.operator === "$set") && typeof newVal === "string" && !newVal.length) {
              this.remove();                                                                                          // 333
            }                                                                                                         // 334
          }                                                                                                           // 335
        }                                                                                                             // 336
        // remove empty strings                                                                                       // 337
        if (options.removeEmptyStrings && !wasAutoConverted && (!this.operator || this.operator === "$set") && typeof val === "string" && !val.length) {
          // For a document, we remove any fields that are being set to an empty string                               // 339
          this.remove();                                                                                              // 340
          // For a modifier, we $unset any fields that are being set to an empty string                               // 341
          if (this.operator === "$set") {                                                                             // 342
            var p = this.position.replace("$set", "$unset");                                                          // 343
            mDoc.setValueForPosition(p, "");                                                                          // 344
          }                                                                                                           // 345
        }                                                                                                             // 346
      }                                                                                                               // 347
    }                                                                                                                 // 348
  }, {endPointsOnly: false});                                                                                         // 349
                                                                                                                      // 350
  // Set automatic values                                                                                             // 351
  options.getAutoValues && getAutoValues.call(self, mDoc, options.isModifier, options.extendAutoValueContext);        // 352
                                                                                                                      // 353
  return doc;                                                                                                         // 354
};                                                                                                                    // 355
                                                                                                                      // 356
// Returns the entire schema object or just the definition for one key                                                // 357
// in the schema.                                                                                                     // 358
SimpleSchema.prototype.schema = function(key) {                                                                       // 359
  var self = this;                                                                                                    // 360
  // if not null or undefined (more specific)                                                                         // 361
  if (key != null) {                                                                                                  // 362
    return self._schema[SimpleSchema._makeGeneric(key)];                                                              // 363
  } else {                                                                                                            // 364
    return self._schema;                                                                                              // 365
  }                                                                                                                   // 366
};                                                                                                                    // 367
                                                                                                                      // 368
// Returns the evaluated definition for one key in the schema                                                         // 369
// key = non-generic key                                                                                              // 370
// [propList] = props to include in the result, for performance                                                       // 371
// [functionContext] = used for evaluating schema options that are functions                                          // 372
SimpleSchema.prototype.getDefinition = function(key, propList, functionContext) {                                     // 373
  var self = this;                                                                                                    // 374
  var defs = self.schema(key);                                                                                        // 375
  if (!defs)                                                                                                          // 376
    return;                                                                                                           // 377
                                                                                                                      // 378
  if (_.isArray(propList)) {                                                                                          // 379
    defs = _.pick(defs, propList);                                                                                    // 380
  } else {                                                                                                            // 381
    defs = _.clone(defs);                                                                                             // 382
  }                                                                                                                   // 383
                                                                                                                      // 384
  // For any options that support specifying a function,                                                              // 385
  // evaluate the functions.                                                                                          // 386
  _.each(['min', 'max', 'minCount', 'maxCount', 'allowedValues', 'optional', 'label'], function (prop) {              // 387
    if (_.isFunction(defs[prop])) {                                                                                   // 388
      defs[prop] = defs[prop].call(functionContext || {});                                                            // 389
    }                                                                                                                 // 390
  });                                                                                                                 // 391
                                                                                                                      // 392
  // Inflect label if not defined                                                                                     // 393
  defs["label"] = defs["label"] || inflectedLabel(key);                                                               // 394
                                                                                                                      // 395
  return defs;                                                                                                        // 396
};                                                                                                                    // 397
                                                                                                                      // 398
// Check if the key is a nested dot-syntax key inside of a blackbox object                                            // 399
SimpleSchema.prototype.keyIsInBlackBox = function(key) {                                                              // 400
  var self = this;                                                                                                    // 401
  var parentPath = SimpleSchema._makeGeneric(key), lastDot, def;                                                      // 402
                                                                                                                      // 403
  // Iterate the dot-syntax hierarchy until we find a key in our schema                                               // 404
  do {                                                                                                                // 405
    lastDot = parentPath.lastIndexOf('.');                                                                            // 406
    if (lastDot !== -1) {                                                                                             // 407
      parentPath = parentPath.slice(0, lastDot); // Remove last path component                                        // 408
      def = self.getDefinition(parentPath);                                                                           // 409
    }                                                                                                                 // 410
  } while (lastDot !== -1 && !def);                                                                                   // 411
                                                                                                                      // 412
  return !!(def && def.blackbox);                                                                                     // 413
};                                                                                                                    // 414
                                                                                                                      // 415
// Use to dynamically change the schema labels.                                                                       // 416
SimpleSchema.prototype.labels = function(labels) {                                                                    // 417
  var self = this;                                                                                                    // 418
  _.each(labels, function(label, fieldName) {                                                                         // 419
    if (!_.isString(label) && !_.isFunction(label))                                                                   // 420
      return;                                                                                                         // 421
                                                                                                                      // 422
    if (!(fieldName in self._schema))                                                                                 // 423
      return;                                                                                                         // 424
                                                                                                                      // 425
    self._schema[fieldName].label = label;                                                                            // 426
    self._depsLabels[fieldName] && self._depsLabels[fieldName].changed();                                             // 427
  });                                                                                                                 // 428
};                                                                                                                    // 429
                                                                                                                      // 430
// should be used to safely get a label as string                                                                     // 431
SimpleSchema.prototype.label = function(key) {                                                                        // 432
  var self = this;                                                                                                    // 433
                                                                                                                      // 434
  // Get all labels                                                                                                   // 435
  if (key == null) {                                                                                                  // 436
    var result = {};                                                                                                  // 437
    _.each(self.schema(), function(def, fieldName) {                                                                  // 438
      result[fieldName] = self.label(fieldName);                                                                      // 439
    });                                                                                                               // 440
    return result;                                                                                                    // 441
  }                                                                                                                   // 442
                                                                                                                      // 443
  // Get label for one field                                                                                          // 444
  var def = self.getDefinition(key);                                                                                  // 445
  if (def) {                                                                                                          // 446
    self._depsLabels[key] && self._depsLabels[key].depend();                                                          // 447
    return def.label;                                                                                                 // 448
  }                                                                                                                   // 449
                                                                                                                      // 450
  return null;                                                                                                        // 451
};                                                                                                                    // 452
                                                                                                                      // 453
// Global messages                                                                                                    // 454
                                                                                                                      // 455
SimpleSchema._globalMessages = {                                                                                      // 456
  required: "[label] is required",                                                                                    // 457
  minString: "[label] must be at least [min] characters",                                                             // 458
  maxString: "[label] cannot exceed [max] characters",                                                                // 459
  minNumber: "[label] must be at least [min]",                                                                        // 460
  maxNumber: "[label] cannot exceed [max]",                                                                           // 461
  minDate: "[label] must be on or before [min]",                                                                      // 462
  maxDate: "[label] cannot be after [max]",                                                                           // 463
  minCount: "You must specify at least [minCount] values",                                                            // 464
  maxCount: "You cannot specify more than [maxCount] values",                                                         // 465
  noDecimal: "[label] must be an integer",                                                                            // 466
  notAllowed: "[value] is not an allowed value",                                                                      // 467
  expectedString: "[label] must be a string",                                                                         // 468
  expectedNumber: "[label] must be a number",                                                                         // 469
  expectedBoolean: "[label] must be a boolean",                                                                       // 470
  expectedArray: "[label] must be an array",                                                                          // 471
  expectedObject: "[label] must be an object",                                                                        // 472
  expectedConstructor: "[label] must be a [type]",                                                                    // 473
  regEx: [                                                                                                            // 474
    {msg: "[label] failed regular expression validation"},                                                            // 475
    {exp: SimpleSchema.RegEx.Email, msg: "[label] must be a valid e-mail address"},                                   // 476
    {exp: SimpleSchema.RegEx.WeakEmail, msg: "[label] must be a valid e-mail address"},                               // 477
    {exp: SimpleSchema.RegEx.Domain, msg: "[label] must be a valid domain"},                                          // 478
    {exp: SimpleSchema.RegEx.WeakDomain, msg: "[label] must be a valid domain"},                                      // 479
    {exp: SimpleSchema.RegEx.IP, msg: "[label] must be a valid IPv4 or IPv6 address"},                                // 480
    {exp: SimpleSchema.RegEx.IPv4, msg: "[label] must be a valid IPv4 address"},                                      // 481
    {exp: SimpleSchema.RegEx.IPv6, msg: "[label] must be a valid IPv6 address"},                                      // 482
    {exp: SimpleSchema.RegEx.Url, msg: "[label] must be a valid URL"},                                                // 483
    {exp: SimpleSchema.RegEx.Id, msg: "[label] must be a valid alphanumeric ID"}                                      // 484
  ],                                                                                                                  // 485
  keyNotInSchema: "[label] is not allowed by the schema"                                                              // 486
};                                                                                                                    // 487
                                                                                                                      // 488
SimpleSchema.messages = function(messages) {                                                                          // 489
  _.extend(SimpleSchema._globalMessages, messages);                                                                   // 490
  SimpleSchema._depsGlobalMessages.changed();                                                                         // 491
};                                                                                                                    // 492
                                                                                                                      // 493
// Schema-specific messages                                                                                           // 494
                                                                                                                      // 495
SimpleSchema.prototype.messages = function(messages) {                                                                // 496
  var self = this;                                                                                                    // 497
  _.extend(self._messages, messages);                                                                                 // 498
  self._depsMessages.changed();                                                                                       // 499
};                                                                                                                    // 500
                                                                                                                      // 501
// Returns a string message for the given error type and key. Uses the                                                // 502
// def and value arguments to fill in placeholders in the error messages.                                             // 503
SimpleSchema.prototype.messageForError = function(type, key, def, value) {                                            // 504
  var self = this;                                                                                                    // 505
  def = def || self.schema(key) || {};                                                                                // 506
                                                                                                                      // 507
  // Adjust for complex types, currently only regEx,                                                                  // 508
  // where we might have regEx.1 meaning the second                                                                   // 509
  // expression in the array.                                                                                         // 510
  var firstTypePeriod = type.indexOf("."), index = null;                                                              // 511
  if (firstTypePeriod !== -1) {                                                                                       // 512
    index = type.substring(firstTypePeriod + 1);                                                                      // 513
    index = parseInt(index, 10);                                                                                      // 514
    type = type.substring(0, firstTypePeriod);                                                                        // 515
  }                                                                                                                   // 516
                                                                                                                      // 517
  // Which regExp is it?                                                                                              // 518
  var regExpMatch;                                                                                                    // 519
  if (type === "regEx") {                                                                                             // 520
    if (index != null && !isNaN(index)) {                                                                             // 521
      regExpMatch = def.regEx[index];                                                                                 // 522
    } else {                                                                                                          // 523
      regExpMatch = def.regEx;                                                                                        // 524
    }                                                                                                                 // 525
    if (regExpMatch) {                                                                                                // 526
      regExpMatch = regExpMatch.toString();                                                                           // 527
    }                                                                                                                 // 528
  }                                                                                                                   // 529
                                                                                                                      // 530
  // Prep some strings to be used when finding the correct message for this error                                     // 531
  var typePlusKey = type + " " + key;                                                                                 // 532
  var genericKey = SimpleSchema._makeGeneric(key);                                                                    // 533
  var typePlusGenKey = type + " " + genericKey;                                                                       // 534
                                                                                                                      // 535
  // reactively update when message templates or labels are changed                                                   // 536
  SimpleSchema._depsGlobalMessages.depend();                                                                          // 537
  self._depsMessages.depend();                                                                                        // 538
  self._depsLabels[key] && self._depsLabels[key].depend();                                                            // 539
                                                                                                                      // 540
  // Prep a function that finds the correct message for regEx errors                                                  // 541
  function findRegExError(message) {                                                                                  // 542
    if (type !== "regEx" || !_.isArray(message)) {                                                                    // 543
      return message;                                                                                                 // 544
    }                                                                                                                 // 545
    // Parse regEx messages, which are provided in a special object array format                                      // 546
    // [{exp: RegExp, msg: "Foo"}]                                                                                    // 547
    // Where `exp` is optional                                                                                        // 548
                                                                                                                      // 549
    var msgObj;                                                                                                       // 550
    // First see if there's one where exp matches this expression                                                     // 551
    if (regExpMatch) {                                                                                                // 552
      msgObj = _.find(message, function (o) {                                                                         // 553
        return o.exp && o.exp.toString() === regExpMatch;                                                             // 554
      });                                                                                                             // 555
    }                                                                                                                 // 556
                                                                                                                      // 557
    // If not, see if there's a default message defined                                                               // 558
    if (!msgObj) {                                                                                                    // 559
      msgObj = _.findWhere(message, {exp: null});                                                                     // 560
      if (!msgObj) {                                                                                                  // 561
        msgObj = _.findWhere(message, {exp: void 0});                                                                 // 562
      }                                                                                                               // 563
    }                                                                                                                 // 564
                                                                                                                      // 565
    return msgObj ? msgObj.msg : null;                                                                                // 566
  }                                                                                                                   // 567
                                                                                                                      // 568
  // Try finding the correct message to use at various levels, from most                                              // 569
  // specific to least specific.                                                                                      // 570
  var message = self._messages[typePlusKey] ||                  // (1) Use schema-specific message for specific key   // 571
                self._messages[typePlusGenKey] ||               // (2) Use schema-specific message for generic key    // 572
                self._messages[type];                           // (3) Use schema-specific message for type           // 573
  message = findRegExError(message);                                                                                  // 574
                                                                                                                      // 575
  if (!message) {                                                                                                     // 576
    message = SimpleSchema._globalMessages[typePlusKey] ||      // (4) Use global message for specific key            // 577
              SimpleSchema._globalMessages[typePlusGenKey] ||   // (5) Use global message for generic key             // 578
              SimpleSchema._globalMessages[type];               // (6) Use global message for type                    // 579
    message = findRegExError(message);                                                                                // 580
  }                                                                                                                   // 581
                                                                                                                      // 582
  if (!message) {                                                                                                     // 583
    return "Unknown validation error";                                                                                // 584
  }                                                                                                                   // 585
                                                                                                                      // 586
  // Now replace all placeholders in the message with the correct values                                              // 587
  message = message.replace("[label]", self.label(key));                                                              // 588
  if (typeof def.minCount !== "undefined") {                                                                          // 589
    message = message.replace("[minCount]", def.minCount);                                                            // 590
  }                                                                                                                   // 591
  if (typeof def.maxCount !== "undefined") {                                                                          // 592
    message = message.replace("[maxCount]", def.maxCount);                                                            // 593
  }                                                                                                                   // 594
  if (value !== void 0 && value !== null) {                                                                           // 595
    message = message.replace("[value]", value.toString());                                                           // 596
  }                                                                                                                   // 597
  var min = def.min;                                                                                                  // 598
  var max = def.max;                                                                                                  // 599
  if (typeof min === "function") {                                                                                    // 600
    min = min();                                                                                                      // 601
  }                                                                                                                   // 602
  if (typeof max === "function") {                                                                                    // 603
    max = max();                                                                                                      // 604
  }                                                                                                                   // 605
  if (def.type === Date || def.type === [Date]) {                                                                     // 606
    if (typeof min !== "undefined") {                                                                                 // 607
      message = message.replace("[min]", Utility.dateToDateString(min));                                              // 608
    }                                                                                                                 // 609
    if (typeof max !== "undefined") {                                                                                 // 610
      message = message.replace("[max]", Utility.dateToDateString(max));                                              // 611
    }                                                                                                                 // 612
  } else {                                                                                                            // 613
    if (typeof min !== "undefined") {                                                                                 // 614
      message = message.replace("[min]", min);                                                                        // 615
    }                                                                                                                 // 616
    if (typeof max !== "undefined") {                                                                                 // 617
      message = message.replace("[max]", max);                                                                        // 618
    }                                                                                                                 // 619
  }                                                                                                                   // 620
  if (def.type instanceof Function) {                                                                                 // 621
    message = message.replace("[type]", def.type.name);                                                               // 622
  }                                                                                                                   // 623
                                                                                                                      // 624
  // Now return the message                                                                                           // 625
  return message;                                                                                                     // 626
};                                                                                                                    // 627
                                                                                                                      // 628
// Returns true if key is explicitly allowed by the schema or implied                                                 // 629
// by other explicitly allowed keys.                                                                                  // 630
// The key string should have $ in place of any numeric array positions.                                              // 631
SimpleSchema.prototype.allowsKey = function(key) {                                                                    // 632
  var self = this;                                                                                                    // 633
                                                                                                                      // 634
  // Loop through all keys in the schema                                                                              // 635
  return _.any(self._schemaKeys, function(schemaKey) {                                                                // 636
                                                                                                                      // 637
    // If the schema key is the test key, it's allowed.                                                               // 638
    if (schemaKey === key) {                                                                                          // 639
      return true;                                                                                                    // 640
    }                                                                                                                 // 641
                                                                                                                      // 642
    // Black box handling                                                                                             // 643
    if (self.schema(schemaKey).blackbox === true) {                                                                   // 644
      var kl = schemaKey.length;                                                                                      // 645
      var compare1 = key.slice(0, kl + 2);                                                                            // 646
      var compare2 = compare1.slice(0, -1);                                                                           // 647
                                                                                                                      // 648
      // If the test key is the black box key + ".$", then the test                                                   // 649
      // key is NOT allowed because black box keys are by definition                                                  // 650
      // only for objects, and not for arrays.                                                                        // 651
      if (compare1 === schemaKey + '.$')                                                                              // 652
        return false;                                                                                                 // 653
                                                                                                                      // 654
      // Otherwise                                                                                                    // 655
      if (compare2 === schemaKey + '.')                                                                               // 656
        return true;                                                                                                  // 657
    }                                                                                                                 // 658
                                                                                                                      // 659
    return false;                                                                                                     // 660
  });                                                                                                                 // 661
};                                                                                                                    // 662
                                                                                                                      // 663
SimpleSchema.prototype.newContext = function() {                                                                      // 664
  return new SimpleSchemaValidationContext(this);                                                                     // 665
};                                                                                                                    // 666
                                                                                                                      // 667
SimpleSchema.prototype.requiredObjectKeys = function(keyPrefix) {                                                     // 668
  var self = this;                                                                                                    // 669
  if (!keyPrefix) {                                                                                                   // 670
    return self._firstLevelRequiredSchemaKeys;                                                                        // 671
  }                                                                                                                   // 672
  return self._requiredObjectKeys[keyPrefix + "."] || [];                                                             // 673
};                                                                                                                    // 674
                                                                                                                      // 675
SimpleSchema.prototype.requiredSchemaKeys = function() {                                                              // 676
  return this._requiredSchemaKeys;                                                                                    // 677
};                                                                                                                    // 678
                                                                                                                      // 679
SimpleSchema.prototype.firstLevelSchemaKeys = function() {                                                            // 680
  return this._firstLevelSchemaKeys;                                                                                  // 681
};                                                                                                                    // 682
                                                                                                                      // 683
SimpleSchema.prototype.customObjectKeys = function(keyPrefix) {                                                       // 684
  var self = this;                                                                                                    // 685
  if (!keyPrefix) {                                                                                                   // 686
    return self._firstLevelCustomSchemaKeys;                                                                          // 687
  }                                                                                                                   // 688
  return self._customObjectKeys[keyPrefix + "."] || [];                                                               // 689
};                                                                                                                    // 690
                                                                                                                      // 691
SimpleSchema.prototype.customSchemaKeys = function() {                                                                // 692
  return this._customSchemaKeys;                                                                                      // 693
};                                                                                                                    // 694
                                                                                                                      // 695
/*                                                                                                                    // 696
 * PRIVATE FUNCTIONS                                                                                                  // 697
 */                                                                                                                   // 698
                                                                                                                      // 699
//called by clean()                                                                                                   // 700
var typeconvert = function(value, type) {                                                                             // 701
  if (_.isArray(value) || (_.isObject(value) && !(value instanceof Date)))                                            // 702
    return value; //can't and shouldn't convert arrays or objects                                                     // 703
  if (type === String) {                                                                                              // 704
    if (typeof value !== "undefined" && value !== null && typeof value !== "string") {                                // 705
      return value.toString();                                                                                        // 706
    }                                                                                                                 // 707
    return value;                                                                                                     // 708
  }                                                                                                                   // 709
  if (type === Number) {                                                                                              // 710
    if (typeof value === "string" && !S(value).isEmpty()) {                                                           // 711
      //try to convert numeric strings to numbers                                                                     // 712
      var numberVal = Number(value);                                                                                  // 713
      if (!isNaN(numberVal)) {                                                                                        // 714
        return numberVal;                                                                                             // 715
      } else {                                                                                                        // 716
        return value; //leave string; will fail validation                                                            // 717
      }                                                                                                               // 718
    }                                                                                                                 // 719
    return value;                                                                                                     // 720
  }                                                                                                                   // 721
  return value;                                                                                                       // 722
};                                                                                                                    // 723
                                                                                                                      // 724
var mergeSchemas = function(schemas) {                                                                                // 725
                                                                                                                      // 726
  // Merge all provided schema definitions.                                                                           // 727
  // This is effectively a shallow clone of each object, too,                                                         // 728
  // which is what we want since we are going to manipulate it.                                                       // 729
  var mergedSchema = {};                                                                                              // 730
  _.each(schemas, function(schema) {                                                                                  // 731
                                                                                                                      // 732
    // Create a temporary SS instance so that the internal object                                                     // 733
    // we use for merging/extending will be fully expanded                                                            // 734
    if (Match.test(schema, SimpleSchema)) {                                                                           // 735
      schema = schema._schema;                                                                                        // 736
    } else {                                                                                                          // 737
      schema = addImplicitKeys(expandSchema(schema));                                                                 // 738
    }                                                                                                                 // 739
                                                                                                                      // 740
    // Loop through and extend each individual field                                                                  // 741
    // definition. That way you can extend and overwrite                                                              // 742
    // base field definitions.                                                                                        // 743
    _.each(schema, function(def, field) {                                                                             // 744
      mergedSchema[field] = mergedSchema[field] || {};                                                                // 745
      _.extend(mergedSchema[field], def);                                                                             // 746
    });                                                                                                               // 747
                                                                                                                      // 748
  });                                                                                                                 // 749
                                                                                                                      // 750
  // If we merged some schemas, do this again to make sure                                                            // 751
  // extended definitions are pushed into array item field                                                            // 752
  // definitions properly.                                                                                            // 753
  schemas.length && adjustArrayFields(mergedSchema);                                                                  // 754
                                                                                                                      // 755
  return mergedSchema;                                                                                                // 756
};                                                                                                                    // 757
                                                                                                                      // 758
var expandSchema = function(schema) {                                                                                 // 759
  // Flatten schema by inserting nested definitions                                                                   // 760
  _.each(schema, function(val, key) {                                                                                 // 761
    var dot, type;                                                                                                    // 762
    if (!val)                                                                                                         // 763
      return;                                                                                                         // 764
    if (Match.test(val.type, SimpleSchema)) {                                                                         // 765
      dot = '.';                                                                                                      // 766
      type = val.type;                                                                                                // 767
      val.type = Object;                                                                                              // 768
    } else if (Match.test(val.type, [SimpleSchema])) {                                                                // 769
      dot = '.$.';                                                                                                    // 770
      type = val.type[0];                                                                                             // 771
      val.type = [Object];                                                                                            // 772
    } else {                                                                                                          // 773
      return;                                                                                                         // 774
    }                                                                                                                 // 775
    //add child schema definitions to parent schema                                                                   // 776
    _.each(type._schema, function(subVal, subKey) {                                                                   // 777
      var newKey = key + dot + subKey;                                                                                // 778
      if (!(newKey in schema))                                                                                        // 779
        schema[newKey] = subVal;                                                                                      // 780
    });                                                                                                               // 781
  });                                                                                                                 // 782
  return schema;                                                                                                      // 783
};                                                                                                                    // 784
                                                                                                                      // 785
var adjustArrayFields = function(schema) {                                                                            // 786
  _.each(schema, function(def, existingKey) {                                                                         // 787
    if (_.isArray(def.type) || def.type === Array) {                                                                  // 788
      // Copy some options to array-item definition                                                                   // 789
      var itemKey = existingKey + ".$";                                                                               // 790
      if (!(itemKey in schema)) {                                                                                     // 791
        schema[itemKey] = {};                                                                                         // 792
      }                                                                                                               // 793
      if (_.isArray(def.type)) {                                                                                      // 794
        schema[itemKey].type = def.type[0];                                                                           // 795
      }                                                                                                               // 796
      if (def.label) {                                                                                                // 797
        schema[itemKey].label = def.label;                                                                            // 798
      }                                                                                                               // 799
      schema[itemKey].optional = true;                                                                                // 800
      if (typeof def.min !== "undefined") {                                                                           // 801
        schema[itemKey].min = def.min;                                                                                // 802
      }                                                                                                               // 803
      if (typeof def.max !== "undefined") {                                                                           // 804
        schema[itemKey].max = def.max;                                                                                // 805
      }                                                                                                               // 806
      if (typeof def.allowedValues !== "undefined") {                                                                 // 807
        schema[itemKey].allowedValues = def.allowedValues;                                                            // 808
      }                                                                                                               // 809
      if (typeof def.decimal !== "undefined") {                                                                       // 810
        schema[itemKey].decimal = def.decimal;                                                                        // 811
      }                                                                                                               // 812
      if (typeof def.regEx !== "undefined") {                                                                         // 813
        schema[itemKey].regEx = def.regEx;                                                                            // 814
      }                                                                                                               // 815
      // Remove copied options and adjust type                                                                        // 816
      def.type = Array;                                                                                               // 817
      _.each(['min', 'max', 'allowedValues', 'decimal', 'regEx'], function(k) {                                       // 818
        Utility.deleteIfPresent(def, k);                                                                              // 819
      });                                                                                                             // 820
    }                                                                                                                 // 821
  });                                                                                                                 // 822
};                                                                                                                    // 823
                                                                                                                      // 824
/**                                                                                                                   // 825
 * Adds implied keys.                                                                                                 // 826
 * * If schema contains a key like "foo.$.bar" but not "foo", adds "foo".                                             // 827
 * * If schema contains a key like "foo" with an array type, adds "foo.$".                                            // 828
 * @param {Object} schema                                                                                             // 829
 * @returns {Object} modified schema                                                                                  // 830
 */                                                                                                                   // 831
var addImplicitKeys = function(schema) {                                                                              // 832
  var arrayKeysToAdd = [], objectKeysToAdd = [], newKey, key;                                                         // 833
                                                                                                                      // 834
  // Pass 1 (objects)                                                                                                 // 835
  _.each(schema, function(def, existingKey) {                                                                         // 836
    var pos = existingKey.indexOf(".");                                                                               // 837
    while (pos !== -1) {                                                                                              // 838
      newKey = existingKey.substring(0, pos);                                                                         // 839
                                                                                                                      // 840
      // It's an array item; nothing to add                                                                           // 841
      if (newKey.substring(newKey.length - 2) === ".$") {                                                             // 842
        pos = -1;                                                                                                     // 843
      }                                                                                                               // 844
      // It's an array of objects; add it with type [Object] if not already in the schema                             // 845
      else if (existingKey.substring(pos, pos + 3) === ".$.") {                                                       // 846
        arrayKeysToAdd.push(newKey); // add later, since we are iterating over schema right now                       // 847
        pos = existingKey.indexOf(".", pos + 3); // skip over next dot, find the one after                            // 848
      }                                                                                                               // 849
      // It's an object; add it with type Object if not already in the schema                                         // 850
      else {                                                                                                          // 851
        objectKeysToAdd.push(newKey); // add later, since we are iterating over schema right now                      // 852
        pos = existingKey.indexOf(".", pos + 1); // find next dot                                                     // 853
      }                                                                                                               // 854
    }                                                                                                                 // 855
  });                                                                                                                 // 856
                                                                                                                      // 857
  for (var i = 0, ln = arrayKeysToAdd.length; i < ln; i++) {                                                          // 858
    key = arrayKeysToAdd[i];                                                                                          // 859
    if (!(key in schema)) {                                                                                           // 860
      schema[key] = {type: [Object], optional: true};                                                                 // 861
    }                                                                                                                 // 862
  }                                                                                                                   // 863
                                                                                                                      // 864
  for (var i = 0, ln = objectKeysToAdd.length; i < ln; i++) {                                                         // 865
    key = objectKeysToAdd[i];                                                                                         // 866
    if (!(key in schema)) {                                                                                           // 867
      schema[key] = {type: Object, optional: true};                                                                   // 868
    }                                                                                                                 // 869
  }                                                                                                                   // 870
                                                                                                                      // 871
  // Pass 2 (arrays)                                                                                                  // 872
  adjustArrayFields(schema);                                                                                          // 873
                                                                                                                      // 874
  return schema;                                                                                                      // 875
};                                                                                                                    // 876
                                                                                                                      // 877
// Returns an object relating the keys in the list                                                                    // 878
// to their parent object.                                                                                            // 879
var getObjectKeys = function(schema, schemaKeyList) {                                                                 // 880
  var keyPrefix, remainingText, rKeys = {}, loopArray;                                                                // 881
  _.each(schema, function(definition, fieldName) {                                                                    // 882
    if (definition.type === Object) {                                                                                 // 883
      //object                                                                                                        // 884
      keyPrefix = fieldName + ".";                                                                                    // 885
    } else {                                                                                                          // 886
      return;                                                                                                         // 887
    }                                                                                                                 // 888
                                                                                                                      // 889
    loopArray = [];                                                                                                   // 890
    _.each(schemaKeyList, function(fieldName2) {                                                                      // 891
      if (S(fieldName2).startsWith(keyPrefix)) {                                                                      // 892
        remainingText = fieldName2.substring(keyPrefix.length);                                                       // 893
        if (remainingText.indexOf(".") === -1) {                                                                      // 894
          loopArray.push(remainingText);                                                                              // 895
        }                                                                                                             // 896
      }                                                                                                               // 897
    });                                                                                                               // 898
    rKeys[keyPrefix] = loopArray;                                                                                     // 899
  });                                                                                                                 // 900
  return rKeys;                                                                                                       // 901
};                                                                                                                    // 902
                                                                                                                      // 903
// returns an inflected version of fieldName to use as the label                                                      // 904
var inflectedLabel = function(fieldName) {                                                                            // 905
  var label = fieldName, lastPeriod = label.lastIndexOf(".");                                                         // 906
  if (lastPeriod !== -1) {                                                                                            // 907
    label = label.substring(lastPeriod + 1);                                                                          // 908
    if (label === "$") {                                                                                              // 909
      var pcs = fieldName.split(".");                                                                                 // 910
      label = pcs[pcs.length - 2];                                                                                    // 911
    }                                                                                                                 // 912
  }                                                                                                                   // 913
  if (label === "_id")                                                                                                // 914
    return "ID";                                                                                                      // 915
  return S(label).humanize().s;                                                                                       // 916
};                                                                                                                    // 917
                                                                                                                      // 918
/**                                                                                                                   // 919
 * @method getAutoValues                                                                                              // 920
 * @private                                                                                                           // 921
 * @param {MongoObject} mDoc                                                                                          // 922
 * @param {Boolean} [isModifier=false] - Is it a modifier doc?                                                        // 923
 * @param {Object} [extendedAutoValueContext] - Object that will be added to the context when calling each autoValue function
 * @returns {undefined}                                                                                               // 925
 *                                                                                                                    // 926
 * Updates doc with automatic values from autoValue functions or default                                              // 927
 * values from defaultValue. Modifies the referenced object in place.                                                 // 928
 */                                                                                                                   // 929
function getAutoValues(mDoc, isModifier, extendedAutoValueContext) {                                                  // 930
  var self = this;                                                                                                    // 931
  var doneKeys = [];                                                                                                  // 932
                                                                                                                      // 933
  //on the client we can add the userId if not already in the custom context                                          // 934
  if (Meteor.isClient && extendedAutoValueContext.userId === void 0) {                                                // 935
    extendedAutoValueContext.userId = (Meteor.userId && Meteor.userId()) || null;                                     // 936
  }                                                                                                                   // 937
                                                                                                                      // 938
  function runAV(func) {                                                                                              // 939
    var affectedKey = this.key;                                                                                       // 940
    // If already called for this key, skip it                                                                        // 941
    if (_.contains(doneKeys, affectedKey))                                                                            // 942
      return;                                                                                                         // 943
    var lastDot = affectedKey.lastIndexOf('.');                                                                       // 944
    var fieldParentName = lastDot === -1 ? '' : affectedKey.slice(0, lastDot + 1);                                    // 945
    var doUnset = false;                                                                                              // 946
    var autoValue = func.call(_.extend({                                                                              // 947
      isSet: (this.value !== void 0),                                                                                 // 948
      unset: function() {                                                                                             // 949
        doUnset = true;                                                                                               // 950
      },                                                                                                              // 951
      value: this.value,                                                                                              // 952
      operator: this.operator,                                                                                        // 953
      field: function(fName) {                                                                                        // 954
        var keyInfo = mDoc.getInfoForKey(fName) || {};                                                                // 955
        return {                                                                                                      // 956
          isSet: (keyInfo.value !== void 0),                                                                          // 957
          value: keyInfo.value,                                                                                       // 958
          operator: keyInfo.operator || null                                                                          // 959
        };                                                                                                            // 960
      },                                                                                                              // 961
      siblingField: function(fName) {                                                                                 // 962
        var keyInfo = mDoc.getInfoForKey(fieldParentName + fName) || {};                                              // 963
        return {                                                                                                      // 964
          isSet: (keyInfo.value !== void 0),                                                                          // 965
          value: keyInfo.value,                                                                                       // 966
          operator: keyInfo.operator || null                                                                          // 967
        };                                                                                                            // 968
      }                                                                                                               // 969
    }, extendedAutoValueContext || {}), mDoc.getObject());                                                            // 970
                                                                                                                      // 971
    // Update tracking of which keys we've run autovalue for                                                          // 972
    doneKeys.push(affectedKey);                                                                                       // 973
                                                                                                                      // 974
    if (autoValue === void 0) {                                                                                       // 975
      if (doUnset) {                                                                                                  // 976
        mDoc.removeValueForPosition(this.position);                                                                   // 977
      }                                                                                                               // 978
      return;                                                                                                         // 979
    }                                                                                                                 // 980
                                                                                                                      // 981
    // If the user's auto value is of the pseudo-modifier format, parse it                                            // 982
    // into operator and value.                                                                                       // 983
    var op, newValue;                                                                                                 // 984
    if (_.isObject(autoValue)) {                                                                                      // 985
      for (var key in autoValue) {                                                                                    // 986
        if (autoValue.hasOwnProperty(key) && key.substring(0, 1) === "$") {                                           // 987
          op = key;                                                                                                   // 988
          newValue = autoValue[key];                                                                                  // 989
          break;                                                                                                      // 990
        }                                                                                                             // 991
      }                                                                                                               // 992
    }                                                                                                                 // 993
                                                                                                                      // 994
    // Add $set for updates and upserts if necessary                                                                  // 995
    if (!op && isModifier && this.position.slice(0, 1) !== '$') {                                                     // 996
      op = "$set";                                                                                                    // 997
      newValue = autoValue;                                                                                           // 998
    }                                                                                                                 // 999
                                                                                                                      // 1000
    // Update/change value                                                                                            // 1001
    if (op) {                                                                                                         // 1002
      mDoc.removeValueForPosition(this.position);                                                                     // 1003
      mDoc.setValueForPosition(op + '[' + affectedKey + ']', newValue);                                               // 1004
    } else {                                                                                                          // 1005
      mDoc.setValueForPosition(this.position, autoValue);                                                             // 1006
    }                                                                                                                 // 1007
  }                                                                                                                   // 1008
                                                                                                                      // 1009
  _.each(self._autoValues, function(func, fieldName) {                                                                // 1010
    var positionSuffix, key, keySuffix, positions;                                                                    // 1011
                                                                                                                      // 1012
    // If we're under an array, run autovalue for all the properties of                                               // 1013
    // any objects that are present in the nearest ancestor array.                                                    // 1014
    if (fieldName.indexOf("$") !== -1) {                                                                              // 1015
      var testField = fieldName.slice(0, fieldName.lastIndexOf("$") + 1);                                             // 1016
      keySuffix = fieldName.slice(testField.length + 1);                                                              // 1017
      positionSuffix = MongoObject._keyToPosition(keySuffix, true);                                                   // 1018
      keySuffix = '.' + keySuffix;                                                                                    // 1019
      positions = mDoc.getPositionsForGenericKey(testField);                                                          // 1020
    } else {                                                                                                          // 1021
                                                                                                                      // 1022
      // See if anything in the object affects this key                                                               // 1023
      positions = mDoc.getPositionsForGenericKey(fieldName);                                                          // 1024
                                                                                                                      // 1025
      // Run autovalue for properties that are set in the object                                                      // 1026
      if (positions.length) {                                                                                         // 1027
        key = fieldName;                                                                                              // 1028
        keySuffix = '';                                                                                               // 1029
        positionSuffix = '';                                                                                          // 1030
      }                                                                                                               // 1031
                                                                                                                      // 1032
      // Run autovalue for properties that are NOT set in the object                                                  // 1033
      else {                                                                                                          // 1034
        key = fieldName;                                                                                              // 1035
        keySuffix = '';                                                                                               // 1036
        positionSuffix = '';                                                                                          // 1037
        if (isModifier) {                                                                                             // 1038
          positions = ["$set[" + fieldName + "]"];                                                                    // 1039
        } else {                                                                                                      // 1040
          positions = [MongoObject._keyToPosition(fieldName)];                                                        // 1041
        }                                                                                                             // 1042
      }                                                                                                               // 1043
                                                                                                                      // 1044
    }                                                                                                                 // 1045
                                                                                                                      // 1046
    _.each(positions, function(position) {                                                                            // 1047
      runAV.call({                                                                                                    // 1048
        key: (key || MongoObject._positionToKey(position)) + keySuffix,                                               // 1049
        value: mDoc.getValueForPosition(position + positionSuffix),                                                   // 1050
        operator: Utility.extractOp(position),                                                                        // 1051
        position: position + positionSuffix                                                                           // 1052
      }, func);                                                                                                       // 1053
    });                                                                                                               // 1054
  });                                                                                                                 // 1055
}                                                                                                                     // 1056
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                    //
// packages/simple-schema/simple-schema-validation.js                                                                 //
//                                                                                                                    //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                      //
doValidation1 = function doValidation1(obj, isModifier, isUpsert, keyToValidate, ss, extendedCustomContext) {         // 1
  var setKeys = [];                                                                                                   // 2
                                                                                                                      // 3
  // First do some basic checks of the object, and throw errors if necessary                                          // 4
  if (!_.isObject(obj)) {                                                                                             // 5
    throw new Error("The first argument of validate() or validateOne() must be an object");                           // 6
  }                                                                                                                   // 7
                                                                                                                      // 8
  if (isModifier) {                                                                                                   // 9
    if (_.isEmpty(obj)) {                                                                                             // 10
      throw new Error("When the modifier option is true, validation object must have at least one operator");         // 11
    } else {                                                                                                          // 12
      var allKeysAreOperators = _.every(obj, function(v, k) {                                                         // 13
        return (k.substring(0, 1) === "$");                                                                           // 14
      });                                                                                                             // 15
      if (!allKeysAreOperators) {                                                                                     // 16
        throw new Error("When the modifier option is true, all validation object keys must be operators. Did you forget `$set`?");
      }                                                                                                               // 18
                                                                                                                      // 19
      // Get a list of all keys in $set and $setOnInsert combined, for use later                                      // 20
      setKeys = setKeys.concat(_.keys(obj.$set || {})).concat(_.keys(obj.$setOnInsert || {}));                        // 21
    }                                                                                                                 // 22
  } else if (Utility.looksLikeModifier(obj)) {                                                                        // 23
    throw new Error("When the validation object contains mongo operators, you must set the modifier option to true"); // 24
  }                                                                                                                   // 25
                                                                                                                      // 26
  // If this is an upsert, add all the $setOnInsert keys to $set;                                                     // 27
  // since we don't know whether it will be an insert or update, we'll                                                // 28
  // validate upserts as if they will be an insert.                                                                   // 29
  if ("$setOnInsert" in obj) {                                                                                        // 30
    if (isUpsert) {                                                                                                   // 31
      obj.$set = obj.$set || {};                                                                                      // 32
      obj.$set = _.extend(obj.$set, obj.$setOnInsert);                                                                // 33
    }                                                                                                                 // 34
    delete obj.$setOnInsert;                                                                                          // 35
  }                                                                                                                   // 36
                                                                                                                      // 37
  var invalidKeys = [];                                                                                               // 38
  var mDoc; // for caching the MongoObject if necessary                                                               // 39
                                                                                                                      // 40
  // Validation function called for each affected key                                                                 // 41
  function validate(val, affectedKey, affectedKeyGeneric, def, op, skipRequiredCheck, strictRequiredCheck) {          // 42
                                                                                                                      // 43
    // Get the schema for this key, marking invalid if there isn't one.                                               // 44
    if (!def) {                                                                                                       // 45
      invalidKeys.push(Utility.errorObject("keyNotInSchema", affectedKey, val, def, ss));                             // 46
      return;                                                                                                         // 47
    }                                                                                                                 // 48
                                                                                                                      // 49
    // Check for missing required values. The general logic is this:                                                  // 50
    // * If there's no operator, or if the operator is $set and it's an upsert,                                       // 51
    //   val must not be undefined, null, or an empty string.                                                         // 52
    // * If there is an operator other than $unset or $rename, val must                                               // 53
    //   not be null or an empty string, but undefined is OK.                                                         // 54
    // * If the operator is $unset or $rename, it's invalid.                                                          // 55
    if (!skipRequiredCheck && !def.optional) {                                                                        // 56
      if (                                                                                                            // 57
        op === "$unset" ||                                                                                            // 58
        op === "$rename" ||                                                                                           // 59
        ((!op || (op === "$set" && isUpsert) || strictRequiredCheck) && Utility.isBlankNullOrUndefined(val)) ||       // 60
        (op && Utility.isBlankOrNull(val))                                                                            // 61
        ) {                                                                                                           // 62
        invalidKeys.push(Utility.errorObject("required", affectedKey, null, def, ss));                                // 63
        return;                                                                                                       // 64
      }                                                                                                               // 65
    }                                                                                                                 // 66
                                                                                                                      // 67
    // For $rename, make sure that the new name is allowed by the schema                                              // 68
    if (op === "$rename" && typeof val === "string" && !ss.allowsKey(val)) {                                          // 69
      invalidKeys.push(Utility.errorObject("keyNotInSchema", val, null, null, ss));                                   // 70
      return;                                                                                                         // 71
    }                                                                                                                 // 72
                                                                                                                      // 73
    // No further checking necessary for $unset or $rename                                                            // 74
    if (_.contains(["$unset", "$rename"], op)) {                                                                      // 75
      return;                                                                                                         // 76
    }                                                                                                                 // 77
                                                                                                                      // 78
    // Value checks are not necessary for null or undefined values                                                    // 79
    if (Utility.isNotNullOrUndefined(val)) {                                                                          // 80
                                                                                                                      // 81
      // Check that value is of the correct type                                                                      // 82
      var typeError = doTypeChecks(def, val, op);                                                                     // 83
      if (typeError) {                                                                                                // 84
        invalidKeys.push(Utility.errorObject(typeError, affectedKey, val, def, ss));                                  // 85
        return;                                                                                                       // 86
      }                                                                                                               // 87
                                                                                                                      // 88
      // Check value against allowedValues array                                                                      // 89
      if (def.allowedValues && !_.contains(def.allowedValues, val)) {                                                 // 90
        invalidKeys.push(Utility.errorObject("notAllowed", affectedKey, val, def, ss));                               // 91
        return;                                                                                                       // 92
      }                                                                                                               // 93
                                                                                                                      // 94
    }                                                                                                                 // 95
                                                                                                                      // 96
    // Perform custom validation                                                                                      // 97
    var lastDot = affectedKey.lastIndexOf('.');                                                                       // 98
    var fieldParentName = lastDot === -1 ? '' : affectedKey.slice(0, lastDot + 1);                                    // 99
    var validators = def.custom ? [def.custom] : [];                                                                  // 100
    validators = validators.concat(ss._validators).concat(SimpleSchema._validators);                                  // 101
    _.every(validators, function(validator) {                                                                         // 102
      var errorType = validator.call(_.extend({                                                                       // 103
        key: affectedKey,                                                                                             // 104
        genericKey: affectedKeyGeneric,                                                                               // 105
        definition: def,                                                                                              // 106
        isSet: (val !== void 0),                                                                                      // 107
        value: val,                                                                                                   // 108
        operator: op,                                                                                                 // 109
        field: function(fName) {                                                                                      // 110
          mDoc = mDoc || new MongoObject(obj, ss._blackboxKeys); //create if necessary, cache for speed               // 111
          var keyInfo = mDoc.getInfoForKey(fName) || {};                                                              // 112
          return {                                                                                                    // 113
            isSet: (keyInfo.value !== void 0),                                                                        // 114
            value: keyInfo.value,                                                                                     // 115
            operator: keyInfo.operator                                                                                // 116
          };                                                                                                          // 117
        },                                                                                                            // 118
        siblingField: function(fName) {                                                                               // 119
          mDoc = mDoc || new MongoObject(obj, ss._blackboxKeys); //create if necessary, cache for speed               // 120
          var keyInfo = mDoc.getInfoForKey(fieldParentName + fName) || {};                                            // 121
          return {                                                                                                    // 122
            isSet: (keyInfo.value !== void 0),                                                                        // 123
            value: keyInfo.value,                                                                                     // 124
            operator: keyInfo.operator                                                                                // 125
          };                                                                                                          // 126
        }                                                                                                             // 127
      }, extendedCustomContext || {}));                                                                               // 128
      if (typeof errorType === "string") {                                                                            // 129
        invalidKeys.push(Utility.errorObject(errorType, affectedKey, val, def, ss));                                  // 130
        return false;                                                                                                 // 131
      }                                                                                                               // 132
      return true;                                                                                                    // 133
    });                                                                                                               // 134
  }                                                                                                                   // 135
                                                                                                                      // 136
  // The recursive function                                                                                           // 137
  function checkObj(val, affectedKey, operator, adjusted, skipRequiredCheck, strictRequiredCheck) {                   // 138
    var affectedKeyGeneric, def, checkAllRequired = false;                                                            // 139
                                                                                                                      // 140
    // Adjust for first-level modifier operators                                                                      // 141
    if (!operator && affectedKey && affectedKey.substring(0, 1) === "$") {                                            // 142
      operator = affectedKey;                                                                                         // 143
      affectedKey = null;                                                                                             // 144
    }                                                                                                                 // 145
                                                                                                                      // 146
    if (affectedKey) {                                                                                                // 147
                                                                                                                      // 148
      // Adjust for $push and $addToSet                                                                               // 149
      if (!adjusted && (operator === "$push" || operator === "$addToSet")) {                                          // 150
        // Adjust for $each                                                                                           // 151
        // We can simply jump forward and pretend like the $each array                                                // 152
        // is the array for the field. This has the added benefit of                                                  // 153
        // skipping past any $slice, which we also don't care about.                                                  // 154
        if (Utility.isBasicObject(val) && "$each" in val) {                                                           // 155
          val = val.$each;                                                                                            // 156
        } else {                                                                                                      // 157
          affectedKey = affectedKey + ".0";                                                                           // 158
        }                                                                                                             // 159
        checkAllRequired = adjusted = true;                                                                           // 160
      }                                                                                                               // 161
                                                                                                                      // 162
      // When we hit a blackbox key, we don't progress any further                                                    // 163
      if (ss.keyIsInBlackBox(affectedKey)) {                                                                          // 164
        return;                                                                                                       // 165
      }                                                                                                               // 166
                                                                                                                      // 167
      // Make a generic version of the affected key, and use that                                                     // 168
      // to get the schema for this key.                                                                              // 169
      affectedKeyGeneric = SimpleSchema._makeGeneric(affectedKey);                                                    // 170
      def = ss.getDefinition(affectedKey);                                                                            // 171
                                                                                                                      // 172
      // Perform validation for this key                                                                              // 173
      if (!keyToValidate || keyToValidate === affectedKey || keyToValidate === affectedKeyGeneric) {                  // 174
        validate(val, affectedKey, affectedKeyGeneric, def, operator, skipRequiredCheck, strictRequiredCheck);        // 175
      }                                                                                                               // 176
    }                                                                                                                 // 177
                                                                                                                      // 178
    // Temporarily convert missing objects to empty objects                                                           // 179
    // so that the looping code will be called and required                                                           // 180
    // descendent keys can be validated.                                                                              // 181
    if ((val === void 0 || val === null) && (!def || (def.type === Object && !def.optional))) {                       // 182
      val = {};                                                                                                       // 183
    }                                                                                                                 // 184
                                                                                                                      // 185
    // Loop through arrays                                                                                            // 186
    if (_.isArray(val)) {                                                                                             // 187
      _.each(val, function(v, i) {                                                                                    // 188
        checkObj(v, affectedKey + '.' + i, operator, adjusted);                                                       // 189
      });                                                                                                             // 190
    }                                                                                                                 // 191
                                                                                                                      // 192
    // Loop through object keys                                                                                       // 193
    else if (Utility.isBasicObject(val) && (!def || !def.blackbox)) {                                                 // 194
      var presentKeys, requiredKeys, customKeys;                                                                      // 195
                                                                                                                      // 196
      // Get list of present keys                                                                                     // 197
      presentKeys = _.keys(val);                                                                                      // 198
                                                                                                                      // 199
      if (!isModifier || operator === "$set" || checkAllRequired) {                                                   // 200
                                                                                                                      // 201
        // For required checks, we want to also loop through all keys expected                                        // 202
        // based on the schema, in case any are missing.                                                              // 203
        requiredKeys = ss.requiredObjectKeys(affectedKeyGeneric);                                                     // 204
                                                                                                                      // 205
        // We want to be sure to call any present custom functions                                                    // 206
        // even if the value isn't set, so they can be used for custom                                                // 207
        // required errors, such as basing it on another field's value.                                               // 208
        customKeys = ss.customObjectKeys(affectedKeyGeneric);                                                         // 209
      }                                                                                                               // 210
                                                                                                                      // 211
      // Merge the lists                                                                                              // 212
      var keysToCheck = _.union(presentKeys, requiredKeys || [], customKeys || []);                                   // 213
                                                                                                                      // 214
      // If this object is within an array, make sure we check for                                                    // 215
      // required as if it's not a modifier                                                                           // 216
      var strictRequiredCheck = (affectedKeyGeneric && affectedKeyGeneric.slice(-2) === ".$");                        // 217
                                                                                                                      // 218
      // Check all keys in the merged list                                                                            // 219
      _.each(keysToCheck, function(key) {                                                                             // 220
        if (Utility.shouldCheck(key)) {                                                                               // 221
          // We can skip the required check for keys that are ancestors                                               // 222
          // of those in $set or $setOnInsert because they will be created                                            // 223
          // by MongoDB while setting.                                                                                // 224
          skipRequiredCheck = _.some(setKeys, function(sk) {                                                          // 225
            return (sk.slice(0, key.length + 1) === key + ".");                                                       // 226
          });                                                                                                         // 227
          checkObj(val[key], Utility.appendAffectedKey(affectedKey, key), operator, adjusted, skipRequiredCheck, strictRequiredCheck);
        }                                                                                                             // 229
      });                                                                                                             // 230
    }                                                                                                                 // 231
                                                                                                                      // 232
  }                                                                                                                   // 233
                                                                                                                      // 234
  // Kick off the validation                                                                                          // 235
  checkObj(obj);                                                                                                      // 236
                                                                                                                      // 237
  // Make sure there is only one error per fieldName                                                                  // 238
  var addedFieldNames = [];                                                                                           // 239
  invalidKeys = _.filter(invalidKeys, function(errObj) {                                                              // 240
    if (!_.contains(addedFieldNames, errObj.name)) {                                                                  // 241
      addedFieldNames.push(errObj.name);                                                                              // 242
      return true;                                                                                                    // 243
    }                                                                                                                 // 244
    return false;                                                                                                     // 245
  });                                                                                                                 // 246
                                                                                                                      // 247
  return invalidKeys;                                                                                                 // 248
};                                                                                                                    // 249
                                                                                                                      // 250
function doTypeChecks(def, keyValue, op) {                                                                            // 251
  var expectedType = def.type;                                                                                        // 252
                                                                                                                      // 253
  // String checks                                                                                                    // 254
  if (expectedType === String) {                                                                                      // 255
    if (typeof keyValue !== "string") {                                                                               // 256
      return "expectedString";                                                                                        // 257
    } else if (def.max !== null && def.max < keyValue.length) {                                                       // 258
      return "maxString";                                                                                             // 259
    } else if (def.min !== null && def.min > keyValue.length) {                                                       // 260
      return "minString";                                                                                             // 261
    } else if (def.regEx instanceof RegExp && !def.regEx.test(keyValue)) {                                            // 262
      return "regEx";                                                                                                 // 263
    } else if (_.isArray(def.regEx)) {                                                                                // 264
      var regExError;                                                                                                 // 265
      _.every(def.regEx, function(re, i) {                                                                            // 266
        if (!re.test(keyValue)) {                                                                                     // 267
          regExError = "regEx." + i;                                                                                  // 268
          return false;                                                                                               // 269
        }                                                                                                             // 270
        return true;                                                                                                  // 271
      });                                                                                                             // 272
      if (regExError)                                                                                                 // 273
        return regExError;                                                                                            // 274
    }                                                                                                                 // 275
  }                                                                                                                   // 276
                                                                                                                      // 277
  // Number checks                                                                                                    // 278
  else if (expectedType === Number) {                                                                                 // 279
    if (typeof keyValue !== "number" || isNaN(keyValue)) {                                                            // 280
      return "expectedNumber";                                                                                        // 281
    } else if (op !== "$inc" && def.max !== null && def.max < keyValue) {                                             // 282
      return "maxNumber";                                                                                             // 283
    } else if (op !== "$inc" && def.min !== null && def.min > keyValue) {                                             // 284
      return "minNumber";                                                                                             // 285
    } else if (!def.decimal && keyValue.toString().indexOf(".") > -1) {                                               // 286
      return "noDecimal";                                                                                             // 287
    }                                                                                                                 // 288
  }                                                                                                                   // 289
                                                                                                                      // 290
  // Boolean checks                                                                                                   // 291
  else if (expectedType === Boolean) {                                                                                // 292
    if (typeof keyValue !== "boolean") {                                                                              // 293
      return "expectedBoolean";                                                                                       // 294
    }                                                                                                                 // 295
  }                                                                                                                   // 296
                                                                                                                      // 297
  // Object checks                                                                                                    // 298
  else if (expectedType === Object) {                                                                                 // 299
    if (!Utility.isBasicObject(keyValue)) {                                                                           // 300
      return "expectedObject";                                                                                        // 301
    }                                                                                                                 // 302
  }                                                                                                                   // 303
                                                                                                                      // 304
  // Array checks                                                                                                     // 305
  else if (expectedType === Array) {                                                                                  // 306
    if (!_.isArray(keyValue)) {                                                                                       // 307
      return "expectedArray";                                                                                         // 308
    } else if (def.minCount !== null && keyValue.length < def.minCount) {                                             // 309
      return "minCount";                                                                                              // 310
    } else if (def.maxCount !== null && keyValue.length > def.maxCount) {                                             // 311
      return "maxCount";                                                                                              // 312
    }                                                                                                                 // 313
  }                                                                                                                   // 314
                                                                                                                      // 315
  // Constructor function checks                                                                                      // 316
  else if (expectedType instanceof Function || Utility.safariBugFix(expectedType)) {                                  // 317
                                                                                                                      // 318
    // Generic constructor checks                                                                                     // 319
    if (!(keyValue instanceof expectedType)) {                                                                        // 320
      return "expectedConstructor";                                                                                   // 321
    }                                                                                                                 // 322
                                                                                                                      // 323
    // Date checks                                                                                                    // 324
    else if (expectedType === Date) {                                                                                 // 325
      if (_.isDate(def.min) && def.min.getTime() > keyValue.getTime()) {                                              // 326
        return "minDate";                                                                                             // 327
      } else if (_.isDate(def.max) && def.max.getTime() < keyValue.getTime()) {                                       // 328
        return "maxDate";                                                                                             // 329
      }                                                                                                               // 330
    }                                                                                                                 // 331
  }                                                                                                                   // 332
                                                                                                                      // 333
}                                                                                                                     // 334
                                                                                                                      // 335
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                    //
// packages/simple-schema/simple-schema-validation-new.js                                                             //
//                                                                                                                    //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                      //
doValidation2 = function doValidation2(obj, isModifier, isUpsert, keyToValidate, ss, extendedCustomContext) {         // 1
  var setKeys = [];                                                                                                   // 2
                                                                                                                      // 3
  // First do some basic checks of the object, and throw errors if necessary                                          // 4
  if (!_.isObject(obj)) {                                                                                             // 5
    throw new Error("The first argument of validate() or validateOne() must be an object");                           // 6
  }                                                                                                                   // 7
                                                                                                                      // 8
  if (isModifier) {                                                                                                   // 9
    if (_.isEmpty(obj)) {                                                                                             // 10
      throw new Error("When the modifier option is true, validation object must have at least one operator");         // 11
    } else {                                                                                                          // 12
      var allKeysAreOperators = _.every(obj, function(v, k) {                                                         // 13
        return (k.substring(0, 1) === "$");                                                                           // 14
      });                                                                                                             // 15
      if (!allKeysAreOperators) {                                                                                     // 16
        throw new Error("When the modifier option is true, all validation object keys must be operators");            // 17
      }                                                                                                               // 18
                                                                                                                      // 19
      // Get a list of all keys in $set and $setOnInsert combined, for use later                                      // 20
      setKeys = setKeys.concat(_.keys(obj.$set || {})).concat(_.keys(obj.$setOnInsert || {}));                        // 21
                                                                                                                      // 22
      // We use a LocalCollection to figure out what the resulting doc                                                // 23
      // would be in a worst case scenario. Then we validate that doc                                                 // 24
      // so that we don't have to validate the modifier object directly.                                              // 25
      console.log("BEFORE", obj);                                                                                     // 26
      obj = convertModifierToDoc(obj, ss.schema(), isUpsert);                                                         // 27
      console.log("AFTER", obj);                                                                                      // 28
    }                                                                                                                 // 29
  } else if (Utility.looksLikeModifier(obj)) {                                                                        // 30
    throw new Error("When the validation object contains mongo operators, you must set the modifier option to true"); // 31
  }                                                                                                                   // 32
                                                                                                                      // 33
  // If this is an upsert, add all the $setOnInsert keys to $set;                                                     // 34
  // since we don't know whether it will be an insert or update, we'll                                                // 35
  // validate upserts as if they will be an insert.                                                                   // 36
  if ("$setOnInsert" in obj) {                                                                                        // 37
    if (isUpsert) {                                                                                                   // 38
      obj.$set = obj.$set || {};                                                                                      // 39
      obj.$set = _.extend(obj.$set, obj.$setOnInsert);                                                                // 40
    }                                                                                                                 // 41
    delete obj.$setOnInsert;                                                                                          // 42
  }                                                                                                                   // 43
                                                                                                                      // 44
  var invalidKeys = [];                                                                                               // 45
  var mDoc; // for caching the MongoObject if necessary                                                               // 46
                                                                                                                      // 47
  // Validation function called for each affected key                                                                 // 48
  function validate(val, affectedKey, affectedKeyGeneric, def, op, skipRequiredCheck, strictRequiredCheck) {          // 49
                                                                                                                      // 50
    // Get the schema for this key, marking invalid if there isn't one.                                               // 51
    if (!def) {                                                                                                       // 52
      invalidKeys.push(Utility.errorObject("keyNotInSchema", affectedKey, val, def, ss));                             // 53
      return;                                                                                                         // 54
    }                                                                                                                 // 55
                                                                                                                      // 56
    // Check for missing required values. The general logic is this:                                                  // 57
    // * If there's no operator, or if the operator is $set and it's an upsert,                                       // 58
    //   val must not be undefined, null, or an empty string.                                                         // 59
    // * If there is an operator other than $unset or $rename, val must                                               // 60
    //   not be null or an empty string, but undefined is OK.                                                         // 61
    // * If the operator is $unset or $rename, it's invalid.                                                          // 62
    if (!skipRequiredCheck && !def.optional) {                                                                        // 63
      if (                                                                                                            // 64
        op === "$unset" ||                                                                                            // 65
        op === "$rename" ||                                                                                           // 66
        ((!op || (op === "$set" && isUpsert) || strictRequiredCheck) && Utility.isBlankNullOrUndefined(val)) ||       // 67
        (op && Utility.isBlankOrNull(val))                                                                            // 68
        ) {                                                                                                           // 69
        invalidKeys.push(Utility.errorObject("required", affectedKey, null, def, ss));                                // 70
        return;                                                                                                       // 71
      }                                                                                                               // 72
    }                                                                                                                 // 73
                                                                                                                      // 74
    // For $rename, make sure that the new name is allowed by the schema                                              // 75
    if (op === "$rename" && typeof val === "string" && !ss.allowsKey(val)) {                                          // 76
      invalidKeys.push(Utility.errorObject("keyNotInSchema", val, null, null, ss));                                   // 77
      return;                                                                                                         // 78
    }                                                                                                                 // 79
                                                                                                                      // 80
    // No further checking necessary for $unset or $rename                                                            // 81
    if (_.contains(["$unset", "$rename"], op)) {                                                                      // 82
      return;                                                                                                         // 83
    }                                                                                                                 // 84
                                                                                                                      // 85
    // Value checks are not necessary for null or undefined values                                                    // 86
    if (Utility.isNotNullOrUndefined(val)) {                                                                          // 87
                                                                                                                      // 88
      // Check that value is of the correct type                                                                      // 89
      var typeError = doTypeChecks(def, val, op);                                                                     // 90
      if (typeError) {                                                                                                // 91
        invalidKeys.push(Utility.errorObject(typeError, affectedKey, val, def, ss));                                  // 92
        return;                                                                                                       // 93
      }                                                                                                               // 94
                                                                                                                      // 95
      // Check value against allowedValues array                                                                      // 96
      if (def.allowedValues && !_.contains(def.allowedValues, val)) {                                                 // 97
        invalidKeys.push(Utility.errorObject("notAllowed", affectedKey, val, def, ss));                               // 98
        return;                                                                                                       // 99
      }                                                                                                               // 100
                                                                                                                      // 101
    }                                                                                                                 // 102
                                                                                                                      // 103
    // Perform custom validation                                                                                      // 104
    var lastDot = affectedKey.lastIndexOf('.');                                                                       // 105
    var fieldParentName = lastDot === -1 ? '' : affectedKey.slice(0, lastDot + 1);                                    // 106
    var validators = def.custom ? [def.custom] : [];                                                                  // 107
    validators = validators.concat(ss._validators).concat(SimpleSchema._validators);                                  // 108
    _.every(validators, function(validator) {                                                                         // 109
      var errorType = validator.call(_.extend({                                                                       // 110
        key: affectedKey,                                                                                             // 111
        genericKey: affectedKeyGeneric,                                                                               // 112
        definition: def,                                                                                              // 113
        isSet: (val !== void 0),                                                                                      // 114
        value: val,                                                                                                   // 115
        operator: op,                                                                                                 // 116
        field: function(fName) {                                                                                      // 117
          mDoc = mDoc || new MongoObject(obj, ss._blackboxKeys); //create if necessary, cache for speed               // 118
          var keyInfo = mDoc.getInfoForKey(fName) || {};                                                              // 119
          return {                                                                                                    // 120
            isSet: (keyInfo.value !== void 0),                                                                        // 121
            value: keyInfo.value,                                                                                     // 122
            operator: keyInfo.operator                                                                                // 123
          };                                                                                                          // 124
        },                                                                                                            // 125
        siblingField: function(fName) {                                                                               // 126
          mDoc = mDoc || new MongoObject(obj, ss._blackboxKeys); //create if necessary, cache for speed               // 127
          var keyInfo = mDoc.getInfoForKey(fieldParentName + fName) || {};                                            // 128
          return {                                                                                                    // 129
            isSet: (keyInfo.value !== void 0),                                                                        // 130
            value: keyInfo.value,                                                                                     // 131
            operator: keyInfo.operator                                                                                // 132
          };                                                                                                          // 133
        }                                                                                                             // 134
      }, extendedCustomContext || {}));                                                                               // 135
      if (typeof errorType === "string") {                                                                            // 136
        invalidKeys.push(Utility.errorObject(errorType, affectedKey, val, def, ss));                                  // 137
        return false;                                                                                                 // 138
      }                                                                                                               // 139
      return true;                                                                                                    // 140
    });                                                                                                               // 141
  }                                                                                                                   // 142
                                                                                                                      // 143
  // The recursive function                                                                                           // 144
  function checkObj(val, affectedKey, operator, adjusted, skipRequiredCheck, strictRequiredCheck) {                   // 145
    var affectedKeyGeneric, def, checkAllRequired = false;                                                            // 146
                                                                                                                      // 147
    // Adjust for first-level modifier operators                                                                      // 148
    if (!operator && affectedKey && affectedKey.substring(0, 1) === "$") {                                            // 149
      operator = affectedKey;                                                                                         // 150
      affectedKey = null;                                                                                             // 151
    }                                                                                                                 // 152
                                                                                                                      // 153
    if (affectedKey) {                                                                                                // 154
                                                                                                                      // 155
      // Adjust for $push and $addToSet                                                                               // 156
      if (!adjusted && (operator === "$push" || operator === "$addToSet")) {                                          // 157
        // Adjust for $each                                                                                           // 158
        // We can simply jump forward and pretend like the $each array                                                // 159
        // is the array for the field. This has the added benefit of                                                  // 160
        // skipping past any $slice, which we also don't care about.                                                  // 161
        if (Utility.isBasicObject(val) && "$each" in val) {                                                           // 162
          val = val.$each;                                                                                            // 163
        } else {                                                                                                      // 164
          affectedKey = affectedKey + ".0";                                                                           // 165
        }                                                                                                             // 166
        checkAllRequired = adjusted = true;                                                                           // 167
      }                                                                                                               // 168
                                                                                                                      // 169
      // When we hit a blackbox key, we don't progress any further                                                    // 170
      if (ss.keyIsInBlackBox(affectedKey)) {                                                                          // 171
        return;                                                                                                       // 172
      }                                                                                                               // 173
                                                                                                                      // 174
      // Make a generic version of the affected key, and use that                                                     // 175
      // to get the schema for this key.                                                                              // 176
      affectedKeyGeneric = SimpleSchema._makeGeneric(affectedKey);                                                    // 177
      def = ss.getDefinition(affectedKey);                                                                            // 178
                                                                                                                      // 179
      // Perform validation for this key                                                                              // 180
      if (!keyToValidate || keyToValidate === affectedKey || keyToValidate === affectedKeyGeneric) {                  // 181
        validate(val, affectedKey, affectedKeyGeneric, def, operator, skipRequiredCheck, strictRequiredCheck);        // 182
      }                                                                                                               // 183
    }                                                                                                                 // 184
                                                                                                                      // 185
    // Temporarily convert missing objects to empty objects                                                           // 186
    // so that the looping code will be called and required                                                           // 187
    // descendent keys can be validated.                                                                              // 188
    if ((val === void 0 || val === null) && (!def || (def.type === Object && !def.optional))) {                       // 189
      val = {};                                                                                                       // 190
    }                                                                                                                 // 191
                                                                                                                      // 192
    // Loop through arrays                                                                                            // 193
    if (_.isArray(val)) {                                                                                             // 194
      _.each(val, function(v, i) {                                                                                    // 195
        checkObj(v, affectedKey + '.' + i, operator, adjusted);                                                       // 196
      });                                                                                                             // 197
    }                                                                                                                 // 198
                                                                                                                      // 199
    // Loop through object keys                                                                                       // 200
    else if (Utility.isBasicObject(val) && (!def || !def.blackbox)) {                                                 // 201
      var presentKeys, requiredKeys, customKeys;                                                                      // 202
                                                                                                                      // 203
      // Get list of present keys                                                                                     // 204
      presentKeys = _.keys(val);                                                                                      // 205
                                                                                                                      // 206
      if (!isModifier || operator === "$set" || checkAllRequired) {                                                   // 207
                                                                                                                      // 208
        // For required checks, we want to also loop through all keys expected                                        // 209
        // based on the schema, in case any are missing.                                                              // 210
        requiredKeys = ss.requiredObjectKeys(affectedKeyGeneric);                                                     // 211
                                                                                                                      // 212
        // We want to be sure to call any present custom functions                                                    // 213
        // even if the value isn't set, so they can be used for custom                                                // 214
        // required errors, such as basing it on another field's value.                                               // 215
        customKeys = ss.customObjectKeys(affectedKeyGeneric);                                                         // 216
      }                                                                                                               // 217
                                                                                                                      // 218
      // Merge the lists                                                                                              // 219
      var keysToCheck = _.union(presentKeys, requiredKeys || [], customKeys || []);                                   // 220
                                                                                                                      // 221
      // If this object is within an array, make sure we check for                                                    // 222
      // required as if it's not a modifier                                                                           // 223
      var strictRequiredCheck = (affectedKeyGeneric && affectedKeyGeneric.slice(-2) === ".$");                        // 224
                                                                                                                      // 225
      // Check all keys in the merged list                                                                            // 226
      _.each(keysToCheck, function(key) {                                                                             // 227
        if (Utility.shouldCheck(key)) {                                                                               // 228
          // We can skip the required check for keys that are ancestors                                               // 229
          // of those in $set or $setOnInsert because they will be created                                            // 230
          // by MongoDB while setting.                                                                                // 231
          skipRequiredCheck = _.some(setKeys, function(sk) {                                                          // 232
            return (sk.slice(0, key.length + 1) === key + ".");                                                       // 233
          });                                                                                                         // 234
          checkObj(val[key], Utility.appendAffectedKey(affectedKey, key), operator, adjusted, skipRequiredCheck, strictRequiredCheck);
        }                                                                                                             // 236
      });                                                                                                             // 237
    }                                                                                                                 // 238
                                                                                                                      // 239
  }                                                                                                                   // 240
                                                                                                                      // 241
  // Kick off the validation                                                                                          // 242
  checkObj(obj);                                                                                                      // 243
                                                                                                                      // 244
  // Make sure there is only one error per fieldName                                                                  // 245
  var addedFieldNames = [];                                                                                           // 246
  invalidKeys = _.filter(invalidKeys, function(errObj) {                                                              // 247
    if (!_.contains(addedFieldNames, errObj.name)) {                                                                  // 248
      addedFieldNames.push(errObj.name);                                                                              // 249
      return true;                                                                                                    // 250
    }                                                                                                                 // 251
    return false;                                                                                                     // 252
  });                                                                                                                 // 253
                                                                                                                      // 254
  return invalidKeys;                                                                                                 // 255
};                                                                                                                    // 256
                                                                                                                      // 257
function convertModifierToDoc(mod, schema, isUpsert) {                                                                // 258
  // Create unmanaged LocalCollection as scratchpad                                                                   // 259
  var t = new Meteor.Collection(null);                                                                                // 260
                                                                                                                      // 261
  // LocalCollections are in memory, and it seems                                                                     // 262
  // that it's fine to use them synchronously on                                                                      // 263
  // either client or server                                                                                          // 264
  var id;                                                                                                             // 265
  if (isUpsert) {                                                                                                     // 266
    // We assume upserts will be inserts (conservative                                                                // 267
    // validation of requiredness)                                                                                    // 268
    id = Random.id();                                                                                                 // 269
    t.upsert({_id: id}, mod);                                                                                         // 270
  } else {                                                                                                            // 271
    // Create a ficticious existing document                                                                          // 272
    var fakeDoc = {};                                                                                                 // 273
    // _.each(schema, function (def, fieldName) {                                                                     // 274
    //   fakeDoc[fieldName] = "TODO";                                                                                 // 275
    // });                                                                                                            // 276
    id = t.insert(fakeDoc);                                                                                           // 277
    // Now update it with the modifier                                                                                // 278
    t.update(id, mod);                                                                                                // 279
  }                                                                                                                   // 280
                                                                                                                      // 281
  var doc = t.findOne(id);                                                                                            // 282
  // We're done with it                                                                                               // 283
  t.remove(id);                                                                                                       // 284
  // Currently we don't validate _id unless it is                                                                     // 285
  // explicitly added to the schema                                                                                   // 286
  if (!schema._id) {                                                                                                  // 287
    delete doc._id;                                                                                                   // 288
  }                                                                                                                   // 289
  return doc;                                                                                                         // 290
}                                                                                                                     // 291
                                                                                                                      // 292
function doTypeChecks(def, keyValue, op) {                                                                            // 293
  var expectedType = def.type;                                                                                        // 294
                                                                                                                      // 295
  // String checks                                                                                                    // 296
  if (expectedType === String) {                                                                                      // 297
    if (typeof keyValue !== "string") {                                                                               // 298
      return "expectedString";                                                                                        // 299
    } else if (def.max !== null && def.max < keyValue.length) {                                                       // 300
      return "maxString";                                                                                             // 301
    } else if (def.min !== null && def.min > keyValue.length) {                                                       // 302
      return "minString";                                                                                             // 303
    } else if (def.regEx instanceof RegExp && !def.regEx.test(keyValue)) {                                            // 304
      return "regEx";                                                                                                 // 305
    } else if (_.isArray(def.regEx)) {                                                                                // 306
      var regExError;                                                                                                 // 307
      _.every(def.regEx, function(re, i) {                                                                            // 308
        if (!re.test(keyValue)) {                                                                                     // 309
          regExError = "regEx." + i;                                                                                  // 310
          return false;                                                                                               // 311
        }                                                                                                             // 312
        return true;                                                                                                  // 313
      });                                                                                                             // 314
      if (regExError)                                                                                                 // 315
        return regExError;                                                                                            // 316
    }                                                                                                                 // 317
  }                                                                                                                   // 318
                                                                                                                      // 319
  // Number checks                                                                                                    // 320
  else if (expectedType === Number) {                                                                                 // 321
    if (typeof keyValue !== "number" || isNaN(keyValue)) {                                                            // 322
      return "expectedNumber";                                                                                        // 323
    } else if (op !== "$inc" && def.max !== null && def.max < keyValue) {                                             // 324
      return "maxNumber";                                                                                             // 325
    } else if (op !== "$inc" && def.min !== null && def.min > keyValue) {                                             // 326
      return "minNumber";                                                                                             // 327
    } else if (!def.decimal && keyValue.toString().indexOf(".") > -1) {                                               // 328
      return "noDecimal";                                                                                             // 329
    }                                                                                                                 // 330
  }                                                                                                                   // 331
                                                                                                                      // 332
  // Boolean checks                                                                                                   // 333
  else if (expectedType === Boolean) {                                                                                // 334
    if (typeof keyValue !== "boolean") {                                                                              // 335
      return "expectedBoolean";                                                                                       // 336
    }                                                                                                                 // 337
  }                                                                                                                   // 338
                                                                                                                      // 339
  // Object checks                                                                                                    // 340
  else if (expectedType === Object) {                                                                                 // 341
    if (!Utility.isBasicObject(keyValue)) {                                                                           // 342
      return "expectedObject";                                                                                        // 343
    }                                                                                                                 // 344
  }                                                                                                                   // 345
                                                                                                                      // 346
  // Array checks                                                                                                     // 347
  else if (expectedType === Array) {                                                                                  // 348
    if (!_.isArray(keyValue)) {                                                                                       // 349
      return "expectedArray";                                                                                         // 350
    } else if (def.minCount !== null && keyValue.length < def.minCount) {                                             // 351
      return "minCount";                                                                                              // 352
    } else if (def.maxCount !== null && keyValue.length > def.maxCount) {                                             // 353
      return "maxCount";                                                                                              // 354
    }                                                                                                                 // 355
  }                                                                                                                   // 356
                                                                                                                      // 357
  // Constructor function checks                                                                                      // 358
  else if (expectedType instanceof Function || Utility.safariBugFix(expectedType)) {                                  // 359
                                                                                                                      // 360
    // Generic constructor checks                                                                                     // 361
    if (!(keyValue instanceof expectedType)) {                                                                        // 362
      return "expectedConstructor";                                                                                   // 363
    }                                                                                                                 // 364
                                                                                                                      // 365
    // Date checks                                                                                                    // 366
    else if (expectedType === Date) {                                                                                 // 367
      if (_.isDate(def.min) && def.min.getTime() > keyValue.getTime()) {                                              // 368
        return "minDate";                                                                                             // 369
      } else if (_.isDate(def.max) && def.max.getTime() < keyValue.getTime()) {                                       // 370
        return "maxDate";                                                                                             // 371
      }                                                                                                               // 372
    }                                                                                                                 // 373
  }                                                                                                                   // 374
                                                                                                                      // 375
}                                                                                                                     // 376
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                    //
// packages/simple-schema/simple-schema-context.js                                                                    //
//                                                                                                                    //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                      //
/*                                                                                                                    // 1
 * PUBLIC API                                                                                                         // 2
 */                                                                                                                   // 3
                                                                                                                      // 4
SimpleSchemaValidationContext = function(ss) {                                                                        // 5
  var self = this;                                                                                                    // 6
  self._simpleSchema = ss;                                                                                            // 7
  self._schema = ss.schema();                                                                                         // 8
  self._schemaKeys = _.keys(self._schema);                                                                            // 9
  self._invalidKeys = [];                                                                                             // 10
  //set up validation dependencies                                                                                    // 11
  self._deps = {};                                                                                                    // 12
  self._depsAny = new Deps.Dependency;                                                                                // 13
  _.each(self._schemaKeys, function(name) {                                                                           // 14
    self._deps[name] = new Deps.Dependency;                                                                           // 15
  });                                                                                                                 // 16
};                                                                                                                    // 17
                                                                                                                      // 18
//validates the object against the simple schema and sets a reactive array of error objects                           // 19
SimpleSchemaValidationContext.prototype.validate = function(doc, options) {                                           // 20
  var self = this;                                                                                                    // 21
  options = _.extend({                                                                                                // 22
    modifier: false,                                                                                                  // 23
    upsert: false,                                                                                                    // 24
    extendedCustomContext: {}                                                                                         // 25
  }, options || {});                                                                                                  // 26
                                                                                                                      // 27
  //on the client we can add the userId if not already in the custom context                                          // 28
  if (Meteor.isClient && options.extendedCustomContext.userId === void 0) {                                           // 29
    options.extendedCustomContext.userId = (Meteor.userId && Meteor.userId()) || null;                                // 30
  }                                                                                                                   // 31
                                                                                                                      // 32
  var invalidKeys = doValidation(doc, options.modifier, options.upsert, null, self._simpleSchema, options.extendedCustomContext);
                                                                                                                      // 34
  //now update self._invalidKeys and dependencies                                                                     // 35
                                                                                                                      // 36
  //note any currently invalid keys so that we can mark them as changed                                               // 37
  //due to new validation (they may be valid now, or invalid in a different way)                                      // 38
  var removedKeys = _.pluck(self._invalidKeys, "name");                                                               // 39
                                                                                                                      // 40
  //update                                                                                                            // 41
  self._invalidKeys = invalidKeys;                                                                                    // 42
                                                                                                                      // 43
  //add newly invalid keys to changedKeys                                                                             // 44
  var addedKeys = _.pluck(self._invalidKeys, "name");                                                                 // 45
                                                                                                                      // 46
  //mark all changed keys as changed                                                                                  // 47
  var changedKeys = _.union(addedKeys, removedKeys);                                                                  // 48
  self._markKeysChanged(changedKeys);                                                                                 // 49
                                                                                                                      // 50
  // Return true if it was valid; otherwise, return false                                                             // 51
  return self._invalidKeys.length === 0;                                                                              // 52
};                                                                                                                    // 53
                                                                                                                      // 54
//validates doc against self._schema for one key and sets a reactive array of error objects                           // 55
SimpleSchemaValidationContext.prototype.validateOne = function(doc, keyName, options) {                               // 56
  var self = this;                                                                                                    // 57
  options = _.extend({                                                                                                // 58
    modifier: false,                                                                                                  // 59
    upsert: false,                                                                                                    // 60
    extendedCustomContext: {}                                                                                         // 61
  }, options || {});                                                                                                  // 62
                                                                                                                      // 63
  //on the client we can add the userId if not already in the custom context                                          // 64
  if (Meteor.isClient && options.extendedCustomContext.userId === void 0) {                                           // 65
    options.extendedCustomContext.userId = (Meteor.userId && Meteor.userId()) || null;                                // 66
  }                                                                                                                   // 67
                                                                                                                      // 68
  var invalidKeys = doValidation(doc, options.modifier, options.upsert, keyName, self._simpleSchema, options.extendedCustomContext);
                                                                                                                      // 70
  //now update self._invalidKeys and dependencies                                                                     // 71
                                                                                                                      // 72
  //remove objects from self._invalidKeys where name = keyName                                                        // 73
  var newInvalidKeys = [];                                                                                            // 74
  for (var i = 0, ln = self._invalidKeys.length, k; i < ln; i++) {                                                    // 75
    k = self._invalidKeys[i];                                                                                         // 76
    if (k.name !== keyName) {                                                                                         // 77
      newInvalidKeys.push(k);                                                                                         // 78
    }                                                                                                                 // 79
  }                                                                                                                   // 80
  self._invalidKeys = newInvalidKeys;                                                                                 // 81
                                                                                                                      // 82
  //merge invalidKeys into self._invalidKeys                                                                          // 83
  for (var i = 0, ln = invalidKeys.length, k; i < ln; i++) {                                                          // 84
    k = invalidKeys[i];                                                                                               // 85
    self._invalidKeys.push(k);                                                                                        // 86
  }                                                                                                                   // 87
                                                                                                                      // 88
  //mark key as changed due to new validation (they may be valid now, or invalid in a different way)                  // 89
  self._markKeysChanged([keyName]);                                                                                   // 90
                                                                                                                      // 91
  // Return true if it was valid; otherwise, return false                                                             // 92
  return !self._keyIsInvalid(keyName);                                                                                // 93
};                                                                                                                    // 94
                                                                                                                      // 95
function doValidation(obj, isModifier, isUpsert, keyToValidate, ss, extendedCustomContext) {                          // 96
  var useOld = true; //for now this can be manually changed to try the experimental method, which doesn't yet work properly
  var func = useOld ? doValidation1 : doValidation2;                                                                  // 98
  return func(obj, isModifier, isUpsert, keyToValidate, ss, extendedCustomContext);                                   // 99
}                                                                                                                     // 100
                                                                                                                      // 101
//reset the invalidKeys array                                                                                         // 102
SimpleSchemaValidationContext.prototype.resetValidation = function() {                                                // 103
  var self = this;                                                                                                    // 104
  var removedKeys = _.pluck(self._invalidKeys, "name");                                                               // 105
  self._invalidKeys = [];                                                                                             // 106
  self._markKeysChanged(removedKeys);                                                                                 // 107
};                                                                                                                    // 108
                                                                                                                      // 109
SimpleSchemaValidationContext.prototype.isValid = function() {                                                        // 110
  var self = this;                                                                                                    // 111
  self._depsAny.depend();                                                                                             // 112
  return !self._invalidKeys.length;                                                                                   // 113
};                                                                                                                    // 114
                                                                                                                      // 115
SimpleSchemaValidationContext.prototype.invalidKeys = function() {                                                    // 116
  var self = this;                                                                                                    // 117
  self._depsAny.depend();                                                                                             // 118
  return self._invalidKeys;                                                                                           // 119
};                                                                                                                    // 120
                                                                                                                      // 121
SimpleSchemaValidationContext.prototype.addInvalidKeys = function(errors) {                                           // 122
  var self = this;                                                                                                    // 123
                                                                                                                      // 124
  if (!errors || !errors.length)                                                                                      // 125
    return;                                                                                                           // 126
                                                                                                                      // 127
  var changedKeys = [];                                                                                               // 128
  _.each(errors, function (errorObject) {                                                                             // 129
    changedKeys.push(errorObject.name);                                                                               // 130
    self._invalidKeys.push(errorObject);                                                                              // 131
  });                                                                                                                 // 132
                                                                                                                      // 133
  self._markKeysChanged(changedKeys);                                                                                 // 134
};                                                                                                                    // 135
                                                                                                                      // 136
SimpleSchemaValidationContext.prototype._markKeysChanged = function(keys) {                                           // 137
  var self = this;                                                                                                    // 138
                                                                                                                      // 139
  if (!keys || !keys.length)                                                                                          // 140
    return;                                                                                                           // 141
                                                                                                                      // 142
  _.each(keys, function(name) {                                                                                       // 143
    var genericName = SimpleSchema._makeGeneric(name);                                                                // 144
    if (genericName in self._deps) {                                                                                  // 145
      self._deps[genericName].changed();                                                                              // 146
    }                                                                                                                 // 147
  });                                                                                                                 // 148
  self._depsAny.changed();                                                                                            // 149
};                                                                                                                    // 150
                                                                                                                      // 151
SimpleSchemaValidationContext.prototype._keyIsInvalid = function(name, genericName) {                                 // 152
  var self = this;                                                                                                    // 153
  genericName = genericName || SimpleSchema._makeGeneric(name);                                                       // 154
  var specificIsInvalid = !!_.findWhere(self._invalidKeys, {name: name});                                             // 155
  var genericIsInvalid = (genericName !== name) ? (!!_.findWhere(self._invalidKeys, {name: genericName})) : false;    // 156
  return specificIsInvalid || genericIsInvalid;                                                                       // 157
};                                                                                                                    // 158
                                                                                                                      // 159
SimpleSchemaValidationContext.prototype.keyIsInvalid = function(name) {                                               // 160
  var self = this, genericName = SimpleSchema._makeGeneric(name);                                                     // 161
  self._deps[genericName].depend();                                                                                   // 162
  return self._keyIsInvalid(name, genericName);                                                                       // 163
};                                                                                                                    // 164
                                                                                                                      // 165
SimpleSchemaValidationContext.prototype.keyErrorMessage = function(name) {                                            // 166
  var self = this, genericName = SimpleSchema._makeGeneric(name);                                                     // 167
  var ss = self._simpleSchema;                                                                                        // 168
  self._deps[genericName].depend();                                                                                   // 169
                                                                                                                      // 170
  var errorObj = _.findWhere(self._invalidKeys, {name: name});                                                        // 171
  if (!errorObj) {                                                                                                    // 172
    errorObj = _.findWhere(self._invalidKeys, {name: genericName});                                                   // 173
    if (!errorObj) {                                                                                                  // 174
      return "";                                                                                                      // 175
    }                                                                                                                 // 176
  }                                                                                                                   // 177
                                                                                                                      // 178
  var def = ss.schema(genericName);                                                                                   // 179
  if (!def) {                                                                                                         // 180
    return "";                                                                                                        // 181
  }                                                                                                                   // 182
                                                                                                                      // 183
  return ss.messageForError(errorObj.type, errorObj.name, def, errorObj.value);                                       // 184
};                                                                                                                    // 185
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);


/* Exports */
if (typeof Package === 'undefined') Package = {};
Package['simple-schema'] = {
  SimpleSchema: SimpleSchema,
  MongoObject: MongoObject
};

})();
