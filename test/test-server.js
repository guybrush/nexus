var ME = module.exports.server = {}
var nexus = require('..')                           
var common = require('./common')
var assert = require('assert')
                         
ME['start/stop'] = function(done) {      
  var n = nexus(common.config) 
  n.server({command:'start'},function(err,data){
    assert.ok(!err)
    var c = n.connect({remote:'local',reconnect:500},function(r, conn){
      conn.on('end',done)
      n.stop(data.id,function(err,d){
        assert.ok(!err)
      })
    })                          
  })
}

