var common = require('./common')
  , scenario = common.scenario({clients:1})
  , nexus = require('../')(__dirname+'/common/config')
  , dnode = require('dnode')
  , fs = require('fs')
  , http = require('http')
  , assert = require('assert')
 
module.exports =
{ 'nexus.start':
  { before: scenario.before
  , after: scenario.after
  , simple: function(done){
      this.timeout(10000)
      var port = Math.floor(Math.random() * 40000 + 10000)
      var opts = {script:'app-simple@0.0.0',options:[port]}
      scenario.clients[0].remote.start(opts,function(err,data){
        assert.ok(!err)
        assert.equal(data.name,'app-simple@0.0.0')
        done()  
      })
    }
  , error: function(done){
      this.timeout(10000)
      var plan = common.plan(3,done)
      var port = Math.floor(Math.random() * 40000 + 10000)
      var opts = {script:'app-error@0.0.0',options:[port]}
      var remote = scenario.clients[0].remote
      remote.start(opts,function(err,resStart){
        if (err) throw new Error(err)
        remote.subscribe('monitor::'+resStart.id+'::end',function(event,resEnd){
          remote.ps({id:resStart.id},function(err,resPs){
            assert.equal(1,resPs.crashed)
            plan.did()
          })
        })
        setTimeout(function(){sendRequest()},500)
        function sendRequest() {
          http.get({host:'localhost',port:port,path:'/'},function(res){
            assert.equal(200,res.statusCode)
            plan.did()
          })
        }
        remote.subscribe('monitor::'+resStart.id+'::start',function(event,data){
          setTimeout(function(){sendRequest()},500)
        })  
      }) 
    }
  }
}

