var nexus = require('../../')
  , fs = require('fs')
  , dnode = require('dnode')
  , rimraf = require('rimraf')

module.exports = 
{ scenario: scenario 
, plan: plan
, cleanup: cleanup
}

// screnario()
function scenario(opts) {
  if (!(this instanceof scenario)) return new scenario(opts)
  var self = this
  self.clients = []
  self.before = function(done){
    nexus.install({package:__dirname+'/../fixtures/app-error'},function(err,data){
      if (err) return done(err)
      nexus.install({package:__dirname+'/../fixtures/app-simple'},function(err,data){
        if (err) return done(err)
        nexus.server({cmd:'start'},function(err,data){
          nexus.config(function(err,cfg){
            var clientOpts = { port : cfg.port
                             , host : cfg.host
                             , key  : cfg.key ? fs.readFileSync(cfg.key) : null
                             , cert : cfg.cert ? fs.readFileSync(cfg.cert) : null
                             , reconnect : 100 }
            for (var i=0;i<opts.clients;i++) {
              var client = dnode.connect(clientOpts, function(remote, conn){
                self.clients.push( { client : client
                                   , conn   : conn.id
                                   , remote : remote } )
                done()
              })
              client.on('error',console.error)
            }
          })
        })
      })
    })
  }
  self.after = function(done) {
    self.clients[0].remote.stopall(function(err,data){   
      if (err) return done(err)
      self.clients[0].remote.server({cmd:'stop'},function(err,data){
        if (err) return done(err)
        cleanup(done)
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
  rimraf(__dirname+'/root',cb)
}
