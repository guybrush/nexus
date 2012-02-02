var common = require('./common')
  , nexus = require('../')(__dirname+'/common/config')
  , dnode = require('dnode')
  , fs = require('fs')
  , http = require('http')
  , assert = require('assert')
  //, AA = require('async-array')



describe('nexus.start',function(){
    
  /* */
  var nexusClient, nexusConn, nexusRemote
  before(function(done){
    nexus.install({package:__dirname+'/fixtures/app-error'},function(err,data){
      if (err) done(err)
      nexus.install({package:__dirname+'/fixtures/app-simple'},function(err,data){
        if (err) return done(err)
        nexus.server({cmd:'start'},function(err,data){
          nexus.config(function(err,cfg){
            var opts = { port : cfg.port
                       , host : cfg.host
                       , key  : cfg.key ? fs.readFileSync(cfg.key) : null
                       , cert : cfg.cert ? fs.readFileSync(cfg.cert) : null
                       , reconnect : 100
                       }
            
            nexusClient = dnode.connect(opts, function(remote, conn){
              nexusRemote = remote
              nexusConn = conn
              var _did, _do = function(e){if(!_did){_did=true,done(e)}}
              remote.server(function(err,data){
                if (!err) _do()
              })
              remote.subscribe('server::*::connected',function(event,data){
                _do()
              })
              // remote.subscribe('all',function(e,d){console.log('nexus>',e,'→',d)})
            })
            nexusClient.on('error',function(){})
          })
        })
      })
    }) 
    
  })
  /* */
  after(function(done){
    nexusRemote.stopall(function(err,data){                                                               
      nexusRemote.server({cmd:'stop'},function(err,data){
        common.cleanup(done)
      })                                                                      
    })
  })
    
    
  describe('simple',function(){
    it('should start the application',function(done){
      this.timeout(10000)
      var port = Math.floor(Math.random() * 40000 + 10000)
      var opts = {script:'app-simple@0.0.0',options:[port]}
      nexusRemote.start(opts,function(err,data){
        done()  
      })
    })
  })
  describe('error',function(){
    it('should restart the application upon crash '
      +'and increase the crash-count',function(done){
      this.timeout(10000)
      var sumDone = 3
      function addDone(){if (--sumDone) done()}
      var port = Math.floor(Math.random() * 40000 + 10000)
      var opts = {script:'app-error@0.0.0',options:[port]}
      nexusRemote.start(opts,function(err,resStart){
        if (err) throw new Error(err)
        nexusRemote.subscribe('monitor::'+resStart.id+'::end',function(event,resEnd){
          nexusRemote.ps({id:resStart.id},function(err,resPs){
            assert.equal(1,resPs.crashed)
            addDone()
          })
        })
        setTimeout(function(){sendRequest()},500)
        function sendRequest() {
          http.get({host:'localhost',port:port,path:'/'},function(res){
            assert.equal(200,res.statusCode)
            addDone()
          })
        }
        nexusRemote.subscribe('monitor::'+resStart.id+'::start',function(event,data){
          setTimeout(function(){sendRequest()},500)
        })  
      })    
    })
  })
  /* */
})
  
/****************************************************************************** /

    var aa = new AA
    ( [ ['install',{package:__dirname+'/fixtures/app-error'}]
      , ['install',{package:__dirname+'/fixtures/app-simple'}]
      , ['server',{cmd:'start'}]
      ] )
    aa.eachSerial(function(x,i,next){
      nexus[x[0]](x[1],next)
    })
    aa.done(function(err){
      if (err) throw new Error(err)
      nexus.config(function(err,cfg){
        nexusClient = dnode.connect(port, function(remote, conn){
          nexusRemote = remote
          nexusConn = conn
        })
      })
    })
    aa.exec()

/******************************************************************************/

