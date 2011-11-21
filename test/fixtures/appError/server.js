var port = process.argv[2] || 3002
console.log('port',port)
require('http').createServer(function(req,res){
  console.log('request')
  res.end('hello - i will crash now.. see you later! (hopefully)')
  throw(new Error('i crashed hard'))
}).listen(port,function(){console.log('listening on :'+port)})
