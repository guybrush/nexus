var common = require('./common')
  , scenario = common.scenario({clients:1})
  , nexus = require('../')(__dirname+'/common/config')
  , debug = require('debug')('test')
  , dnode = require('dnode')
  , fs = require('fs')
  , http = require('http')
  , assert = require('assert')
  
module.exports = 
{ 'nexus.uninstall()':
  { before: scenario.before 
  , after: scenario.after
  , 'app-error@0.0.0': function(done){
      scenario.clients[0].remote.uninstall('app-error@0.0.0',function(err,res){
        assert.ok(!err)
        assert.equal('app-error@0.0.0',res)
        done()
      })
    }
  , 'app-simple@0.0.0 (while running)': function(done){
      scenario.clients[0].remote.start({script:'app-simple@0.0.0'},function(errA,resA){
        scenario.clients[0].remote.uninstall('app-simple@0.0.0',function(errB,resB){
          assert.ok(errB)
          scenario.clients[0].remote.stopall(function(errC,resC){
            assert.ok(!errC)
            scenario.clients[0].remote.uninstall('app-simple@0.0.0',function(errD,resD){
              assert.ok(!errD)
              done()
            })
          })
        })
      })
    }
  }
}