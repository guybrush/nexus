var nexus = require('../index')(__dirname+'/common/config')
var common = require('./common')
var assert = require('assert')
var dnode = require('dnode')
var fs = require('fs')
var cfg = nexus.config()
var opts = { port : cfg.port
           , host : cfg.host
           , key  : cfg.key ? fs.readFileSync(cfg.key) : null
           , cert : cfg.cert ? fs.readFileSync(cfg.cert) : null
           , reconnect : 100 }

describe('nexus.server()',function(){
  var nexusRemote
  after(function(done){
    nexusRemote.server({cmd:'stop'},function(){
      common.cleanup(done)
    })
  })
  describe('cmd:start',function(){
    it('should start the server',function(done){
      this.timeout(5000) // on my computer, it takes ~2800ms :/
      nexus.server({cmd:'start'},function(err,dataA){
        assert.equal(null,err)
        var _did, _do = function(e){if(!_did){_did=true,done(e)}}
        var client = dnode.connect(opts,function(remote,conn){
          nexusRemote = remote
          remote.subscribe('server::*::connected',function(e,d){
            if (_did) return
            remote.server(function(err,dataB){
              //assert.equal(dataA.id,dataB.id)
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
    })
  })
})