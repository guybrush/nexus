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
          remote.subscribe('server::*::*',function(e,d){
            if (_did) return
            remote.server(function(err,dataB){
              assert.equal(dataA.id,dataB.id)
              _do()
            })
          })
          remote.server(function(err,dataB){
            if (err) return
            assert.equal(dataA.id,dataB.id)
            _do()
          })
        })
        client.on('error',function(){})
      })
    }
  , 'cmd:"stop"': function(done){
      tmp.nexusRemote.server({cmd:'stop'},function(err,dataA){
        assert.ok(!err)
        setTimeout(function(){
          opts.reconnect = false
          var client = dnode.connect(opts,function(r,c){
            console.log('connected')
          })
          client.on('error',function(err){
            assert.equal(err.code,'ECONNREFUSED')
            done()
          })
        },200)
      })
    }
  }
}
