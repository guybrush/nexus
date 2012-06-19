var nexus = require('../')(__dirname+'/common/config')
  , common = require('./common')
  , scenario = common.scenario({clients:1})
  , assert = require('assert')
  , dnode = require('dnode')
  , fs = require('fs')
  , debug = require('debug')('test')
  , http = require('http')
  , cfg = nexus.config()
  , tmp = {}
  , opts = { port : cfg.port
           , host : cfg.host
           , key  : cfg.key ? fs.readFileSync(cfg.key) : null
           , cert : cfg.cert ? fs.readFileSync(cfg.cert) : null
           //, reconnect : 100
           }

module.exports =
{ 'nexus.server()':
  { 
  //  beforeEach: function(done){common.cleanup(done)} 
  // afterEach: function(done){common.cleanup(done)}
  
  'start/stop': function(done){
      this.timeout(10000) // on my computer, it takes ~2800ms :/
      debug('starting server')
      nexus.server({cmd:'start'},function(err,dataA){
        debug('n.server start',dataA.id)
        assert.ok(!err)
        var client = dnode.connect(opts,function(r,c){
          debug('connected to server')
          r.server(function(err,data){
            debug('r.server',err,data.id)
            c.on('drop',function(){
              debug('client dropped')
            })
            c.on('end',function(){
              debug('client ended')
              var client2 = dnode.connect(opts)
              client2.on('error',function(e){
                assert.equal(e.code,'ECONNREFUSED')
                done()
              })
            })
            c.on('error',function(){debug('error')})
            r.server({cmd:'stop'},function(err){
              debug('r.server stop',err)
            }) 
          })  
        })
        client.on('error',function(e){
          debug('err',e)
        })
      })
    }
  , 'reboot': function(done){
      this.timeout(20000)
      var port = ~~(Math.random() * 40000 + 10000)
      nexus.server({cmd:'start'},function(){
        debug('started server')
        nexus.install({package:__dirname+'/fixtures/app-simple'},function(errInstall,dataInstall){
          debug('installed app-simple')
          var client = dnode.connect(common.config.socket,function(rem,con){
            rem.start({script:'app-simple@0.0.0',options:[port]},function(errStart,dataStart){
              debug('started app-simple')
              var didit = false
              rem.subscribe('monitor::*::stdout',function(){
                if (didit) return
                didit = true
                debug('app is listening')
                http.get({host:'localhost',port:port,path:'/'},function(res){
                  assert.equal(200,res.statusCode,'app is running')
                  rem.server(function(err,dataServer){
                    client.end()
                    setTimeout(function(){
                      process.kill(dataServer.monitorPid)
                      process.kill(dataServer.pid)
                      process.kill(dataStart.monitorPid)
                      process.kill(dataStart.pid)
                      debug('simulated system-crash')
                      var req = http.get({host:'localhost',port:port,path:'/'})
                      req.on('error',function(){
                        debug('app is dead')
                        nexus.server({cmd:'reboot'},function(){
                          debug('did start server with reboot')
                          var client = dnode.connect(common.config.socket,function(rem,con){
                            debug('connected to server')
                            rem.ps(function(err,data){debug('ps',data)})
                            var didit = false
                            rem.subscribe('monitor::*::stdout',function(ev,d){
                              debug('app stdout',d)
                              if (didit) return
                              didit = true
                              http.get({host:'localhost',port:port,path:'/'},function(res){
                                debug('app runs again')
                                assert.equal(200,res.statusCode)
                                rem.stopall(function(err, data){
                                  debug('stopped all')
                                  con.on('end',function(){
                                    debug('client ended')
                                    var client2 = dnode.connect(common.config.socket)
                                    client2.on('error',function(e){
                                      assert.equal(e.code,'ECONNREFUSED')
                                      done()
                                    })
                                  })
                                  rem.server({cmd:'stop'})
                                })
                              })
                            },function(){debug('subscribed to server')})
                          })
                        })
                      })
                    },100)
                  })
                })
              })
            })
          })
        })  
      })
    }
  // , 'without options': function(done){done()} 
  // , 'restart': function(done){done()}
  // , 'version': function(done){done()}
  }
}
