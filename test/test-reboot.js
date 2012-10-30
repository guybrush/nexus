var ME = module.exports.reboot = {}
var nexus = require('../')
var common = require('./common')
var assert = require('assert')
var debug = require('debug')('test')

ME.before = function(done){common.cleanup(done)}

ME['start 2 apps, process.kill all, reboot'] = function(done){
  var n = nexus(common.config)
  var name = 'bla'
  n.install({url:common.appPath,name:name},function(err,data){
    assert.ok(!err)
    debug('installed app')
    assert.equal(data.name,name)
    n.start({name:name},function(err,dataA){
      assert.ok(!err)
      debug('started app A')
      assert.equal(dataA.name,name)
      var idA = dataA.id
      var pidA = dataA.pid
      var monPidA = dataA.monPid
      n.start({name:name},function(err,dataB){
        assert.ok(!err)
        debug('started app B')
        assert.equal(dataB.name,name)
        var idB = dataB.id
        var pidB = dataB.pid
        var monPidB = dataB.monPid
        // now fake a system-reboot: kill all processes
        process.kill(monPidA)
        process.kill(monPidB)
        n.reboot(function(err,data){
          assert.ok(!err)
          debug('did reboot')
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

