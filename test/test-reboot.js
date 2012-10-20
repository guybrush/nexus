var ME = module.exports.reboot = {}
var nexus = require('../')
var common = require('./common')
var assert = require('assert')

ME.before = function(done){common.cleanup(done)}

ME['start 2 apps, process.kill all, reboot'] = function(done){
  var n = nexus(common.config)
  var name = 'bla'
  n.install({url:common.appPath,name:name},function(err,data){
    assert.ok(!err)
    assert.equal(data.name,name)
    n.start({name:name},function(err,data){
      assert.ok(!err)
      assert.equal(data.name,name)
      var idA = data.id
      var pidA = data.pid
      var monPidA = data.monPid
      n.start({name:name},function(err,data){
        assert.ok(!err)
        assert.equal(data.name,name)
        var idB = data.id
        var pidB = data.pid
        var monPidB = data.monPid
        // now fake a system-reboot: kill all processes
        process.kill(monPidA)
        process.kill(monPidB)
        process.kill(pidA)
        process.kill(pidB)
        n.reboot(function(err,data){
          assert.ok(!err)
          assert.equal(data.length,2)
          var idsToRestart = [idA,idB]
          data.forEach(function(x){
            idsToRestart.splice(idsToRestart.indexOf(x.id),1)
          })
          assert.ok(!idsToRestart.length)
          n.stopall(done)
        })
      })
    })
  })
}
