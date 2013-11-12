import random
import sys
import json
from flask import Flask, request, Response
from geventwebsocket.handler import WebSocketHandler

app = Flask(__name__)
# TODO: this is not thread-safe
users = {}


def handle_offer(socket, offer):
    '''
    Forwards an offer to a connected peer via its WebSocket connection. The
    peer is chosen at random if not explicitly set.
    '''

    # deny offer if no other peer is connected
    if len(users) <= 1 or (offer["to"] and not users[offer["to"]]):
        print "Denying offer"
        socket.send(
            json.dumps(
                {
                    "type": "signaling-protocol",
                    "to": offer["from"],
                    "from": "signaling-server",
                    "payload": {"type": "denied"}
                }
            )
        )
        return
    if offer["to"] and users[offer["to"]]:
        receiverId = offer["to"]
    else:
        # choose a receiver randomly
        receiverId = random.choice(
            [k for k in users.keys() if k != offer["from"]])
    offer["to"] = receiverId
    receiver = users[receiverId]
    print "Forwarding offer from " + offer["from"] + " to " + receiverId
    receiver.send(json.dumps(offer))


def handle_answer(socket, answer):
    receiver = users[answer["to"]]
    receiver.send(json.dumps(answer))


@app.route("/ws/<username>")
def ws(username):
    socket = request.environ.get("wsgi.websocket")
    if socket is None:
        return Response(status=400)
    users[username] = socket
    while True:
        raw_msg = socket.receive()
        if raw_msg is None:
            print "disconnecting {0}".format(username)
            del users[username]
            return Response()
        message = json.loads(raw_msg)
        print message
        if not message["type"] == "signaling-protocol":
            print "Discarding message because it is not a valid " +\
                "signaling-protocol message"
            return ""
        if message["payload"] and message["payload"]["type"] == "offer":
            handle_offer(socket, message)
        elif message["payload"] and message["payload"]["type"] == "answer":
            handle_answer(socket, message)


if __name__ == '__main__':
    from gevent.pywsgi import WSGIServer
    app.debug = True
    host = len(sys.argv) >= 2 and sys.argv[1] or '0.0.0.0'
    port = len(sys.argv) >= 3 and int(sys.argv[2]) or 5000
    print "Server listening on {0}:{1}".format(host, port)
    server = WSGIServer((host, port), app, handler_class=WebSocketHandler)
    server.serve_forever()
