  //
 // nexus (remote program installation and control)
//

var fs      = require('fs')
  , fstream = require('fstream')
  , util    = require('util')
  , net     = require('net')
  , spawn   = require('child_process').spawn
  , dnode   = require('dnode')
  , AA      = require('async-array')
  , npm     = require('npm')
  , uuid    = require('node-uuid')
  , _config = config()
  , _pkg    = require('./package.json')

//------------------------------------------------------------------------------
//                                               exports
//------------------------------------------------------------------------------

module.exports = exports =
  { version   : _pkg.version
  , config    : config

  , install   : install
  , uninstall : uninstall
  , link      : link

  , ls        : ls
  , ps        : ps

  , start     : start
  , restart   : restart
  , stop      : stop
  , stopall   : stopall

  , stderr    : stderr
  , stdout    : stdout
  , stdin     : stdin

  , server    : server
  , remote    : remote
  }

//------------------------------------------------------------------------------
//                                               version
//------------------------------------------------------------------------------

function version(cb) {cb(null, _version); return _version}

//------------------------------------------------------------------------------
//                                               config
//------------------------------------------------------------------------------
//
// config(function(err,data){})                          // get all config
// config('some key',function(err,data){})               // get 1 config
// config('some key','some value',function(err,data){})  // set config
//
function config(key, value, cb) {
  if (key && value && !cb) cb = value
  if (key && !value && !cb) cb = key
  var currConfig = {}
    , fileConfig = {}
    , fileConfigPath = process.env.HOME+'/.nexus/config.json'

  try { fileConfig = require(fileConfigPath) }
  catch (e) { /* no config.json, so we use hardcoded defaults */ }

  currConfig.prefix  = fileConfig.prefix     || process.env.HOME+'/.nexus'
  currConfig.key     = fileConfig.key        || currConfig.prefix+'/nexus.key'
  currConfig.cert    = fileConfig.cert       || currConfig.prefix+'/nexus.cert'
  currConfig.tmp     = fileConfig.tmp        || currConfig.prefix+'/tmp'
  currConfig.socket  = fileConfig.socket     || currConfig.prefix+'/socket'
  currConfig.apps    = fileConfig.packages   || currConfig.prefix+'/apps'
  currConfig.pids    = fileConfig.pids       || currConfig.prefix+'/pids'
  currConfig.keys    = fileConfig.keys       || currConfig.prefix+'/keys'
  currConfig.logs    = fileConfig.logs       || currConfig.prefix+'/logs'
  currConfig.host    = fileConfig.serverHost || '127.0.0.1'
  currConfig.port    = fileConfig.serverPort || 5001
  currConfig.remotes = fileConfig.remotes    ||
                       { localhost : { host : currConfig.serverHost
                                     , port : currConfig.serverPort } }

  var aa = new AA
    ( [ currConfig.socket
      , currConfig.pids
      , currConfig.keys
      , currConfig.logs
      , currConfig.apps
      , currConfig.tmp
      ] )

  aa.map(function(x, i, next){
    fs.lstat(x, function(err){
      if (!err) return next()
      var w = fstream.Writer({path:x,type:'Directory'})
      w.on('error',function(err){next(err)})
      w.once('end',function(){next()})
      w.end()
    })
  }).done(function(err, data){
    if (err) return cb && cb(err)
    cb && cb(null, currConfig)
  }).exec()

  return currConfig
}

//------------------------------------------------------------------------------
//                                               install
//------------------------------------------------------------------------------
//
// install('same-as-npm',function(err,data){})
//
function install(opts, cb) {
  npm.load({prefix:_config.tmp, global:true, loglevel:'silent'}, function(err){
    if (err) return cb(err)
    npm.commands.install(opts, function(err, res){
      if (err) return cb(err)
      var r = fstream.Reader(res[0][1])
        , w = fstream.Writer( { path:_config.apps+'/'+res[0][0]
                              , type:'Directory' } )
      r.pipe(w)
      w.once('end',function(){cb(null, res[0][0])})
    })
  })
}

//------------------------------------------------------------------------------
//                                               uninstall
//------------------------------------------------------------------------------
//
// uninstall('app-name',function(err,data){})
//
function uninstall(opts, cb) {
  cb('#TODO')
  // npm.load({prefix:_config.prefix, global:true}, function(err){
  //   if (err) return cb(err)
  //   npm.commands.uninstall(opts, cb)
  // })
}

//------------------------------------------------------------------------------
//                                               link
//------------------------------------------------------------------------------

function link(opts, cb) {
  cb('#TODO')
  // npm.load({prefix:_config.prefix}, function(err){
  //   if (err) return cb(err)
  //   console.log('linking',opts,process.cwd())
  //   npm.commands.link(opts, cb)
  // })
}

//------------------------------------------------------------------------------
//                                               ls
//------------------------------------------------------------------------------

function ls(opts, cb) {
  npm.load({prefix:_config.prefix, global:true}, function(err){
    if (err) return cb(err)
    npm.commands.ls(cb)
  })
}

//------------------------------------------------------------------------------
//                                               ps
//------------------------------------------------------------------------------
//
// ps({},function(err,data){})
//
function ps(opts, cb) {
  // * connect to socket
  // * query: who is alive?
}

//------------------------------------------------------------------------------
//                                               start
//------------------------------------------------------------------------------
//
// start( { exec : 'node'              // executable
//        , app  : ''                  // optional
//        , path : '/path/to/script'
//        , args : []
//        , max  : 10                  // restart maximal 10 times
//        , env  : {}                  // process.env
//        }
//      , function(err, data) {}
//      )
//
function start(opts, cb) {
  var script = /^\//.test(opts.script)
    ? opts.script
    : _config.apps+'/'+opts.script+'/server.js'
  console.log('starting '+script,opts)
  var spawn = require('child_process').spawn
  var child = spawn('node',[script].concat(opts.options))
  child.stdout.on('data',function(data){util.print(data)})
  child.stderr.on('data',function(data){util.debug(data)})
  child.once('exit',function(){start(opts)})
}

//------------------------------------------------------------------------------
//                                               restart
//------------------------------------------------------------------------------
//
// restart({},function(err,data){})
//
function restart(opts, cb) {
  if (opt.script === null) return cb('vo nix kommt nix')
  stop({script:opt.script}, function(err, stoppedProc) {
    start( {script:stoppedProc.file,uid:stoppedProc.uid}
         , function(err, startedProc) {
      cb(null, startedProc)
    })
  })
}

//------------------------------------------------------------------------------
//                                               stop
//------------------------------------------------------------------------------

function stop(opts, cb) {cb && cb(null, '#TODO')}

//------------------------------------------------------------------------------
//                                               stopall
//------------------------------------------------------------------------------

function stopall(opts, cb) {cb && cb(null, '#TODO')}

//------------------------------------------------------------------------------
//                                               stdin
//------------------------------------------------------------------------------

function stdin(opts, cb) {cb && cb(null, '#TODO')}

//------------------------------------------------------------------------------
//                                               stdout
//------------------------------------------------------------------------------

function stdout(opts, cb) {cb && cb(null, '#TODO')}

//------------------------------------------------------------------------------
//                                               stderr
//------------------------------------------------------------------------------

function stderr(opts, cb) {cb && cb(null, '#TODO')}

//------------------------------------------------------------------------------
//                                               server
//------------------------------------------------------------------------------
//
// server({host:'localhost',port:5001},function(err,data){})
//
function server(opts, cb) {
  cb && cb(null, '#TODO')
  // var opt  = opt || {}
  //   , port = opt.port || _config.netPort
  //   , host = opt.host || _config.netHost
  // start( { script  : __dirname+'/bin/server.js'
  //        , options : ['-p',port,'-h',host] }
  //      , function(err, proc){
  //   cb && cb(err,proc)
  // })
}

//------------------------------------------------------------------------------
//                                               remote
//------------------------------------------------------------------------------

function remote(opts, cb) {
  var opts = opts || {}
    , remote = (opt.remote && config.remotes[opts.remote])
               ? config.remotes[opts.remote] : false
    , port = opts.port || (remote && remote.port) ? remote.port : config.defaults.tlsPort
    , host = opts.host || (remote && remote.host) ? remote.host : 'localhost'
    , keyFile  = opts.key  || config.defaults.key
    , certFile = opts.cert || config.defaults.cert
    , key = fs.readFileSync(keyFile)
    , cert = fs.readFileSync(certFile)
    , options = {key:key,cert:cert}

  console.log('connecting to '+host+':'+port)
  dnode.connect(host, port, options, function(remote,con) {
    cb(null,remote)
  }).on('error',function(err){cb(err)})
}



/*************************************** /

var keyA  = keyB  = config.defaults.key
  , certA = certB = config.defaults.cert
console.log('trying to connect')
dnode({server:function(cb){cb('hello i am the server')}}).listen
  ( 4444
  , { key  : fs.readFileSync(keyA)
    , cert : fs.readFileSync(certA)
    , ca   : [fs.readFileSync(certB)]
    , requestCert: true
    , rejectUnauthorized: true
    }
  , function(remote){remote.client(function(data){console.log(data)})}
  ).on('ready',function(){
    dnode({client:function(cb){cb('hello i am the client')}}).connect
      ( 4444
      , { key  : fs.readFileSync(keyB)
        , cert : fs.readFileSync(certB)
        }
      , function(remote){remote.server(function(data){console.log(data)})}
      )
  })

/***************************************/

