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
        debug('did kill processes')
        n.ps(function(err,dataPs){
          assert.ok(!err)
          assert.equal(dataPs.length,2)
          assert.equal(dataPs[0].status,'ghost')
          assert.equal(dataPs[1].status,'ghost')
          n.reboot(function(err,dataReboot){
            assert.ok(!err)
            debug('did reboot')
            assert.equal(dataReboot.length,2)
            assert.equal(dataReboot[0].status,'alive')
            assert.equal(dataReboot[1].status,'alive')
            var idsToRestart = [idA,idB]
            dataReboot.forEach(function(x){
              idsToRestart.splice(idsToRestart.indexOf(x.id),1)
            })
            assert.ok(!idsToRestart.length)
            n.stopall(done)
          })
        })
      })
    })
  })
}

