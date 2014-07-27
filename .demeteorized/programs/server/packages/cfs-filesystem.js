(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var FS = Package['cfs-base-package'].FS;

(function () {

//////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                          //
// packages/cfs-filesystem/filesystem.server.js                                                             //
//                                                                                                          //
//////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                            //
var fs = Npm.require('fs');                                                                                 // 1
var path = Npm.require('path');                                                                             // 2
var mkdirp = Npm.require('mkdirp');                                                                         // 3
//var chokidar = Npm.require('chokidar');                                                                   // 4
                                                                                                            // 5
FS.Store.FileSystem = function(name, options) {                                                             // 6
  var self = this;                                                                                          // 7
  if (!(self instanceof FS.Store.FileSystem))                                                               // 8
    throw new Error('FS.Store.FileSystem missing keyword "new"');                                           // 9
                                                                                                            // 10
  // We allow options to be string/path empty or options.path                                               // 11
  options = (options !== ''+options) ? options || {} : { path: options };                                   // 12
                                                                                                            // 13
  // Provide a default FS directory one level up from the build/bundle directory                            // 14
  var pathname = options.path;                                                                              // 15
  if (!pathname && __meteor_bootstrap__ && __meteor_bootstrap__.serverDir) {                                // 16
    pathname = path.join(__meteor_bootstrap__.serverDir, '../../../cfs/files/' + name);                     // 17
  }                                                                                                         // 18
                                                                                                            // 19
  if (!pathname)                                                                                            // 20
    throw new Error('FS.Store.FileSystem unable to determine path');                                        // 21
                                                                                                            // 22
  // Check if we have '~/foo/bar'                                                                           // 23
  if (pathname.split(path.sep)[0] === '~') {                                                                // 24
    var homepath = process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE;                     // 25
    if (homepath) {                                                                                         // 26
      pathname = pathname.replace('~', homepath);                                                           // 27
    } else {                                                                                                // 28
      throw new Error('FS.Store.FileSystem unable to resolve "~" in path');                                 // 29
    }                                                                                                       // 30
  }                                                                                                         // 31
                                                                                                            // 32
  // Set absolute path                                                                                      // 33
  var absolutePath = path.resolve(pathname);                                                                // 34
                                                                                                            // 35
  // Ensure the path exists                                                                                 // 36
  mkdirp.sync(absolutePath);                                                                                // 37
  FS.debug && console.log(name + ' FileSystem mounted on: ' + absolutePath);                                // 38
                                                                                                            // 39
  return new FS.StorageAdapter(name, options, {                                                             // 40
    typeName: 'storage.filesystem',                                                                         // 41
    fileKey: function(fileObj) {                                                                            // 42
      // Lookup the copy                                                                                    // 43
      var store = fileObj && fileObj._getInfo(name);                                                        // 44
      // If the store and key is found return the key                                                       // 45
      if (store && store.key) return store.key;                                                             // 46
                                                                                                            // 47
      var filename = fileObj.name();                                                                        // 48
      var filenameInStore = fileObj.name({store: name});                                                    // 49
                                                                                                            // 50
      // If no store key found we resolve / generate a key                                                  // 51
      return fileObj.collectionName + '-' + fileObj._id + '-' + (filenameInStore || filename);              // 52
    },                                                                                                      // 53
    createReadStream: function(fileKey, options) {                                                          // 54
      // this is the Storage adapter scope                                                                  // 55
      var filepath = path.join(absolutePath, fileKey);                                                      // 56
                                                                                                            // 57
      // return the read stream - Options allow { start, end }                                              // 58
      return fs.createReadStream(filepath, options);                                                        // 59
    },                                                                                                      // 60
    createWriteStream: function(fileKey, options) {                                                         // 61
      options = options || {};                                                                              // 62
                                                                                                            // 63
      // this is the Storage adapter scope                                                                  // 64
      var filepath = path.join(absolutePath, fileKey);                                                      // 65
                                                                                                            // 66
      // Return the stream handle                                                                           // 67
      var writeStream = fs.createWriteStream(filepath, options);                                            // 68
                                                                                                            // 69
      // The filesystem does not emit the "end" event only close - so we                                    // 70
      // manually send the end event                                                                        // 71
      writeStream.on('close', function() {                                                                  // 72
        if (FS.debug) console.log('SA FileSystem - DONE!! fileKey: "' + fileKey + '"');                     // 73
                                                                                                            // 74
        // Get the exact size of the stored file, so that we can pass it to onEnd/onStored.                 // 75
        // Since stream transforms might have altered the size, this is the best way to                     // 76
        // ensure we update the fileObj.copies with the correct size.                                       // 77
        try {                                                                                               // 78
          // Get the stats of the file                                                                      // 79
          var stats = fs.statSync(filepath);                                                                // 80
                                                                                                            // 81
          // Emit end and return the fileKey, size, and updated date                                        // 82
          writeStream.emit('stored', {                                                                      // 83
            fileKey: fileKey,                                                                               // 84
            size: stats.size,                                                                               // 85
            storedAt: stats.mtime                                                                           // 86
          });                                                                                               // 87
                                                                                                            // 88
        } catch(err) {                                                                                      // 89
          // On error we emit the error on                                                                  // 90
          writeStream.emit('error', err);                                                                   // 91
        }                                                                                                   // 92
      });                                                                                                   // 93
                                                                                                            // 94
      return writeStream;                                                                                   // 95
    },                                                                                                      // 96
    remove: function(fileKey, callback) {                                                                   // 97
      // this is the Storage adapter scope                                                                  // 98
      var filepath = path.join(absolutePath, fileKey);                                                      // 99
                                                                                                            // 100
      // Call node unlink file                                                                              // 101
      fs.unlink(filepath, function (error, result) {                                                        // 102
        if (error && error.errno === 34) {                                                                  // 103
          console.warn("SA FileSystem: Could not delete " + filepath + " because the file was not found."); // 104
          callback && callback(null);                                                                       // 105
        } else {                                                                                            // 106
          callback && callback(error, result);                                                              // 107
        }                                                                                                   // 108
      });                                                                                                   // 109
    },                                                                                                      // 110
    stats: function(fileKey, callback) {                                                                    // 111
      // this is the Storage adapter scope                                                                  // 112
      var filepath = path.join(absolutePath, fileKey);                                                      // 113
      if (typeof callback === 'function') {                                                                 // 114
        fs.stat(filepath, callback);                                                                        // 115
      } else {                                                                                              // 116
        return fs.statSync(filepath);                                                                       // 117
      }                                                                                                     // 118
    }                                                                                                       // 119
    // Add this back and add the chokidar dependency back when we make this work eventually                 // 120
    // watch: function(callback) {                                                                          // 121
    //   function fileKey(filePath) {                                                                       // 122
    //     return filePath.replace(absolutePath, "");                                                       // 123
    //   }                                                                                                  // 124
                                                                                                            // 125
    //   FS.debug && console.log('Watching ' + absolutePath);                                               // 126
                                                                                                            // 127
    //   // chokidar seems to be most widely used and production ready watcher                              // 128
    //   var watcher = chokidar.watch(absolutePath, {ignored: /\/\./, ignoreInitial: true});                // 129
    //   watcher.on('add', Meteor.bindEnvironment(function(filePath, stats) {                               // 130
    //     callback("change", fileKey(filePath), {                                                          // 131
    //       name: path.basename(filePath),                                                                 // 132
    //       type: null,                                                                                    // 133
    //       size: stats.size,                                                                              // 134
    //       utime: stats.mtime                                                                             // 135
    //     });                                                                                              // 136
    //   }, function(err) {                                                                                 // 137
    //     throw err;                                                                                       // 138
    //   }));                                                                                               // 139
    //   watcher.on('change', Meteor.bindEnvironment(function(filePath, stats) {                            // 140
    //     callback("change", fileKey(filePath), {                                                          // 141
    //       name: path.basename(filePath),                                                                 // 142
    //       type: null,                                                                                    // 143
    //       size: stats.size,                                                                              // 144
    //       utime: stats.mtime                                                                             // 145
    //     });                                                                                              // 146
    //   }, function(err) {                                                                                 // 147
    //     throw err;                                                                                       // 148
    //   }));                                                                                               // 149
    //   watcher.on('unlink', Meteor.bindEnvironment(function(filePath) {                                   // 150
    //     callback("remove", fileKey(filePath));                                                           // 151
    //   }, function(err) {                                                                                 // 152
    //     throw err;                                                                                       // 153
    //   }));                                                                                               // 154
    // }                                                                                                    // 155
  });                                                                                                       // 156
};                                                                                                          // 157
                                                                                                            // 158
//////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);


/* Exports */
if (typeof Package === 'undefined') Package = {};
Package['cfs-filesystem'] = {};

})();
