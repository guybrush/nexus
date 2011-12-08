var test = require('tap').test
  , nexus = require('../')(__dirname+'/common/config')
  , dnode = require('dnode')
  , cleanup = require('./common/cleanup')
  , fs = require('fs')
  , http = require('http')
  , port = Math.floor(Math.random() * 40000 + 10000)

/*
test('start error', function(t) {
  // t.plan(7)
  nexus.install({package:__dirname+'/fixtures/app-error'},function(err,data){
    t.notOk(err,'installing without error')
    console.log(data)
    nexus.server( { cmd    : 'start'
                  , config : __dirname+'/common/config.js' }
                , function(err,data){
      t.notOk(err,'nexus server started')
      var config = nexus.config()
      console.log('SERVERSTARTED',data, config)
      var opts = { port : config.port
                 , host : config.host
                 , key : fs.readFileSync(config.key,'utf8')
                 , cert : fs.readFileSync(config.cert,'utf8')
                 }
      console.log('CONNECTING',opts)
      var client = dnode.connect(opts,function(remote, conn){
        console.log('we are connected')
        // nexus.server({cmd:'stop'},function(err,data){
        //   console.log('STOPPEDNEXUSSERVER',err,data)
        //   t.notOk(err,'nexus server stopped')
        //   cleanup(function(){
        //     t.end()
        //   })
        // })
      })
      
    })
  })
})

*/

