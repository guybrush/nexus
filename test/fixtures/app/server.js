var idx = process.argv.indexOf('-p')
var port = !!~idx && process.argv[idx+1] ? process.argv[idx+1] : 8004
var http = require('http')

http.createServer(function(req,res){
  res.end(process.env.NEXUS_ID)
  if (req.url!='/favicon.ico') throw(new Error('i crashed hard'))
}).listen(port,function(){
  console.log(':'+port)
})

var i = 0
setInterval(function(){
  i++
  console.log('log',i)
  console.error('error',i)
},1000)
