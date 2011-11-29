var test = require('tap').test
  , nexus = require('../')
  , nexusServer = require('../bin/server')
  , fs = require('fs')
  , http = require('http')
  , port = Math.floor(Math.random() * 40000 + 10000)

test('install-tarball-url-invalid-domain', function(t) {
  t.plan(7)
  nexus.install({package:__dirname+'/fixtures/app-error'},function(err,data){
    t.notOk(err,'installing without error')
    nexus.start({script:data,options:[port]},function(err,startedProc){
      t.notOk(err,'starting without error')
      setTimeout(function(){ // #TODO this is lame, nexus.subsribe needs to be done!
        nexus.ps(function(err,procs){
          t.notOk(err,'nexus.ps works without error')
          t.ok(procs[startedProc.id],'nexus.ps does list the started proc')
          http.get({host:'localhost',port:port,path:'/'},function(res){
            t.equal(res.statusCode,200,'the first request is ok, but will crash the app')
            setTimeout(function(){
              nexus.ps(function(err,procs){
                t.ok(procs[startedProc.id],'nexus.ps still lists the proc with the same id')
                t.equal(procs[startedProc.id].crashed,1,'nexus.ps says the proc has crashed 1 time')
                nexus.stopall()
                nexusServer.close()
                t.end()
              })
            },400)
          })
        })
      },400)
    })
  })
})

