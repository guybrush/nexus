var common = require('./common')
  , nexus = require('../')(__dirname+'/common/config')
  , fs = require('fs')
  , http = require('http')
  , assert = require('assert')

describe('nexus.install',function(){
    
  var port = Math.floor(Math.random() * 40000 + 10000)
  var server = http.createServer(function(req,res){
    var stream = fs.createReadStream(__dirname+'/fixtures/app-simple.tar.gz')
    stream.pipe(res)
  })
    
  before(function(done){
    server.listen(port,done)
  })
  
  after(function(done){
    server.close()
    common.cleanup(done)
  })
  
  afterEach(function(done){common.cleanup(done)})
    
  describe('tarball', function(){
    var opts = { package : 'http://localhost:'+port+'/app-simple.tar.gz'
               , name    : 'gnag' }
    
    it('should install the tarball and append `_$i` upon name-collision',function(done){
      nexus.install(opts, function(err,data){
        assert.equal(null,err)
        assert.equal(data,'gnag')
        nexus.ls({name:'gnag'},function(err,data){
          assert.equal(null,err)
          assert.equal(data.name,'app-simple')
          nexus.install(opts, function(err,data){
            assert.equal(null,err)
            assert.equal(data,'gnag_1')
            nexus.ls({name:'gnag_1'},function(err,data){
              assert.equal(null,err)
              assert.equal(data.name,'app-simple')
              done()
            })
          })
        })
      })
    })
  })
  
  describe('local folder',function(){
    var opts = { package : __dirname+'/fixtures/app-error'
               , name    : 'errorapp' }
    it('should install the folder',function(done){
      nexus.install(opts, function(err,data){
        assert.equal(null,err)
        assert.equal(data,'errorapp')
        nexus.ls({name:'errorapp'},function(err,data){
          assert.equal(null,err)
          assert.equal(data.name,'app-error')
          done()
        })
      })
    })
  })
  
  describe('unnamed',function(){
    var opts = { package : __dirname+'/fixtures/app-error' }
    it('should install the folder under the name: <pkg-name>@<pkg-version>',function(done){
      nexus.install(opts, function(err,data){
        assert.equal(null,err)
        assert.equal(data,'app-error@0.0.0')
        nexus.ls({name:'app-error@0.0.0'},function(err,data){
          assert.equal(null,err)
          assert.equal(data.name,'app-error')
          done()
        })
      })
    })
  })
  
  describe('invalid url', function() {
    it('should not throw, but passes the error along', function(done){
      nexus.install({package:'http://321-foo-bar-123.com/package.tar.gz'},function(err,data){
        assert.equal(err.code,'ENOTFOUND')
        assert.equal(err.syscall,'getaddrinfo')
        done()
      })
    })
  })
})

