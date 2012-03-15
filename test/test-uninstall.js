var common = require('./common')
  , scenario = common.scenario({clients:1})
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
        debug('started',resA[Object.keys(resA)[0]].name)
        scenario.clients[0].remote.subscribe('**',common.ee2log('remote'))
        scenario.clients[0].remote.uninstall('app-simple@0.0.0',function(errB,resB){
          debug('tried to uninstall, error:',errB)
          assert.ok(errB)
          scenario.clients[0].remote.stopall(function(errC,resC){
            debug('stopped all',errC)
            assert.ok(!errC)
            scenario.clients[0].remote.uninstall('app-simple@0.0.0',function(errD,resD){
              debug('uninstalled',errD,resD)
              assert.ok(!errD)
              done()
            })
          })
        })
      })
    }
  }
}