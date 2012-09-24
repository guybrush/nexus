var ME = module.exports.install = {}
var nexus = require('../')
var common = require('./common')
var assert = require('assert')
var path = require('path')
var fs = require('fs')

ME.before = function(done){common.cleanup(done)}
ME.git = function(done){
  var n = nexus(common.config)
  n.install({url:common.appPath,name:'fofoo'},function(err,data){
    assert.ok(!err)
    assert.equal(data.name,'fofoo')
    var testHookPath = path.join(common.config.apps,'fofoo','INSTALLHOOK')
    fs.exists(testHookPath,function(e){
      assert.ok(e)
      done()
    })
  })
}
