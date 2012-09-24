var ME = module.exports.uninstall = {}
var nexus = require('../')
var common = require('./common')
var assert = require('assert')
var path = require('path')
var fs = require('fs')

ME.before = function(done){common.cleanup(done)}

ME['install, ls, uninstall'] = function(done){
  var n = nexus(common.config)
  var name = 'bla'
  n.install({url:common.appPath,name:name},function(err,data){
    assert.ok(!err)
    assert.equal(data.name,name)
    n.ls(function(err,data){
      assert.ok(!err)
      assert.equal(data[0].name,name)
      n.uninstall(name,function(err,data){
        assert.ok(!err)
        assert.equal(data.name,name)
        n.ls(function(err,data){
          assert.ok(!err)
          assert.equal(data.length,0)
          done()
        })
      })
    })
  })
}

ME['install, ls, start, uninstall'] = function(done){
  var n = nexus(common.config)
  var name = 'bla'
  n.install({url:common.appPath,name:name},function(err,data){
    assert.ok(!err)
    assert.equal(data.name,name)
    n.ls(function(err,data){
      assert.ok(!err)
      assert.equal(data[0].name,name)
      n.start({name:name},function(err,data){
        assert.ok(!err)
        var id = data.id
        n.uninstall(name,function(err,data){
          assert.ok(err)
          n.stop(id,function(err,data){
            assert.ok(!err)
            n.uninstall(name,function(err,data){
              assert.ok(!err)
              n.ls(function(err,data){
                assert.ok(!err)
                assert.equal(data.length,0)
                done()
              })
            })  
          })
        })
      })
    })
  })
}