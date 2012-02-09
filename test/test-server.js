var nexus = require('../index')(__dirname+'/common/config')
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
  , beforeEach: function(){console.log('')}
  , 'cmd:"start"': function(done){
      this.timeout(5000) // on my computer, it takes ~2800ms :/
      var _did, _do = function(e){if(!_did){_did=true;done(e)}}
      debug('starting server')
      nexus.server({cmd:'start',debug:true},function(err,dataA){
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
        var iv = setInterval(function(){
          opts.reconnect = false
          var client = dnode.connect(opts)
          client.on('error',function(err){
            debug('server is not running anymore')
            clearInterval(iv)
            assert.equal(err.code,'ECONNREFUSED')
            done()
          })
        },200)
      })
    }
  }
}
