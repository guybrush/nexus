exports = 
{ port : Math.floor(Math.random() * 40000 + 10000) 
, host : '0.0.0.0'
, key : __dirname+'/agent2-key.pem'
, cert : __dirname+'/agent2-cert.pem'
, prefix : __dirname+'/root'
}