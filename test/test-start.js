var ME = module.exports.start = {}
var nexus = require('../')
var common = require('./common')
var assert = require('assert')
var path = require('path')
var fs = require('fs')
var http = require('http')

ME.before = function(done){common.cleanup(done)}

/* */

ME['start and stop'] = function(done){
  var n = nexus(common.config)
  var name = 'bla'
  n.install({url:common.appPath,name:name},function(err,data){
    assert.ok(!err)
    assert.equal(data.name,name)
    n.start({name:name},function(err,data){
      assert.ok(!err)
      assert.equal(data.name,name)
      n.stop(data.id,function(err,data){
        assert.ok(!err)
        done()
      })
    })
  })
}

/* */

ME['start error'] = function(done){
  var n = nexus(common.config)
  var name = 'blub'
  n.install({url:common.appPath,name:name},function(err,data){
    assert.ok(!err)
    assert.equal(data.name,name)
    n.start({name:name},function(err,data){ 
      assert.ok(!err)
      assert.equal(data.name,name)
      var id = data.id
      ;(function checkRequest(){
        sendRequest(function(err,d){
          if (err) return setTimeout(checkRequest,200)
          assert.equal(d,id)
          var testHookPath = path.join(common.config.apps,name,'ERRORHOOK')
          ;(function checkHook(){
            fs.exists(testHookPath,function(e){
              if (!e) return setTimeout(checkHook,200)
              n.stop(id,function(err,data){
                assert.ok(!err)
                done()
              })
            })
          })()
        })
      })()
      function sendRequest(cb) {
        http.get({host:'localhost',port:8004,path:'/'},function(res){
          assert.equal(res.statusCode,200)
          res.setEncoding('utf8')
          res.on('data', function(d){cb(null,d)})
        }).on('error', cb)
      }
    })
  })
}

/* */
