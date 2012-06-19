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
  , after: function(done){server.close();common.cleanup(done)}
  , 'name:"<name>" package:"http://<url>/<path>.tar.gz"': function(done){
      var opts = { package : 'http://localhost:'+port+'/app-simple.tar.gz'
                 , name    : 'gnag' }
      debug('installing',opts.package,'→',opts.name)
      nexus.install(opts, function(err,dataA){
        debug('installed',opts.package,'→',dataA)
        assert.ok(!err)
        Object.keys(dataA).forEach(function(x){
          assert.equal(x,'gnag')
          assert.equal(dataA[x].name,'app-simple')
        })
        nexus.ls({name:'gnag'},function(err,dataB){
          assert.ok(!err)
          Object.keys(dataB).forEach(function(x){
            assert.equal(x,'gnag')
            assert.equal(dataB[x].name,'app-simple')
          })
          debug('installing',opts.package,'→',opts.name)
          nexus.install(opts, function(err,dataC){
            debug('installed',opts.package,'→',dataC)
            assert.ok(!err)
            Object.keys(dataC).forEach(function(x){
              assert.equal(x,'gnag_1')
              assert.equal(dataC[x].name,'app-simple')
            })
            nexus.ls({name:'gnag_1'},function(err,dataD){
              assert.ok(!err)
              Object.keys(dataD).forEach(function(x,i){
                assert.equal(x,'gnag_1')
                assert.equal(dataD[x].name,'app-simple')
              })
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
        assert.ok(!err)
        assert.equal(Object.keys(data)[0],'errorapp')
        nexus.ls({name:'errorapp'},function(err,data){
          assert.ok(!err)
          Object.keys(data).forEach(function(x,i){
            assert.equal(x,'errorapp')
            assert.equal(data[x].name,'app-error')
          })
          done()
        })
      })
    }
  , 'name:null, package:"<local path>"': function(done){
      var opts = { package : __dirname+'/fixtures/app-error' }
      debug('installing',opts.package,'→',opts.name)
      nexus.install(opts, function(err,data){
        debug('installed',opts.package,'→',data)
        assert.ok(!err)
        assert.equal(Object.keys(data)[0],'app-error@0.0.0')
        nexus.ls({name:'app-error@0.0.0'},function(err,data){
          assert.ok(!err)
          Object.keys(data).forEach(function(x,i){
            assert.equal(x,'app-error@0.0.0')
            assert.equal(data[x].name,'app-error')
          })
          done()
        })
      })
    }
  , 'package:http://<invalid url>': function(done){
      var opts = {package:'http://321-foo-bar-123.com/package.tar.gz'}
      debug('installing',opts.package,'→',opts.name)
      nexus.install(opts, function(err,data){
        assert.equal(err.code,'ENOTFOUND')
        done()
      })
    }
  }
}

