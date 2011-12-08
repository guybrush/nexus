var test = require('tap').test
  , nexus = require('../')(__dirname+'/common/config.js')
  , cleanup = require('./common/cleanup')
  , fs = require('fs')
  , http = require('http')

test('install tarball url', function(t) {
  t.plan(8)
  var port = Math.floor(Math.random() * 40000 + 10000)
  var server = http.createServer(function(req,res){
    var stream = fs.createReadStream(__dirname+'/fixtures/app-simple.tar.gz')
    stream.pipe(res)
  }).listen(port, function(){
    var opts = 
      { package : 'http://localhost:'+port+'/app-simple.tar.gz'
      , name    : 'gnag' }
    nexus.install(opts, function(err, data){
      t.notOk(err,'install without error')
      t.equal(data,'gnag','the name of installed package is correct')
      nexus.ls('gnag', function(err, data){
        t.notOk(err,'ls without error')
        
        t.equal(data.name,'app-simple','ls displays the right package')
        nexus.install(opts, function(err, data) {
          t.notOk(err,'install with name-collision without error')
          t.equal(data,'gnag_1','the name of name-collision-package is altered')
          nexus.ls('gnag_1', function(err, data){
            t.notOk(err,'ls name-collision-package without error')
            t.equal(data.name,'app-simple','ls name-collision-package displays right package')
            cleanup(function(){
              t.end()
            })
          })
        })
      })
    })
  })
})

test('install tarball url', function(t) {
  t.plan(8)
  var port = Math.floor(Math.random() * 40000 + 10000)
  var server = http.createServer(function(req,res){
    var stream = fs.createReadStream(__dirname+'/fixtures/app-simple.tar.gz')
    stream.pipe(res)
  }).listen(port, function(){
    var opts = 
      { package : 'http://localhost:'+port+'/app-simple.tar.gz'
      , name    : 'gnag' }
    nexus.install(opts, function(err, data){
      t.notOk(err,'install without error')
      t.equal(data,'gnag','the name of installed package is correct')
      console.log('installed',err,data)
      nexus.ls('gnag', function(err, data){
        t.notOk(err,'ls without error')
        t.equal(data.name,'app-simple','ls displays the right package')
        nexus.install(opts, function(err, data) {
          t.notOk(err,'install with name-collision without error')
          t.equal(data,'gnag_1','the name of name-collision-package is altered')
          nexus.ls('gnag_1', function(err, data){
            t.notOk(err,'ls name-collision-package without error')
            t.equal(data.name,'app-simple','ls name-collision-package displays right package')
            server.close()
            nexusServer.close()
            t.end()
          })
        })
      })
    })
  })
})
