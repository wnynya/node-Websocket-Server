import EventEmitter from 'events';
import Crypto from '@wnynya/crypto';
import { WebSocketServer as WSS } from 'ws';

class WebSocketServer extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = options;
    this.server = new WSS({ noServer: true });
    this.connections = [];
    this.middlewares = [];

    // 쿼리 스트링 parse
    this.use((req, res, next, socket, head) => {
      try {
        req.query = {};
        const url = req.url;
        if (!url) {
          next();
          return;
        }
        let qs = url.split('?')[1];
        if (!qs) {
          next();
          return;
        }
        let q = {};
        let queries = qs.split('&');
        for (const query of queries) {
          const s = query.split('=');
          q[s[0]] = s[1];
        }
        req.query = q;
        next();
      } catch (error) {}
    });

    this.handleUpgrade = async (req, socket, head) => {
      for (const middleware of this.middlewares) {
        await new Promise((resolve) => {
          middleware(req, {}, resolve, socket, head);
        });
      }
      this.upgrade(req, socket, head);
    };

    this.upgrade = (req, socket, head) => {
      this.server.handleUpgrade(req, socket, head, (con) => {
        con.uid = Crypto.uid();
        con.req = req;
        con.client = req.client;
        con.session = req.session;
        con.account = req.account;
        this.addMethods(con);
        this.addEventListener(con);
        this.emit('connection', con);
        this.connections.push(con);
      });
    };
  }

  use(middleware) {
    this.middlewares.push(middleware);
  }

  addEventListener(con) {
    con.addEventListener('open', () => {
      this.emit('open', con);
    });

    con.addEventListener('message', (read) => {
      const text = read.data;
      if (text === 'PING') {
        return;
      }
      try {
        const object = JSON.parse(text);
        this.emit('json', con, object.event, object.data, object.message);
        this.emit('text', con, text);
      } catch (error) {
        this.emit('text', con, text);
      }
    });

    con.addEventListener('close', (code, reason) => {
      const index = this.connections.indexOf(con);
      index > -1 ? this.connections.splice(index, 1) : null;
      this.emit('close', con, code.code, reason);
    });

    con.addEventListener('error', (error) => {
      this.emit('error', error);
    });
  }

  addMethods(connection) {
    connection.init = (data = {}) => {
      connection.send(
        JSON.stringify({ event: 'init', message: 'Initialization', data: data })
      );
    };
    connection.event = (event, data = {}, message = event) => {
      connection.send(
        JSON.stringify({ event: event, message: message, data: data })
      );
    };
    connection.error = (message) => {
      connection.send(
        JSON.stringify({ event: 'error', message: message, data: {} })
      );
    };
  }

  send(id, message) {
    for (var connection of this.connections) {
      if (connection.id == id) {
        connection.send(message);
        break;
      }
    }
  }

  broadcast(message) {
    for (var connection of this.connections) {
      connection.send(message);
    }
  }

  event(event, data = {}, message = event) {
    this.broadcast(
      JSON.stringify({ event: event, message: message, data: data })
    );
  }
}

export default WebSocketServer;
