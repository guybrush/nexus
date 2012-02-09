var common = require('./common')
  , nexus = require('../')(__dirname+'/common/config')
  , fs = require('fs')
  , http = require('http')
  , assert = require('assert')
  
var port = Math.floor(Math.random() * 40000 + 10000)
var server = http.createServer(function(req,res){
  var stream = fs.createReadStream(__dirname+'/fixtures/app-simple.tar.gz')
  stream.pipe(res)
})
  
module.exports =
{ 'nexus.install':
  { before: function(done){server.listen(port,done)}
  , after: function(done){server.close();common.cleanup(done)}
  , 'install tarball from url and append `_$i` upon name-collision': function(done){
    Math.floor(Math.random() * 40000 + 10000)
      var opts = { package : 'http://localhost:'+port+'/app-simple.tar.gz'
                 , name    : 'gnag' }
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
    }
  , 'local folder with name': function(done){
      var opts = { package : __dirname+'/fixtures/app-error'
                 , name    : 'errorapp' }
      nexus.install(opts, function(err,data){
        assert.equal(null,err)
        assert.equal(data,'errorapp')
        nexus.ls({name:'errorapp'},function(err,data){
          assert.equal(null,err)
          assert.equal(data.name,'app-error')
          done()
        })
      })
    }
  , 'local folder w/o name → <pkg-name>@<pkg-version>': function(done){
      var opts = { package : __dirname+'/fixtures/app-error' }
      nexus.install(opts, function(err,data){
        assert.equal(null,err)
        assert.equal(data,'app-error@0.0.0')
        nexus.ls({name:'app-error@0.0.0'},function(err,data){
          assert.equal(null,err)
          assert.equal(data.name,'app-error')
          done()
        })
      })
    }
  , 'invalid url should not throw, but passes the error along': function(done){
      var opts = {package:'http://321-foo-bar-123.com/package.tar.gz'}
      nexus.install(opts, function(err,data){
        assert.equal(err.code,1)
        done()
      })
    }
  }
}

