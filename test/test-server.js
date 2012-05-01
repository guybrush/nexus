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
           //, reconnect : 100
           }

module.exports =
{ 'nexus.server()':
  { before:function(done){setTimeout(done,200)}
  , after: function(done){common.cleanup(done)}
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
  }
}
