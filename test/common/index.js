var nexus = require('../../')(__dirname+'/config')
  , fs = require('fs')
  , dnode = require('dnode')
  , rimraf = require('rimraf')
  , debug = require('debug')('test')
  , config = require(__dirname+'/config')

module.exports =
{ scenario: scenario
, plan: plan
, cleanup: cleanup
, ee2log: ee2log
, config: config
}

// screnario()
function scenario(opts) {
  if (!(this instanceof scenario)) return new scenario(opts)
  var self = this
  self.clients = []
  self.config = null
  self.before = function(done){
    cleanup(function(err){
      debug('cleaned up')
      if (err) return done(err)
      nexus.install({package:__dirname+'/../fixtures/app-error'},function(err,data){
        debug('installed',__dirname+'/../fixtures/app-error')
        if (err) return done(err)
        nexus.install({package:__dirname+'/../fixtures/app-simple'},function(err,data){
          debug('installed',__dirname+'/../fixtures/app-simple')
          if (err) return done(err)
          nexus.server({cmd:'start'},function(err,data){
            debug('started server')
            nexus.config(function(err,cfg){
              self.config = cfg
              var clientOpts = { port : cfg.port
                               , host : cfg.host
                               , key  : cfg.key ? fs.readFileSync(cfg.key) : null
                               , cert : cfg.cert ? fs.readFileSync(cfg.cert) : null
                               , reconnect : 100 }
              debug('starting '+opts.clients+' clients')
              for (var i=0;i<opts.clients;i++) {
                var client = dnode.connect(clientOpts, function(remote, conn){
                  debug('client connected')
                  //remote.subscribe('**',function(){debug('**',[].slice.call(arguments))})
                  self.clients.push( { client : client
                                     , conn   : conn.id
                                     , remote : remote } )
                  conn.on('error',debug)
                  done()
                })
                client.on('error',debug)
              }
            })
          })
        })
      })
    })
  }
  self.after = function(done) {
    self.clients[0].client.on('error',function(e){debug('client-error',e)})
    self.clients[0].remote.stopall(function(err,data){
      debug('stopped all')
      if (err) return done(err)
      self.clients[0].remote.server({cmd:'stop'},function(err,data){
        debug('stopped server')
        if (err) return
        ;(function check(){
          var client = require('net').connect(self.config.socket,function(){
            setTimeout(check,20)
          })
          client.on('error',function(e){
            if (e.code === 'ECONNREFUSED')return done()
            done(e)
          })
        })()
      })
    })
  }
  return self
}

// test('foo',function(done){var did = plan(2,done);did();did()})
function plan(todo,cb) {
  if (!(this instanceof plan)) return new plan(todo,cb)
  var self = this
  self.todo = todo
  self.did = function(e) {
    if (--self.todo<=0) cb && cb(e)
  }
}

function cleanup(cb) {
  try {
    rimraf(__dirname+'/root',cb)
  } catch(e) {
    cb()
  }
}

function ee2log(name){
  return function(){
    debug((name || '☼')+':',this.event,'→',[].slice.call(arguments))
  }
}

