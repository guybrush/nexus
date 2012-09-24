var ME = module.exports.config = {}
var nexus = require('..')
var common = require('./common')
var assert = require('assert')
var path = require('path')

/* * /
ME['obj'] = function(done) {
  var cfg = { port: 3434
            , key: '/path/to/key'
            , cert: '/path/to/cert' }
  var n = nexus(cfg)
  Object.keys(cfg).forEach(function(x){
    assert.equal(n._config[x], cfg[x])  
  })
  done()
}

ME['string (file)'] = function(done) {
  var cfgPath = path.join(__dirname,'common','config.js')
  var cfg = require(cfgPath)
  var n = nexus(cfgPath)
  Object.keys(cfg).forEach(function(x){
    assert.equal(n._config[x], cfg[x])  
  })
  done()
}

/* */
