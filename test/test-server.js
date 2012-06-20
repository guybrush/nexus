var nexus = require('../')(__dirname+'/common/config')
  , common = require('./common')
  , scenario = common.scenario({clients:1})
  , EE = require('events').EventEmitter
  , assert = require('assert')
  , dnode = require('dnode')
  , fs = require('fs')
  , debug = require('debug')('test')
  , http = require('http')
  , cfg = nexus.config()    
  , AA = require('async-array')
  , tmp = {}
  , opts = { port : cfg.port
           , host : cfg.host
           , key  : cfg.key ? fs.readFileSync(cfg.key) : null
           , cert : cfg.cert ? fs.readFileSync(cfg.cert) : null
           //, reconnect : 100
           }

module.exports =                                                                                
{ 'nexus.server()':
  { after: function(done){common.cleanup(done)}
  , 'start/stop': function(done){
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
      this.timeout(40000)
      var port = ~~(Math.random() * 40000 + 10000)
      var remote = null
      var conn = null
      var ee = new EE()
      var client = dnode().connect(common.config.socket,{reconnect:100},function(r,c){
        remote = r
        conn = c
        c.on('remote',function(){ee.emit('remote')})
        c.on('end',function(){remote = null; conn = null})
      })
      client.on('error',function(er){console.log('client-error',er)})
      
      var todo =                                         
        [ [ nexus.install    , {package:__dirname+'/fixtures/app-simple'} ]
        , [ nexus.server     , {cmd:'start'} ]
        , [ onRemote         ]
        , [ 'remote.start'   , {script:'app-simple@0.0.0',options:[port]} ]
        , [ 'remote.ps'      ] 
        , [ crash            ] 
        , [ nexus.server     , {cmd:'reboot'} ]
        , [ onRemote         ]
        , [ waitForApp       ]
        , [ 'remote.ps'      ]
        , [ 'remote.stopall' ]
        , [ 'remote.server'  , {cmd:'stop'} ]
        ]
        
      new AA(todo).forEachSerial(function(x,i,next){
        var fn = x.shift()
        x.push(next)
        if (typeof fn == 'string' && /^remote/.test(fn))
          fn = remote[fn.split('.')[1]]
        debug(fn.name,x)
        fn.apply(null,x)
      }).done(function(err,data){
        if (err) return done(err)
        client.end()
        assert.ok(!err)
        var psBeforeCrash = data[4][Object.keys(data[4])[0]]
        var psAfterCrash = data[9][Object.keys(data[9])[0]]
        assert.equal(psBeforeCrash.name, psAfterCrash.name)
        assert.equal(psBeforeCrash.script, psAfterCrash.script)
        assert.deepEqual(psBeforeCrash.options, psAfterCrash.options)
        done()
      }).exec()
      
      function crash(cb) {
        remote.ps(function(err, data){
          if (err) return cb(new Error(err))
          remote.server({cmd:'stop'},function(err){
            if (err) return cb(new Error(err))
            setTimeout(function(){
              var id = Object.keys(data)[0]
              var pids = [ data[id].monitorPid, data[id].pid ]
              debug('killing',pids)
              pids.forEach(function(x){process.kill(x)})
              cb(null,'crashed all')
            },2000)
          })
        })
      }
      
      function onRemote(cb) {
        if (remote) return cb(null, remote)
        ee.once('remote', function(){cb(null, remote)})
      }
      
      function waitForApp(cb) {
        remote.ps(function(err,data){
          if (err) return cb(err)
          if (Object.keys(data).length>0) return cb(null,data)
          remote.subscribe('monitor::*::connected',function(ev,da){
            cb(null,ev.split('::')[1])
          })
        })
      }
      
      /*
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
      */
    }
  // , 'without options': function(done){done()} 
  // , 'restart': function(done){done()}
  // , 'version': function(done){done()}
  }
}
