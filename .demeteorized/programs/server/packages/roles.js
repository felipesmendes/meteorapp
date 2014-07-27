(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var _ = Package.underscore._;
var Accounts = Package['accounts-base'].Accounts;

/* Package-scope variables */
var Roles;

(function () {

/////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                         //
// packages/roles/roles_server.js                                                                          //
//                                                                                                         //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                           //
;(function () {                                                                                            // 1
                                                                                                           // 2
                                                                                                           // 3
/**                                                                                                        // 4
 * Roles collection documents consist only of an id and a role name.                                       // 5
 *   ex: { _id:<uuid>, name: "admin" }                                                                     // 6
 */                                                                                                        // 7
if (!Meteor.roles) {                                                                                       // 8
  Meteor.roles = new Meteor.Collection("roles")                                                            // 9
                                                                                                           // 10
  // Create default indexes for roles collection                                                           // 11
  Meteor.roles._ensureIndex('name', {unique: 1})                                                           // 12
}                                                                                                          // 13
                                                                                                           // 14
                                                                                                           // 15
/**                                                                                                        // 16
 * Always publish logged-in user's roles so client-side                                                    // 17
 * checks can work.                                                                                        // 18
 */                                                                                                        // 19
Meteor.publish(null, function () {                                                                         // 20
  var userId = this.userId,                                                                                // 21
      fields = {roles:1}                                                                                   // 22
                                                                                                           // 23
  return Meteor.users.find({_id:userId}, {fields: fields})                                                 // 24
})                                                                                                         // 25
                                                                                                           // 26
}());                                                                                                      // 27
                                                                                                           // 28
/////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

/////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                         //
// packages/roles/roles_common.js                                                                          //
//                                                                                                         //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                           //
;(function () {                                                                                            // 1
                                                                                                           // 2
/**                                                                                                        // 3
 * Provides functions related to user authorization. Compatible with built-in Meteor accounts packages.    // 4
 *                                                                                                         // 5
 * @module Roles                                                                                           // 6
 */                                                                                                        // 7
                                                                                                           // 8
/**                                                                                                        // 9
 * Roles collection documents consist only of an id and a role name.                                       // 10
 *   ex: { _id:<uuid>, name: "admin" }                                                                     // 11
 */                                                                                                        // 12
if (!Meteor.roles) {                                                                                       // 13
  Meteor.roles = new Meteor.Collection("roles")                                                            // 14
}                                                                                                          // 15
                                                                                                           // 16
/**                                                                                                        // 17
 * Role-based authorization compatible with built-in Meteor accounts package.                              // 18
 *                                                                                                         // 19
 * Stores user's current roles in a 'roles' field on the user object.                                      // 20
 *                                                                                                         // 21
 * @class Roles                                                                                            // 22
 * @constructor                                                                                            // 23
 */                                                                                                        // 24
if ('undefined' === typeof Roles) {                                                                        // 25
  Roles = {}                                                                                               // 26
}                                                                                                          // 27
                                                                                                           // 28
"use strict";                                                                                              // 29
                                                                                                           // 30
var mixingGroupAndNonGroupErrorMsg = "Roles error: Can't mix grouped and non-grouped roles for same user"; // 31
                                                                                                           // 32
_.extend(Roles, {                                                                                          // 33
                                                                                                           // 34
  /**                                                                                                      // 35
   * Constant used to reference the special 'global' group that                                            // 36
   * can be used to apply blanket permissions across all groups.                                           // 37
   *                                                                                                       // 38
   * @example                                                                                              // 39
   *     Roles.addUsersToRoles(user, 'admin', Roles.GLOBAL_GROUP)                                          // 40
   *     Roles.userIsInRole(user, 'admin') // => true                                                      // 41
   *                                                                                                       // 42
   *     Roles.setUserRoles(user, 'support-staff', Roles.GLOBAL_GROUP)                                     // 43
   *     Roles.userIsInRole(user, 'support-staff') // => true                                              // 44
   *     Roles.userIsInRole(user, 'admin') // => false                                                     // 45
   *                                                                                                       // 46
   * @property GLOBAL_GROUP                                                                                // 47
   * @type String                                                                                          // 48
   * @static                                                                                               // 49
   * @final                                                                                                // 50
   */                                                                                                      // 51
  GLOBAL_GROUP: '__global_roles__',                                                                        // 52
                                                                                                           // 53
                                                                                                           // 54
  /**                                                                                                      // 55
   * Create a new role. Whitespace will be trimmed.                                                        // 56
   *                                                                                                       // 57
   * @method createRole                                                                                    // 58
   * @param {String} role Name of role                                                                     // 59
   * @return {String} id of new role                                                                       // 60
   */                                                                                                      // 61
  createRole: function (role) {                                                                            // 62
    var id,                                                                                                // 63
        match                                                                                              // 64
                                                                                                           // 65
    if (!role                                                                                              // 66
        || 'string' !== typeof role                                                                        // 67
        || role.trim().length === 0) {                                                                     // 68
      return                                                                                               // 69
    }                                                                                                      // 70
                                                                                                           // 71
    try {                                                                                                  // 72
      id = Meteor.roles.insert({'name': role.trim()})                                                      // 73
      return id                                                                                            // 74
    } catch (e) {                                                                                          // 75
      // (from Meteor accounts-base package, insertUserDoc func)                                           // 76
      // XXX string parsing sucks, maybe                                                                   // 77
      // https://jira.mongodb.org/browse/SERVER-3069 will get fixed one day                                // 78
      if (e.name !== 'MongoError') throw e                                                                 // 79
      match = e.err.match(/^E11000 duplicate key error index: ([^ ]+)/)                                    // 80
      if (!match) throw e                                                                                  // 81
      if (match[1].indexOf('$name') !== -1)                                                                // 82
        throw new Meteor.Error(403, "Role already exists.")                                                // 83
      throw e                                                                                              // 84
    }                                                                                                      // 85
  },                                                                                                       // 86
                                                                                                           // 87
  /**                                                                                                      // 88
   * Delete an existing role.  Will throw "Role in use" error if any users                                 // 89
   * are currently assigned to the target role.                                                            // 90
   *                                                                                                       // 91
   * @method deleteRole                                                                                    // 92
   * @param {String} role Name of role                                                                     // 93
   */                                                                                                      // 94
  deleteRole: function (role) {                                                                            // 95
    if (!role) return                                                                                      // 96
                                                                                                           // 97
    var foundExistingUser = Meteor.users.findOne(                                                          // 98
                              {roles: {$in: [role]}},                                                      // 99
                              {fields: {_id: 1}})                                                          // 100
                                                                                                           // 101
    if (foundExistingUser) {                                                                               // 102
      throw new Meteor.Error(403, 'Role in use')                                                           // 103
    }                                                                                                      // 104
                                                                                                           // 105
    var thisRole = Meteor.roles.findOne({name: role})                                                      // 106
    if (thisRole) {                                                                                        // 107
      Meteor.roles.remove({_id: thisRole._id})                                                             // 108
    }                                                                                                      // 109
  },                                                                                                       // 110
                                                                                                           // 111
  /**                                                                                                      // 112
   * Add users to roles. Will create roles as needed.                                                      // 113
   *                                                                                                       // 114
   * NOTE: Mixing grouped and non-grouped roles for the same user                                          // 115
   *       is not supported and will throw an error.                                                       // 116
   *                                                                                                       // 117
   * Makes 2 calls to database:                                                                            // 118
   *  1. retrieve list of all existing roles                                                               // 119
   *  2. update users' roles                                                                               // 120
   *                                                                                                       // 121
   * @example                                                                                              // 122
   *     Roles.addUsersToRoles(userId, 'admin')                                                            // 123
   *     Roles.addUsersToRoles(userId, ['view-secrets'], 'example.com')                                    // 124
   *     Roles.addUsersToRoles([user1, user2], ['user','editor'])                                          // 125
   *     Roles.addUsersToRoles([user1, user2], ['glorious-admin', 'perform-action'], 'example.org')        // 126
   *     Roles.addUsersToRoles(userId, 'admin', Roles.GLOBAL_GROUP)                                        // 127
   *                                                                                                       // 128
   * @method addUsersToRoles                                                                               // 129
   * @param {Array|String} users User id(s) or object(s) with an _id field                                 // 130
   * @param {Array|String} roles Name(s) of roles/permissions to add users to                              // 131
   * @param {String} [group] Optional group name. If supplied, roles will be                               // 132
   *                         specific to that group.                                                       // 133
   *                         Group names can not start with '$'.                                           // 134
   *                         Periods in names '.' are automatically converted                              // 135
   *                         to underscores.                                                               // 136
   *                         The special group Roles.GLOBAL_GROUP provides                                 // 137
   *                         a convenient way to assign blanket roles/permissions                          // 138
   *                         across all groups.  The roles/permissions in the                              // 139
   *                         Roles.GLOBAL_GROUP group will be automatically                                // 140
   *                         included in checks for any group.                                             // 141
   */                                                                                                      // 142
  addUsersToRoles: function (users, roles, group) {                                                        // 143
    // use Template pattern to update user roles                                                           // 144
    Roles._updateUserRoles(users, roles, group, Roles._update_$addToSet_fn)                                // 145
  },                                                                                                       // 146
                                                                                                           // 147
  /**                                                                                                      // 148
   * Set a users roles/permissions.                                                                        // 149
   *                                                                                                       // 150
   * @example                                                                                              // 151
   *     Roles.setUserRoles(userId, 'admin')                                                               // 152
   *     Roles.setUserRoles(userId, ['view-secrets'], 'example.com')                                       // 153
   *     Roles.setUserRoles([user1, user2], ['user','editor'])                                             // 154
   *     Roles.setUserRoles([user1, user2], ['glorious-admin', 'perform-action'], 'example.org')           // 155
   *     Roles.setUserRoles(userId, 'admin', Roles.GLOBAL_GROUP)                                           // 156
   *                                                                                                       // 157
   * @method setUserRoles                                                                                  // 158
   * @param {Array|String} users User id(s) or object(s) with an _id field                                 // 159
   * @param {Array|String} roles Name(s) of roles/permissions to add users to                              // 160
   * @param {String} [group] Optional group name. If supplied, roles will be                               // 161
   *                         specific to that group.                                                       // 162
   *                         Group names can not start with '$'.                                           // 163
   *                         Periods in names '.' are automatically converted                              // 164
   *                         to underscores.                                                               // 165
   *                         The special group Roles.GLOBAL_GROUP provides                                 // 166
   *                         a convenient way to assign blanket roles/permissions                          // 167
   *                         across all groups.  The roles/permissions in the                              // 168
   *                         Roles.GLOBAL_GROUP group will be automatically                                // 169
   *                         included in checks for any group.                                             // 170
   */                                                                                                      // 171
  setUserRoles: function (users, roles, group) {                                                           // 172
    // use Template pattern to update user roles                                                           // 173
    Roles._updateUserRoles(users, roles, group, Roles._update_$set_fn)                                     // 174
  },                                                                                                       // 175
                                                                                                           // 176
  /**                                                                                                      // 177
   * Remove users from roles                                                                               // 178
   *                                                                                                       // 179
   * @example                                                                                              // 180
   *     Roles.removeUsersFromRoles(users.bob, 'admin')                                                    // 181
   *     Roles.removeUsersFromRoles([users.bob, users.joe], ['editor'])                                    // 182
   *     Roles.removeUsersFromRoles([users.bob, users.joe], ['editor', 'user'])                            // 183
   *     Roles.removeUsersFromRoles(users.eve, ['user'], 'group1')                                         // 184
   *                                                                                                       // 185
   * @method removeUsersFromRoles                                                                          // 186
   * @param {Array|String} users User id(s) or object(s) with an _id field                                 // 187
   * @param {Array|String} roles Name(s) of roles to add users to                                          // 188
   * @param {String} [group] Optional. Group name. If supplied, only that                                  // 189
   *                         group will have roles removed.                                                // 190
   */                                                                                                      // 191
  removeUsersFromRoles: function (users, roles, group) {                                                   // 192
    var update                                                                                             // 193
                                                                                                           // 194
    if (!users) throw new Error ("Missing 'users' param")                                                  // 195
    if (!roles) throw new Error ("Missing 'roles' param")                                                  // 196
    if (group) {                                                                                           // 197
      if ('string' !== typeof group)                                                                       // 198
        throw new Error ("Roles error: Invalid parameter 'group'. Expected 'string' type")                 // 199
      if ('$' === group[0])                                                                                // 200
        throw new Error ("Roles error: groups can not start with '$'")                                     // 201
                                                                                                           // 202
      // convert any periods to underscores                                                                // 203
      group = group.replace(/\./g, '_')                                                                    // 204
    }                                                                                                      // 205
                                                                                                           // 206
    // ensure arrays                                                                                       // 207
    if (!_.isArray(users)) users = [users]                                                                 // 208
    if (!_.isArray(roles)) roles = [roles]                                                                 // 209
                                                                                                           // 210
    // ensure users is an array of user ids                                                                // 211
    users = _.reduce(users, function (memo, user) {                                                        // 212
      var _id                                                                                              // 213
      if ('string' === typeof user) {                                                                      // 214
        memo.push(user)                                                                                    // 215
      } else if ('object' === typeof user) {                                                               // 216
        _id = user._id                                                                                     // 217
        if ('string' === typeof _id) {                                                                     // 218
          memo.push(_id)                                                                                   // 219
        }                                                                                                  // 220
      }                                                                                                    // 221
      return memo                                                                                          // 222
    }, [])                                                                                                 // 223
                                                                                                           // 224
    // update all users, remove from roles set                                                             // 225
                                                                                                           // 226
    if (group) {                                                                                           // 227
      update = {$pullAll: {}}                                                                              // 228
      update.$pullAll['roles.'+group] = roles                                                              // 229
    } else {                                                                                               // 230
      update = {$pullAll: {roles: roles}}                                                                  // 231
    }                                                                                                      // 232
                                                                                                           // 233
    try {                                                                                                  // 234
      if (Meteor.isClient) {                                                                               // 235
        // Iterate over each user to fulfill Meteor's 'one update per ID' policy                           // 236
        _.each(users, function (user) {                                                                    // 237
          Meteor.users.update({_id:user}, update)                                                          // 238
        })                                                                                                 // 239
      } else {                                                                                             // 240
        // On the server we can leverage MongoDB's $in operator for performance                            // 241
        Meteor.users.update({_id:{$in:users}}, update, {multi: true})                                      // 242
      }                                                                                                    // 243
    }                                                                                                      // 244
    catch (ex) {                                                                                           // 245
      var removeNonGroupedRoleFromGroupMsg = 'Cannot apply $pull/$pullAll modifier to non-array'           // 246
                                                                                                           // 247
      if (ex.name === 'MongoError' &&                                                                      // 248
          ex.err === removeNonGroupedRoleFromGroupMsg) {                                                   // 249
        throw new Error (mixingGroupAndNonGroupErrorMsg)                                                   // 250
      }                                                                                                    // 251
                                                                                                           // 252
      throw ex                                                                                             // 253
    }                                                                                                      // 254
  },                                                                                                       // 255
                                                                                                           // 256
  /**                                                                                                      // 257
   * Check if user has specified permissions/roles                                                         // 258
   *                                                                                                       // 259
   * @example                                                                                              // 260
   *     // non-group usage                                                                                // 261
   *     Roles.userIsInRole(user, 'admin')                                                                 // 262
   *     Roles.userIsInRole(user, ['admin','editor'])                                                      // 263
   *     Roles.userIsInRole(userId, 'admin')                                                               // 264
   *     Roles.userIsInRole(userId, ['admin','editor'])                                                    // 265
   *                                                                                                       // 266
   *     // per-group usage                                                                                // 267
   *     Roles.userIsInRole(user,   ['admin','editor'], 'group1')                                          // 268
   *     Roles.userIsInRole(userId, ['admin','editor'], 'group1')                                          // 269
   *     Roles.userIsInRole(userId, ['admin','editor'], Roles.GLOBAL_GROUP)                                // 270
   *                                                                                                       // 271
   *     // this format can also be used as short-hand for Roles.GLOBAL_GROUP                              // 272
   *     Roles.userIsInRole(user, 'admin')                                                                 // 273
   *                                                                                                       // 274
   * @method userIsInRole                                                                                  // 275
   * @param {String|Object} user User Id or actual user object                                             // 276
   * @param {String|Array} roles Name of role/permission or Array of                                       // 277
   *                            roles/permissions to check against.  If array,                             // 278
   *                            will return true if user is in _any_ role.                                 // 279
   * @param {String} [group] Optional. Name of group.  If supplied, limits check                           // 280
   *                         to just that group.                                                           // 281
   *                         The user's Roles.GLOBAL_GROUP will always be checked                          // 282
   *                         whether group is specified or not.                                            // 283
   * @return {Boolean} true if user is in _any_ of the target roles                                        // 284
   */                                                                                                      // 285
  userIsInRole: function (user, roles, group) {                                                            // 286
    var id,                                                                                                // 287
        userRoles,                                                                                         // 288
        query,                                                                                             // 289
        groupQuery,                                                                                        // 290
        found = false                                                                                      // 291
                                                                                                           // 292
    // ensure array to simplify code                                                                       // 293
    if (!_.isArray(roles)) {                                                                               // 294
      roles = [roles]                                                                                      // 295
    }                                                                                                      // 296
                                                                                                           // 297
    if (!user) return false                                                                                // 298
    if (group) {                                                                                           // 299
      if ('string' !== typeof group) return false                                                          // 300
      if ('$' === group[0]) return false                                                                   // 301
                                                                                                           // 302
      // convert any periods to underscores                                                                // 303
      group = group.replace(/\./g, '_')                                                                    // 304
    }                                                                                                      // 305
                                                                                                           // 306
    if ('object' === typeof user) {                                                                        // 307
      userRoles = user.roles                                                                               // 308
      if (_.isArray(userRoles)) {                                                                          // 309
        return _.some(roles, function (role) {                                                             // 310
          return _.contains(userRoles, role)                                                               // 311
        })                                                                                                 // 312
      } else if ('object' === typeof userRoles) {                                                          // 313
        // roles field is dictionary of groups                                                             // 314
        found = _.isArray(userRoles[group]) && _.some(roles, function (role) {                             // 315
          return _.contains(userRoles[group], role)                                                        // 316
        })                                                                                                 // 317
        if (!found) {                                                                                      // 318
          // not found in regular group or group not specified.                                            // 319
          // check Roles.GLOBAL_GROUP, if it exists                                                        // 320
          found = _.isArray(userRoles[Roles.GLOBAL_GROUP]) && _.some(roles, function (role) {              // 321
            return _.contains(userRoles[Roles.GLOBAL_GROUP], role)                                         // 322
          })                                                                                               // 323
        }                                                                                                  // 324
        return found                                                                                       // 325
      }                                                                                                    // 326
                                                                                                           // 327
      // missing roles field, try going direct via id                                                      // 328
      id = user._id                                                                                        // 329
    } else if ('string' === typeof user) {                                                                 // 330
      id = user                                                                                            // 331
    }                                                                                                      // 332
                                                                                                           // 333
    if (!id) return false                                                                                  // 334
                                                                                                           // 335
                                                                                                           // 336
    query = {_id: id, $or: []}                                                                             // 337
                                                                                                           // 338
    // always check Roles.GLOBAL_GROUP                                                                     // 339
    groupQuery = {}                                                                                        // 340
    groupQuery['roles.'+Roles.GLOBAL_GROUP] = {$in: roles}                                                 // 341
    query.$or.push(groupQuery)                                                                             // 342
                                                                                                           // 343
    if (group) {                                                                                           // 344
      // structure of query, when group specified including Roles.GLOBAL_GROUP                             // 345
      //   {_id: id,                                                                                       // 346
      //    $or: [                                                                                         // 347
      //      {'roles.group1':{$in: ['admin']}},                                                           // 348
      //      {'roles.__global_roles__':{$in: ['admin']}}                                                  // 349
      //    ]}                                                                                             // 350
      groupQuery = {}                                                                                      // 351
      groupQuery['roles.'+group] = {$in: roles}                                                            // 352
      query.$or.push(groupQuery)                                                                           // 353
    } else {                                                                                               // 354
      // structure of query, where group not specified. includes                                           // 355
      // Roles.GLOBAL_GROUP                                                                                // 356
      //   {_id: id,                                                                                       // 357
      //    $or: [                                                                                         // 358
      //      {roles: {$in: ['admin']}},                                                                   // 359
      //      {'roles.__global_roles__': {$in: ['admin']}}                                                 // 360
      //    ]}                                                                                             // 361
      query.$or.push({roles: {$in: roles}})                                                                // 362
    }                                                                                                      // 363
                                                                                                           // 364
    found = Meteor.users.findOne(query, {fields: {_id: 1}})                                                // 365
    return found ? true : false                                                                            // 366
  },                                                                                                       // 367
                                                                                                           // 368
  /**                                                                                                      // 369
   * Retrieve users roles                                                                                  // 370
   *                                                                                                       // 371
   * @method getRolesForUser                                                                               // 372
   * @param {String|Object} user User Id or actual user object                                             // 373
   * @param {String} [group] Optional name of group to restrict roles to.                                  // 374
   *                         User's Roles.GLOBAL_GROUP will also be included.                              // 375
   * @return {Array} Array of user's roles, unsorted.                                                      // 376
   */                                                                                                      // 377
  getRolesForUser: function (user, group) {                                                                // 378
    if (!user) return []                                                                                   // 379
    if (group) {                                                                                           // 380
      if ('string' !== typeof group) return []                                                             // 381
      if ('$' === group[0]) return []                                                                      // 382
                                                                                                           // 383
      // convert any periods to underscores                                                                // 384
      group = group.replace(/\./g, '_')                                                                    // 385
    }                                                                                                      // 386
                                                                                                           // 387
    if ('string' === typeof user) {                                                                        // 388
      user = Meteor.users.findOne(                                                                         // 389
               {_id: user},                                                                                // 390
               {fields: {roles: 1}})                                                                       // 391
                                                                                                           // 392
    } else if ('object' !== typeof user) {                                                                 // 393
      // invalid user object                                                                               // 394
      return []                                                                                            // 395
    }                                                                                                      // 396
                                                                                                           // 397
    if (!user || !user.roles) return []                                                                    // 398
                                                                                                           // 399
    if (group) {                                                                                           // 400
      return _.union(user.roles[group] || [], user.roles[Roles.GLOBAL_GROUP] || [])                        // 401
    }                                                                                                      // 402
                                                                                                           // 403
    if (_.isArray(user.roles))                                                                             // 404
      return user.roles                                                                                    // 405
                                                                                                           // 406
    // using groups but group not specified. return global group, if exists                                // 407
    return user.roles[Roles.GLOBAL_GROUP] || []                                                            // 408
  },                                                                                                       // 409
                                                                                                           // 410
  /**                                                                                                      // 411
   * Retrieve set of all existing roles                                                                    // 412
   *                                                                                                       // 413
   * @method getAllRoles                                                                                   // 414
   * @return {Cursor} cursor of existing roles                                                             // 415
   */                                                                                                      // 416
  getAllRoles: function () {                                                                               // 417
    return Meteor.roles.find({}, {sort: {name: 1}})                                                        // 418
  },                                                                                                       // 419
                                                                                                           // 420
  /**                                                                                                      // 421
   * Retrieve all users who are in target role.                                                            // 422
   *                                                                                                       // 423
   * NOTE: This is an expensive query; it performs a full collection scan                                  // 424
   * on the users collection since there is no index set on the 'roles' field.                             // 425
   * This is by design as most queries will specify an _id so the _id index is                             // 426
   * used automatically.                                                                                   // 427
   *                                                                                                       // 428
   * @method getUsersInRole                                                                                // 429
   * @param {Array|String} role Name of role/permission.  If array, users                                  // 430
   *                            returned will have at least one of the roles                               // 431
   *                            specified but need not have _all_ roles.                                   // 432
   * @param {String} [group] Optional name of group to restrict roles to.                                  // 433
   *                         User's Roles.GLOBAL_GROUP will also be checked.                               // 434
   * @return {Cursor} cursor of users in role                                                              // 435
   */                                                                                                      // 436
  getUsersInRole: function (role, group) {                                                                 // 437
    var query,                                                                                             // 438
        roles = role,                                                                                      // 439
        groupQuery                                                                                         // 440
                                                                                                           // 441
    // ensure array to simplify query logic                                                                // 442
    if (!_.isArray(roles)) roles = [roles]                                                                 // 443
                                                                                                           // 444
    if (group) {                                                                                           // 445
      if ('string' !== typeof group)                                                                       // 446
        throw new Error ("Roles error: Invalid parameter 'group'. Expected 'string' type")                 // 447
      if ('$' === group[0])                                                                                // 448
        throw new Error ("Roles error: groups can not start with '$'")                                     // 449
                                                                                                           // 450
      // convert any periods to underscores                                                                // 451
      group = group.replace(/\./g, '_')                                                                    // 452
    }                                                                                                      // 453
                                                                                                           // 454
    query = {$or: []}                                                                                      // 455
                                                                                                           // 456
    // always check Roles.GLOBAL_GROUP                                                                     // 457
    groupQuery = {}                                                                                        // 458
    groupQuery['roles.'+Roles.GLOBAL_GROUP] = {$in: roles}                                                 // 459
    query.$or.push(groupQuery)                                                                             // 460
                                                                                                           // 461
    if (group) {                                                                                           // 462
      // structure of query, when group specified including Roles.GLOBAL_GROUP                             // 463
      //   {                                                                                               // 464
      //    $or: [                                                                                         // 465
      //      {'roles.group1':{$in: ['admin']}},                                                           // 466
      //      {'roles.__global_roles__':{$in: ['admin']}}                                                  // 467
      //    ]}                                                                                             // 468
      groupQuery = {}                                                                                      // 469
      groupQuery['roles.'+group] = {$in: roles}                                                            // 470
      query.$or.push(groupQuery)                                                                           // 471
    } else {                                                                                               // 472
      // structure of query, where group not specified. includes                                           // 473
      // Roles.GLOBAL_GROUP                                                                                // 474
      //   {                                                                                               // 475
      //    $or: [                                                                                         // 476
      //      {roles: {$in: ['admin']}},                                                                   // 477
      //      {'roles.__global_roles__': {$in: ['admin']}}                                                 // 478
      //    ]}                                                                                             // 479
      query.$or.push({roles: {$in: roles}})                                                                // 480
    }                                                                                                      // 481
                                                                                                           // 482
    return Meteor.users.find(query)                                                                        // 483
  },  // end getUsersInRole                                                                                // 484
                                                                                                           // 485
                                                                                                           // 486
  /**                                                                                                      // 487
   * Private function 'template' that uses $set to construct an update object                              // 488
   * for MongoDB.  Passed to _updateUserRoles                                                              // 489
   *                                                                                                       // 490
   * @method _update_$set_fn                                                                               // 491
   * @protected                                                                                            // 492
   * @param {Array} roles                                                                                  // 493
   * @param {String} [group]                                                                               // 494
   * @return {Object} update object for use in MongoDB update command                                      // 495
   */                                                                                                      // 496
  _update_$set_fn: function  (roles, group) {                                                              // 497
    var update = {}                                                                                        // 498
                                                                                                           // 499
    if (group) {                                                                                           // 500
      // roles is a key/value dict object                                                                  // 501
      update.$set = {}                                                                                     // 502
      update.$set['roles.' + group] = roles                                                                // 503
    } else {                                                                                               // 504
      // roles is an array of strings                                                                      // 505
      update.$set = {roles: roles}                                                                         // 506
    }                                                                                                      // 507
                                                                                                           // 508
    return update                                                                                          // 509
  },  // end _update_$set_fn                                                                               // 510
                                                                                                           // 511
  /**                                                                                                      // 512
   * Private function 'template' that uses $addToSet to construct an update                                // 513
   * object for MongoDB.  Passed to _updateUserRoles                                                       // 514
   *                                                                                                       // 515
   * @method _update_$addToSet_fn                                                                          // 516
   * @protected                                                                                            // 517
   * @param {Array} roles                                                                                  // 518
   * @param {String} [group]                                                                               // 519
   * @return {Object} update object for use in MongoDB update command                                      // 520
   */                                                                                                      // 521
  _update_$addToSet_fn: function (roles, group) {                                                          // 522
    var update = {}                                                                                        // 523
                                                                                                           // 524
    if (group) {                                                                                           // 525
      // roles is a key/value dict object                                                                  // 526
      update.$addToSet = {}                                                                                // 527
      update.$addToSet['roles.' + group] = {$each: roles}                                                  // 528
    } else {                                                                                               // 529
      // roles is an array of strings                                                                      // 530
      update.$addToSet = {roles: {$each: roles}}                                                           // 531
    }                                                                                                      // 532
                                                                                                           // 533
    return update                                                                                          // 534
  },  // end _update_$addToSet_fn                                                                          // 535
                                                                                                           // 536
                                                                                                           // 537
  /**                                                                                                      // 538
   * Internal function that users the Template pattern to adds or sets roles                               // 539
   * for users.                                                                                            // 540
   *                                                                                                       // 541
   * @method _updateUserRoles                                                                              // 542
   * @protected                                                                                            // 543
   * @param {Array|String} users user id(s) or object(s) with an _id field                                 // 544
   * @param {Array|String} roles name(s) of roles/permissions to add users to                              // 545
   * @param {String} group Group name. If not null or undefined, roles will be                             // 546
   *                         specific to that group.                                                       // 547
   *                         Group names can not start with '$'.                                           // 548
   *                         Periods in names '.' are automatically converted                              // 549
   *                         to underscores.                                                               // 550
   *                         The special group Roles.GLOBAL_GROUP provides                                 // 551
   *                         a convenient way to assign blanket roles/permissions                          // 552
   *                         across all groups.  The roles/permissions in the                              // 553
   *                         Roles.GLOBAL_GROUP group will be automatically                                // 554
   *                         included in checks for any group.                                             // 555
   * @param {Function} updateFactory Func which returns an update object that                              // 556
   *                         will be passed to Mongo.                                                      // 557
   *   @param {Array} roles                                                                                // 558
   *   @param {String} [group]                                                                             // 559
   */                                                                                                      // 560
  _updateUserRoles: function (users, roles, group, updateFactory) {                                        // 561
    if (!users) throw new Error ("Missing 'users' param")                                                  // 562
    if (!roles) throw new Error ("Missing 'roles' param")                                                  // 563
    if (group) {                                                                                           // 564
      if ('string' !== typeof group)                                                                       // 565
        throw new Error ("Roles error: Invalid parameter 'group'. Expected 'string' type")                 // 566
      if ('$' === group[0])                                                                                // 567
        throw new Error ("Roles error: groups can not start with '$'")                                     // 568
                                                                                                           // 569
      // convert any periods to underscores                                                                // 570
      group = group.replace(/\./g, '_')                                                                    // 571
    }                                                                                                      // 572
                                                                                                           // 573
    var existingRoles,                                                                                     // 574
        query,                                                                                             // 575
        update                                                                                             // 576
                                                                                                           // 577
    // ensure arrays to simplify code                                                                      // 578
    if (!_.isArray(users)) users = [users]                                                                 // 579
    if (!_.isArray(roles)) roles = [roles]                                                                 // 580
                                                                                                           // 581
    // remove invalid roles                                                                                // 582
    roles = _.reduce(roles, function (memo, role) {                                                        // 583
      if (role                                                                                             // 584
          && 'string' === typeof role                                                                      // 585
          && role.trim().length > 0) {                                                                     // 586
        memo.push(role.trim())                                                                             // 587
      }                                                                                                    // 588
      return memo                                                                                          // 589
    }, [])                                                                                                 // 590
                                                                                                           // 591
    // empty roles array is ok, since it might be a $set operation to clear roles                          // 592
    //if (roles.length === 0) return                                                                       // 593
                                                                                                           // 594
    // ensure all roles exist in 'roles' collection                                                        // 595
    existingRoles = _.reduce(Meteor.roles.find({}).fetch(), function (memo, role) {                        // 596
      memo[role.name] = true                                                                               // 597
      return memo                                                                                          // 598
    }, {})                                                                                                 // 599
    _.each(roles, function (role) {                                                                        // 600
      if (!existingRoles[role]) {                                                                          // 601
        Roles.createRole(role)                                                                             // 602
      }                                                                                                    // 603
    })                                                                                                     // 604
                                                                                                           // 605
    // ensure users is an array of user ids                                                                // 606
    users = _.reduce(users, function (memo, user) {                                                        // 607
      var _id                                                                                              // 608
      if ('string' === typeof user) {                                                                      // 609
        memo.push(user)                                                                                    // 610
      } else if ('object' === typeof user) {                                                               // 611
        _id = user._id                                                                                     // 612
        if ('string' === typeof _id) {                                                                     // 613
          memo.push(_id)                                                                                   // 614
        }                                                                                                  // 615
      }                                                                                                    // 616
      return memo                                                                                          // 617
    }, [])                                                                                                 // 618
                                                                                                           // 619
    // update all users                                                                                    // 620
    update = updateFactory(roles, group)                                                                   // 621
                                                                                                           // 622
    try {                                                                                                  // 623
      if (Meteor.isClient) {                                                                               // 624
        // On client, iterate over each user to fulfill Meteor's                                           // 625
        // 'one update per ID' policy                                                                      // 626
        _.each(users, function (user) {                                                                    // 627
          Meteor.users.update({_id: user}, update)                                                         // 628
        })                                                                                                 // 629
      } else {                                                                                             // 630
        // On the server we can use MongoDB's $in operator for                                             // 631
        // better performance                                                                              // 632
        Meteor.users.update(                                                                               // 633
          {_id: {$in: users}},                                                                             // 634
          update,                                                                                          // 635
          {multi: true})                                                                                   // 636
      }                                                                                                    // 637
    }                                                                                                      // 638
    catch (ex) {                                                                                           // 639
      var addNonGroupToGroupedRolesMsg = 'Cannot apply $addToSet modifier to non-array',                   // 640
          addGrouped2NonGroupedMsg = "can't append to array using string field name"                       // 641
                                                                                                           // 642
      if (ex.name === 'MongoError' &&                                                                      // 643
          (ex.err === addNonGroupToGroupedRolesMsg ||                                                      // 644
           ex.err.substring(0, 45) === addGrouped2NonGroupedMsg)) {                                        // 645
        throw new Error (mixingGroupAndNonGroupErrorMsg)                                                   // 646
      }                                                                                                    // 647
                                                                                                           // 648
      throw ex                                                                                             // 649
    }                                                                                                      // 650
  }  // end _updateUserRoles                                                                               // 651
                                                                                                           // 652
})  // end _.extend(Roles ...)                                                                             // 653
                                                                                                           // 654
}());                                                                                                      // 655
                                                                                                           // 656
/////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);


/* Exports */
if (typeof Package === 'undefined') Package = {};
Package.roles = {
  Roles: Roles
};

})();
