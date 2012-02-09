var common = require('./common')
  , scenario = common.scenario({clients:1})
  , nexus = require('../')(common.config)
  , debug = require('debug')('test')
  , dnode = require('dnode')
  , fs = require('fs')
  , http = require('http')
  , assert = require('assert')
  
module.exports =
{ 'nexus.start()':
  { before: scenario.before
  , beforeEach: function(){console.log('')}
  , afterEach: function(done){scenario.clients[0].remote.stopall(done)}
  , after: scenario.after
  , 'script:"app-simple@0.0.0",options:[port]': function(done){
      this.timeout(10000)
      var port = Math.floor(Math.random() * 40000 + 10000)
      var opts = {script:'app-simple@0.0.0',options:[port]}
      debug('starting app on port '+port)
      scenario.clients[0].remote.start(opts,function(err,data){
        debug('started app on port '+port)
        assert.ok(!err)
        assert.equal(data.name,'app-simple@0.0.0')
        done()  
      })
    }
  , 'script:"app-error@0.0.0",options:[port]': function(done){
      this.timeout(10000)
      var plan = common.plan(4,done)
      var port = Math.floor(Math.random() * 40000 + 10000)
      var opts = {script:'app-error@0.0.0',options:[port]}
      var remote = scenario.clients[0].remote
      var crashed = 0
      debug('starting script',opts)
      remote.start(opts,function(err,resStart){
        if (err) throw new Error(err)
        debug('started script',resStart.script)
        remote.subscribe('monitor::'+resStart.id+'::exit',function(event,resEnd){
          debug('script crashed',resEnd)
          remote.ps({id:resStart.id},function(err,resPs){
            assert.equal(++crashed,resPs.crashed)
            plan.did()
          })
        })
        setTimeout(function(){sendRequest()},500)
        function sendRequest() {
          debug('sending request')
          http.get({host:'localhost',port:port,path:'/'},function(res){
            debug('got response',res.statusCode)
            assert.equal(200,res.statusCode)
            plan.did()
          })
        }
        remote.subscribe('monitor::'+resStart.id+'::start',function(event,data){
          debug('restarted script')
          setTimeout(function(){sendRequest()},500)
        })  
      }) 
    }
  }
}

