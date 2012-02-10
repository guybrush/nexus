var common = require('./common')
  , nexus = require('../')(__dirname+'/common/config')
  , fs = require('fs')
  , http = require('http')
  , assert = require('assert')
  , debug = require('debug')('test')
  , port = Math.floor(Math.random() * 40000 + 10000)
  , server = http.createServer(function(req,res){
      var stream = fs.createReadStream(__dirname+'/fixtures/app-simple.tar.gz')
      stream.pipe(res)
    })

module.exports =
{ 'nexus.install()':
  { before: function(done){server.listen(port,done)}
  , beforeEach: function(){debug('')}
  , after: function(done){server.close();common.cleanup(done)}
  , 'name:"<name>" package:"http://<url>/<path>.tar.gz"': function(done){
      var opts = { package : 'http://localhost:'+port+'/app-simple.tar.gz'
                 , name    : 'gnag' }
      debug('installing',opts.package,'→',opts.name)
      nexus.install(opts, function(err,data){
        debug('installed',opts.package,'→',data)
        assert.equal(null,err)
        assert.equal(data,'gnag')
        nexus.ls({name:'gnag'},function(err,data){
          assert.equal(null,err)
          assert.equal(data.name,'app-simple')
          debug('installing',opts.package,'→',opts.name)
          nexus.install(opts, function(err,data){
            debug('installed',opts.package,'→',data)
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
  , 'name:"<name>", package:"http://<url>/<path>.tar.gz"': function(done){
      var opts = { package : __dirname+'/fixtures/app-error'
                 , name    : 'errorapp' }
      debug('installing',opts.package,'→',opts.name)
      nexus.install(opts, function(err,data){
        debug('installed',opts.package,'→',data)
        assert.equal(null,err)
        assert.equal(data,'errorapp')
        nexus.ls({name:'errorapp'},function(err,data){
          assert.equal(null,err)
          assert.equal(data.name,'app-error')
          done()
        })
      })
    }
  , 'name:null, package:"<local path>"': function(done){
      var opts = { package : __dirname+'/fixtures/app-error' }
      debug('installing',opts.package,'→',opts.name)
      nexus.install(opts, function(err,data){
        debug('installed',opts.package,'→',data)
        assert.equal(null,err)
        assert.equal(data,'app-error@0.0.0')
        nexus.ls({name:'app-error@0.0.0'},function(err,data){
          assert.equal(null,err)
          assert.equal(data.name,'app-error')
          done()
        })
      })
    }
  , 'package:http://<invalid url>': function(done){
      var opts = {package:'http://321-foo-bar-123.com/package.tar.gz'}
      debug('installing',opts.package,'→',opts.name)
      nexus.install(opts, function(err,data){
        assert.equal(err.code,1)
        done()
      })
    }
  }
}

