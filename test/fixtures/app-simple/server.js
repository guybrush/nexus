var port = process.argv[2] || 3001
require('http').createServer(function(req,res){
  console.log('request')
  res.end('hello')
}).listen(port,function(){console.log('listening on :'+port)})
