var test = require('tap').test
  , nexus = require('../')(__dirname+'/common/config.js')
  , dnode = require('dnode')
  , cleanup = require('./common/cleanup')
  , fs = require('fs')
  , http = require('http')
  , port = Math.floor(Math.random() * 40000 + 10000)

test('start error', function(t) {
  t.plan(4)
  cleanup(function(){
    nexus.install( { package:__dirname+'/fixtures/app-error'
                   , name : 'errorapp' } 
                 , function(err,data){
      t.notOk(err,'installing without error')
      nexus.server({cmd:'start'},function(err,data){
        var config = nexus.config()
        var opts = { port : config.port
                   , host : config.host
                   , key : config.key ? fs.readFileSync(config.key,'utf8') : null
                   , cert : config.cert ? fs.readFileSync(config.cert,'utf8') : null
                   , reconnect : 500 }
        var client = dnode.connect(opts,function(remote,conn){
          var done
          remote.subscribe('monitor::*::stdout',function(event,data){
            if (done) return
            done = true
            var id = event.split('::')[1]
            remote.ps({id:id},function(err,data){
              http.get({host:'localhost',port:port,path:'/'},function(res){
                t.equal(res.statusCode,200,'the first request is ok, but will crash the app')
                setTimeout(function(){
                  remote.ps({id:id},function(err,proc){
                    t.equal(proc.crashed,1,'nexus.ps says the proc has crashed 1 time')
                    remote.stopall()
                    remote.server({cmd:'stop'})
                    conn.end()
                    cleanup(function(){
                      t.end()
                    })
                  })
                },500)
              })
            })
          })
          remote.ls(function(err,data){
            t.equal(data['errorapp'].name,'app-error')
            remote.start({script:'errorapp',options:[port]},function(){})
          })
        }) 
        client.on('error',function(err){
          if (err.code != 'ECONNREFUSED')
            throw new Error(err)
        })
      })
    })
  })
})


