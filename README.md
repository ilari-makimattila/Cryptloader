# Cryptloader #

This is a proof of concept application that takes drag&dropped files,
encrypts them on the client side and uploads crypted file to the server.

Encrypting is done using [http://crypto.stanford.edu/sjcl/](Standford Javascript Crypto Library)
and it actually is not the interesting part of this PoC.

The files are read using HTML5 File API, serialized using JS typed arrays and
moved between server and client using Websockets.

Client side javascript is pure [http://vanilla-js.com/](Vanilla-JS) and
the server is implemented using node.js. It requires just one module,
[https://github.com/Worlize/WebSocket-Node](Websocket-Node) and it can be
installed using the npm.

I have tested the server with nodejs version 0.8.14 and the client side with
Firefox 16.

## File serialization ##

Files are serialized using typed arrays and Int32Array ArrayBufferView.
The file slices are read to the ArrayBuffer, which is then serialized to a
string representing a javascript array of integers. This string is then
encrypted and sent to the server.

Deserialization process creates an array of Int32Arrays and turns them to
one big Blob object. The blob is then read to a data uri and the data uri
is written to href attribute of a anchor tag.

As everyone should imagine, this is fairly big process and has a lot of
overhead. So when you test it out, I suggest not to try it with big files...

## Websocket protocol definition ##

All messages use the same data structure:

```javascript
{"type": "message name", "data": "anything"}
```

_"type"_ is always a string defining the reason of the message. _"data"_
is message specific set of data. It can be a string or json object.

### Uploading a file to server ###

Client can initialize the upload by using message type _incomingfile_
where _data_ is an object containing transfer id and number of slices in
the transfer.

```javascript
{"type": "incomingfile", "data": {"id":"randomly-generated-id","slices".3}}
```

Server responds with message type _readyfortransfer_ with data containing
the id and next number of file slice.

```javascript
{"type": "readyfortransfer", "data": {"id":"randomly-generated-id","slice":0}}
```

Client can then send the requested slice using type _fileslice_ with data
containing transfer id, slice number and data.

```javascript
{
    "type": "fileslice",
    "data": {"id": "randomly-generated-id", "slice": 0, "data": "foobar"}}
```

Server will response with either type _readyfortransfer_ or _transfercompleted_
if all slices are received. The _transfercompleted_ data will contain the id
and an filename which can be used to retrieve the file from server.

```javascript
{
    "type": "transfercompleted",
    "data": {
        "filename": "name-on-server",
        "id": "randomly-generated-id"
    }
}
```

Using the _filename_ from the _transfercompleted_ message, client can now
receive the file from the server by sending a message type _get_ with
data containing only the filename.

```javascript
{"type":"get","data","name-on-server"}
```

Server will respond with message type _incomingfile_ with data containing
the id, which is the filename and number of slices in the file.

```javascript
{"type":"incomingfile","data":{"id":"name-on-server","slices":3}}
```

Client can then request the slices with message type _getslice_ with data
containing id and slice number.

```javascript
{"type": "getslice", "data": {"id": "name-on-server", "slice": 0}}
```

Server will send the requested part of the file with message type _fileslice_
containing the id, slice number and file data.

```javascript
{
    "type": "fileslice",
    "data": {"id": "name-on-server", "slice": 0, "data": "foobar"}
}
```

Client can continue to ask slices using the message type _getslice_, until
all slices are received.

## License ##

The code is licensed under the GNU GPL version 3 or higher.
