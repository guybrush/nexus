var path = require('path')
var rimraf = require('rimraf')
var cp = require('child_process')
var http = require('http')

var configPath = path.join(__dirname,'config.js')
var config = require(configPath)
var tmpPath = path.join(__dirname,'..','tmp')
var appPath = path.join(__dirname,'..','tmp','app')

module.exports =
{ scenario: scenario
, plan: plan
, cleanup: cleanup
, ee2log: ee2log
, configPath: configPath
, config: config
, tmpPath: tmpPath
, appPath: appPath
, sendRequest: sendRequest
}

function scenario() {}

// test('foo',function(done){var did = plan(2,done);did();did()})
function plan(todo,cb) {
  if (!(this instanceof plan)) return new plan(todo,cb)
  var self = this
  self.todo = todo
  self.did = function(e) {
    if (--self.todo<=0) cb && cb(e)
  }
}

function cleanup(cb) {
  cp.exec('rm -rf '+config.prefix+'/* ^.gitignore',function(err,stdout,stderr){
    cb(err)
  })
}

function ee2log(name){
  return function(){
    debug((name || '☼')+':',this.event,'→',[].slice.call(arguments))
  }
}

function sendRequest(port,cb) {
  http.get({host:'localhost',port:port,path:'/'},function(res){
    if (res.statusCode != 200) return cb(res.statusCode)
    res.setEncoding('utf8')
    var data = ''
    res.on('data',function(d){data+=d})
    res.on('end',function(){cb(null,data)})
  }).on('error', cb)
}

