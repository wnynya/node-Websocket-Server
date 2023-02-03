import WebSocketServer from './websocket-server.mjs';

const echoServer = new WebSocketServer();
echoServer.on('connection', (connection) => {
  console.log('Open: ' + connection.id);
});
echoServer.on('text', (connection, text) => {
  console.log(connection.id + ' -> ' + text);
  connection.send(text);
});
echoServer.on('close', (connection) => {
  console.log('Close: ' + connection.id);
});

export default echoServer;

export { echoServer };
