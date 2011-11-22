  //
 // nexus (remote program installation and control)
//

var fs      = require('fs')
  , path    = require('path')
  , fstream = require('fstream')
  , util    = require('util')
  , net     = require('net')
  , spawn   = require('child_process').spawn
  , dnode   = require('dnode')
  , AA      = require('async-array')
  , pf      = require('portfinder')
  , forever = require('forever')
  , rimraf  = require('rimraf') 
  , npm     = require('npm')
  , uuid    = require('node-uuid')
  , _config = config()
  , _pkg    = require('./package.json')

forever.load( { root     : _config.logPath
              , pidPath  : _config.pidPath
              , sockPath : _config.sockPath } )  
  
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
  
  // #TODO get/set config
  
  if (key && value && !cb) cb = value
  if (key && !value && !cb) cb = key
  var currConfig = {}
    , fileConfig = {}
    , fileConfigPath = process.env.HOME+'/.nexus/config.json'

  try { fileConfig = require(fileConfigPath) }
  catch (e) { /* no config.json, so we use hardcoded defaults */ }

  currConfig.prefix  = fileConfig.prefix  || process.env.HOME+'/.nexus'
  currConfig.key     = fileConfig.key     || currConfig.prefix+'/nexus.key'
  currConfig.cert    = fileConfig.cert    || currConfig.prefix+'/nexus.cert'
  currConfig.tmp     = fileConfig.tmp     || currConfig.prefix+'/tmp'
  currConfig.socks   = fileConfig.socks   || currConfig.prefix+'/socks'
  currConfig.apps    = fileConfig.apps    || currConfig.prefix+'/apps'
  currConfig.pids    = fileConfig.pids    || currConfig.prefix+'/pids'
  currConfig.keys    = fileConfig.keys    || currConfig.prefix+'/keys'
  currConfig.logs    = fileConfig.logs    || currConfig.prefix+'/logs'
  currConfig.host    = fileConfig.host    || '127.0.0.1'
  currConfig.port    = fileConfig.port    || 5001
  currConfig.remotes = fileConfig.remotes || { localhost : 
                                               { host : currConfig.host
                                               , port : currConfig.port } }

  var aa = new AA
    ( [ currConfig.socks
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
      // w.on('error',function(err){next(err)})
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
      w.once('end',function(){
        // #TODO maybe delete _config.tmp+'/lib'
        // what if 2 guys install at the same time?
        rimraf(res[0][1],function(err){cb(err, res[0][0])})
      })
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
  var path = _config.apps+'/'+opts
  fs.stat(path,function(err,stat){
    if (err) return cb(opts+' not installed')
    rimraf(_config.apps+'/'+opts,cb)  
  })
}

//------------------------------------------------------------------------------
//                                               link
//------------------------------------------------------------------------------

function link(opts, cb) {
  cb('#TODO')
  // like `npm link`
  // fstream.Writer({type:'Symlink'}).end()
}

//------------------------------------------------------------------------------
//                                               ls
//------------------------------------------------------------------------------

function ls(opts, cb) {
  fs.readdir(_config.apps,cb)
}

//------------------------------------------------------------------------------
//                                               ps
//------------------------------------------------------------------------------
//
// ps({format:true},function(err,data){})
//
function ps(opts, cb) {
  opts = opts || {}
  forever.list(opts.format,cb)
}

//------------------------------------------------------------------------------
//                                               start
//------------------------------------------------------------------------------
//
// start( { command : 'node'             // executable
//        , script  : '/path/to/script'
//        , options : []
//        , max     : 10                 // restart maximal 10 times
//        , env     : {}                 // process.env
//        }
//      , function(err, data) {}
//      )
//
function start(opts, cb) {
  var scriptConfig =
    { sourceDir : '/'
    , command   : opts.command || 'node'
    , options   : opts.options || []
    , forever   : opts.forever || true
    , max       : opts.max     || 10
    , env       : opts.env     || process.env
    , silent    : true
    }         
   
  // #TODO generate script-path - this may need some refactor :D
  
  // nexus start /some/file
  //   script = /some/file 
  // nexus start ./some/file 
  //   script = CWD+'/some/file'
  // nexus start appName/path/to/script
  //   appName is an app
  //     ? script = _config.apps+'/appName/path/to/script'
  //     : script = CWD+'/appName/path/to/script'
  // nexus start appName
  //   appName is an app
  //     ? look for package.json-startScript
  //       ? starScript.split(' ')
  //         ? fs.stat([0])
  //           ? script = [0], options = [>0]
  //           : command = [0], script = [1], options = [>1]
  //         : script = _config.apps+'/appName/'+startScript 
  //       : fs.stat(appName+'/server.js') || fs.stat(appName+'/app.js')
  //         ? script = appName+'/server.js' || appName+'/server.js'
  //         : script = appName // this is most likely an error..
  //     : script CWD+'/'+appName
  
  // handle `nexus start /some/file` and `nexus start ./some/file`
  var script = 
    /^\//.test(opts.script) 
      ? opts.script 
      : /^\.\//.test(opts.script)
        ? process.cwd()+'/'+opts.script.substring(1)
        : null
  
  // handle `nexus start appName/path/to/script`
  if (!script && /\//.test(opts.script)) {
    var maybeApp = opts.script.split('/')[0]
      , isApp = path.existsSync(_config.apps+'/'+maybeApp)
    if (isApp) script = _config.apps+'/'+opts.script
    else script = process.cwd()+'/'+opts.script
  }

  // handle `nexus start appName`
  if (!script) {
    var maybeApp = opts.script.split('/')[0]
    if (path.existsSync(_config.apps+'/'+maybeApp)) {
      // console.log('---- A')
      var appPath = _config.apps+'/'+maybeApp
      var pkg = require(appPath+'/package.json')
      if (pkg.scripts && pkg.scripts.start) {
        // console.log('---- AA')
        var startScript = pkg.scripts.start
        if (/\w/.test(startScript)) {
          // console.log('---- AAA')
          var split = startScript.split(' ')
          var isScript = path.existsSync(appPath+'/'+split[0])
          if (isScript) {
            // console.log('---- AAAA')
            script = appPath+'/'+split[0]
            scriptConfig.options = split.splice(1)
          }
          else {
            // console.log('---- AAAB')
            scriptConfig.command = split[0]
            script = appPath+'/'+split[1]
            options = split.splice(2)
          }
        }
        else {
          // console.log('---- AAB')
          script = appPath+'/'+startScript
        }
      }
      else {
        // console.log('---- AB')
        var serverJsExists = path.existsSync(appPath+'/server.js')
        var appJsExists = path.existsSync(appPath+'/app.js')
        if (serverJsExists) script = appPath+'/server.js'
        else if (appJsExists) script = appPath+'/app.js'
        else script = appPath
      }
    }
  }

  // console.log('------- SCRIPT : '+script)
  
  if (!process.send) {
    var fork = require('child_process').fork
    fork( __dirname+'/bin/cli.js'
        , ['start',script].concat(scriptConfig.options)
        , {env:scriptConfig.env} )
    process.exit(0)  
  }
  var monitor = new forever.Monitor(script, scriptConfig).start()
  monitor.on('start',function(){
    cb(null,script)
    forever.startServer(monitor)
  })
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

function stop(opts, cb) {
  opts = opts || {}
  if (opts.script === undefined) return cb('no script')
  var runner = forever.stop(opts.script)
  runner.on('stop',function(procs){
    // fs.unlinkSync(procs[0].pidFile)
    // fs.unlinkSync(config.pidPath+'/'+procs[0].uid+'.fvr')
    cb && cb(null, opts.script)
  })
  runner.on('error',function(err){
    return cb && cb('cant stop process: '+opts.script)
  })
}

//------------------------------------------------------------------------------
//                                               stopall
//------------------------------------------------------------------------------

function stopall(opts, cb) {
  var runner = forever.stopAll()
  runner.on('stopAll', function (procs) {
    cb && cb(null, procs)
  })
}

//------------------------------------------------------------------------------
//                                               stdin
//------------------------------------------------------------------------------

function stdin(opts, cb) {cb && cb('#TODO')}

//------------------------------------------------------------------------------
//                                               stdout
//------------------------------------------------------------------------------

function stdout(opts, cb) {cb && cb('#TODO')}

//------------------------------------------------------------------------------
//                                               stderr
//------------------------------------------------------------------------------

function stderr(opts, cb) {cb && cb('#TODO')}

//------------------------------------------------------------------------------
//                                               remote
//------------------------------------------------------------------------------

function remote(opts, cb) {
  return cb('#TODO')
  /*************************** /
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
  //***************************/
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

