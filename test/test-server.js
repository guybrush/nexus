var nexus = require('../')(__dirname+'/common/config')
  , common = require('./common')
  , assert = require('assert')
  , dnode = require('dnode')
  , fs = require('fs')
  , debug = require('debug')('test')
  , cfg = nexus.config()
  , tmp = {}
  , opts = { port : cfg.port
           , host : cfg.host
           , key  : cfg.key ? fs.readFileSync(cfg.key) : null
           , cert : cfg.cert ? fs.readFileSync(cfg.cert) : null
           , reconnect : 100 }

module.exports =
{ 'nexus.server()':
  { after: function(done){common.cleanup(done)}
  , beforeEach: function(){debug('')}
  , 'cmd:"start"': function(done){
      this.timeout(10000) // on my computer, it takes ~2800ms :/
      var _did, _do = function(e){if(!_did){_did=true;done(e)}}
      debug('starting server')
      nexus.server({cmd:'start'},function(err,dataA){
        debug('started server')
        assert.equal(null,err)
        debug('connecting to server')
        var client = dnode.connect(opts,function(remote,conn){
          debug('connected to server')
          tmp.nexusRemote = remote
          tmp.nexusRemote.server(function(err,dataB){
            assert.equal(dataA.id,dataB.id)
            done()
          })
        })
        client.on('error',function(){})
      })
    }
  , 'cmd:"stop"': function(done){
      debug('stopping server')
      tmp.nexusRemote.server({cmd:'stop'},function(err,dataA){
        assert.ok(!err)
        opts.reconnect = false
        ;(function check(){
          var client = dnode.connect(opts,function(){
            client.end()
            setTimeout(check,200)
          })
          client.on('error',function(err){
            if (err.code=='ECONNREFUSED') return done()
            client.end()
            setTimeout(check,200)
          })
        })()
      })
    }
  }
}
