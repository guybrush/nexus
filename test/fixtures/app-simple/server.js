var port = process.argv[2] || Math.floor(Math.random() * 40000 + 10000)
require('http').createServer(function(req,res){
  console.log('request')
  res.end('hello')
}).listen(port,function(){
  console.log('listening on :'+port)
})

