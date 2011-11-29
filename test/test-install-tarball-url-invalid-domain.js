var test = require('tap').test
  , nexus = require('../')
  , nexusServer = require('../bin/server')
  , fs = require('fs')

test('install tarball url invalid domain', function(t) {
  nexus.install({package:'http://321-foo-bar-123.com/package.tar.gz'},function(err,data){
    t.ok(err,'install does not throw, but passes the error along')
    nexusServer.close()
    t.end()
  })
})

